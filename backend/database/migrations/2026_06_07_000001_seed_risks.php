<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Seed the 4 risks from the local snapshot into Railway. The risks table was
 * empty on Railway, so the dashboard's High Risk list (tasks with a related
 * risk where risk_rate > 10) was legitimately empty.
 *
 * Tasks are resolved by (title + project name [+ program name to disambiguate
 * the two "Automated Workflow" projects]), since raw task IDs differ between
 * environments. company_id is stamped to 1 so TenantScope shows them.
 *
 * Idempotent: a risk is skipped if one already exists for the target task
 * (risks.task_id is UNIQUE).
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        echo "\n=== SEED RISKS ===\n";

        // Resolve a project id by name, optionally disambiguated by program name.
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

        // Resolve a task id by title within a project.
        $task = function (string $title, ?int $projectId) {
            if (!$projectId) return null;
            return DB::table('tasks')
                ->whereRaw('LOWER(TRIM(title)) = ?', [strtolower(trim($title))])
                ->where('parent_type', 'project')
                ->where('parent_id', $projectId)
                ->value('id');
        };

        // [ name, probability, impact, risk_rate, risk_status, status, mitigation,
        //   task_title, project_name, program_name ]
        $risks = [
            ['Test Risk',     3, 5, 15, 'High Risk',     'open',   null,   'Test3',       'Automated Workflow',              'Horizons'],
            ['Test Rick',     5, 5, 25, 'Critical Risk', 'open',   'Test', 'Development',  'Automated Workflow',              'Horizons'],
            ['Test Risk Fix', 3, 3,  9, 'Medium Risk',   'open',   null,   'Analysis',    'Phase 3 Integration into Assess', null],
            ['Test',          4, 4, 16, 'Critical Risk', 'active', 'Test', 'Analysis',    'Dover Integrations',              null],
        ];

        $inserted = 0; $skipped = 0; $missing = 0;

        foreach ($risks as [$name, $prob, $impact, $rate, $rstatus, $status, $mit, $taskTitle, $projName, $progName]) {
            $projectId = $proj($projName, $progName);
            $taskId    = $task($taskTitle, $projectId);

            if (!$taskId) {
                echo "  [MISS] no task '{$taskTitle}' in '{$projName}'" . ($progName ? " ({$progName})" : '') . "\n";
                $missing++;
                continue;
            }

            $exists = DB::table('risks')->where('task_id', $taskId)->exists();
            if ($exists) {
                echo "  [skip] risk already on task_id={$taskId} ({$taskTitle})\n";
                $skipped++;
                continue;
            }

            DB::table('risks')->insert([
                'task_id'         => $taskId,
                'name'            => $name,
                'description'     => null,
                'probability'    => $prob,
                'impact'          => $impact,
                'risk_rate'       => $rate,
                'risk_status'     => $rstatus,
                'status'          => $status,
                'mitigation_plan' => $mit,
                'company_id'      => 1,
                'created_at'      => $now,
                'updated_at'      => $now,
            ]);
            echo "  [INSERT] risk '{$name}' rate={$rate} → task_id={$taskId} ({$taskTitle} / {$projName})\n";
            $inserted++;
        }

        $highRisk = DB::table('risks')->where('risk_rate', '>', 10)->where('company_id', 1)->count();
        echo "  inserted={$inserted} skipped={$skipped} missing={$missing}\n";
        echo "  high-risk tasks now visible to company 1 (rate>10): {$highRisk}\n";
        echo "=== DONE ===\n";
    }

    public function down(): void {}
};
