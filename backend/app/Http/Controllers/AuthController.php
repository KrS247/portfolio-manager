<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\PasswordResetToken;
use Illuminate\Support\Facades\Hash;
use Tymon\JWTAuth\Facades\JWTAuth;
use Illuminate\Support\Str;

class AuthController extends Controller {
    public function login(Request $request) {
        $credentials = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::with('role')->where('username', $credentials['username'])->first();

        // Use password_verify directly to support $2b$ bcrypt hashes from Node.js (bcryptjs)
        if (!$user || !password_verify($credentials['password'], $user->password_hash)) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        $token = JWTAuth::fromUser($user);

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'role_id' => $user->role_id,
                'role_name' => $user->role?->name,
                'is_admin' => (bool)($user->role?->is_admin),
            ]
        ]);
    }

    public function register(Request $request) {
        $data = $request->validate([
            'username' => 'required|string|unique:users,username',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
        ]);

        // Get default 'member' role
        $role = \App\Models\Role::where('name', 'member')->first();

        $user = User::create([
            'username' => $data['username'],
            'email' => $data['email'],
            'password_hash' => password_hash($data['password'], PASSWORD_BCRYPT),
            'role_id' => $role?->id,
        ]);

        return response()->json(['message' => 'User registered successfully', 'user_id' => $user->id], 201);
    }

    public function forgotPassword(Request $request) {
        $data = $request->validate(['email' => 'required|email']);

        $user = User::where('email', $data['email'])->first();
        if (!$user) {
            return response()->json(['message' => 'If that email exists, a reset link has been sent.']);
        }

        // Delete existing tokens
        PasswordResetToken::where('user_id', $user->id)->delete();

        $token = Str::random(64);
        PasswordResetToken::create([
            'user_id' => $user->id,
            'token' => $token,
            'expires_at' => now()->addHour()->toDateTimeString(),
        ]);

        $resetUrl = env('APP_URL', 'http://localhost:5173') . '/reset-password?token=' . $token;

        // Log to console in development
        \Log::info("Password reset link for {$user->email}: {$resetUrl}");

        return response()->json(['message' => 'If that email exists, a reset link has been sent.']);
    }

    public function resetPassword(Request $request) {
        $data = $request->validate([
            'token' => 'required|string',
            'password' => 'required|string|min:8',
        ]);

        $resetToken = PasswordResetToken::where('token', $data['token'])
            ->where('expires_at', '>', now()->toDateTimeString())
            ->first();

        if (!$resetToken) {
            return response()->json(['error' => 'Invalid or expired token'], 400);
        }

        $user = User::find($resetToken->user_id);
        $user->password_hash = password_hash($data['password'], PASSWORD_BCRYPT);
        $user->save();

        $resetToken->delete();

        return response()->json(['message' => 'Password reset successfully']);
    }
}
