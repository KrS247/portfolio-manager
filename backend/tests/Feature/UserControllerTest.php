<?php

namespace Tests\Feature;

use Tests\DatabaseTestCase;
use Illuminate\Support\Facades\DB;

/**
 * P7 – UserController authorization (Pentagon)
 *
 * The user-listing endpoint exposes PII (email, hourly_rate, company, role).
 * Unauthenticated requests must be rejected.
 * Non-admin users should not access admin-only operations.
 */
class UserControllerTest extends DatabaseTestCase
{
    // ── Unauthenticated ───────────────────────────────────────────────────────

    public function test_user_list_requires_authentication(): void
    {
        $this->getJson('/api/users')
             ->assertStatus(401);
    }

    public function test_user_show_requires_authentication(): void
    {
        $user = $this->createUser();
        $this->getJson("/api/users/{$user->id}")
             ->assertStatus(401);
    }

    public function test_create_user_requires_authentication(): void
    {
        $this->postJson('/api/users', [
            'username' => 'hacker',
            'email'    => 'hacker@example.com',
            'password' => 'HackPass1!',
        ])->assertStatus(401);
    }

    // ── Authenticated member (non-admin) ──────────────────────────────────────

    public function test_member_cannot_list_all_users(): void
    {
        [$member, $token] = $this->createUserWithToken(['role' => 'member']);

        $response = $this->getJson('/api/users', $this->authHeader($token));

        // Members should get 403 (Forbidden) — not 200
        $response->assertStatus(403);
    }

    public function test_member_cannot_create_user(): void
    {
        [$member, $token] = $this->createUserWithToken(['role' => 'member']);

        $this->postJson('/api/users', [
            'username' => 'newguy',
            'email'    => 'newguy@example.com',
            'password' => 'ValidPass1!',
        ], $this->authHeader($token))->assertStatus(403);
    }

    public function test_member_cannot_delete_user(): void
    {
        [$member, $token] = $this->createUserWithToken(['role' => 'member']);
        $target = $this->createUser();

        $this->deleteJson("/api/users/{$target->id}", [], $this->authHeader($token))
             ->assertStatus(403);
    }

    // ── Authenticated admin ───────────────────────────────────────────────────

    public function test_admin_can_list_users(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);

        $this->getJson('/api/users', $this->authHeader($token))
             ->assertStatus(200)
             ->assertJsonStructure([['id', 'username', 'email']]);
    }

    public function test_admin_can_create_user(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);

        $this->postJson('/api/users', [
            'username' => 'created-by-admin',
            'email'    => 'created@example.com',
            'password' => 'ValidPass12!',   // 12 chars — meets complexity rule
        ], $this->authHeader($token))->assertStatus(201);

        $this->assertDatabaseHas('users', ['username' => 'created-by-admin']);
    }

    // ── Response must not expose password_hash ────────────────────────────────

    public function test_user_list_does_not_expose_password_hash(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);

        $response = $this->getJson('/api/users', $this->authHeader($token))
                         ->assertStatus(200);

        foreach ($response->json() as $userRow) {
            $this->assertArrayNotHasKey('password_hash', $userRow,
                'password_hash must never appear in user list responses');
            $this->assertArrayNotHasKey('password', $userRow,
                'password must never appear in user list responses');
        }
    }
}
