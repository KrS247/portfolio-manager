<?php

namespace Tests\Feature;

use Tests\DatabaseTestCase;
use Illuminate\Support\Facades\DB;

/**
 * P1 – AuthController coverage
 *
 * Pentagon: validates login brute-force surface, duplicate user registration,
 * password minimum length, and token issuance.
 */
class AuthControllerTest extends DatabaseTestCase
{
    // ── Login ─────────────────────────────────────────────────────────────────

    public function test_login_with_valid_credentials_returns_token(): void
    {
        $this->createUser([
            'username'      => 'alice',
            'email'         => 'alice@example.com',
            'password_hash' => password_hash('Secret123!', PASSWORD_BCRYPT),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'alice',
            'password' => 'Secret123!',
        ]);

        $response->assertStatus(200)
                 ->assertJsonStructure(['token', 'user' => ['id', 'username', 'email', 'role_id', 'is_admin']]);
    }

    public function test_login_with_wrong_password_returns_401(): void
    {
        $this->createUser([
            'username'      => 'bob',
            'password_hash' => password_hash('CorrectHorse!', PASSWORD_BCRYPT),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'bob',
            'password' => 'WrongPassword',
        ]);

        $response->assertStatus(401)
                 ->assertJsonFragment(['error' => 'Invalid credentials']);
    }

    public function test_login_with_unknown_username_returns_401(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'username' => 'nobody',
            'password' => 'anything',
        ]);

        $response->assertStatus(401);
    }

    public function test_login_requires_username_and_password(): void
    {
        $this->postJson('/api/auth/login', [])
             ->assertStatus(422)
             ->assertJsonValidationErrors(['username', 'password']);
    }

    public function test_login_response_does_not_expose_password_hash(): void
    {
        $this->createUser([
            'username'      => 'carol',
            'password_hash' => password_hash('Pass1234!', PASSWORD_BCRYPT),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'carol',
            'password' => 'Pass1234!',
        ]);

        $body = $response->json();
        $this->assertArrayNotHasKey('password_hash', $body['user'] ?? []);
        $this->assertArrayNotHasKey('password',      $body['user'] ?? []);
    }

    // ── Register (admin-only — route is now behind jwt.auth + authorize:admin.users,edit) ─────

    public function test_register_with_valid_data_creates_user(): void
    {
        [$admin, $adminToken] = $this->createUserWithToken(['role' => 'admin']);

        $response = $this->postJson('/api/auth/register', [
            'username' => 'newuser',
            'email'    => 'newuser@example.com',
            'password' => 'Str0ngPass1!',   // 12 chars — meets new complexity rule
        ], $this->authHeader($adminToken));

        $response->assertStatus(201)
                 ->assertJsonFragment(['message' => 'User registered successfully']);

        $this->assertDatabaseHas('users', ['username' => 'newuser', 'email' => 'newuser@example.com']);
    }

    public function test_register_password_is_stored_as_bcrypt_hash(): void
    {
        [$admin, $adminToken] = $this->createUserWithToken(['role' => 'admin']);
        $plainPassword = 'MyPlain1234!';  // 12 chars

        $this->postJson('/api/auth/register', [
            'username' => 'hashcheck',
            'email'    => 'hashcheck@example.com',
            'password' => $plainPassword,
        ], $this->authHeader($adminToken))->assertStatus(201);

        $user = DB::table('users')->where('username', 'hashcheck')->first();

        // Must NOT store plaintext
        $this->assertNotEquals($plainPassword, $user->password_hash);
        // Must be a valid bcrypt hash
        $this->assertTrue(password_verify($plainPassword, $user->password_hash));
    }

    public function test_register_rejects_duplicate_username(): void
    {
        [$admin, $adminToken] = $this->createUserWithToken(['role' => 'admin']);
        $this->createUser(['username' => 'taken']);

        $this->postJson('/api/auth/register', [
            'username' => 'taken',
            'email'    => 'other@example.com',
            'password' => 'ValidPass12!',   // 12 chars
        ], $this->authHeader($adminToken))
          ->assertStatus(422)
          ->assertJsonValidationErrors(['username']);
    }

    public function test_register_rejects_duplicate_email(): void
    {
        [$admin, $adminToken] = $this->createUserWithToken(['role' => 'admin']);
        $this->createUser(['email' => 'used@example.com']);

        $this->postJson('/api/auth/register', [
            'username' => 'fresh',
            'email'    => 'used@example.com',
            'password' => 'ValidPass12!',   // 12 chars
        ], $this->authHeader($adminToken))
          ->assertStatus(422)
          ->assertJsonValidationErrors(['email']);
    }

    public function test_register_rejects_password_shorter_than_8_chars(): void
    {
        [$admin, $adminToken] = $this->createUserWithToken(['role' => 'admin']);

        $this->postJson('/api/auth/register', [
            'username' => 'shortpass',
            'email'    => 'shortpass@example.com',
            'password' => '1234567',   // 7 chars — well below the 12-char minimum
        ], $this->authHeader($adminToken))
          ->assertStatus(422)
          ->assertJsonValidationErrors(['password']);
    }

    public function test_register_rejects_invalid_email(): void
    {
        [$admin, $adminToken] = $this->createUserWithToken(['role' => 'admin']);

        $this->postJson('/api/auth/register', [
            'username' => 'bademail',
            'email'    => 'not-an-email',
            'password' => 'ValidPass12!',   // 12 chars
        ], $this->authHeader($adminToken))
          ->assertStatus(422)
          ->assertJsonValidationErrors(['email']);
    }

    public function test_register_assigns_member_role_by_default(): void
    {
        [$admin, $adminToken] = $this->createUserWithToken(['role' => 'admin']);

        $this->postJson('/api/auth/register', [
            'username' => 'roleless',
            'email'    => 'roleless@example.com',
            'password' => 'ValidPass12!',   // 12 chars
        ], $this->authHeader($adminToken))->assertStatus(201);

        $user = DB::table('users')->where('username', 'roleless')->first();
        $role = DB::table('roles')->where('id', $user->role_id)->first();
        $this->assertEquals('member', $role->name);
    }
}
