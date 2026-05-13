<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;

/**
 * OnboardingController
 *
 * Guides a newly-registered company admin through the initial setup wizard:
 *   1. status          — check whether onboarding is still required
 *   2. updateWorkspace — set the company name
 *   3. inviteUser      — invite a team member
 *   4. loadSampleData  — populate a demo portfolio hierarchy
 *   5. complete        — mark onboarding as done
 *
 * All routes require jwt.auth middleware (applied in routes/api.php).
 * NOTE: use $this->getAuthUser($request) — NOT auth()->user() — to
 * retrieve the authenticated user.  The app's JwtAuthenticate middleware stores
 * the full Eloquent user (with company_id) on the request attributes; calling
 * auth()->user() returns only the bare JWT subject and lacks company_id.
 */
class OnboardingController extends Controller
{
    // ── 1. Status ─────────────────────────────────────────────────────────────

    /**
     * GET /api/onboarding/status
     *
     * Returns whether the authenticated user's company still needs onboarding.
     */
    public function status(Request $request)
    {
        $user    = $this->getAuthUser($request);
        $company = $user ? Company::find($user->company_id) : null;

        $needsOnboarding = $company ? !(bool) $company->onboarding_completed : false;

        return response()->json(['needs_onboarding' => $needsOnboarding]);
    }

    // ── 2. Update workspace name ──────────────────────────────────────────────

    /**
     * POST /api/onboarding/workspace
     *
     * Validates and updates the company's display name.
     */
    public function updateWorkspace(Request $request)
    {
        $data = $request->validate([
            'company_name' => 'required|string|max:255',
        ]);

        $user    = $this->getAuthUser($request);
        $company = Company::find($user->company_id);

        if (!$company) {
            return response()->json(['error' => 'Company not found'], 404);
        }

        $company->update(['name' => $data['company_name']]);

        return response()->json([
            'success'      => true,
            'company_name' => $company->name,
        ]);
    }

    // ── 3. Invite a user ──────────────────────────────────────────────────────

    /**
     * POST /api/onboarding/invite
     *
     * Creates a new user scoped to the current company.
     * The role name (admin|project_manager|member) is resolved to a role_id.
     */
    public function inviteUser(Request $request)
    {
        $data = $request->validate([
            'username'      => 'required|string|max:100|unique:users,username',
            'email'         => 'required|email|unique:users,email',
            'role'          => 'required|in:admin,project_manager,member',
            'temp_password' => 'required|string|min:8',
        ]);

        $authUser = $this->getAuthUser($request);

        $role = Role::where('name', $data['role'])->first();

        $newUser = new User;
        $newUser->username      = $data['username'];
        $newUser->name          = $data['username'];
        $newUser->email         = $data['email'];
        $newUser->password      = '';                                          // legacy field
        $newUser->password_hash = password_hash($data['temp_password'], PASSWORD_BCRYPT);
        $newUser->role_id       = $role?->id;
        $newUser->company_id    = $authUser->company_id;
        $newUser->save();

        return response()->json([
            'success' => true,
            'user'    => [
                'id'        => $newUser->id,
                'username'  => $newUser->username,
                'email'     => $newUser->email,
                'role_name' => $role?->name,
            ],
        ], 201);
    }

    // ── 4a. Sample-data status ────────────────────────────────────────────────

    /**
     * GET /api/onboarding/sample-data
     *
     * Returns whether sample data has already been loaded for this company.
     */
    public function sampleDataStatus(Request $request)
    {
        $user    = $this->getAuthUser($request);
        $company = Company::find($user->company_id);

        $loaded = !is_null($company?->sample_data_portfolio_id);

        return response()->json([
            'loaded'       => $loaded,
            'portfolio_id' => $company?->sample_data_portfolio_id,
        ]);
    }

    // ── 4b. Load sample data ──────────────────────────────────────────────────

