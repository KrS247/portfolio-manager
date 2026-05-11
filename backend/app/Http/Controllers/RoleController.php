<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\Role;
use App\Models\User;

class RoleController extends Controller {
    public function index() {
        return response()->json(Role::all());
    }

    public function store(Request $request) {
        $data = $request->validate([
            'name'        => 'required|string|max:100|unique:roles,name',
            'description' => 'nullable|string|max:500',
            'is_admin'    => 'nullable|boolean',
        ]);

        $role = Role::create($data);

        $actor = $request->attributes->get('auth_user');
        Log::info('Role created', [
            'role_id'   => $role->id,
            'role_name' => $role->name,
            'actor_id'  => $actor?->id,
            'actor'     => $actor?->username,
        ]);

        return response()->json($role, 201);
    }

    public function update(Request $request, $id) {
        $role = Role::findOrFail($id);

        $request->validate([
            'name'        => 'sometimes|string|max:100|unique:roles,name,' . $id,
            'description' => 'sometimes|nullable|string|max:500',
            'is_admin'    => 'sometimes|nullable|boolean',
        ]);

        $before = $role->only(['name', 'description', 'is_admin']);
        $role->update($request->only(['name', 'description', 'is_admin']));

        $actor = $request->attributes->get('auth_user');
        Log::info('Role updated', [
            'role_id'  => $role->id,
            'before'   => $before,
            'after'    => $role->only(['name', 'description', 'is_admin']),
            'actor_id' => $actor?->id,
            'actor'    => $actor?->username,
        ]);

        return response()->json($role);
    }

    public function destroy(Request $request, $id) {
        $role = Role::findOrFail($id);

        if ($role->name === 'admin') {
            return response()->json(['error' => 'Cannot delete the admin role'], 400);
        }
        if (User::where('role_id', $id)->exists()) {
            return response()->json(['error' => 'Cannot delete a role that has users assigned'], 400);
        }

        $roleName = $role->name;
        $role->delete();

        $actor = $request->attributes->get('auth_user');
        Log::info('Role deleted', [
            'role_id'   => $id,
            'role_name' => $roleName,
            'actor_id'  => $actor?->id,
            'actor'     => $actor?->username,
        ]);

        return response()->json(['message' => 'Role deleted']);
    }
}
