<?php
namespace App\Http\Middleware;
use Closure;
use Illuminate\Http\Request;
use App\Models\PagePermission;
use App\Models\Page;

class Authorize {
    public function handle(Request $request, Closure $next, string $pageSlug, string $requiredLevel = 'view') {
        $user = $request->attributes->get('auth_user');

        // Fallback: try to get from JWT if not set in attributes
        if (!$user || !($user instanceof \App\Models\User)) {
            try {
                $tokenUser = \Tymon\JWTAuth\Facades\JWTAuth::parseToken()->authenticate();
                if ($tokenUser) {
                    $user = \App\Models\User::with('role')->find($tokenUser->getKey());
                }
            } catch (\Exception $e) {
                return response()->json(['error' => 'Unauthorized'], 401);
            }
        }

        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        // Load role relationship if not already loaded
        if (!$user->relationLoaded('role')) {
            $user->load('role');
        }

        // Admin bypasses all permission checks
        if ($user->role && $user->role->is_admin) {
            return $next($request);
        }

        $levelMap = ['none' => 0, 'view' => 1, 'edit' => 2];
        $required = $levelMap[$requiredLevel] ?? 1;

        $page = Page::where('slug', $pageSlug)->first();
        if (!$page) {
            return response()->json(['error' => 'Page not found'], 404);
        }

        $permission = PagePermission::where('role_id', $user->role_id)
            ->where('page_id', $page->id)
            ->first();

        $userLevel = $permission ? ($levelMap[$permission->access_level] ?? 0) : 0;

        if ($userLevel < $required) {
            return response()->json(['error' => 'Insufficient permissions'], 403);
        }

        // Company-level access restriction (applies after role check passes).
        // Only restrict when the company has at least one permission row configured.
        if ($user->company_id) {
            $companyConfigured = \App\Models\CompanyPermission::where('company_id', $user->company_id)->exists();
            if ($companyConfigured) {
                $companyPerm = \App\Models\CompanyPermission::where('company_id', $user->company_id)
                    ->where('page_id', $page->id)
                    ->first();
                if (!$companyPerm || !$companyPerm->can_view) {
                    return response()->json(['error' => 'Access restricted by company policy'], 403);
                }
            }
        }

        return $next($request);
    }
}
