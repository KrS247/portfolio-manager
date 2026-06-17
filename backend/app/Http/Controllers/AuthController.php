<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password;
use App\Models\User;
use App\Models\PasswordResetToken;
use Tymon\JWTAuth\Facades\JWTAuth;
use Tymon\JWTAuth\Exceptions\JWTException;
use Illuminate\Support\Str;

/**
 * AuthController
 *
 * Security hardening applied:
 *  - Rate limiting on login/forgot-password via named throttle in routes/api.php
 *  - Account lockout: 5 failed attempts per IP per 15 minutes → 15-minute block
 *  - Password complexity: min 12 chars, mixed case, numbers, symbols
 *  - Server-side JWT blacklisting on logout
 *  - SHA-256 hashed password-reset tokens (plaintext never stored)
 *  - No token or URL logged (no log leakage)
 *
 * SOC 2: CC6.1, CC6.6, CC6.7
 * ISO 27001: A.5.17, A.8.5
 */
class AuthController extends Controller
{
    // ── Login ─────────────────────────────────────────────────────────────────

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $ip          = $request->ip();
        $lockoutKey  = 'login_lockout:' . $ip;
        $failKey     = 'login_failures:' . $ip;

        // ── Account lockout check ─────────────────────────────────────────────
        if (Cache::has($lockoutKey)) {
            // Fix for audit finding H-2: Cache::getTimeToLive() is not available
            // on all cache drivers (e.g. FileStore) and caused a fatal 500 crash.
            // Return a fixed lockout duration instead of computing remaining time.
            Log::warning('AuthController: login blocked — IP locked out', [
                'ip' => $ip, 'username' => $credentials['username'],
            ]);
            return response()->json([
                'error' => 'Account temporarily locked due to too many failed attempts. '
                         . 'Please try again in 15 minutes.',
            ], 429, ['Retry-After' => 900]);
        }

        $user = User::with(['role', 'company'])->where('username', $credentials['username'])->first();

        if (!$user || !password_verify($credentials['password'], $user->password_hash)) {
            // Increment failure counter; lock IP after 5 failures for 15 minutes
            $failures = Cache::increment($failKey);
            Cache::put($failKey, $failures, now()->addMinutes(15));

            if ($failures >= 5) {
                Cache::put($lockoutKey, true, now()->addMinutes(15));
                Cache::forget($failKey);
                Log::warning('AuthController: IP locked out after repeated failures', [
                    'ip' => $ip, 'username' => $credentials['username'],
                ]);
                return response()->json([
                    'error' => 'Too many failed attempts. Your IP has been locked for 15 minutes.',
                ], 429, ['Retry-After' => 900]);
            }

            Log::info('AuthController: failed login attempt', [
                'ip'       => $ip,
                'username' => $credentials['username'],
                'failures' => $failures,
            ]);
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        // ── Successful login — clear failure counters ─────────────────────────
        Cache::forget($failKey);
        Cache::forget($lockoutKey);

        $token = JWTAuth::fromUser($user);
        $ttlMinutes = (int) config('jwt.ttl', 60); // minutes

        Log::info('AuthController: successful login', [
            'ip'      => $ip,
            'user_id' => $user->id,
            'username'=> $user->username,
        ]);

        // Fix for audit finding H-10: set the JWT in an HttpOnly cookie so it
        // cannot be read by JavaScript (XSS-safe). The token is ALSO returned in
        // the JSON body for backward-compatible API clients (mobile apps, Postman).
        // Browser clients should use cookie-based auth with withCredentials: true
        // and ignore the token in the JSON body.
        // The SPA (Vercel) and API (Railway) are cross-origin, so the cookie must
        // be SameSite=None to be sent — which requires Secure=true. CSRF is then
        // enforced via the HMAC token below (see VerifyCsrfForCookieAuth).
        return response()
            ->json([
                'token'      => $token,                                        // for non-browser/API clients
                'csrf_token' => \App\Http\Middleware\VerifyCsrfForCookieAuth::tokenFor($token),
                'user'  => [
                    'id'                   => $user->id,
                    'username'             => $user->username,
                    'email'                => $user->email,
                    'role_id'              => $user->role_id,
                    'role_name'            => $user->role?->name,
                    'is_admin'             => (bool) ($user->role?->is_admin),
                    'company_id'           => $user->company_id,
                    'onboarding_completed' => (bool) optional($user->company)->onboarding_completed,
                ],
            ])
            ->cookie(
                'jwt_token',                    // name
                $token,                         // value
                $ttlMinutes,                    // minutes until expiry
                '/',                            // path
                null,                           // domain (null = current host)
                true,                           // Secure (required for SameSite=None)
                true,                           // HttpOnly — not accessible to JS
                false,                          // raw (don't URL-encode)
                'None'                          // SameSite — cross-origin SPA; CSRF via HMAC token
            );
    }

