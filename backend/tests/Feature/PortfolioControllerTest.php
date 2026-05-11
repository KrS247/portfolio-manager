<?php

namespace Tests\Feature;

use Tests\DatabaseTestCase;
use Illuminate\Support\Facades\DB;

/**
 * P8 – Portfolio CRUD coverage (Pentagon + McLaren)
 *
 * Pentagon: auth required, members cannot create/edit/delete.
 * McLaren:  list response contains expected shape; no 500s.
 */
class PortfolioControllerTest extends DatabaseTestCase
{
    private function makePortfolio(int $ownerId): int
    {
        return DB::table('portfolios')->insertGetId([
            'name'       => 'Test Portfolio ' . uniqid(),
            'status'     => 'active',
            'owner_id'   => $ownerId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    // ── Auth guard ────────────────────────────────────────────────────────────

    public function test_list_portfolios_requires_auth(): void
    {
        $this->getJson('/api/portfolios')->assertStatus(401);
    }

    public function test_create_portfolio_requires_auth(): void
    {
        $this->postJson('/api/portfolios', ['name' => 'Hack'])->assertStatus(401);
    }

    // ── Admin / member permissions ────────────────────────────────────────────

    public function test_admin_can_list_portfolios(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);

        $this->getJson('/api/portfolios', $this->authHeader($token))
             ->assertStatus(200)
             ->assertJsonStructure([]);   // empty array is fine; shape check below
    }

    public function test_admin_can_create_portfolio(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);

        $this->postJson('/api/portfolios', [
            'name'   => 'Alpha Portfolio',
            'status' => 'active',
        ], $this->authHeader($token))->assertStatus(201);

        $this->assertDatabaseHas('portfolios', ['name' => 'Alpha Portfolio']);
    }

    public function test_admin_can_update_portfolio(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);
        $id = $this->makePortfolio($admin->id);

        $this->putJson("/api/portfolios/{$id}", [
            'name'   => 'Updated Name',
            'status' => 'on_hold',
        ], $this->authHeader($token))->assertStatus(200);

        $this->assertDatabaseHas('portfolios', ['id' => $id, 'name' => 'Updated Name']);
    }

    public function test_admin_can_delete_portfolio(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);
        $id = $this->makePortfolio($admin->id);

        $this->deleteJson("/api/portfolios/{$id}", [], $this->authHeader($token))
             ->assertStatus(200);

        $this->assertDatabaseMissing('portfolios', ['id' => $id]);
    }

    public function test_member_cannot_create_portfolio(): void
    {
        [$member, $token] = $this->createUserWithToken(['role' => 'member']);

        $this->postJson('/api/portfolios', [
            'name'   => 'Hacker Portfolio',
            'status' => 'active',
        ], $this->authHeader($token))->assertStatus(403);
    }

    public function test_member_cannot_delete_portfolio(): void
    {
        [$admin]          = $this->createUserWithToken(['role' => 'admin']);
        [$member, $token] = $this->createUserWithToken(['role' => 'member']);
        $id               = $this->makePortfolio($admin->id);

        $this->deleteJson("/api/portfolios/{$id}", [], $this->authHeader($token))
             ->assertStatus(403);
    }

    // ── Response shape ────────────────────────────────────────────────────────

    public function test_portfolio_list_returns_expected_fields(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);
        $this->makePortfolio($admin->id);

        $response = $this->getJson('/api/portfolios', $this->authHeader($token))
                         ->assertStatus(200);

        $first = $response->json(0);
        $this->assertArrayHasKey('id',     $first);
        $this->assertArrayHasKey('name',   $first);
        $this->assertArrayHasKey('status', $first);
    }

    public function test_fetching_nonexistent_portfolio_returns_404(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);

        $this->getJson('/api/portfolios/99999', $this->authHeader($token))
             ->assertStatus(404);
    }
}
