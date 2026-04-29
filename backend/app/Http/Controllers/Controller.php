<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

abstract class Controller
{
    /**
     * Returns true when the authenticated user has the project_manager role.
     * Uses the eager-loaded role relationship when available; falls back to a
     * direct DB lookup to avoid silent failures if the relationship was not
     * loaded before the controller runs.
     */
    protected function isPM(Request $request): bool
    {
        // Primary source: set by Authorize middleware (or JwtAuthenticate if active)
        $user = $request->attributes->get('auth_user');

        // Ultimate fallback: ask JWTAuth directly. This covers cases where neither
        // of the auth middlewares wrote the user into request attributes.
        if (!$user || !$user->role_id) {
            try {
                $jwtUser = \Tymon\JWTAuth\Facades\JWTAuth::parseToken()->authenticate();
                if ($jwtUser) {
                    $user = \App\Models\User::with('role')->find($jwtUser->getKey());
                }
            } catch (\Exception $e) {
                return false;
            }
        }

        if (!$user || !$user->role_id) return false;

        $roleName = $user->relationLoaded('role') && $user->role
            ? $user->role->name
            : DB::table('roles')->where('id', $user->role_id)->value('name');

        return $roleName === 'project_manager';
    }
}
