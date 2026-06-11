<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * High-risk tasks weren't showing on the dashboard.
 *
 * Risk uses BelongsToTenant, so TenantScope filters it by the logged-in
 * user's company_id. The dashboard's high-risk query
 * (Task::whereHas('risk', fn => risk_rate > 10)) runs that subquery under
 * TenantScope — so any risk with NULL company_id is invisible and the task
 * never appears as high-risk.
 *
 * Like every other tenant table, risks.company_id was never backfilled on
 * Railway. Derive it from the risk's parent task, falling back to 1.
 *
 * Diagnostic-first: dumps the risks so we can confirm they exist and how they
 * map to tasks before/after the fix.
 */
return new class extends Migration
{
    public function up(): void
    {
        echo "\n=== FIX RISK COMPANY_ID ===\n";

        $total = DB::table('risks')->count();
        echo "  risks total: {$total}\n";

        if ($total === 0) {
            echo "  [NOTE] No risks exist on Railway — high-risk list is legitimately empty.\n";
            echo "         (Risks were never seeded here; nothing to backfill.)\n";
            echo "=== DONE ===\n";
            return;
        }

        // Dump current risks + whether the parent task exists
        $rows = DB::table('risks as r')
            ->leftJoin('tasks as t', 't.id', '=', 'r.task_id')
            ->select('r.id', 'r.task_id', 'r.risk_rate', 'r.risk_status', 'r.company_id', 't.title as task_title')
            ->orderBy('r.id')
            ->get();

        echo "  Before:\n";
        foreach ($rows as $r) {
            echo "    risk {$r->id}: task_id={$r->task_id} rate={$r->risk_rate}"
                . " status=" . ($r->risk_status ?? '-')
                . " company_id=" . ($r->company_id ?? 'NULL')
                . " task=" . ($r->task_title ?? '[MISSING]') . "\n";
        }

        // Backfill NULL company_id from the parent task, fallback to 1
        $nullCount = DB::table('risks')->whereNull('company_id')->count();
        echo "  risks with NULL company_id: {$nullCount}\n";

        if ($nullCount > 0) {
            DB::statement("
                UPDATE risks
                SET    company_id = COALESCE(
                           (SELECT company_id FROM tasks WHERE tasks.id = risks.task_id),
                           1
                       ),
                       updated_at = NOW()
                WHERE  company_id IS NULL
            ");
            $stillNull = DB::table('risks')->whereNull('company_id')->count();
            echo "  risks backfilled: " . ($nullCount - $stillNull) . " (still NULL: {$stillNull})\n";
        } else {
            echo "  nothing to backfill\n";
        }

        // How many tasks now qualify as high-risk (risk_rate > 10), company 1
        $highRisk = DB::table('risks')
            ->where('risk_rate', '>', 10)
            ->where('company_id', 1)
            ->count();
        echo "  high-risk tasks visible to company 1 (rate>10): {$highRisk}\n";

        echo "=== DONE ===\n";
    }

    public function down(): void {}
};
