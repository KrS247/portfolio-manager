<?php

namespace Tests\Feature;

use Tests\DatabaseTestCase;
use Illuminate\Support\Facades\DB;

/**
 * P10 – N+1 query detection in PortfolioController (McLaren)
 * P11 – Unbounded task listing (McLaren)
 *
 * McLaren: The PortfolioController::index fires separate queries per portfolio
 * to count programs, projects and tasks. With 10 portfolios that is 30+ extra
 * queries. We assert the query count stays within a safe threshold.
 *
 * For P11 we document that TaskController::index has no pagination and assert
 * that a large dataset returns ALL rows (confirming the gap is real).
 */
class PerformanceTest extends DatabaseTestCase
{
    // ── P10: Portfolio list query count ───────────────────────────────────────

    /**
     * Create N portfolios with programs/projects/tasks nested inside.
     */
    private function seedPortfolioHierarchy(int $adminId, int $count = 5): void
    {
        for ($i = 0; $i < $count; $i++) {
            $pId = DB::table('portfolios')->insertGetId([
                'company_id' => $this->defaultCompanyId,
                'name'     => "Portfolio {$i}",
                'status'   => 'active',
                'owner_id' => $adminId,
            ]);
            $progId = DB::table('programs')->insertGetId([
                'company_id'   => $this->defaultCompanyId,
                'portfolio_id' => $pId,
                'name'         => "Program {$i}",
                'status'       => 'active',
                'owner_id'     => $adminId,
            ]);
            $projId = DB::table('projects')->insertGetId([
                'company_id' => $this->defaultCompanyId,
                'program_id' => $progId,
                'name'       => "Project {$i}",
                'status'     => 'active',
                'owner_id'   => $adminId,
            ]);
            DB::table('tasks')->insert([
                'company_id'  => $this->defaultCompanyId,
                'title'       => "Task {$i}",
                'status'      => 'in_progress',
                'parent_type' => 'project',
                'parent_id'   => $projId,
                'created_by'  => $adminId,
            ]);
        }
    }

    public function test_portfolio_list_query_count_is_bounded(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);
        $portfolioCount  = 5;
        $this->seedPortfolioHierarchy($admin->id, $portfolioCount);

        $queryCount = 0;
        DB::listen(function () use (&$queryCount) { $queryCount++; });

        $this->getJson('/api/portfolios', $this->authHeader($token))
             ->assertStatus(200);

        // Ideal: O(1) queries. Acceptable: < 10.
        // If this fails, PortfolioController::index has an N+1 problem.
        $this->assertLessThan(
            15,
            $queryCount,
            "PortfolioController::index fired {$queryCount} queries for {$portfolioCount} portfolios. "
            . "Expected < 15. Likely N+1 on program/project/task counts per portfolio."
        );
    }

    public function test_project_list_query_count_is_bounded(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);
        $this->seedPortfolioHierarchy($admin->id, 6); // 6 projects, each with tasks

        $queryCount = 0;
        DB::listen(function () use (&$queryCount) { $queryCount++; });

        $this->getJson('/api/projects', $this->authHeader($token))->assertStatus(200);

        // Aggregates are batched (grouped queries), so count is ~constant.
        // The old per-project N+1 fired ~5 queries/project (30+ for 6 projects).
        $this->assertLessThan(
            15,
            $queryCount,
            "ProjectController::index fired {$queryCount} queries for 6 projects. "
            . "Expected < 15 — likely an N+1 on per-project aggregates."
        );
    }

    public function test_task_list_query_count_is_bounded(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);

        // 15 tasks under ONE project: formatTask must resolve the project/program/
        // portfolio hierarchy once (memoized), not once per task.
        $pId = DB::table('portfolios')->insertGetId(['company_id' => $this->defaultCompanyId, 'name' => 'P', 'status' => 'active', 'owner_id' => $admin->id]);
        $progId = DB::table('programs')->insertGetId(['company_id' => $this->defaultCompanyId, 'portfolio_id' => $pId, 'name' => 'Pr', 'status' => 'active', 'owner_id' => $admin->id]);
        $projId = DB::table('projects')->insertGetId(['company_id' => $this->defaultCompanyId, 'program_id' => $progId, 'name' => 'Proj', 'status' => 'active', 'owner_id' => $admin->id]);
        for ($i = 0; $i < 15; $i++) {
            DB::table('tasks')->insert(['company_id' => $this->defaultCompanyId, 'title' => "T{$i}", 'status' => 'in_progress', 'parent_type' => 'project', 'parent_id' => $projId, 'created_by' => $admin->id]);
        }

        $queryCount = 0;
        DB::listen(function () use (&$queryCount) { $queryCount++; });

        $this->getJson('/api/tasks', $this->authHeader($token))->assertStatus(200);

        // Memoized: ~constant regardless of task count. Un-memoized N+1 would be 30+.
        $this->assertLessThan(
            15,
            $queryCount,
            "TaskController::index fired {$queryCount} queries for 15 tasks in one project. "
            . "Expected < 15 — likely an N+1 in formatTask's hierarchy lookups."
        );
    }

    // ── P11: Unbounded task listing ───────────────────────────────────────────

    /**
     * @group performance-gap
     *
     * This test DOCUMENTS a known gap: TaskController::index has no pagination.
     * With thousands of tasks this will return a huge JSON payload and
     * exhaust PHP memory.
     *
     * The test asserts the current behaviour (all rows returned) so that
     * when pagination is added, this test will guide the new expected shape.
     */
    public function test_task_list_returns_all_tasks_without_pagination(): void
    {
        [$admin, $token] = $this->createUserWithToken(['role' => 'admin']);

        $taskCount = 20;
        for ($i = 0; $i < $taskCount; $i++) {
            DB::table('tasks')->insert([
                'company_id'  => $this->defaultCompanyId,
                'title'       => "Bulk Task {$i}",
                'status'      => 'not_started',
                'parent_type' => 'project',
                'parent_id'   => 1,
                'created_by'  => $admin->id,
            ]);
        }

        $response = $this->getJson('/api/tasks', $this->authHeader($token))
                         ->assertStatus(200);

        $returned = count($response->json());

        // Current behaviour: all 20 tasks returned in one shot.
        // TODO (McLaren P11): add pagination — response should be
        //   { data: [...], meta: { total, per_page, current_page } }
        $this->assertGreaterThanOrEqual($taskCount, $returned,
            'Current behaviour: all tasks returned without pagination. '
            . 'When pagination is implemented, update this test.');
    }
}
