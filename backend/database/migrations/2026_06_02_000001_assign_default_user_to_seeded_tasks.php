<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Tasks seeded by migrations 000003/000004 were inserted without created_by
 * or assigned_to.  visibleScope() in Controller.php filters non-admin users
 * to tasks where:
 *   assigned_to = userId  OR  created_by = userId  OR  user is in task_resources
 *
 * Without any of these set, non-admin users see zero tasks, and therefore
 * zero projects / programs / portfolios (because the hierarchy visibility is
 * derived upward from task ownership).
 *
 * This migration:
 *   1. Sets created_by   → first admin user of the company (records data origin)
 *   2. Sets assigned_to  → the owning project's owner_id  (makes the project
 *                          owner responsible for their own project's tasks)
 *
 * Both fields are only updated where they are currently NULL.
 * Safe to re-run (idempotent).
 */
return new class extends Migration
{
    public function up(): void
    {
        echo "\n=== ASSIGN DEFAULT USER TO SEEDED TASKS ===\n";

        // ── Resolve the default creator (first admin of company 1) ────────────
        $adminUserId = DB::table('users')
            ->join('roles', 'users.role_id', '=', 'roles.id')
            ->where('users.company_id', 1)
            ->where('roles.is_admin', true)
            ->orderBy('users.id')
            ->value('users.id');

        if (!$adminUserId) {
            // Fallback: any user in company 1
            $adminUserId = DB::table('users')->where('company_id', 1)->orderBy('id')->value('id');
        }

        if (!$adminUserId) {
            echo "  [ERROR] No users found for company_id=1 — cannot assign default user. Aborting.\n";
            return;
        }

        echo "  Default creator user_id: {$adminUserId}\n";

        // ── Snapshot before ───────────────────────────────────────────────────
        $nullCreatedBy   = DB::table('tasks')->whereNull('created_by')->count();
        $nullAssignedTo  = DB::table('tasks')->whereNull('assigned_to')->count();
        $totalTasks      = DB::table('tasks')->count();

        echo "  tasks total: {$totalTasks}\n";
        echo "  tasks with NULL created_by:  {$nullCreatedBy}\n";
        echo "  tasks with NULL assigned_to: {$nullAssignedTo}\n";

        // ── 1. Stamp created_by on tasks that have no creator ─────────────────
        if ($nullCreatedBy > 0) {
            $updated = DB::table('tasks')
                ->whereNull('created_by')
                ->update([
                    'created_by' => $adminUserId,
                    'updated_at' => now(),
                ]);
            echo "  created_by stamped: {$updated} tasks → user_id={$adminUserId}\n";
        } else {
            echo "  created_by: nothing to update\n";
        }

        // ── 2. Stamp assigned_to — derive from the parent project's owner_id ──
        // For tasks whose parent is a project with an owner, assign to that owner.
        // Falls back to the admin user if the project has no owner.
        if ($nullAssignedTo > 0) {
            // Update tasks that belong to a project (parent_type = 'project')
            DB::statement("
                UPDATE tasks
                SET    assigned_to = COALESCE(
                           (SELECT owner_id FROM projects WHERE id = tasks.parent_id),
                           :fallback
                       ),
                       updated_at = NOW()
                WHERE  assigned_to IS NULL
                  AND  parent_type = 'project'
            ", ['fallback' => $adminUserId]);

            // For tasks with other parent types (program, portfolio), use the admin
            DB::table('tasks')
                ->whereNull('assigned_to')
                ->whereIn('parent_type', ['program', 'portfolio'])
                ->update([
                    'assigned_to' => $adminUserId,
                    'updated_at'  => now(),
                ]);

            $stillNull = DB::table('tasks')->whereNull('assigned_to')->count();
            $fixed     = $nullAssignedTo - $stillNull;
            echo "  assigned_to stamped: {$fixed} tasks (still NULL: {$stillNull})\n";
        } else {
            echo "  assigned_to: nothing to update\n";
        }

        // ── Final breakdown ───────────────────────────────────────────────────
        echo "\n  === assigned_to breakdown ===\n";
        $breakdown = DB::table('tasks')
            ->selectRaw('assigned_to, count(*) as cnt')
            ->groupBy('assigned_to')
            ->orderBy('assigned_to')
            ->get();
        foreach ($breakdown as $row) {
            echo "    assigned_to=" . ($row->assigned_to ?? 'NULL') . ": {$row->cnt} tasks\n";
        }

        echo "\n  === created_by breakdown ===\n";
        $breakdown2 = DB::table('tasks')
            ->selectRaw('created_by, count(*) as cnt')
            ->groupBy('created_by')
            ->orderBy('created_by')
            ->get();
        foreach ($breakdown2 as $row) {
            echo "    created_by=" . ($row->created_by ?? 'NULL') . ": {$row->cnt} tasks\n";
        }

        echo "=== DONE ===\n";
    }

    public function down(): void
    {
        // Non-destructive — clearing these fields would lose any real assignments
        // made through the UI after this migration ran. Left empty intentionally.
    }
};
