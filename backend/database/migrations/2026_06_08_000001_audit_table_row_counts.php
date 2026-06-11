<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * READ-ONLY AUDIT (no writes).
 *
 * Reports the row count of every data table on Railway against the expected
 * counts from the local snapshot, so any table that wasn't fully migrated
 * (the recurring root cause behind "X isn't displaying") shows up in one pass.
 *
 * Flags:
 *   GAP   — Railway has fewer rows than local (missing data — needs seeding)
 *   OVER  — Railway has more rows than local (created on Railway since; usually fine)
 *   OK    — counts match
 * System tables (cache/migrations/sessions/jobs…) are reported but not flagged.
 */
return new class extends Migration
{
    public function up(): void
    {
        echo "\n=== TABLE ROW-COUNT AUDIT (Railway vs local snapshot) ===\n";

        // Expected counts from the local SQLite snapshot (data tables).
        $expected = [
            'activity_logs'             => 73,
            'agile_phases'              => 17,
            'companies'                 => 2,
            'company_permissions'       => 0,
            'company_settings'          => 1,
            'page_permissions'          => 64,
            'pages'                     => 18,
            'portfolios'                => 2,
            'programs'                  => 6,
            'projects'                  => 12,
            'public_holidays'           => 2,
            'risks'                     => 4,
            'roles'                     => 4,
            'schedule_baseline_tasks'   => 1,
            'schedule_baselines'        => 1,
            'sprints'                   => 10,
            'task_dependencies'         => 9,
            'task_resources'            => 29,
            'tasks'                     => 40,
            'teams'                     => 5,
            'user_working_calendars'    => 0,
            'users'                     => 9,
            'working_calendar_settings' => 1,
        ];

        // System / framework tables — report only, never flagged.
        $systemTables = ['cache', 'cache_locks', 'migrations', 'password_reset_tokens',
                         'sessions', 'jobs', 'job_batches', 'failed_jobs'];

        $gaps = [];

        echo "\n  DATA TABLES:\n";
        echo str_pad("    table", 32) . str_pad("railway", 10) . str_pad("local", 10) . "flag\n";
        echo "    " . str_repeat('-', 56) . "\n";

        foreach ($expected as $table => $exp) {
            try {
                $actual = DB::table($table)->count();
            } catch (\Throwable $e) {
                echo "    " . str_pad($table, 28) . str_pad('ERR', 10) . str_pad((string)$exp, 10) . "MISSING TABLE\n";
                $gaps[] = "{$table} (table missing)";
                continue;
            }

            $flag = 'OK';
            if ($actual < $exp)      { $flag = 'GAP  <<<'; $gaps[] = "{$table}: {$actual}/{$exp}"; }
            elseif ($actual > $exp)  { $flag = 'OVER'; }

            echo "    " . str_pad($table, 28) . str_pad((string)$actual, 10) . str_pad((string)$exp, 10) . $flag . "\n";
        }

        echo "\n  SYSTEM TABLES (informational):\n";
        foreach ($systemTables as $table) {
            try {
                $actual = DB::table($table)->count();
                echo "    " . str_pad($table, 28) . $actual . "\n";
            } catch (\Throwable $e) {
                echo "    " . str_pad($table, 28) . "(absent)\n";
            }
        }

        // Any Railway tables not in our expected/system lists?
        try {
            $known = array_merge(array_keys($expected), $systemTables);
            $allTables = DB::select("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            $extra = [];
            foreach ($allTables as $row) {
                $name = $row->table_name ?? $row->TABLE_NAME ?? null;
                if ($name && !in_array($name, $known, true)) $extra[] = $name;
            }
            if ($extra) {
                echo "\n  RAILWAY-ONLY TABLES (not in snapshot):\n";
                foreach ($extra as $name) {
                    $cnt = DB::table($name)->count();
                    echo "    " . str_pad($name, 28) . $cnt . "\n";
                }
            }
        } catch (\Throwable $e) {
            echo "\n  (could not enumerate information_schema: {$e->getMessage()})\n";
        }

        echo "\n  === SUMMARY ===\n";
        if (empty($gaps)) {
            echo "  No data gaps — every data table meets or exceeds the snapshot count.\n";
        } else {
            echo "  " . count($gaps) . " table(s) with missing data (need seeding):\n";
            foreach ($gaps as $g) echo "    - {$g}\n";
        }
        echo "=== DONE ===\n";
    }

    public function down(): void {}
};
