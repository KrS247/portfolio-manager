<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

abstract class Controller
{
    /**
     * Retrieve the authenticated user reliably.
     *
     * Tries request attributes first (set by JwtAuthenticate or Authorize
     * middleware). Falls back to parsing the JWT directly for routes that
     * only have jwt.auth and no authorize middleware (e.g. onboarding routes).
     */
    protected function getAuthUser(Request $request): ?\App\Models\User
    {
        $user = $request->attributes->get('auth_user');

        if ($user instanceof \App\Models\User) {
            return $user;
        }

        try {
            $jwtUser = \Tymon\JWTAuth\Facades\JWTAuth::parseToken()->authenticate();
            if ($jwtUser) {
                $user = \App\Models\User::with('role')->find($jwtUser->getKey());
                if ($user) {
                    // Cache back on request so subsequent calls in the same
                    // request cycle don't have to parse the token again.
                    $request->attributes->set('auth_user', $user);
                }
                return $user;
            }
        } catch (\Exception $e) {
            // Token invalid or expired — return null, caller handles 401
        }

        return null;
    }

    /**
     * Returns true when the authenticated user has the project_manager role.
     */
    protected function isPM(Request $request): bool
    {
        $user = $request->attributes->get('auth_user');

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

    /**
     * Compute the set of entity IDs visible to the current non-admin user.
     *
     * A record is visible when the user:
     *   - owns it (owner_id = user.id / created_by = user.id), OR
     *   - is the Responsible person on a task within it (tasks.assigned_to), OR
     *   - is listed as a Resource on a task within it (task_resources.user_id)
     *
     * Visibility propagates upward: a task makes its project visible, that
     * project makes its program visible, that program makes its portfolio visible.
     *
     * Returns null for admin users (no restriction applies).
     *
     * @return array{userId:int, taskIds:\Illuminate\Support\Collection,
     *               projectIds:\Illuminate\Support\Collection,
     *               programIds:\Illuminate\Support\Collection,
     *               portfolioIds:\Illuminate\Support\Collection}|null
     */
    protected function visibleScope(Request $request): ?array
    {
        $user = $request->attributes->get('auth_user');
        if (!$user) return null;

        // Admin users bypass all visibility restrictions
        if ($user->role && $user->role->is_admin) return null;

        $userId = $user->id;

        // ── 1. Tasks directly involving this user ─────────────────────────────
        // A task is "mine" if I am: the Responsible (assigned_to), the creator,
        // or listed as a Resource (task_resources row).
        $myTasks = \App\Models\Task::where(function ($q) use ($userId) {
                $q->where('assigned_to', $userId)
                  ->orWhere('created_by', $userId)
                  ->orWhereHas('resources', fn($r) => $r->where('user_id', $userId));
            })
            ->select('id', 'parent_type', 'parent_id')
            ->get();

        $taskIds          = $myTasks->pluck('id')->unique()->values();
        $taskProjectIds   = $myTasks->where('parent_type', 'project') ->pluck('parent_id')->unique();
        $taskProgramIds   = $myTasks->where('parent_type', 'program') ->pluck('parent_id')->unique();
        $taskPortfolioIds = $myTasks->where('parent_type', 'portfolio')->pluck('parent_id')->unique();

        // ── 2. Projects: owned OR contain a visible task ──────────────────────
        $ownedProjectIds   = \App\Models\Project::where('owner_id', $userId)->pluck('id');
        $visibleProjectIds = $ownedProjectIds->merge($taskProjectIds)->unique()->values();

        // ── 3. Programs: owned OR contain visible projects OR direct tasks ────
        $programsFromProjects = \App\Models\Project::whereIn('id', $visibleProjectIds)
            ->pluck('program_id')->filter()->unique();
        $ownedProgramIds   = \App\Models\Program::where('owner_id', $userId)->pluck('id');
        $visibleProgramIds = $ownedProgramIds
            ->merge($taskProgramIds)
            ->merge($programsFromProjects)
            ->unique()->values();

        // ── 4. Portfolios: owned OR contain visible programs OR direct tasks ──
        $portfoliosFromPrograms = \App\Models\Program::whereIn('id', $visibleProgramIds)
            ->pluck('portfolio_id')->filter()->unique();
        $ownedPortfolioIds   = \App\Models\Portfolio::where('owner_id', $userId)->pluck('id');
        $visiblePortfolioIds = $ownedPortfolioIds
            ->merge($taskPortfolioIds)
            ->merge($portfoliosFromPrograms)
            ->unique()->values();

        return [
            'userId'       => $userId,
            'taskIds'      => $taskIds,
            'projectIds'   => $visibleProjectIds,
            'programIds'   => $visibleProgramIds,
            'portfolioIds' => $visiblePortfolioIds,
        ];
    }
}