    /**
     * POST /api/onboarding/sample-data
     *
     * Inserts a complete demo hierarchy (portfolio → programs → projects → tasks)
     * scoped to the current user's company. Uses DB::table() to bypass model
     * events and avoid BelongsToTenant scope interference during bulk insert.
     * Returns 409 if sample data has already been loaded.
     */
    public function loadSampleData(Request $request)
    {
        $user      = $this->getAuthUser($request);
        $company   = Company::find($user->company_id);
        $companyId = $user->company_id;
        $userId    = $user->id;

        // Prevent double-loading
        if ($company && !is_null($company->sample_data_portfolio_id)) {
            return response()->json(['error' => 'Sample data has already been loaded'], 409);
        }

        $today = now()->format('Y-m-d');
        $now   = now()->toDateTimeString();

        // ── Portfolio ─────────────────────────────────────────────────────────
        $portfolioId = DB::table('portfolios')->insertGetId([
            'company_id'  => $companyId,
            'name'        => 'Digital Transformation 2026',
            'description' => 'Sample portfolio created during onboarding',
            'status'      => 'active',
            'priority'    => 8,
            'owner_id'    => $userId,
            'created_at'  => $now,
            'updated_at'  => $now,
        ]);

        // ── Program: Customer Experience ──────────────────────────────────────
        $programCxId = DB::table('programs')->insertGetId([
            'company_id'   => $companyId,
            'portfolio_id' => $portfolioId,
            'name'         => 'Customer Experience',
            'status'       => 'active',
            'priority'     => 7,
            'owner_id'     => $userId,
            'created_at'   => $now,
            'updated_at'   => $now,
        ]);

        // ── Project: Website Redesign ─────────────────────────────────────────
        $projectWebId = DB::table('projects')->insertGetId([
            'company_id' => $companyId,
            'program_id' => $programCxId,
            'name'       => 'Website Redesign',
            'status'     => 'active',
            'priority'   => 8,
            'owner_id'   => $userId,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->insertTask($companyId, $userId, $projectWebId, 'Design wireframes',     'completed',  100, $today, 3);
        $this->insertTask($companyId, $userId, $projectWebId, 'Build frontend',        'in_progress', 60, $today, 5);
        $this->insertTask($companyId, $userId, $projectWebId, 'API integration',       'open',         0, $today, 4);
        $this->insertTask($companyId, $userId, $projectWebId, 'User testing & launch', 'open',         0, $today, 3);

        // ── Project: Mobile App Launch ────────────────────────────────────────
        $projectMobileId = DB::table('projects')->insertGetId([
            'company_id' => $companyId,
            'program_id' => $programCxId,
            'name'       => 'Mobile App Launch',
            'status'     => 'active',
            'priority'   => 6,
            'owner_id'   => $userId,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->insertTask($companyId, $userId, $projectMobileId, 'Requirements gathering', 'completed',  100, $today, 2);
        $this->insertTask($companyId, $userId, $projectMobileId, 'Development sprint 1',   'in_progress', 35, $today, 10);
        $this->insertTask($companyId, $userId, $projectMobileId, 'QA & release',           'open',         0, $today, 5);

        // ── Program: Infrastructure ───────────────────────────────────────────
        $programInfraId = DB::table('programs')->insertGetId([
            'company_id'   => $companyId,
            'portfolio_id' => $portfolioId,
            'name'         => 'Infrastructure',
            'status'       => 'active',
            'priority'     => 5,
            'owner_id'     => $userId,
            'created_at'   => $now,
            'updated_at'   => $now,
        ]);

        // ── Project: Cloud Migration ──────────────────────────────────────────
        $projectCloudId = DB::table('projects')->insertGetId([
            'company_id' => $companyId,
            'program_id' => $programInfraId,
            'name'       => 'Cloud Migration',
            'status'     => 'active',
            'priority'   => 7,
            'owner_id'   => $userId,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->insertTask($companyId, $userId, $projectCloudId, 'Audit current systems', 'completed',  100, $today, 2);
        $this->insertTask($companyId, $userId, $projectCloudId, 'Design architecture',   'in_progress', 50, $today, 5);
        $this->insertTask($companyId, $userId, $projectCloudId, 'Migrate services',      'open',         0, $today, 8);

        // Record which portfolio belongs to the sample data so we can delete it later
        if ($company) {
            $company->sample_data_portfolio_id = $portfolioId;
            $company->save();
        }

        return response()->json([
            'success'      => true,
            'portfolio_id' => $portfolioId,
            'message'      => 'Sample data loaded',
        ]);
    }

    // ── 4c. Delete sample data ────────────────────────────────────────────────

    /**
     * DELETE /api/onboarding/sample-data
     *
     * Removes the entire sample-data hierarchy (portfolio, programs, projects,
     * tasks, risks, resources, dependencies) and clears the tracking flag.
     */
    public function deleteSampleData(Request $request)
    {
        $user    = $this->getAuthUser($request);
        $company = Company::find($user->company_id);

        if (!$company || is_null($company->sample_data_portfolio_id)) {
            return response()->json(['error' => 'No sample data found'], 404);
        }

        $portfolioId = $company->sample_data_portfolio_id;

        // Collect IDs top-down so we can clean related tables first
        $programIds = DB::table('programs')->where('portfolio_id', $portfolioId)->pluck('id');
        $projectIds = DB::table('projects')->whereIn('program_id', $programIds)->pluck('id');

        // All task IDs across every parent level in this portfolio
        $taskIds = DB::table('tasks')
            ->where(function ($q) use ($portfolioId, $programIds, $projectIds) {
                $q->where(function ($q2) use ($portfolioId) {
                    $q2->where('parent_type', 'portfolio')->where('parent_id', $portfolioId);
                })->orWhere(function ($q2) use ($programIds) {
                    $q2->where('parent_type', 'program')->whereIn('parent_id', $programIds);
                })->orWhere(function ($q2) use ($projectIds) {
                    $q2->where('parent_type', 'project')->whereIn('parent_id', $projectIds);
                });
            })
            ->pluck('id');

        // Delete child records before tasks (no guaranteed FK cascade in SQLite)
        DB::table('risks')->whereIn('task_id', $taskIds)->delete();
        DB::table('task_resources')->whereIn('task_id', $taskIds)->delete();
        DB::table('task_dependencies')
            ->whereIn('task_id', $taskIds)
            ->orWhereIn('depends_on', $taskIds)
            ->delete();

        // Delete the hierarchy bottom-up
        DB::table('tasks')->whereIn('id', $taskIds)->delete();
        DB::table('projects')->whereIn('id', $projectIds)->delete();
        DB::table('programs')->whereIn('id', $programIds)->delete();
        DB::table('portfolios')->where('id', $portfolioId)->delete();

        // Clear the tracking flag
        $company->sample_data_portfolio_id = null;
        $company->save();

        return response()->json(['success' => true, 'message' => 'Sample data deleted']);
    }

    /**
     * Insert a single task row via DB::table() (bypasses BelongsToTenant scope).
     */
    private function insertTask(
        int    $companyId,
        int    $userId,
        int    $projectId,
        string $title,
        string $status,
        int    $percentComplete,
        string $today,
        int    $durationDays
    ): void {
        $dueDate = now()->addDays($durationDays)->format('Y-m-d');
        $now     = now()->toDateTimeString();

        DB::table('tasks')->insert([
            'company_id'       => $companyId,
            'title'            => $title,
            'status'           => $status,
            'percent_complete' => $percentComplete,
            'start_date'       => $today,
            'due_date'         => $dueDate,
            'duration_days'    => $durationDays,
            'parent_type'      => 'project',
            'parent_id'        => $projectId,
            'assigned_to'      => $userId,
            'created_by'       => $userId,
            'created_at'       => $now,
            'updated_at'       => $now,
        ]);
    }

    // ── 5. Complete onboarding ────────────────────────────────────────────────

    /**
     * POST /api/onboarding/complete
     *
     * Marks the user's company as having finished onboarding.
     */
    public function complete(Request $request)
    {
        $user    = $this->getAuthUser($request);
        $company = Company::find($user->company_id);

        if (!$company) {
            return response()->json(['error' => 'Company not found'], 404);
        }

        $company->onboarding_completed = true;
        $company->save();

        return response()->json(['success' => true]);
    }
}
