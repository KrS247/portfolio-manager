<?php

namespace Tests\Feature;

use Tests\DatabaseTestCase;

/**
 * P6 – BackupController security (Pentagon)
 *
 * The /api/backup/database endpoint streams the full SQLite dump.
 * It is now behind jwt.auth + authorize:admin.dashboard,edit + throttle:backup.
 * Tests therefore authenticate as an admin and verify that the secondary
 * X-Backup-Token defence-in-depth check is working correctly.
 */
class BackupControllerTest extends DatabaseTestCase
{
    private string $validToken = 'super-secret-backup-token-test';

    protected function setUp(): void
    {
        parent::setUp();
        // Inject the token into config so the controller can read it via config()
        config(['services.backup.token' => $this->validToken]);
    }

    public function test_backup_without_token_header_returns_401(): void
    {
        // Authenticated as admin but no X-Backup-Token — the controller should reject
        [$admin, $adminToken] = $this->createUserWithToken(['role' => 'admin']);

        $this->get('/api/backup/database', $this->authHeader($adminToken))
             ->assertStatus(401)
             ->assertJsonFragment(['error' => 'Unauthorized']);
    }

    public function test_backup_with_wrong_token_returns_401(): void
    {
        [$admin, $adminToken] = $this->createUserWithToken(['role' => 'admin']);

        $this->get('/api/backup/database', array_merge(
            $this->authHeader($adminToken),
            ['X-Backup-Token' => 'wrong-token']
        ))->assertStatus(401);
    }

    public function test_backup_with_empty_token_returns_401(): void
    {
        [$admin, $adminToken] = $this->createUserWithToken(['role' => 'admin']);

        $this->get('/api/backup/database', array_merge(
            $this->authHeader($adminToken),
            ['X-Backup-Token' => '']
        ))->assertStatus(401);
    }

    public function test_backup_with_correct_token_is_not_401(): void
    {
        // We do not assert 200 because the DB file may not exist in test env —
        // but authentication must pass (any non-401 response means auth succeeded)
        [$admin, $adminToken] = $this->createUserWithToken(['role' => 'admin']);

        $response = $this->get('/api/backup/database', array_merge(
            $this->authHeader($adminToken),
            ['X-Backup-Token' => $this->validToken]
        ));

        $this->assertNotEquals(401, $response->getStatusCode(),
            'A valid backup token must pass the auth check');
    }

    public function test_backup_token_is_not_read_via_env_directly(): void
    {
        // Pentagon regression guard: controller must call config(), not env().
        // Simulate a cached-config scenario by temporarily clearing env vars.
        [$admin, $adminToken] = $this->createUserWithToken(['role' => 'admin']);

        $original = getenv('BACKUP_TOKEN');
        putenv('BACKUP_TOKEN=');     // clear the env var (simulates config:cache)

        config(['services.backup.token' => $this->validToken]);

        $response = $this->get('/api/backup/database', array_merge(
            $this->authHeader($adminToken),
            ['X-Backup-Token' => $this->validToken]
        ));

        $this->assertNotEquals(401, $response->getStatusCode(),
            'Backup auth must work via config(), not env() — env() is empty when config is cached');

        // Restore
        putenv("BACKUP_TOKEN={$original}");
    }
}
