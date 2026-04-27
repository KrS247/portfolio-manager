<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\PagePermission;
use App\Models\Page;
use App\Models\Role;

class PermissionController extends Controller {
    public function me(Request $request) {
        $user = $request->attributes->get('auth_user');
        if (!$user) {
            $user = \App\Models\User::with('role')->find(\Tymon\JWTAuth\Facades\JWTAuth::parseToken()->authenticate()->getKey());
        }
        $pages = Page::all();

        // Pre-load company permissions if user belongs to a company
        $companyPerms = null;
        if ($user->company_id) {
            $companyPerms = \App\Models\CompanyPermission::where('company_id', $user->company_id)
                ->get()->keyBy('page_id');
        }

        $permMap = [];
        foreach ($pages as $page) {
            if ($user->role && $user->role->is_admin) {
                $permMap[$page->slug] = 'edit';
            } else {
                $perm  = PagePermission::where('role_id', $user->role_id)
                    ->where('page_id', $page->id)->first();
                $level = $perm ? $perm->access_level : 'none';

                // Apply company restriction: if company is set, only allow pages
                // explicitly granted by company_permissions
                if ($companyPerms !== null && $level !== 'none') {
                    $cp = $companyPerms->get($page->id);
                    if (!$cp || !$cp->can_view) {
                        $level = 'none';
                    }
                }

                $permMap[$page->slug] = $level;
            }
        }

        return response()->json($permMap);
    }

    public function index() {
        $roles = Role::all();
        $pages = Page::all();
        $permissions = PagePermission::all()->keyBy(fn($p) => $p->role_id . '_' . $p->page_id);

        $matrix = [];
        foreach ($roles as $role) {
            $rolePerms = ['role_id' => $role->id, 'role_name' => $role->name, 'is_admin' => (bool)$role->is_admin];
            foreach ($pages as $page) {
                $key = $role->id . '_' . $page->id;
                $rolePerms[$page->slug] = $permissions[$key]?->access_level ?? 'none';
            }
            $matrix[] = $rolePerms;
        }

        return response()->json(['roles' => $roles, 'pages' => $pages, 'matrix' => $matrix]);
    }

    public function update(Request $request) {
        $data = $request->validate(['permissions' => 'required|array']);

        foreach ($data['permissions'] as $perm) {
            PagePermission::updateOrCreate(
                ['role_id' => $perm['role_id'], 'page_id' => $perm['page_id']],
                ['access_level' => $perm['access_level']]
            );
        }

        return response()->json(['message' => 'Permissions updated']);
    }
}
