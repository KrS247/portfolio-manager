<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Seed the 29 task_resources rows from the local snapshot into Railway.
 * The table was empty on Railway (audit: 0 vs 29), which left the Capacity
 * page, over-budget calculations, and resource-based visibleScope empty.
 *
 * Each row is resolved to its Railway task by (title + project [+ program to
 * disambiguate the two "Automated Workflow" projects]). user_id maps directly
 * (the same user IDs exist in both environments). No company_id column on this
 * table, so no TenantScope concern.
 *
 * Idempotent via the UNIQUE (task_id, user_id) constraint.
 */
return new class extends Migration
{
    public function up(): void
    {
        echo "\n=== SEED TASK_RESOURCES ===\n";

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

        $task = function (string $title, ?int $projectId) {
            if (!$projectId) return null;
            return DB::table('tasks')
                ->whereRaw('LOWER(TRIM(title)) = ?', [strtolower(trim($title))])
                ->where('parent_type', 'project')
                ->where('parent_id', $projectId)
                ->value('id');
        };

        // [ user_id, allocation_pct, estimated_hours, actual_hours, task_title, project_name, program_name ]
        $rows = [
            // API integration (agile project — unique name)
            [4, 100, 4.0,  0.0,  'Task',    'API integration', null],
            [2, 100, 3.0,  0.0,  'Task 1',  'API integration', null],
            [6, 100, 5.0,  0.0,  'Task 1',  'API integration', null],
            [2, 100, 32.0, 0.0,  'Task 10', 'API integration', null],
            [2, 100, 6.5,  0.0,  'Task 3',  'API integration', null],
            [4, 100, 5.5,  0.0,  'Task 3',  'API integration', null],
            [7, 100, 16.0, 0.0,  'Task 4',  'API integration', null],
            [3, 100, 14.0, 0.0,  'Task 5',  'API integration', null],
            [4, 100, 4.0,  0.0,  'Task 6',  'API integration', null],
            [5, 100, 4.0,  0.0,  'Task 7',  'API integration', null],
            [3, 100, 32.0, 0.0,  'Task 8',  'API integration', null],
            [2, 100, 5.0,  0.0,  'Task 9',  'API integration', null],

            // Automated Workflow (Horizons) — disambiguate by program
            [3, 100, 40.0, 40.0, 'Analysis',             'Automated Workflow', 'Horizons'],
            [4, 100, 40.0, 40.0, 'Analysis',             'Automated Workflow', 'Horizons'],
            [2, 100, 24.0, 24.0, 'Design',               'Automated Workflow', 'Horizons'],
            [3, 100, 80.0, 80.0, 'Design',               'Automated Workflow', 'Horizons'],
            [4, 100, 36.0, 36.0, 'Design',               'Automated Workflow', 'Horizons'],
            [2, 100, 40.0, 42.0, 'Development',          'Automated Workflow', 'Horizons'],
            [3, 100, 24.0, 32.0, 'Development',          'Automated Workflow', 'Horizons'],
            [4, 100, 16.0, 16.0, 'Development',          'Automated Workflow', 'Horizons'],
            [2, 100, 16.0, 17.0, 'Launch Day Milestone', 'Automated Workflow', 'Horizons'],
            [4, 100, 8.0,  8.0,  'Launch Day Milestone', 'Automated Workflow', 'Horizons'],
            [2, 100, 60.0, 0.0,  'Test3',                'Automated Workflow', 'Horizons'],
            [3, 100, 20.0, 0.0,  'Test3',                'Automated Workflow', 'Horizons'],
            [4, 100, 50.0, 0.0,  'Test3',                'Automated Workflow', 'Horizons'],

            // Huntsman Integration (unique name)
            [3, 100, 8.0,  0.0,  'Analysis', 'Huntsman Integration', null],
            [4, 100, 16.0, 18.5, 'Analysis', 'Huntsman Integration', null],

            // Phase 1 / Phase 3 (unique names)
            [1, 100, 80.0, 50.0, 'Development', 'Phase 1 Build A service to generate Audit Protocols', null],
            [4, 100, 0.0,  0.0,  'Analysis',    'Phase 3 Integration into Assess',                     null],
        ];

        $inserted = 0; $skipped = 0; $missing = 0;

        foreach ($rows as [$userId, $alloc, $est, $act, $taskTitle, $projName, $progName]) {
            // Confirm the user exists on this environment
            if (!DB::table('users')->where('id', $userId)->exists()) {
                echo "  [MISS] user {$userId} does not exist — skipping {$taskTitle}/{$projName}\n";
                $missing++;
                continue;
            }

            $projectId = $proj($projName, $progName);
            $taskId    = $task($taskTitle, $projectId);

            if (!$taskId) {
                echo "  [MISS] no task '{$taskTitle}' in '{$projName}'" . ($progName ? " ({$progName})" : '') . "\n";
                $missing++;
                continue;
            }

            $exists = DB::table('task_resources')
                ->where('task_id', $taskId)->where('user_id', $userId)->exists();
            if ($exists) { $skipped++; continue; }

            DB::table('task_resources')->insert([
                'task_id'         => $taskId,
                'user_id'         => $userId,
                'allocation_pct'  => $alloc,
                'estimated_hours' => $est,
                'actual_hours'    => $act,
            ]);
            $inserted++;
        }

        $total = DB::table('task_resources')->count();
        echo "  inserted={$inserted} skipped={$skipped} missing={$missing}\n";
        echo "  task_resources total now: {$total}\n";
        echo "=== DONE ===\n";
    }

    public function down(): void {}
};
