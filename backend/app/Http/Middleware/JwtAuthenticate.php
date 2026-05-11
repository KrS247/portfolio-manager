<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Tymon\JWTAuth\Facades\JWTAuth;
use Tymon\JWTAuth\Exceptions\JWTException;

/**
 * JWT authentication middleware.
 *
 * Token resolution order (fix for audit finding H-10):
 *  1. Authorization: Bearer <token> header (backward-compatible for API clients)
 *  2. HttpOnly cookie 'jwt_token' (preferred for browser clients — not accessible
 *     to JavaScript, protecting against XSS token theft)
 *
 * The cookie path is intentionally set to '/' so a single Set-Cookie covers all
 * API routes without requiring path-specific configuration.
 *
 * SOC 2: CC6.1, CC6.7 | ISO A.8.5
 */
class JwtAuthenticate {
    public function handle(Request $request, Closure $next) {
        // If no Authorization header is present but the cookie exists, inject it
        // so that JWTAuth can parse it via its normal Bearer-token flow.
        if (!$request->hasHeader('Authorization') && $request->cookie('jwt_token')) {
            $token = $request->cookie('jwt_token');
            $request->headers->set('Authorization', 'Bearer ' . $token);
        }

        try {
            $userFromToken = JWTAuth::setRequest($request)->parseToken()->authenticate();
            if (!$userFromToken) {
                return response()->json(['error' => 'User not found'], 401);
            }
            // Re-fetch fresh user with role to ensure relationship is available
            $user = \App\Models\User::with('role')->find($userFromToken->getKey());
            if (!$user) {
                return response()->json(['error' => 'User not found'], 401);
            }
            // Store the authenticated user only in request attributes, NOT in
            // the request input bag. Merging into input would expose the User
            // model in $request->all(), risking accidental mass-assignment or
            // inclusion in logged request dumps. Fix for audit finding L-1.
            $request->attributes->set('auth_user', $user);
        } catch (JWTException $e) {
            return response()->json(['error' => 'Token invalid or expired'], 401);
        }
        return $next($request);
    }
}
