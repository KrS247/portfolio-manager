<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Add the indexes the query shapes actually need (audit: only company_id was
 * indexed, so every list/filter was a sequential scan on Postgres).
 *
 * CREATE INDEX IF NOT EXISTS is supported by both Postgres and SQLite, so this
 * is idempotent and safe to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        $indexes = [
            // tasks — the hottest table (formatTask, visibleScope, list filters)
            'idx_tasks_parent'       => ['tasks', '(parent_type, parent_id)'],
            'idx_tasks_status'       => ['tasks', '(status)'],
            'idx_tasks_sequence'     => ['tasks', '(sequence)'],
            'idx_tasks_assigned_to'  => ['tasks', '(assigned_to)'],
            'idx_tasks_created_by'   => ['tasks', '(created_by)'],
            'idx_tasks_sprint'       => ['tasks', '(sprint_id)'],
            'idx_tasks_agile_phase'  => ['tasks', '(agile_phase_id)'],
            'idx_tasks_parent_task'  => ['tasks', '(parent_task_id)'],
            // hierarchy joins
            'idx_projects_program'   => ['projects', '(program_id)'],
            'idx_projects_owner'     => ['projects', '(owner_id)'],
            'idx_programs_portfolio' => ['programs', '(portfolio_id)'],
            'idx_programs_owner'     => ['programs', '(owner_id)'],
            'idx_portfolios_owner'   => ['portfolios', '(owner_id)'],
        ];

        foreach ($indexes as $name => [$table, $cols]) {
            if (!Schema::hasTable($table)) {
                continue;
            }
            // Guard against columns that may not exist in every environment.
            $col = trim(explode(',', trim($cols, '()'))[0]);
            if (!Schema::hasColumn($table, $col)) {
                continue;
            }
            DB::statement("CREATE INDEX IF NOT EXISTS {$name} ON {$table} {$cols}");
        }
    }

    public function down(): void
    {
        foreach ([
            'idx_tasks_parent', 'idx_tasks_status', 'idx_tasks_sequence',
            'idx_tasks_assigned_to', 'idx_tasks_created_by', 'idx_tasks_sprint',
            'idx_tasks_agile_phase', 'idx_tasks_parent_task',
            'idx_projects_program', 'idx_projects_owner',
            'idx_programs_portfolio', 'idx_programs_owner', 'idx_portfolios_owner',
        ] as $name) {
            DB::statement("DROP INDEX IF EXISTS {$name}");
        }
    }
};
