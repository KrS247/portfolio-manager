<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

/**
 * DatabaseTestCase
 *
 * Extends the base Laravel TestCase with a full in-memory SQLite schema
 * that mirrors the production portfolio.db snapshot.
 *
 * The core tables (roles, tasks, portfolios, …) exist only in the snapshot,
 * not in numbered migrations, so we build them here via raw SQL before every
 * test class that needs them.
 *
 * Multi-tenancy: all user-data tables now include a company_id column so the
 * TenantScope global scope does not break queries in test contexts.
 *
 * Usage:
 *   class MyFeatureTest extends \Tests\DatabaseTestCase { … }
 */
abstract class DatabaseTestCase extends BaseTestCase
{
    use \Illuminate\Foundation\Testing\RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildSchema();
        $this->seedBaseData();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Schema
    // ──────────────────────────────────────────────────────────────────────────

    protected function buildSchema(): void
    {
        // The standard migrations (users, cache, jobs, task_comments,
        // activity_logs, …) are handled by RefreshDatabase.
        // We only create the tables that have no migration file.

        DB::statement('PRAGMA foreign_keys = OFF');

        // roles
        DB::statement("
            CREATE TABLE IF NOT EXISTS roles (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL UNIQUE,
                description TEXT,
                is_admin    INTEGER NOT NULL DEFAULT 0
            )
        ");

        // pages
        DB::statement("
            CREATE TABLE IF NOT EXISTS pages (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                slug        TEXT NOT NULL UNIQUE,
                description TEXT
            )
        ");

        // page_permissions
        DB::statement("
            CREATE TABLE IF NOT EXISTS page_permissions (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                role_id      INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                page_id      INTEGER NOT NULL REFERENCES pages(id)  ON DELETE CASCADE,
                access_level TEXT NOT NULL DEFAULT 'none'
            )
        ");

        // company_permissions
        DB::statement("
            CREATE TABLE IF NOT EXISTS company_permissions (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                page_id    INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
                can_view   INTEGER NOT NULL DEFAULT 1
            )
        ");

        // companies — includes tenant management columns for multi-tenancy tests
        DB::statement("
            CREATE TABLE IF NOT EXISTS companies (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                name                 TEXT NOT NULL UNIQUE,
                slug                 TEXT UNIQUE,
                plan                 TEXT NOT NULL DEFAULT 'starter',
                status               TEXT NOT NULL DEFAULT 'active',
                trial_ends_at        DATETIME,
                max_users            INTEGER,
                owner_email          TEXT,
                onboarding_completed INTEGER NOT NULL DEFAULT 0,
                created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // teams
        DB::statement("
            CREATE TABLE IF NOT EXISTS teams (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // company_settings
        DB::statement("
            CREATE TABLE IF NOT EXISTS company_settings (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                company_name TEXT,
                logo_path    TEXT,
                updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // Alter users table to add app-specific columns (username, password_hash, role_id, …)
        // The default migration creates: id, name, email, email_verified_at, password, remember_token, timestamps
        // We add the extra columns that our app actually uses.
        $userCols = DB::select("PRAGMA table_info(users)");
        $existingCols = array_column($userCols, 'name');

        foreach ([
            'username'      => "TEXT",
            'password_hash' => "TEXT",
            'role_id'       => "INTEGER",
            'hourly_rate'   => "REAL",
            'team_id'       => "INTEGER",
            'company_id'    => "INTEGER",
        ] as $col => $type) {
            if (!in_array($col, $existingCols)) {
                DB::statement("ALTER TABLE users ADD COLUMN {$col} {$type}");
            }
        }

        // The default migration creates password_reset_tokens with (email, token, created_at).
        // The app model expects (user_id, token, expires_at, created_at).
        // Drop and recreate with the correct structure.
        DB::statement("DROP TABLE IF EXISTS password_reset_tokens");
        DB::statement("
            CREATE TABLE password_reset_tokens (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token      TEXT NOT NULL UNIQUE,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // portfolios — includes company_id for multi-tenancy
        DB::statement("
            CREATE TABLE IF NOT EXISTS portfolios (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id  INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                name        TEXT NOT NULL,
                description TEXT,
                status      TEXT NOT NULL DEFAULT 'active',
                priority    INTEGER DEFAULT 5,
                start_date  TEXT,
                end_date    TEXT,
                owner_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // programs — includes company_id for multi-tenancy
        DB::statement("
            CREATE TABLE IF NOT EXISTS programs (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id   INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
                name         TEXT NOT NULL,
                description  TEXT,
                status       TEXT NOT NULL DEFAULT 'active',
                priority     INTEGER DEFAULT 5,
                start_date   TEXT,
                end_date     TEXT,
                owner_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // projects — includes company_id for multi-tenancy
        DB::statement("
            CREATE TABLE IF NOT EXISTS projects (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id  INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                program_id  INTEGER REFERENCES programs(id) ON DELETE CASCADE,
                name        TEXT NOT NULL,
                description TEXT,
                status      TEXT NOT NULL DEFAULT 'active',
                priority    INTEGER DEFAULT 5,
                start_date  TEXT,
                end_date    TEXT,
                owner_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
                clickup_id  TEXT,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // tasks — includes company_id for multi-tenancy
        DB::statement("
            CREATE TABLE IF NOT EXISTS tasks (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id           INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                title                TEXT NOT NULL,
                description          TEXT,
                priority             INTEGER DEFAULT 5,
                sequence             INTEGER DEFAULT 0,
                status               TEXT NOT NULL DEFAULT 'not_started',
                due_date             TEXT,
                start_date           TEXT,
                assigned_to          INTEGER REFERENCES users(id) ON DELETE SET NULL,
                parent_type          TEXT,
                parent_id            INTEGER,
                percent_complete     INTEGER DEFAULT 0,
                is_milestone         INTEGER DEFAULT 0,
                parent_task_id       INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
                constraint_type      TEXT,
                constraint_date      TEXT,
                schedule_mode        TEXT DEFAULT 'auto',
                early_start          TEXT,
                early_finish         TEXT,
                late_start           TEXT,
                late_finish          TEXT,
                float_days           INTEGER DEFAULT 0,
                duration_days        INTEGER,
                notes                TEXT,
                created_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
                recurrence_type      TEXT,
                recurrence_interval  INTEGER DEFAULT 1,
                recurrence_end_date  TEXT,
                recurrence_parent_id INTEGER,
                created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // risks — includes company_id for multi-tenancy
        DB::statement("
            CREATE TABLE IF NOT EXISTS risks (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id      INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                task_id         INTEGER UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
                name            TEXT,
                description     TEXT,
                probability     REAL,
                impact          REAL,
                risk_rate       REAL,
                risk_status     TEXT DEFAULT 'open',
                mitigation_plan TEXT,
                status          TEXT DEFAULT 'open',
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // task_dependencies
        DB::statement("
            CREATE TABLE IF NOT EXISTS task_dependencies (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                depends_on      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                lag_days        INTEGER DEFAULT 0,
                dependency_type TEXT DEFAULT 'finish_to_start',
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // task_resources
        DB::statement("
            CREATE TABLE IF NOT EXISTS task_resources (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                allocation_pct  REAL DEFAULT 100,
                estimated_hours REAL DEFAULT 0,
                actual_hours    REAL DEFAULT 0
            )
        ");

        // working_calendar_settings — includes company_id for multi-tenancy
        DB::statement("
            CREATE TABLE IF NOT EXISTS working_calendar_settings (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id    INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                work_days     TEXT DEFAULT '1,2,3,4,5',
                hours_per_day REAL DEFAULT 8,
                timezone      TEXT DEFAULT 'UTC',
                created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // public_holidays — includes company_id for multi-tenancy
        DB::statement("
            CREATE TABLE IF NOT EXISTS public_holidays (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id   INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                holiday_date TEXT NOT NULL,
                name         TEXT NOT NULL,
                recurring    INTEGER DEFAULT 0,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // user_working_calendars
        DB::statement("
            CREATE TABLE IF NOT EXISTS user_working_calendars (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                work_days     TEXT,
                hours_per_day REAL,
                created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // schedule_baselines — includes company_id for multi-tenancy
        DB::statement("
            CREATE TABLE IF NOT EXISTS schedule_baselines (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id  INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                name        TEXT NOT NULL,
                parent_type TEXT,
                parent_id   INTEGER,
                created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // schedule_baseline_tasks
        DB::statement("
            CREATE TABLE IF NOT EXISTS schedule_baseline_tasks (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                baseline_id      INTEGER NOT NULL REFERENCES schedule_baselines(id) ON DELETE CASCADE,
                task_id          INTEGER NOT NULL,
                title            TEXT NOT NULL,
                status           TEXT,
                start_date       TEXT,
                due_date         TEXT,
                duration_days    INTEGER,
                percent_complete INTEGER DEFAULT 0,
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // Add security columns to activity_logs if the table exists and the columns
        // are missing. Guard with table existence check because buildSchema() may
        // run against the production SQLite file which might not have activity_logs.
        $activityLogExists = DB::select(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='activity_logs'"
        );
        if (!empty($activityLogExists)) {
            $alCols     = DB::select("PRAGMA table_info(activity_logs)");
            $alExisting = array_column($alCols, 'name');
            if (!in_array('ip_address', $alExisting)) {
                DB::statement("ALTER TABLE activity_logs ADD COLUMN ip_address TEXT");
            }
            if (!in_array('user_agent', $alExisting)) {
                DB::statement("ALTER TABLE activity_logs ADD COLUMN user_agent TEXT");
            }
        }

        DB::statement('PRAGMA foreign_keys = ON');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Seed baseline data every test needs
    // ──────────────────────────────────────────────────────────────────────────

    protected function seedBaseData(): void
    {
        // Default company (tenant) — all test users belong to this
        DB::table('companies')->insert([
            'name'   => 'Test Company',
            'slug'   => 'test',
            'plan'   => 'starter',
            'status' => 'active',
        ]);
        $companyId = DB::table('companies')->where('slug', 'test')->value('id');

        // Roles
        DB::table('roles')->insert([
            ['name' => 'admin',          'description' => 'Administrator', 'is_admin' => 1],
            ['name' => 'member',         'description' => 'Standard member', 'is_admin' => 0],
            ['name' => 'project_manager','description' => 'Project Manager', 'is_admin' => 0],
        ]);

        // Pages that match the permission slugs used in middleware
        $pages = [
            'dashboard','portfolios','programs','projects','tasks',
            'reports','capacity','risks','calendar',
            'admin.users','admin.roles',
            'admin.permissions','admin.dashboard','admin.teams',
            'admin.company','admin.companies',
        ];
        foreach ($pages as $slug) {
            DB::table('pages')->insert(['name' => ucfirst($slug), 'slug' => $slug]);
        }

        // Grant admin role full access to every page
        $adminRoleId = DB::table('roles')->where('name', 'admin')->value('id');
        foreach (DB::table('pages')->get() as $page) {
            DB::table('page_permissions')->insert([
                'role_id'      => $adminRoleId,
                'page_id'      => $page->id,
                'access_level' => 'edit',
            ]);
        }

        // Grant project_manager role edit access to non-admin pages
        $pmRoleId    = DB::table('roles')->where('name', 'project_manager')->value('id');
        $pmEditSlugs = ['dashboard', 'portfolios', 'programs', 'projects', 'tasks',
                        'reports', 'capacity', 'risks', 'calendar'];
        foreach (DB::table('pages')->get() as $page) {
            DB::table('page_permissions')->insert([
                'role_id'      => $pmRoleId,
                'page_id'      => $page->id,
                'access_level' => in_array($page->slug, $pmEditSlugs) ? 'edit' : 'none',
            ]);
        }

        // Expose companyId to subclasses that need to seed tenant-specific data
        $this->defaultCompanyId = $companyId;
    }

    /** ID of the default test company, available after seedBaseData(). */
    protected int $defaultCompanyId = 1;

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Create a user row directly in the DB and return the model.
     * The UserFactory definition doesn't match the actual schema, so we insert raw.
     * Users are automatically assigned to the default test company.
     */
    protected function createUser(array $overrides = []): \App\Models\User
    {
        $roleId = DB::table('roles')
            ->where('name', $overrides['role'] ?? 'member')
            ->value('id');

        $username = $overrides['username'] ?? ('testuser_' . uniqid());

        $id = DB::table('users')->insertGetId(array_merge([
            'username'      => $username,
            'email'         => 'test_' . uniqid() . '@example.com',
            'password_hash' => password_hash('Password1!', PASSWORD_BCRYPT),
            'role_id'       => $roleId,
            'company_id'    => $this->defaultCompanyId,
            // Default migration requires name / password to be non-null in SQLite
            // (the nullable migration only runs on pgsql/mysql).
            'name'          => $username,
            'password'      => '',
        ], array_filter($overrides, fn($k) => $k !== 'role', ARRAY_FILTER_USE_KEY)));

        return \App\Models\User::with('role')->findOrFail($id);
    }

    /**
     * Create a user and return a JWT token for use in Authorization headers.
     */
    protected function createUserWithToken(array $overrides = []): array
    {
        $user  = $this->createUser($overrides);
        $token = \Tymon\JWTAuth\Facades\JWTAuth::fromUser($user);
        return [$user, $token];
    }

    /**
     * Return an Authorization header array.
     */
    protected function authHeader(string $token): array
    {
        return ['Authorization' => "Bearer {$token}"];
    }
}
