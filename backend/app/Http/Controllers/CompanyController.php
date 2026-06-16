<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Company;
use App\Models\CompanyPermission;
use App\Models\Page;

class CompanyController extends Controller {

    /**
     * Guard cross-tenant access. A platform super-admin may touch any company;
     * an ordinary tenant admin may only touch their own. Returns a 403 response
     * when the caller is not permitted to act on $id, otherwise null.
     */
    private function denyIfForeignCompany(Request $request, $id): ?\Illuminate\Http\JsonResponse
    {
        if ($this->isSuperAdmin($request)) {
            return null;
        }
        $user = $this->getAuthUser($request);
        if (!$user || (int) $id !== (int) $user->company_id) {
            return response()->json(['error' => 'Forbidden: cross-tenant access denied'], 403);
        }
        return null;
    }

    /** GET /companies — super-admin sees all tenants; a tenant admin sees only their own. */
    public function index(Request $request) {
        $query = Company::withCount('users');

        if (!$this->isSuperAdmin($request)) {
            $user = $this->getAuthUser($request);
            $query->where('id', $user?->company_id);
        }

        return response()->json($query->orderBy('name')->get());
    }

    /** POST /companies — creating new tenants is a platform (super-admin) action only. */
    public function store(Request $request) {
        if (!$this->isSuperAdmin($request)) {
            return response()->json(['error' => 'Forbidden: only a platform super-admin can create companies'], 403);
        }
        $data = $request->validate([
            'name' => 'required|string|max:255|unique:companies,name',
        ]);
        $company = Company::create(['name' => $data['name']]);
        return response()->json($company, 201);
    }

    /** PUT /companies/{id} */
    public function update(Request $request, $id) {
        if ($deny = $this->denyIfForeignCompany($request, $id)) return $deny;
        $company = Company::findOrFail($id);
        $data = $request->validate([
            'name' => 'required|string|max:255|unique:companies,name,' . $id,
        ]);
        $company->update(['name' => $data['name']]);
        return response()->json($company);
    }

    /** DELETE /companies/{id} — deleting a tenant is a platform (super-admin) action only. */
    public function destroy(Request $request, $id) {
        if (!$this->isSuperAdmin($request)) {
            return response()->json(['error' => 'Forbidden: only a platform super-admin can delete companies'], 403);
        }
        Company::findOrFail($id)->delete();
        return response()->json(['message' => 'Company deleted']);
    }

    /** GET /companies/{id}/permissions */
    public function getPermissions(Request $request, $id) {
        if ($deny = $this->denyIfForeignCompany($request, $id)) return $deny;
        Company::findOrFail($id);
        $pages = Page::all();
        $perms = CompanyPermission::where('company_id', $id)->get()->keyBy('page_id');

        $result = $pages->map(function ($page) use ($perms) {
            $p = $perms->get($page->id);
            return [
                'page_id'   => $page->id,
                'page_name' => $page->name,
                'page_slug' => $page->slug,
                'can_view'  => $p ? (bool) $p->can_view : false,
            ];
        });

        return response()->json($result->values());
    }

    /** PUT /companies/{id}/permissions */
    public function updatePermissions(Request $request, $id) {
        if ($deny = $this->denyIfForeignCompany($request, $id)) return $deny;
        Company::findOrFail($id);
        $data = $request->validate([
            'permissions'               => 'required|array',
            'permissions.*.page_id'     => 'required|integer|exists:pages,id',
            'permissions.*.can_view'    => 'required|boolean',
        ]);

        foreach ($data['permissions'] as $perm) {
            CompanyPermission::updateOrCreate(
                ['company_id' => $id, 'page_id' => $perm['page_id']],
                ['can_view'   => $perm['can_view'] ? 1 : 0]
            );
        }

        return response()->json(['message' => 'Permissions updated']);
    }
}
