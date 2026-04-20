<?php
namespace App\Http\Middleware;
use Closure;
use Illuminate\Http\Request;
use Tymon\JWTAuth\Facades\JWTAuth;
use Tymon\JWTAuth\Exceptions\JWTException;

class JwtAuthenticate {
    public function handle(Request $request, Closure $next) {
        try {
            $userFromToken = JWTAuth::parseToken()->authenticate();
            if (!$userFromToken) {
                return response()->json(['error' => 'User not found'], 401);
            }
            // Re-fetch fresh user with role to ensure relationship is available
            $user = \App\Models\User::with('role')->find($userFromToken->getKey());
            if (!$user) {
                return response()->json(['error' => 'User not found'], 401);
            }
            $request->attributes->set('auth_user', $user);
            $request->merge(['auth_user' => $user]);
        } catch (JWTException $e) {
            return response()->json(['error' => 'Token invalid or expired'], 401);
        }
        return $next($request);
    }
}
