<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password;
use App\Models\User;

/**
 * UserController
 *
 * All routes are behind jwt.auth + authorize:admin.users,* middleware.
 *
 * Security hardening:
 *  - Password complexity enforced on store() and update()
 *  - Audit log entries for create/update/delete admin actions
 *  - password_hash never returned in responses
 *
 * SOC 2: CC6.1, CC6.2, CC6.3, CC7.2
 * ISO 27001: A.5.17, A.5.18, A.8.15
 */
class UserController extends Controller
{
    // ── List all users ────────────────────────────────────────────────────────

    public function index()
    {
        $users = User::with(['role', 'company'])->get()->map(fn ($u) => [
            'id'           => $u->id,
            'username'     => $u->username,
            'email'        => $u->email,
            'role_id'      => $u->role_id,
            'role_name'    => $u->role?->name,
            'is_admin'     => (bool) ($u->role?->is_admin),
            'hourly_rate'  => $u->hourly_rate,
            'team_id'      => $u->team_id,
            'company_id'   => $u->company_id,
            'company_name' => $u->company?->name ?? $u->company,
            'created_at'   => $u->created_at,
            // password_hash is intentionally excluded (ISO A.5.17)
        ]);

        return response()->json($users);
    }

    // ── Show single user ──────────────────────────────────────────────────────

    public function show($id)
    {
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

    // ── Create user (admin-only) ──────────────────────────────────────────────

    public function store(Request $request)
    {
        $data = $request->validate([
            'username'    => 'required|string|unique:users,username',
            'email'       => 'required|email|unique:users,email',
            'password'    => ['required', 'string',
                Password::min(12)->mixedCase()->numbers()->symbols()->uncompromised()
            ],
            'role_id'     => 'nullable|integer',
            'hourly_rate' => 'nullable|numeric',
            'team_id'     => 'nullable|integer',
            'company_id'  => 'nullable|integer|exists:companies,id',
        ]);

        try {
            // password_hash and role_id are not in $fillable — set via direct
            // property assignment to prevent mass-assignment risk. H-9 fix.
            $user = new User;
            $user->username      = $data['username'];
            $user->name          = $data['username'];
            $user->email         = $data['email'];
            $user->password      = '';                                                 // legacy field
            $user->password_hash = password_hash($data['password'], PASSWORD_BCRYPT);
            $user->role_id       = $data['role_id']     ?? null;
            $user->hourly_rate   = $data['hourly_rate'] ?? null;
            $user->team_id       = $data['team_id']     ?? null;
            $user->company_id    = $data['company_id']  ?? null;
            $user->save();
        } catch (\Throwable $e) {
            Log::error('UserController: failed to create user', ['error' => $e->getMessage(), 'ip' => $request->ip()]);
            return response()->json(['message' => 'Failed to create user. Please try again.'], 500);
        }

        $admin = $request->attributes->get('auth_user');
        Log::info('UserController: user created by admin', [
            'ip'          => $request->ip(),
            'admin_id'    => $admin?->id,
            'new_user_id' => $user->id,
            'username'    => $user->username,
            'role_id'     => $user->role_id,
        ]);

        // Return user without sensitive fields
        return response()->json([
            'id'       => $user->id,
            'username' => $user->username,
            'email'    => $user->email,
            'role_id'  => $user->role_id,
        ], 201);
    }

    // ── Update user (admin-only) ──────────────────────────────────────────────

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        // Validate only the fields that may be updated
        $rules = [
            'email'       => 'sometimes|email|unique:users,email,' . $id,
            'role_id'     => 'sometimes|nullable|integer',
            'hourly_rate' => 'sometimes|nullable|numeric',
            'team_id'     => 'sometimes|nullable|integer',
            'company_id'  => 'sometimes|nullable|integer|exists:companies,id',
        ];

        // Password is optional on update but must meet complexity when provided
        if ($request->filled('password')) {
            $rules['password'] = ['required', 'string',
                Password::min(12)->mixedCase()->numbers()->symbols()->uncompromised()
            ];
        }

        $data = $request->validate($rules);

        // role_id and password_hash are not in $fillable; set via direct assignment.
        // All other allowed fields go through fill() normally. H-9 fix.
        $updateData = $request->only(['email', 'hourly_rate', 'team_id', 'company_id']);
        $user->fill($updateData);

        if ($request->has('role_id')) {
            $user->role_id = $data['role_id'];
        }
        if ($request->filled('password')) {
            $user->password_hash = password_hash($data['password'], PASSWORD_BCRYPT);
        }
        $user->save();

        $admin = $request->attributes->get('auth_user');
        Log::info('UserController: user updated by admin', [
            'ip'             => $request->ip(),
            'admin_id'       => $admin?->id,
            'target_user_id' => $id,
            'fields_changed' => array_keys($updateData),
        ]);

        return response()->json([
            'id'       => $user->id,
            'username' => $user->username,
            'email'    => $user->email,
            'role_id'  => $user->role_id,
        ]);
    }

    // ── Delete user (admin-only) ──────────────────────────────────────────────

    public function destroy(Request $request, $id)
    {
        $authUser = $request->attributes->get('auth_user');

        if ((int) $authUser->id === (int) $id) {
            return response()->json(['error' => 'Cannot delete your own account'], 400);
        }

        $target = User::findOrFail($id);
        $target->delete();

        Log::info('UserController: user deleted by admin', [
            'ip'             => $request->ip(),
            'admin_id'       => $authUser?->id,
            'deleted_user_id'=> $id,
        ]);

        return response()->json(['message' => 'User deleted']);
    }
}
