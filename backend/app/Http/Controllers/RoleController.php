<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Role;
use App\Models\User;

class RoleController extends Controller {
    public function index() {
        return response()->json(Role::all());
    }

    public function store(Request $request) {
        $data = $request->validate([
            'name' => 'required|string|unique:roles,name',
            'description' => 'nullable|string',
            'is_admin' => 'nullable|boolean',
        ]);
        $role = Role::create($data);
        return response()->json($role, 201);
    }

    public function update(Request $request, $id) {
        $role = Role::findOrFail($id);
        $role->update($request->only(['name', 'description', 'is_admin']));
        return response()->json($role);
    }

    public function destroy($id) {
        $role = Role::findOrFail($id);
        if ($role->name === 'admin') {
            return response()->json(['error' => 'Cannot delete the admin role'], 400);
        }
        if (User::where('role_id', $id)->exists()) {
            return response()->json(['error' => 'Cannot delete a role that has users assigned'], 400);
        }
        $role->delete();
        return response()->json(['message' => 'Role deleted']);
    }
}
