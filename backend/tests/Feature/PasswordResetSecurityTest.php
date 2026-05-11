<?php

namespace Tests\Feature;

use Tests\DatabaseTestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * P3 – Reset token is never stored as plaintext (Pentagon)
 * P5 – Log::info must not leak the reset URL or token   (Pentagon)
 *
 * Before the fix: the raw 64-char token was stored directly in the DB and the
 * full reset URL (including the token) was written to the Laravel log.
 *
 * After the fix: only hash('sha256', $token) is persisted; the log line is removed.
 */
class PasswordResetSecurityTest extends DatabaseTestCase
{
    private function makeUser(): \App\Models\User
    {
        return $this->createUser([
            'email' => 'reset-target@example.com',
        ]);
    }

    // ── Token storage ─────────────────────────────────────────────────────────

    public function test_reset_token_is_not_stored_as_plaintext_in_db(): void
    {
        $user = $this->makeUser();

        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])
             ->assertStatus(200);

        $record = DB::table('password_reset_tokens')
                    ->where('user_id', $user->id)
                    ->first();

        $this->assertNotNull($record, 'No password reset token row was created');

        // A 64-char Str::random() plaintext token must NOT appear verbatim
        // The stored value must be a SHA-256 hex string (64 hex chars)
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{64}$/',
            $record->token,
            'Token in DB should be a 64-char SHA-256 hex digest, not plaintext'
        );
    }

    public function test_stored_token_is_sha256_of_submitted_token(): void
    {
        // We can't intercept the plaintext token directly through the HTTP layer,
        // but we can verify that submitting a plausible value works end-to-end:
        // create a token row manually with a known hash, then reset with the plaintext.

        $user        = $this->makeUser();
        $plain       = str_repeat('a', 64);
        $hashed      = hash('sha256', $plain);

        DB::table('password_reset_tokens')->insert([
            'user_id'    => $user->id,
            'token'      => $hashed,
            'expires_at' => now()->addHour()->toDateTimeString(),
        ]);

        $this->postJson('/api/auth/reset-password', [
            'token'    => $plain,
            'password' => 'NewPass1234!',
        ])->assertStatus(200)
          ->assertJsonFragment(['message' => 'Password reset successfully']);

        // Token row must be deleted after use
        $this->assertDatabaseMissing('password_reset_tokens', ['user_id' => $user->id]);
    }

    public function test_expired_token_is_rejected(): void
    {
        $user   = $this->makeUser();
        $plain  = str_repeat('b', 64);

        DB::table('password_reset_tokens')->insert([
            'user_id'    => $user->id,
            'token'      => hash('sha256', $plain),
            'expires_at' => now()->subMinute()->toDateTimeString(), // already expired
        ]);

        $this->postJson('/api/auth/reset-password', [
            'token'    => $plain,
            'password' => 'NewPass1234!',
        ])->assertStatus(400)
          ->assertJsonFragment(['error' => 'Invalid or expired token']);
    }

    public function test_unknown_token_is_rejected(): void
    {
        $this->postJson('/api/auth/reset-password', [
            'token'    => str_repeat('z', 64),
            'password' => 'NewPass1234!',
        ])->assertStatus(400);
    }

    // ── Log redaction (P5) ────────────────────────────────────────────────────

    public function test_forgot_password_does_not_log_the_reset_token(): void
    {
        $user    = $this->makeUser();
        $logged  = [];

        // Intercept log calls
        Log::listen(function (\Illuminate\Log\Events\MessageLogged $event) use (&$logged) {
            $logged[] = $event->message;
        });

        $this->postJson('/api/auth/forgot-password', ['email' => $user->email]);

        // Collect any log messages that contain token-related strings
        $leakingMessages = array_filter($logged, fn($msg) =>
            str_contains($msg, 'reset-password') || str_contains($msg, 'token=')
        );

        // Whether or not any messages were logged, none should contain token info
        $this->assertEmpty(
            $leakingMessages,
            "Log must not contain token-related information. Leaking messages:\n"
            . implode("\n", $leakingMessages)
        );
    }

    // ── Forgot password is safe for unknown email (no user enumeration) ───────

    public function test_forgot_password_returns_same_message_for_unknown_email(): void
    {
        $response = $this->postJson('/api/auth/forgot-password', [
            'email' => 'nobody@nowhere.com',
        ]);

        $response->assertStatus(200)
                 ->assertJsonFragment(['message' => 'If that email exists, a reset link has been sent.']);
    }
}
