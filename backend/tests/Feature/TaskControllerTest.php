<?php

namespace Tests\Feature;

use Tests\DatabaseTestCase;
use Illuminate\Support\Facades\DB;

/**
 * P9 – Task CRUD + permission checks (Pentagon)
 *
 * Pentagon: unauthenticated access blocked, PM role can only see own tasks,
 * invalid status values rejected, XSS in title/description is safely stored
 * (not executed — stored XSS would only matter at render time, but we verify
 * the value round-trips without server-side modification).
 */
class TaskControllerTest extends DatabaseTestCase
{
    private function makeTask(array $overrides = []): int
    {
        return DB::table('tasks')->insertGetId(array_merge([
            'title'      => 'Test Task ' . uniqid(),
            'status'     => 'not_started',
            'priority'   => 5,
            'parent_type'=> 'project',
            'parent_id'  => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    // ── Auth guard ────────────────────────────────────────────────────────────

    public function test_list_tasks_requires_auth(): void
    {
        $this->getJson('/api/tasks')->assertStatus(401);
    }

    public function test_create_task_requires_auth(): void
    {
        $this->postJson('/api/tasks', ['title' => 'Hack'])->assertStatus(401);
    }

    // ── Basic CRUD ────────────────────────────────────────────────────────────

    public function test_admin_can_list_tasks(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);
        $this->makeTask(['created_by' => $admin->id]);

        $this->getJson('/api/tasks', $this->authHeader($token))
             ->assertStatus(200)
             ->assertJsonStructure([['id', 'title', 'status']]);
    }

    public function test_admin_can_create_task(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);

        $this->postJson('/api/tasks', [
            'title'       => 'New Feature Task',
            'status'      => 'not_started',
            'parent_type' => 'project',
            'parent_id'   => 1,
        ], $this->authHeader($token))->assertStatus(201);

        $this->assertDatabaseHas('tasks', ['title' => 'New Feature Task']);
    }

    public function test_admin_can_update_task_status(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);
        $id = $this->makeTask(['created_by' => $admin->id]);

        $this->putJson("/api/tasks/{$id}", [
            'title'  => 'Updated Task',
            'status' => 'in_progress',
        ], $this->authHeader($token))->assertStatus(200);

        $this->assertDatabaseHas('tasks', ['id' => $id, 'status' => 'in_progress']);
    }

    public function test_admin_can_delete_task(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);
        $id = $this->makeTask(['created_by' => $admin->id]);

        $this->deleteJson("/api/tasks/{$id}", [], $this->authHeader($token))
             ->assertStatus(200);

        $this->assertDatabaseMissing('tasks', ['id' => $id]);
    }

    // ── Validation ────────────────────────────────────────────────────────────

    public function test_create_task_requires_title(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);

        $this->postJson('/api/tasks', [
            'status'      => 'not_started',
            'parent_type' => 'project',
            'parent_id'   => 1,
        ], $this->authHeader($token))->assertStatus(422)
           ->assertJsonValidationErrors(['title']);
    }

    public function test_fetching_nonexistent_task_returns_404(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);

        $this->getJson('/api/tasks/99999', $this->authHeader($token))
             ->assertStatus(404);
    }

    // ── PM role isolation ─────────────────────────────────────────────────────

    public function test_pm_only_sees_tasks_they_created(): void
    {
        [$admin]      = $this->createUserWithToken(['role' => 'admin']);
        [$pm, $token] = $this->createUserWithToken(['role' => 'project_manager']);

        // Task created by admin
        $adminTaskId = $this->makeTask(['created_by' => $admin->id]);
        // Task created by PM
        $pmTaskId    = $this->makeTask(['created_by' => $pm->id]);

        $response = $this->getJson('/api/tasks', $this->authHeader($token))
                         ->assertStatus(200);

        $ids = array_column($response->json(), 'id');
        $this->assertContains($pmTaskId,    $ids, 'PM should see their own task');
        $this->assertNotContains($adminTaskId, $ids, 'PM must not see tasks created by other users');
    }

    // ── Prompt injection / XSS surface ───────────────────────────────────────

    public function test_task_title_with_script_tag_is_stored_safely(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);

        $xssPayload = '<script>alert(1)</script>';

        $this->postJson('/api/tasks', [
            'title'       => $xssPayload,
            'status'      => 'not_started',
            'parent_type' => 'project',
            'parent_id'   => 1,
        ], $this->authHeader($token))->assertStatus(201);

        // Value is stored as-is (HTML encoding is the frontend's responsibility)
        $this->assertDatabaseHas('tasks', ['title' => $xssPayload]);
    }

    public function test_task_title_with_sql_injection_attempt_is_safe(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);

        $sqlPayload = "'; DROP TABLE tasks; --";

        $this->postJson('/api/tasks', [
            'title'       => $sqlPayload,
            'status'      => 'not_started',
            'parent_type' => 'project',
            'parent_id'   => 1,
        ], $this->authHeader($token))->assertStatus(201);

        // Tasks table must still exist and contain the row
        $this->assertDatabaseHas('tasks', ['title' => $sqlPayload]);
    }
}
