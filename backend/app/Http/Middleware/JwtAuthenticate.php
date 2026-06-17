<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Tymon\JWTAuth\Facades\JWTAuth;
use Tymon\JWTAuth\Exceptions\JWTException;
use App\Models\McpApiKey;

/**
 * JWT authentication middleware.
 *
 * Token resolution order:
 *  1. x-api-key header with pm_mcp_ prefix — MCP server API key auth
 *  2. Authorization: Bearer <token> header (backward-compatible for API clients)
 *  3. HttpOnly cookie 'jwt_token' (preferred for browser clients — XSS safe)
 *
 * SOC 2: CC6.1, CC6.7 | ISO A.8.5
 */
class JwtAuthenticate {
    public function handle(Request $request, Closure $next) {
        // ── 1. MCP API key authentication ────────────────────────────────────
        // The MCP server passes keys via x-api-key header (pm_mcp_ prefix).
        // Keys are stored as SHA-256 hashes — the raw value is never persisted.
        $apiKey = $request->header('x-api-key');
        if ($apiKey && str_starts_with($apiKey, 'pm_mcp_')) {
            $keyHash = hash('sha256', $apiKey);
            $mcpKey  = McpApiKey::with('user.role')
                ->where('key_hash', $keyHash)
                ->where('is_active', true)
                ->first();

            if (! $mcpKey || ! $mcpKey->isValid()) {
                return response()->json(['error' => 'Invalid or expired API key'], 401);
            }

            $mcpKey->update(['last_used_at' => now()]);
            $request->attributes->set('auth_user', $mcpKey->user);
            // CRITICAL: bind the user to the auth guard so TenantScope and
            // BelongsToTenant (which read auth()->user()) resolve the tenant.
            // Without this, MCP requests wrote NULL company_id and read across
            // tenants because auth()->user() was null.
            auth()->setUser($mcpKey->user);
            return $next($request);
        }

        // ── 2 & 3. JWT authentication (Bearer header or HttpOnly cookie) ─────
        // Browser clients authenticate via the HttpOnly jwt_token cookie; API
        // clients via the Authorization: Bearer header. Resolve the cookie token
        // explicitly with setToken() (more robust than injecting a header and
        // relying on parseToken() to re-read it).
        $cookieToken = (!$request->hasHeader('Authorization'))
            ? $request->cookie('jwt_token')
            : null;

        try {
            $userFromToken = $cookieToken
                ? JWTAuth::setToken($cookieToken)->authenticate()
                : JWTAuth::setRequest($request)->parseToken()->authenticate();
            if (!$userFromToken) {
                return response()->json(['error' => 'User not found'], 401);
            }
            $user = \App\Models\User::with('role')->find($userFromToken->getKey());
            if (!$user) {
                return response()->json(['error' => 'User not found'], 401);
            }
            // Store in request attributes, not input bag (audit finding L-1).
            $request->attributes->set('auth_user', $user);
        } catch (JWTException $e) {
            return response()->json(['error' => 'Token invalid or expired'], 401);
        }
        return $next($request);
    }
}
