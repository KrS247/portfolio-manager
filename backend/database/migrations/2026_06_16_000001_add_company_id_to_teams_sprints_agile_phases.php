<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tenant-isolate teams, sprints, and agile_phases (audit H3).
 *
 * These tables had no company_id and their models were plain Model, so any
 * tenant admin could list/edit/delete every customer's rows by ID. Add a
 * company_id column (nullable + indexed), backfill it from the rows that
 * reference each entity, and BelongsToTenant on the models then filters all
 * reads and stamps company_id on create.
 *
 * Backfill sources:
 *   - sprints      ← tasks.sprint_id      → tasks.company_id
 *   - agile_phases ← tasks.agile_phase_id → tasks.company_id
 *   - teams        ← users.team_id        → users.company_id
 * Anything still unmatched falls back to the lowest company id (single-tenant
 * production = company 1). Idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['teams', 'sprints', 'agile_phases'] as $table) {
            if (Schema::hasTable($table) && !Schema::hasColumn($table, 'company_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->unsignedBigInteger('company_id')->nullable()->index()->after('id');
                });
            }
        }

        // ── Backfill from referencing rows ────────────────────────────────────
        if (Schema::hasTable('sprints') && Schema::hasColumn('tasks', 'sprint_id')) {
            DB::statement("
                UPDATE sprints SET company_id = (
                    SELECT t.company_id FROM tasks t
                    WHERE t.sprint_id = sprints.id AND t.company_id IS NOT NULL
                    LIMIT 1
                ) WHERE company_id IS NULL
            ");
        }
        if (Schema::hasTable('agile_phases') && Schema::hasColumn('tasks', 'agile_phase_id')) {
            DB::statement("
                UPDATE agile_phases SET company_id = (
                    SELECT t.company_id FROM tasks t
                    WHERE t.agile_phase_id = agile_phases.id AND t.company_id IS NOT NULL
                    LIMIT 1
                ) WHERE company_id IS NULL
            ");
        }
        if (Schema::hasTable('teams') && Schema::hasColumn('users', 'team_id')) {
            DB::statement("
                UPDATE teams SET company_id = (
                    SELECT u.company_id FROM users u
                    WHERE u.team_id = teams.id AND u.company_id IS NOT NULL
                    LIMIT 1
                ) WHERE company_id IS NULL
            ");
        }

        // ── Fallback: lowest company id (single active tenant) ────────────────
        $fallback = DB::table('companies')->min('id');
        if ($fallback) {
            foreach (['teams', 'sprints', 'agile_phases'] as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->whereNull('company_id')->update(['company_id' => $fallback]);
                }
            }
        }
    }

    public function down(): void
    {
        foreach (['teams', 'sprints', 'agile_phases'] as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'company_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->dropColumn('company_id');
                });
            }
        }
    }
};
