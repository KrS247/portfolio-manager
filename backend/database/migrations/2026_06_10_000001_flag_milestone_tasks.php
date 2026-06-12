<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The seed-task migrations never set is_milestone, so on Railway every task
 * has is_milestone = false and the dashboard's "Upcoming Milestones" widget
 * has nothing to show.
 *
 * Flag the milestone tasks to match the local snapshot, resolved by
 * title + project (program disambiguates the two Automated Workflow projects).
 * Idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        echo "\n=== FLAG MILESTONE TASKS ===\n";

        $proj = function (string $name, ?string $programName = null) {
            $q = DB::table('projects')->whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($name))]);
            if ($programName !== null) {
                $progId = DB::table('programs')
                    ->whereRaw('LOWER(TRIM(name)) LIKE ?', [strtolower(trim($programName)) . '%'])
                    ->value('id');
                if ($progId) $q->where('program_id', $progId);
            }
            return $q->value('id');
        };

        // [ task_title, project_name, program_name ]
        $milestones = [
            ['Launch Day Milestone', 'Automated Workflow',              'Horizons'],
            ['Dev Completed',        'Automation of Trends Generation', null],
        ];

        $flagged = 0; $missing = 0; $already = 0;
        foreach ($milestones as [$title, $projName, $progName]) {
            $projectId = $proj($projName, $progName);
            if (!$projectId) { echo "  [MISS] project '{$projName}'\n"; $missing++; continue; }

            $task = DB::table('tasks')
                ->whereRaw('LOWER(TRIM(title)) = ?', [strtolower(trim($title))])
                ->where('parent_type', 'project')->where('parent_id', $projectId)
                ->first(['id', 'is_milestone', 'status', 'due_date']);

            if (!$task) { echo "  [MISS] task '{$title}' in '{$projName}'\n"; $missing++; continue; }

            if ($task->is_milestone) {
                echo "  [skip] already a milestone: '{$title}' (task {$task->id})\n";
                $already++;
                continue;
            }

            DB::table('tasks')->where('id', $task->id)
                ->update(['is_milestone' => true, 'updated_at' => now()]);
            echo "  [SET] is_milestone on '{$title}' (task {$task->id}, status={$task->status}, due={$task->due_date})\n";
            $flagged++;
        }

        $total = DB::table('tasks')->where('is_milestone', true)->count();
        echo "  flagged={$flagged} already={$already} missing={$missing}\n";
        echo "  total milestone tasks now: {$total}\n";
        echo "=== DONE ===\n";
    }

    public function down(): void {}
};