    /**
     * GET /api/auth/csrf — returns the CSRF token for the current cookie session.
     * The SPA calls this on bootstrap (it holds the token in memory only) and
     * echoes it in X-XSRF-TOKEN on mutating requests.
     */
    public function csrf(Request $request)
    {
        $jwt = $request->cookie('jwt_token');
        if (!$jwt) {
            return response()->json(['error' => 'No active session'], 401);
        }
        return response()->json([
            'csrf_token' => \App\Http\Middleware\VerifyCsrfForCookieAuth::tokenFor($jwt),
        ]);
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    /**
     * Invalidate the current JWT on the server-side blacklist.
     *
     * SOC 2: CC6.1, CC6.6 | ISO A.8.5
     */
    public function logout(Request $request)
    {
        try {
            JWTAuth::setRequest($request)->parseToken()->invalidate();
            Log::info('AuthController: JWT invalidated on logout', [
                'ip'      => $request->ip(),
                'user_id' => $request->attributes->get('auth_user')?->id,
            ]);
        } catch (JWTException $e) {
            // Token already expired or not present — still treat as successful logout
            Log::info('AuthController: logout called with invalid/expired token', [
                'ip' => $request->ip(),
            ]);
        }

        // Clear the HttpOnly JWT cookie on logout (H-10 fix)
        return response()
            ->json(['message' => 'Logged out successfully.'])
            ->cookie(
                'jwt_token',
                '',         // empty value
                -1,         // expire immediately (negative TTL)
                '/',
                null,
                true,       // Secure
                true,       // HttpOnly
                false,
                'None'      // match the login cookie's SameSite so it clears cross-origin
            );
    }

    // ── Register (admin-provisioned only — public registration removed) ───────

    /**
     * Admin-provisioned user creation.
     * This route is now inside jwt.auth + authorize:admin.users,edit middleware.
     *
     * SOC 2: CC6.2, CC6.3 | ISO A.5.16, A.5.18
     */
    public function register(Request $request)
    {
        $data = $request->validate([
            'username' => 'required|string|unique:users,username',
            'email'    => 'required|email|unique:users,email',
            'password' => ['required', 'string',
                Password::min(12)->mixedCase()->numbers()->symbols()->uncompromised()
            ],
        ]);

        $role = \App\Models\Role::where('name', 'member')->first();

        // password_hash and role_id are intentionally NOT in User::$fillable to
        // prevent mass-assignment exploits. Set them via direct property assignment
        // before save(). Fix for audit finding H-9.
        $user = new User;
        $user->username      = $data['username'];
        $user->name          = $data['username'];
        $user->email         = $data['email'];
        $user->password      = '';                                                    // legacy field
        $user->password_hash = password_hash($data['password'], PASSWORD_BCRYPT);
        $user->role_id       = $role?->id;
        $user->save();

        $admin = $request->attributes->get('auth_user');
        Log::info('AuthController: new user provisioned by admin', [
            'ip'          => $request->ip(),
            'admin_id'    => $admin?->id,
            'new_user_id' => $user->id,
            'username'    => $user->username,
        ]);

        return response()->json(['message' => 'User registered successfully', 'user_id' => $user->id], 201);
    }

    // ── Forgot password ───────────────────────────────────────────────────────

    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['email' => 'required|email']);

        // Always return the same message to prevent user enumeration
        $genericMessage = ['message' => 'If that email exists, a reset link has been sent.'];

        $user = User::where('email', $data['email'])->first();
        if (!$user) {
            return response()->json($genericMessage);
        }

        PasswordResetToken::where('user_id', $user->id)->delete();

        $plainToken  = Str::random(64);
        $hashedToken = hash('sha256', $plainToken);

        PasswordResetToken::create([
            'user_id'    => $user->id,
            'token'      => $hashedToken,
            'expires_at' => now()->addHour()->toDateTimeString(),
        ]);

        // Build the reset URL with the PLAINTEXT token (never log this URL).
        // Link points at the SPA (frontend), not the API host.
        $resetUrl = rtrim(config('app.frontend_url'), '/') . '/reset-password?token=' . $plainToken;

        // Send the reset email. Failures must not break the generic response or
        // leak whether the address exists, so swallow + log (without PII/token).
        try {
            \Illuminate\Support\Facades\Mail::to($user->email)
                ->send(new \App\Mail\PasswordResetMail($resetUrl));
        } catch (\Throwable $e) {
            Log::error('AuthController: password reset email failed to send', [
                'ip'      => $request->ip(),
                'user_id' => $user->id,
                'error'   => $e->getMessage(),
            ]);
        }

        Log::info('AuthController: password reset token issued', [
            'ip'      => $request->ip(),
            'user_id' => $user->id,
            // Do NOT log email, token, or reset URL
        ]);

        return response()->json($genericMessage);
    }

    // ── Reset password ────────────────────────────────────────────────────────

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'token'    => 'required|string|min:1|max:128',
            'password' => ['required', 'string',
                Password::min(12)->mixedCase()->numbers()->symbols()->uncompromised()
            ],
        ]);

        $hashedToken = hash('sha256', $data['token']);

        $resetToken = PasswordResetToken::where('token', $hashedToken)
            ->where('expires_at', '>', now()->toDateTimeString())
            ->first();

        if (!$resetToken) {
            return response()->json(['error' => 'Invalid or expired token'], 400);
        }

        $user = User::find($resetToken->user_id);
        $user->password_hash = password_hash($data['password'], PASSWORD_BCRYPT);
        $user->save();

        $resetToken->delete();

        Log::info('AuthController: password reset completed', [
            'ip'      => $request->ip(),
            'user_id' => $user->id,
        ]);

        return response()->json(['message' => 'Password reset successfully']);
    }
}
