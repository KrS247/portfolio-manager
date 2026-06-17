<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Stateless CSRF protection for cookie-authenticated browser requests.
 *
 * Background: the SPA (Vercel) and API (Railway) are cross-origin, so the JWT
 * cookie must be SameSite=None to be sent — which re-enables CSRF. The classic
 * double-submit *cookie* pattern can't work here because JavaScript on the SPA
 * origin cannot read a cookie scoped to the API origin.
 *
 * Instead we use a signed token the SPA holds in memory:
 *   csrf = HMAC-SHA256(jwt_token_cookie, APP_KEY)
 * The server returns it on login (and GET /auth/csrf) and recomputes it from the
 * cookie on every mutating request, comparing against the X-XSRF-TOKEN header.
 * An attacker can't forge it (no APP_KEY) and can't read it (it's in SPA memory,
 * not a readable cookie).
 *
 * Only enforced when the request authenticates via the cookie. Requests that use
 * an Authorization header (Bearer / MCP x-api-key) are exempt — those credentials
 * are not auto-attached by browsers, so they carry no CSRF risk.
 */
class VerifyCsrfForCookieAuth
{
    public const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

    public static function tokenFor(string $jwt): string
    {
        return hash_hmac('sha256', $jwt, (string) config('app.key'));
    }

    public function handle(Request $request, Closure $next)
    {
        $method = strtoupper($request->method());
        $jwtCookie = $request->cookie('jwt_token');
        $usesCookieAuth = $jwtCookie && !$request->hasHeader('Authorization')
            && !$request->hasHeader('x-api-key');

        if (!in_array($method, self::SAFE_METHODS, true) && $usesCookieAuth) {
            $provided = (string) $request->header('X-XSRF-TOKEN', '');
            $expected = self::tokenFor($jwtCookie);
            if ($provided === '' || !hash_equals($expected, $provided)) {
                return response()->json(['error' => 'CSRF token mismatch or missing.'], 419);
            }
        }

        return $next($request);
    }
}
