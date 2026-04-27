<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Company;
use App\Models\CompanyPermission;
use App\Models\Page;

class CompanyController extends Controller {

    /** GET /companies */
    public function index() {
        return response()->json(
            Company::withCount('users')->orderBy('name')->get()
        );
    }

    /** POST /companies */
    public function store(Request $request) {
        $data = $request->validate([
            'name' => 'required|string|max:255|unique:companies,name',
        ]);
        $company = Company::create(['name' => $data['name']]);
        return response()->json($company, 201);
    }

    /** PUT /companies/{id} */
    public function update(Request $request, $id) {
        $company = Company::findOrFail($id);
        $data = $request->validate([
            'name' => 'required|string|max:255|unique:companies,name,' . $id,
        ]);
        $company->update(['name' => $data['name']]);
        return response()->json($company);
    }

    /** DELETE /companies/{id} */
    public function destroy($id) {
        Company::findOrFail($id)->delete();
        return response()->json(['message' => 'Company deleted']);
    }

    /** GET /companies/{id}/permissions */
    public function getPermissions($id) {
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
