<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller {
    public function index() {
        $users = User::with(['role', 'company'])->get()->map(function($u) {
            return [
                'id'           => $u->id,
                'username'     => $u->username,
                'email'        => $u->email,
                'role_id'      => $u->role_id,
                'role_name'    => $u->role?->name,
                'is_admin'     => (bool)($u->role?->is_admin),
                'hourly_rate'  => $u->hourly_rate,
                'team_id'      => $u->team_id,
                'company_id'   => $u->company_id,
                'company_name' => $u->company?->name ?? $u->company,
                'created_at'   => $u->created_at,
            ];
        });
        return response()->json($users);
    }

    public function show($id) {
        $user = User::with(['role', 'company'])->findOrFail($id);
        return response()->json([
            'id'           => $user->id,
            'username'     => $user->username,
            'email'        => $user->email,
            'role_id'      => $user->role_id,
            'role_name'    => $user->role?->name,
            'hourly_rate'  => $user->hourly_rate,
            'team_id'      => $user->team_id,
            'company_id'   => $user->company_id,
            'company_name' => $user->company?->name ?? $user->company,
        ]);
    }

    public function store(Request $request) {
        $data = $request->validate([
            'username'   => 'required|string|unique:users,username',
            'email'      => 'required|email|unique:users,email',
            'password'   => 'required|string|min:8',
            'role_id'    => 'nullable|integer',
            'hourly_rate'=> 'nullable|numeric',
            'team_id'    => 'nullable|integer',
            'company_id' => 'nullable|integer|exists:companies,id',
        ]);

        $user = User::create([
            'username'      => $data['username'],
            'email'         => $data['email'],
            'password_hash' => password_hash($data['password'], PASSWORD_BCRYPT),
            'role_id'       => $data['role_id']    ?? null,
            'hourly_rate'   => $data['hourly_rate'] ?? null,
            'team_id'       => $data['team_id']    ?? null,
            'company_id'    => $data['company_id'] ?? null,
        ]);

        return response()->json($user, 201);
    }

    public function update(Request $request, $id) {
        $user = User::findOrFail($id);
        $updateData = $request->only(['email', 'role_id', 'hourly_rate', 'team_id', 'company_id']);

        if ($request->password) {
            $updateData['password_hash'] = password_hash($request->password, PASSWORD_BCRYPT);
        }

        $user->update($updateData);
        return response()->json($user);
    }

    public function destroy(Request $request, $id) {
        $authUser = $request->attributes->get('auth_user') ?? $request->auth_user;
        if ($authUser->id == $id) {
            return response()->json(['error' => 'Cannot delete your own account'], 400);
        }
        User::findOrFail($id)->delete();
        return response()->json(['message' => 'User deleted']);
    }
}
