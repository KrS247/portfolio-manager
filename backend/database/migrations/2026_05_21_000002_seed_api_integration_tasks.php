<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Idempotent data migration: insert the 10 tasks for the "API integration"
 * project if they do not already exist.  Safe to run on every deploy.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Resolve project id by name (handles ID drift between environments)
        $projectId = DB::table('projects')
            ->whereRaw('LOWER(name) = ?', ['api integration'])
            ->value('id');

        if (! $projectId) {
            // Project not found — nothing to insert
            return;
        }

        $existing = DB::table('tasks')
            ->where('parent_type', 'project')
            ->where('parent_id', $projectId)
            ->count();

        if ($existing >= 10) {
            // Tasks already present
            return;
        }

        // Resolve sprint id — sprint 1 in local maps to first sprint in production
        $sprintId = DB::table('sprints')->orderBy('id')->value('id');

        // Resolve agile phase ids by position (order they appear)
        $phases = DB::table('agile_phases')->orderBy('id')->pluck('id');
        $phase  = fn(int $pos) => $phases->get($pos - 1); // 1-based helper

        $now = now();

        $tasks = [
            [
                'title'           => 'Task 1',
                'description'     => 'Testing',
                'status'          => 'in_progress',
                'priority'        => 5,
                'parent_type'     => 'project',
                'parent_id'       => $projectId,
                'start_date'      => '2026-05-21',
                'due_date'        => '2026-06-03',
                'percent_complete'=> 50,
                'is_milestone'    => false,
                'sprint_id'       => $sprintId,
                'task_type'       => 'feature',
                'agile_phase_id'  => $phase(11),
                'estimated_hours' => 8,
                'actual_hours'    => null,
                'company_id'      => 1,
                'sequence'        => 1000,
            ],
            [
                'title'           => 'Task',
                'description'     => 'Testing the feature',
                'status'          => 'open',
                'priority'        => 5,
                'parent_type'     => 'project',
                'parent_id'       => $projectId,
                'start_date'      => '2026-05-20',
                'due_date'        => '2026-06-02',
                'percent_complete'=> 0,
                'is_milestone'    => false,
                'sprint_id'       => $sprintId,
                'task_type'       => 'bug_fix',
                'agile_phase_id'  => $phase(2),
                'estimated_hours' => 4,
                'actual_hours'    => null,
                'company_id'      => 1,
                'sequence'        => 2000,
            ],
            [
                'title'           => 'Task 3',
                'description'     => 'Test',
                'status'          => 'open',
                'priority'        => 5,
                'parent_type'     => 'project',
                'parent_id'       => $projectId,
                'start_date'      => '2026-05-20',
                'due_date'        => '2026-06-02',
                'percent_complete'=> 0,
                'is_milestone'    => false,
                'sprint_id'       => $sprintId,
                'task_type'       => 'feature',
                'agile_phase_id'  => $phase(3),
                'estimated_hours' => 12,
                'actual_hours'    => null,
                'company_id'      => 1,
                'sequence'        => 3000,
            ],
            [
                'title'           => 'Task 4',
                'description'     => 'Testing the feature',
                'status'          => 'in_progress',
                'priority'        => 3,
                'parent_type'     => 'project',
                'parent_id'       => $projectId,
                'start_date'      => '2026-05-21',
                'due_date'        => '2026-05-22',
                'percent_complete'=> 70,
                'is_milestone'    => false,
                'sprint_id'       => $sprintId,
                'task_type'       => 'bug_fix',
                'agile_phase_id'  => $phase(11),
                'estimated_hours' => 16,
                'actual_hours'    => null,
                'company_id'      => 1,
                'sequence'        => 4000,
            ],
            [
                'title'           => 'Task 5',
                'description'     => 'Testing the feature',
                'status'          => 'in_progress',
                'priority'        => 3,
                'parent_type'     => 'project',
                'parent_id'       => $projectId,
                'start_date'      => '2026-05-21',
                'due_date'        => '2026-05-22',
                'percent_complete'=> 85,
                'is_milestone'    => false,
                'sprint_id'       => $sprintId,
                'task_type'       => 'feature',
                'agile_phase_id'  => $phase(11),
                'estimated_hours' => 14,
                'actual_hours'    => null,
                'company_id'      => 1,
                'sequence'        => 5000,
            ],
            [
                'title'           => 'Task 6',
                'description'     => 'Testing The Feature',
                'status'          => 'open',
                'priority'        => 7,
                'parent_type'     => 'project',
                'parent_id'       => $projectId,
                'start_date'      => '2026-05-20',
                'due_date'        => '2026-05-21',
                'percent_complete'=> 0,
                'is_milestone'    => false,
                'sprint_id'       => $sprintId,
                'task_type'       => 'bug_fix',
                'agile_phase_id'  => $phase(1),
                'estimated_hours' => 4,
                'actual_hours'    => null,
                'company_id'      => 1,
                'sequence'        => 6000,
            ],
            [
                'title'           => 'Task 7',
                'description'     => 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
                'status'          => 'open',
                'priority'        => 10,
                'parent_type'     => 'project',
                'parent_id'       => $projectId,
                'start_date'      => '2026-05-20',
                'due_date'        => '2026-05-21',
                'percent_complete'=> 0,
                'is_milestone'    => false,
                'sprint_id'       => $sprintId,
                'task_type'       => 'bug_fix',
                'agile_phase_id'  => $phase(1),
                'estimated_hours' => 4,
                'actual_hours'    => null,
                'company_id'      => 1,
                'sequence'        => 7000,
            ],
            [
                'title'           => 'Task 8',
                'description'     => 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
                'status'          => 'open',
                'priority'        => 5,
                'parent_type'     => 'project',
                'parent_id'       => $projectId,
                'start_date'      => '2026-05-20',
                'due_date'        => '2026-05-21',
                'percent_complete'=> 0,
                'is_milestone'    => false,
                'sprint_id'       => $sprintId,
                'task_type'       => 'feature',
                'agile_phase_id'  => $phase(1),
                'estimated_hours' => 32,
                'actual_hours'    => null,
                'company_id'      => 1,
                'sequence'        => 8000,
            ],
            [
                'title'           => 'Task 9',
                'description'     => 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
                'status'          => 'open',
                'priority'        => 3,
                'parent_type'     => 'project',
                'parent_id'       => $projectId,
                'start_date'      => '2026-05-21',
                'due_date'        => '2026-05-22',
                'percent_complete'=> 0,
                'is_milestone'    => false,
                'sprint_id'       => $sprintId,
                'task_type'       => 'feature',
                'agile_phase_id'  => $phase(1),
                'estimated_hours' => 5,
                'actual_hours'    => null,
                'company_id'      => 1,
                'sequence'        => 9000,
            ],
            [
                'title'           => 'Task 10',
                'description'     => 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum',
                'status'          => 'open',
                'priority'        => 7,
                'parent_type'     => 'project',
                'parent_id'       => $projectId,
                'start_date'      => '2026-05-21',
                'due_date'        => '2026-05-22',
                'percent_complete'=> 0,
                'is_milestone'    => false,
                'sprint_id'       => $sprintId,
                'task_type'       => 'feature',
                'agile_phase_id'  => $phase(1),
                'estimated_hours' => 32,
                'actual_hours'    => null,
                'company_id'      => 1,
                'sequence'        => 10000,
            ],
        ];

        foreach ($tasks as $task) {
            $task['created_at'] = $now;
            $task['updated_at'] = $now;
            DB::table('tasks')->insert($task);
        }
    }

    public function down(): void
    {
        $projectId = DB::table('projects')
            ->whereRaw('LOWER(name) = ?', ['api integration'])
            ->value('id');

        if ($projectId) {
            DB::table('tasks')
                ->where('parent_type', 'project')
                ->where('parent_id', $projectId)
                ->delete();
        }
    }
};
