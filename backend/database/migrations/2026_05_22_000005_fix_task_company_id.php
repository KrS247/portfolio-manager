<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Tasks inserted by migrations 000003/000004 were missing company_id.
 * The API filters by company_id, so those tasks were invisible to users.
 *
 * This migration stamps company_id on every task that lacks it,
 * deriving the correct value from the task's parent project.
 *
 * Also stamps company_id on ALL tasks where it is NULL (belt-and-suspenders).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Check before
        $nullBefore = DB::table('tasks')->whereNull('company_id')->count();
        echo "\n=== FIX TASK COMPANY_ID ===\n";
        echo "  tasks with NULL company_id (before): {$nullBefore}\n";

        if ($nullBefore === 0) {
            echo "  Nothing to fix.\n";
            return;
        }

        // For each task missing company_id, look up the company_id
        // from the parent project (projects.company_id).
        // Works for parent_type = 'project', 'program', or 'portfolio'.
        $updated = DB::statement("
            UPDATE tasks
            SET company_id = (
                CASE
                    WHEN parent_type = 'project'   THEN (SELECT company_id FROM projects   WHERE id = tasks.parent_id)
                    WHEN parent_type = 'program'   THEN (SELECT company_id FROM programs   WHERE id = tasks.parent_id)
                    WHEN parent_type = 'portfolio' THEN (SELECT company_id FROM portfolios WHERE id = tasks.parent_id)
                    ELSE NULL
                END
            ),
            updated_at = NOW()
            WHERE company_id IS NULL
        ");

        $nullAfter = DB::table('tasks')->whereNull('company_id')->count();
        $fixed     = $nullBefore - $nullAfter;

        echo "  tasks fixed: {$fixed}\n";
        echo "  tasks still NULL: {$nullAfter}\n";

        // Final breakdown
        $breakdown = DB::table('tasks')
            ->selectRaw('company_id, count(*) as cnt')
            ->groupBy('company_id')
            ->get();
        echo "  company_id breakdown:\n";
        foreach ($breakdown as $row) {
            echo "    company_id=" . ($row->company_id ?? 'NULL') . ": {$row->cnt}\n";
        }
        echo "=== DONE ===\n";
    }

    public function down(): void {}
};
