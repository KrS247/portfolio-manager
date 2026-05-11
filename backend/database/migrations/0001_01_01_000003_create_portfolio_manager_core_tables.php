<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Bootstrap migration: creates all app-specific tables that have no earlier
 * migration file (they were previously hand-built in the SQLite snapshot).
 *
 * This migration must run BEFORE all the 2026_* add-on migrations so that
 * the add-on migrations (which have hasTable/hasColumn guards) can do their
 * ALTER TABLE work cleanly.
 *
 * Multi-tenancy: every user-data table carries a company_id foreign key so
 * that row-level isolation is enforced at the database layer by the Eloquent
 * TenantScope global scope.
 *
 * PostgreSQL-safe: all column types and index syntax use Laravel's Schema
 * builder; no SQLite-specific PRAGMA or INTEGER PRIMARY KEY AUTOINCREMENT.
 */
return new class extends Migration
{
    // ──────────────────────────────────────────────────────────────────────────
    // UP
    // ──────────────────────────────────────────────────────────────────────────

    public function up(): void
    {
        // ── roles ─────────────────────────────────────────────────────────────
        if (!Schema::hasTable('roles')) {
            Schema::create('roles', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->string('description')->nullable();
                $table->boolean('is_admin')->default(false);
            });
        }

        // ── pages ─────────────────────────────────────────────────────────────
        if (!Schema::hasTable('pages')) {
            Schema::create('pages', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('slug')->unique();
                $table->string('description')->nullable();
            });
        }

        // ── companies (tenants) ───────────────────────────────────────────────
        if (!Schema::hasTable('companies')) {
            Schema::create('companies', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                // Tenant management columns
                $table->string('slug')->unique()->nullable()
                      ->comment('URL-safe identifier; used for subdomains in the future');
                $table->enum('plan', ['starter', 'professional', 'enterprise'])
                      ->default('starter');
                $table->enum('status', ['trial', 'active', 'suspended'])
                      ->default('trial');
                $table->timestamp('trial_ends_at')->nullable();
                $table->unsignedInteger('max_users')->nullable()
                      ->comment('NULL = unlimited (enterprise)');
                $table->string('owner_email')->nullable();
                $table->timestamp('created_at')->useCurrent();
            });
        } else {
            // Table already exists — add new tenant columns if missing
            Schema::table('companies', function (Blueprint $table) {
                if (!Schema::hasColumn('companies', 'slug')) {
                    $table->string('slug')->unique()->nullable()->after('name');
                }
                if (!Schema::hasColumn('companies', 'plan')) {
                    $table->enum('plan', ['starter', 'professional', 'enterprise'])
                          ->default('starter')->after('slug');
                }
                if (!Schema::hasColumn('companies', 'status')) {
                    $table->enum('status', ['trial', 'active', 'suspended'])
                          ->default('active')->after('plan');
                }
                if (!Schema::hasColumn('companies', 'trial_ends_at')) {
                    $table->timestamp('trial_ends_at')->nullable()->after('status');
                }
                if (!Schema::hasColumn('companies', 'max_users')) {
                    $table->unsignedInteger('max_users')->nullable()->after('trial_ends_at');
                }
                if (!Schema::hasColumn('companies', 'owner_email')) {
                    $table->string('owner_email')->nullable()->after('max_users');
                }
            });
        }

        // ── teams ─────────────────────────────────────────────────────────────
        if (!Schema::hasTable('teams')) {
            Schema::create('teams', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->timestamp('created_at')->useCurrent();
            });
        }

        // ── company_settings ──────────────────────────────────────────────────
        if (!Schema::hasTable('company_settings')) {
            Schema::create('company_settings', function (Blueprint $table) {
                $table->id();
                $table->string('company_name')->nullable();
                $table->string('logo_path')->nullable();
                $table->timestamp('updated_at')->useCurrent();
            });
        }

        // ── page_permissions ─────────────────────────────────────────────────
        if (!Schema::hasTable('page_permissions')) {
            Schema::create('page_permissions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('role_id')->constrained('roles')->onDelete('cascade');
                $table->foreignId('page_id')->constrained('pages')->onDelete('cascade');
                $table->string('access_level')->default('none');
            });
        }

        // ── company_permissions ───────────────────────────────────────────────
        if (!Schema::hasTable('company_permissions')) {
            Schema::create('company_permissions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id');
                $table->foreignId('page_id')->constrained('pages')->onDelete('cascade');
                $table->boolean('can_view')->default(true);
            });
        }

        // ── Add app-specific columns to users (created by Laravel bootstrap) ─
        // username / password_hash / role_id / hourly_rate / team_id / company_id
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (!Schema::hasColumn('users', 'username')) {
                    $table->string('username')->nullable()->after('id');
                }
                if (!Schema::hasColumn('users', 'password_hash')) {
                    $table->string('password_hash')->nullable()->after('password');
                }
                if (!Schema::hasColumn('users', 'role_id')) {
                    $table->unsignedBigInteger('role_id')->nullable()->after('password_hash');
                }
                if (!Schema::hasColumn('users', 'hourly_rate')) {
                    $table->decimal('hourly_rate', 8, 2)->nullable()->after('role_id');
                }
                if (!Schema::hasColumn('users', 'team_id')) {
                    $table->unsignedBigInteger('team_id')->nullable()->after('hourly_rate');
                }
                if (!Schema::hasColumn('users', 'company_id')) {
                    $table->unsignedBigInteger('company_id')->nullable()->after('team_id');
                }
            });
        }

        // ── Drop and recreate password_reset_tokens with correct app schema ──
        // Laravel bootstrap creates it with (email, token, created_at).
        // The app uses (user_id, token, expires_at, created_at).
        // Only recreate if it still has the legacy schema.
        if (Schema::hasTable('password_reset_tokens') && Schema::hasColumn('password_reset_tokens', 'email')) {
            Schema::drop('password_reset_tokens');
        }
        if (!Schema::hasTable('password_reset_tokens')) {
            Schema::create('password_reset_tokens', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->string('token')->unique();
                $table->timestamp('expires_at');
                $table->timestamp('created_at')->useCurrent();
            });
        }

        // ── working_calendar_settings ─────────────────────────────────────────
        if (!Schema::hasTable('working_calendar_settings')) {
            Schema::create('working_calendar_settings', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id')->nullable()->index();
                $table->string('work_days')->default('1,2,3,4,5');
                $table->decimal('hours_per_day', 4, 2)->default(8.00);
                $table->string('timezone', 64)->default('UTC');
                $table->timestamps();
            });
        } else {
            if (!Schema::hasColumn('working_calendar_settings', 'company_id')) {
                Schema::table('working_calendar_settings', function (Blueprint $table) {
                    $table->unsignedBigInteger('company_id')->nullable()->after('id')->index();
                });
            }
        }

        // ── public_holidays ───────────────────────────────────────────────────
        if (!Schema::hasTable('public_holidays')) {
            Schema::create('public_holidays', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id')->nullable()->index();
                $table->string('holiday_date')->index();
                $table->string('name');
                $table->boolean('recurring')->default(false);
                $table->timestamps();
                // Unique per company + date (was globally unique before)
                $table->unique(['company_id', 'holiday_date']);
            });
        } else {
            if (!Schema::hasColumn('public_holidays', 'company_id')) {
                Schema::table('public_holidays', function (Blueprint $table) {
                    $table->unsignedBigInteger('company_id')->nullable()->after('id')->index();
                });
            }
        }

        // ── user_working_calendars ────────────────────────────────────────────
        if (!Schema::hasTable('user_working_calendars')) {
            Schema::create('user_working_calendars', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->unique()->constrained('users')->onDelete('cascade');
                $table->string('work_days')->nullable();
                $table->decimal('hours_per_day', 4, 2)->nullable();
                $table->timestamps();
            });
        }

        // ── portfolios ────────────────────────────────────────────────────────
        if (!Schema::hasTable('portfolios')) {
            Schema::create('portfolios', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id')->nullable()->index();
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('status')->default('active');
                $table->unsignedInteger('priority')->default(5);
                $table->string('start_date')->nullable();
                $table->string('end_date')->nullable();
                $table->unsignedBigInteger('owner_id')->nullable();
                $table->timestamps();

                $table->foreign('owner_id')->references('id')->on('users')->onDelete('set null');
            });
        } else {
            if (!Schema::hasColumn('portfolios', 'company_id')) {
                Schema::table('portfolios', function (Blueprint $table) {
                    $table->unsignedBigInteger('company_id')->nullable()->after('id')->index();
                });
            }
        }

        // ── programs ──────────────────────────────────────────────────────────
        if (!Schema::hasTable('programs')) {
            Schema::create('programs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id')->nullable()->index();
                $table->unsignedBigInteger('portfolio_id')->nullable();
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('status')->default('active');
                $table->unsignedInteger('priority')->default(5);
                $table->string('start_date')->nullable();
                $table->string('end_date')->nullable();
                $table->unsignedBigInteger('owner_id')->nullable();
                $table->timestamps();

                $table->foreign('portfolio_id')->references('id')->on('portfolios')->onDelete('cascade');
                $table->foreign('owner_id')->references('id')->on('users')->onDelete('set null');
            });
        } else {
            if (!Schema::hasColumn('programs', 'company_id')) {
                Schema::table('programs', function (Blueprint $table) {
                    $table->unsignedBigInteger('company_id')->nullable()->after('id')->index();
                });
            }
        }

        // ── projects ──────────────────────────────────────────────────────────
        if (!Schema::hasTable('projects')) {
            Schema::create('projects', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id')->nullable()->index();
                $table->unsignedBigInteger('program_id')->nullable();
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('status')->default('active');
                $table->unsignedInteger('priority')->default(5);
                $table->string('start_date')->nullable();
                $table->string('end_date')->nullable();
                $table->unsignedBigInteger('owner_id')->nullable();
                $table->string('clickup_id')->nullable();
                $table->timestamps();

                $table->foreign('program_id')->references('id')->on('programs')->onDelete('cascade');
                $table->foreign('owner_id')->references('id')->on('users')->onDelete('set null');
            });
        } else {
            if (!Schema::hasColumn('projects', 'company_id')) {
                Schema::table('projects', function (Blueprint $table) {
                    $table->unsignedBigInteger('company_id')->nullable()->after('id')->index();
                });
            }
        }

        // ── tasks ─────────────────────────────────────────────────────────────
        if (!Schema::hasTable('tasks')) {
            Schema::create('tasks', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id')->nullable()->index();
                $table->string('title');
                $table->text('description')->nullable();
                $table->text('notes')->nullable();
                $table->unsignedInteger('priority')->default(5);
                $table->unsignedInteger('sequence')->default(0);
                $table->string('status')->default('not_started');
                $table->unsignedInteger('percent_complete')->default(0);
                $table->string('due_date')->nullable();
                $table->string('start_date')->nullable();
                $table->boolean('is_milestone')->default(false);
                $table->unsignedBigInteger('assigned_to')->nullable();
                $table->string('parent_type')->nullable();
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->unsignedBigInteger('parent_task_id')->nullable();
                $table->string('constraint_type')->nullable();
                $table->string('constraint_date')->nullable();
                $table->string('schedule_mode')->default('auto');
                $table->string('early_start')->nullable();
                $table->string('early_finish')->nullable();
                $table->string('late_start')->nullable();
                $table->string('late_finish')->nullable();
                $table->integer('float_days')->default(0);
                $table->integer('duration_days')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                // Recurrence
                $table->string('recurrence_type')->nullable();
                $table->unsignedInteger('recurrence_interval')->default(1);
                $table->date('recurrence_end_date')->nullable();
                $table->unsignedBigInteger('recurrence_parent_id')->nullable();
                $table->timestamps();

                $table->foreign('assigned_to')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
                $table->foreign('parent_task_id')->references('id')->on('tasks')->onDelete('set null');
            });
        } else {
            if (!Schema::hasColumn('tasks', 'company_id')) {
                Schema::table('tasks', function (Blueprint $table) {
                    $table->unsignedBigInteger('company_id')->nullable()->after('id')->index();
                });
            }
        }

        // ── risks ─────────────────────────────────────────────────────────────
        if (!Schema::hasTable('risks')) {
            Schema::create('risks', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id')->nullable()->index();
                $table->unsignedBigInteger('task_id')->unique()->nullable();
                $table->string('name')->nullable();
                $table->text('description')->nullable();
                $table->decimal('probability', 5, 2)->nullable();
                $table->decimal('impact', 5, 2)->nullable();
                $table->decimal('risk_rate', 5, 2)->nullable();
                $table->string('risk_status')->default('open');
                $table->text('mitigation_plan')->nullable();
                $table->string('status')->default('open');
                $table->timestamps();

                $table->foreign('task_id')->references('id')->on('tasks')->onDelete('cascade');
            });
        } else {
            if (!Schema::hasColumn('risks', 'company_id')) {
                Schema::table('risks', function (Blueprint $table) {
                    $table->unsignedBigInteger('company_id')->nullable()->after('id')->index();
                });
            }
        }

        // ── task_dependencies ─────────────────────────────────────────────────
        if (!Schema::hasTable('task_dependencies')) {
            Schema::create('task_dependencies', function (Blueprint $table) {
                $table->id();
                $table->foreignId('task_id')->constrained('tasks')->onDelete('cascade');
                $table->foreignId('depends_on')->references('id')->on('tasks')->onDelete('cascade');
                $table->integer('lag_days')->default(0);
                $table->string('dependency_type')->default('finish_to_start');
                $table->timestamps();
            });
        }

        // ── task_resources ────────────────────────────────────────────────────
        if (!Schema::hasTable('task_resources')) {
            Schema::create('task_resources', function (Blueprint $table) {
                $table->id();
                $table->foreignId('task_id')->constrained('tasks')->onDelete('cascade');
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->decimal('allocation_pct', 5, 2)->default(100);
                $table->decimal('estimated_hours', 8, 2)->default(0);
                $table->decimal('actual_hours', 8, 2)->default(0);
            });
        }

        // ── schedule_baselines ────────────────────────────────────────────────
        if (!Schema::hasTable('schedule_baselines')) {
            Schema::create('schedule_baselines', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id')->nullable()->index();
                $table->string('name');
                $table->string('parent_type')->nullable();
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            });
        } else {
            if (!Schema::hasColumn('schedule_baselines', 'company_id')) {
                Schema::table('schedule_baselines', function (Blueprint $table) {
                    $table->unsignedBigInteger('company_id')->nullable()->after('id')->index();
                });
            }
        }

        // ── schedule_baseline_tasks ───────────────────────────────────────────
        if (!Schema::hasTable('schedule_baseline_tasks')) {
            Schema::create('schedule_baseline_tasks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('baseline_id')->constrained('schedule_baselines')->onDelete('cascade');
                $table->unsignedBigInteger('task_id');
                $table->string('title');
                $table->string('status')->nullable();
                $table->string('start_date')->nullable();
                $table->string('due_date')->nullable();
                $table->integer('duration_days')->nullable();
                $table->integer('percent_complete')->default(0);
                $table->timestamps();
            });
        }

        // ── Seed: default company, roles, and pages (only on empty DB) ────────
        $this->seedDefaults();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DOWN
    // ──────────────────────────────────────────────────────────────────────────

    public function down(): void
    {
        // Drop in reverse dependency order
        Schema::dropIfExists('schedule_baseline_tasks');
        Schema::dropIfExists('schedule_baselines');
        Schema::dropIfExists('task_resources');
        Schema::dropIfExists('task_dependencies');
        Schema::dropIfExists('risks');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('programs');
        Schema::dropIfExists('portfolios');
        Schema::dropIfExists('user_working_calendars');
        Schema::dropIfExists('public_holidays');
        Schema::dropIfExists('working_calendar_settings');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('company_settings');
        Schema::dropIfExists('page_permissions');
        Schema::dropIfExists('company_permissions');
        Schema::dropIfExists('teams');
        Schema::dropIfExists('companies');
        Schema::dropIfExists('pages');
        Schema::dropIfExists('roles');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Seed helpers (run only when tables are newly empty)
    // ──────────────────────────────────────────────────────────────────────────

    private function seedDefaults(): void
    {
        // Roles
        if (DB::table('roles')->count() === 0) {
            DB::table('roles')->insert([
                ['name' => 'admin',           'description' => 'Administrator',       'is_admin' => true],
                ['name' => 'project_manager', 'description' => 'Project Manager',     'is_admin' => false],
                ['name' => 'member',          'description' => 'Standard member',     'is_admin' => false],
            ]);
        }

        // Pages
        if (DB::table('pages')->count() === 0) {
            $pages = [
                ['name' => 'Dashboard',        'slug' => 'dashboard'],
                ['name' => 'Portfolios',        'slug' => 'portfolios'],
                ['name' => 'Programs',          'slug' => 'programs'],
                ['name' => 'Projects',          'slug' => 'projects'],
                ['name' => 'Tasks',             'slug' => 'tasks'],
                ['name' => 'Reports',           'slug' => 'reports'],
                ['name' => 'Capacity',          'slug' => 'capacity'],
                ['name' => 'Risk Management',   'slug' => 'risks'],
                ['name' => 'My Calendar',       'slug' => 'calendar'],
                ['name' => 'Users',             'slug' => 'admin.users'],
                ['name' => 'Roles',             'slug' => 'admin.roles'],
                ['name' => 'Permissions',       'slug' => 'admin.permissions'],
                ['name' => 'Admin Dashboard',   'slug' => 'admin.dashboard'],
                ['name' => 'Teams',             'slug' => 'admin.teams'],
                ['name' => 'Company Setup',     'slug' => 'admin.company'],
                ['name' => 'Companies',         'slug' => 'admin.companies'],
            ];
            DB::table('pages')->insert($pages);
        }

        // Default page permissions
        if (DB::table('page_permissions')->count() === 0) {
            $adminRole = DB::table('roles')->where('name', 'admin')->first();
            $pmRole    = DB::table('roles')->where('name', 'project_manager')->first();
            $pages     = DB::table('pages')->get()->keyBy('slug');

            if ($adminRole && $pages->count()) {
                // Admin: edit access to all pages
                foreach ($pages as $page) {
                    DB::table('page_permissions')->insert([
                        'role_id' => $adminRole->id, 'page_id' => $page->id, 'access_level' => 'edit',
                    ]);
                }
            }

            if ($pmRole && $pages->count()) {
                $pmEdit = ['dashboard','portfolios','programs','projects','tasks','reports','capacity','risks','calendar'];
                foreach ($pages as $slug => $page) {
                    DB::table('page_permissions')->insert([
                        'role_id'      => $pmRole->id,
                        'page_id'      => $page->id,
                        'access_level' => in_array($slug, $pmEdit) ? 'edit' : 'none',
                    ]);
                }
            }
        }

        // Default company (id=1) — used by the initial admin account
        if (DB::table('companies')->count() === 0) {
            DB::table('companies')->insert([
                'name'   => 'Default Company',
                'slug'   => 'default',
                'plan'   => 'starter',
                'status' => 'active',
            ]);
        }
    }
};
