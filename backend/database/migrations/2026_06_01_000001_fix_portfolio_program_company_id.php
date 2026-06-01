<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Portfolios and programs that were imported before the company_id column was
 * populated may have company_id = NULL.  TenantScope filters every Eloquent
 * query by company_id, so NULL rows are invisible to all users.
 *
 * This migration stamps company_id on:
 *   1. portfolios  — set to 1 (the single tenant in this installation)
 *   2. programs    — derive from parent portfolio.company_id
 *   3. projects    — derive from parent program → portfolio (belt-and-suspenders;
 *                    these were already fixed implicitly, but ensure none are left)
 *
 * Idempotent: only rows with company_id IS NULL are touched.
 */
return new class extends Migration
{
    public function up(): void
    {
        echo "\n=== FIX PORTFOLIO / PROGRAM / PROJECT COMPANY_ID ===\n";

        // ── Snapshot before ───────────────────────────────────────────────────
        $nullPortfolios = DB::table('portfolios')->whereNull('company_id')->count();
        $nullPrograms   = DB::table('programs')  ->whereNull('company_id')->count();
        $nullProjects   = DB::table('projects')  ->whereNull('company_id')->count();
        $totalPortfolios = DB::table('portfolios')->count();
        $totalPrograms   = DB::table('programs')->count();
        $totalProjects   = DB::table('projects')->count();

        echo "  portfolios : {$totalPortfolios} total, {$nullPortfolios} with NULL company_id\n";
        echo "  programs   : {$totalPrograms} total, {$nullPrograms} with NULL company_id\n";
        echo "  projects   : {$totalProjects} total, {$nullProjects} with NULL company_id\n";

        // ── Resolve the canonical company_id ─────────────────────────────────
        // This deployment has exactly one tenant (id=1). Use it as the fallback.
        $companyId = DB::table('companies')->orderBy('id')->value('id');
        if (!$companyId) {
            echo "  [ERROR] No companies found — cannot fix company_id. Aborting.\n";
            return;
        }
        echo "  Using company_id={$companyId} as the tenant value\n";

        // ── 1. Fix portfolios ─────────────────────────────────────────────────
        if ($nullPortfolios > 0) {
            $affected = DB::table('portfolios')
                ->whereNull('company_id')
                ->update(['company_id' => $companyId, 'updated_at' => now()]);
            echo "  portfolios fixed: {$affected}\n";
        } else {
            echo "  portfolios: nothing to fix\n";
        }

        // ── 2. Fix programs — derive from parent portfolio ────────────────────
        if ($nullPrograms > 0) {
            DB::statement("
                UPDATE programs
                SET    company_id = (SELECT company_id FROM portfolios WHERE id = programs.portfolio_id),
                       updated_at = NOW()
                WHERE  company_id IS NULL
            ");
            $stillNull = DB::table('programs')->whereNull('company_id')->count();
            echo "  programs fixed: " . ($nullPrograms - $stillNull) . " (still NULL: {$stillNull})\n";

            // Any programs whose portfolio had NULL company_id too — stamp directly
            if ($stillNull > 0) {
                DB::table('programs')->whereNull('company_id')
                    ->update(['company_id' => $companyId, 'updated_at' => now()]);
                echo "  programs fallback-fixed: {$stillNull}\n";
            }
        } else {
            echo "  programs: nothing to fix\n";
        }

        // ── 3. Fix projects — derive from parent program → portfolio ──────────
        if ($nullProjects > 0) {
            DB::statement("
                UPDATE projects
                SET    company_id = (
                           SELECT po.company_id
                           FROM   programs pr
                           JOIN   portfolios po ON po.id = pr.portfolio_id
                           WHERE  pr.id = projects.program_id
                       ),
                       updated_at = NOW()
                WHERE  company_id IS NULL
            ");
            $stillNull = DB::table('projects')->whereNull('company_id')->count();
            echo "  projects fixed: " . ($nullProjects - $stillNull) . " (still NULL: {$stillNull})\n";

            if ($stillNull > 0) {
                DB::table('projects')->whereNull('company_id')
                    ->update(['company_id' => $companyId, 'updated_at' => now()]);
                echo "  projects fallback-fixed: {$stillNull}\n";
            }
        } else {
            echo "  projects: nothing to fix\n";
        }

        // ── Final breakdown ───────────────────────────────────────────────────
        echo "\n  === Final company_id breakdown ===\n";
        foreach (['portfolios', 'programs', 'projects'] as $tbl) {
            $rows = DB::table($tbl)
                ->selectRaw('company_id, count(*) as cnt')
                ->groupBy('company_id')
                ->get();
            foreach ($rows as $row) {
                echo "  {$tbl}: company_id=" . ($row->company_id ?? 'NULL') . " → {$row->cnt} rows\n";
            }
        }

        echo "=== DONE ===\n";
    }

    public function down(): void {}
};
