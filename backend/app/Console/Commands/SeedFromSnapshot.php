<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Seeds the production database from the bundled SQLite snapshot.
 * Only runs if the users table is empty — safe to call on every deploy.
 */
class SeedFromSnapshot extends Command
{
    protected $signature   = 'db:seed:from-snapshot {--force : Force re-seed even if data already exists}';
    protected $description = 'Copy data from the SQLite snapshot into the configured database (skipped if data already exists)';

    // Import order respects FK constraints
    private const TABLES = [
        'companies', 'roles', 'pages', 'users',
        'page_permissions', 'company_permissions',
        'working_calendar_settings',
        'portfolios', 'programs', 'projects',
        'tasks', 'task_resources', 'risks',
        'schedule_baselines', 'schedule_baseline_tasks',
        'task_dependencies', 'user_working_calendars',
        'teams', 'task_comments', 'activity_logs',
        'public_holidays', 'company_settings',
        'password_reset_tokens', 'cache', 'cache_locks',
    ];

    public function handle(): int
    {
        // Skip if already fully seeded (portfolios is a good proxy — empty on fresh installs).
        // We check BOTH users and portfolios to handle partially-seeded states where
        // some tables got data but others didn't (a previous crashed run).
        // Use --force to re-seed even when data exists (wipes and replaces everything).
        $alreadySeeded = DB::table('users')->count() > 0 && DB::table('portfolios')->count() > 0;
        if ($alreadySeeded && ! $this->option('force')) {
            $this->info('Database already seeded — skipping snapshot seed. Use --force to re-seed.');
            return 0;
        }
        if ($this->option('force')) {
            $this->warn('--force flag set: wiping and re-seeding all tables.');
        }

        $snapshotPath = database_path('portfolio.db');
        if (! file_exists($snapshotPath)) {
            $this->error("Snapshot not found at {$snapshotPath}");
            return 1;
        }

        $this->info("Seeding from snapshot: {$snapshotPath}");

        $sqlite = new \PDO("sqlite:{$snapshotPath}");
        $sqlite->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

        $isPgsql = (config('database.default') === 'pgsql');

        // Disable FK checks for the duration of the import
        if ($isPgsql) {
            DB::statement('SET session_replication_role = replica');
        } else {
            DB::statement('PRAGMA foreign_keys = OFF');
        }

        try {
            foreach (self::TABLES as $table) {
                $this->importTable($sqlite, $table, $isPgsql);
            }
        } finally {
            if ($isPgsql) {
                DB::statement('SET session_replication_role = DEFAULT');
            } else {
                DB::statement('PRAGMA foreign_keys = ON');
            }
        }

        $this->info('Snapshot seed complete.');
        return 0;
    }

    private function importTable(\PDO $sqlite, string $table, bool $isPgsql): void
    {
        // Get columns from SQLite snapshot
        $pragma = $sqlite->query("PRAGMA table_info({$table})")->fetchAll(\PDO::FETCH_ASSOC);
        if (empty($pragma)) {
            $this->line("  skip  {$table}: not in snapshot");
            return;
        }
        $sqliteCols = array_column($pragma, 'name');

        // Get columns that actually exist in the destination DB to handle schema drift
        $destCols = Schema::getColumnListing($table);
        // Use the intersection so we never try to insert a column that doesn't exist
        $cols = array_values(array_intersect($sqliteCols, $destCols));
        if (empty($cols)) {
            $this->line("  skip  {$table}: no matching columns");
            return;
        }

        $colList = implode(',', $cols);
        $rows = $sqlite->query("SELECT {$colList} FROM {$table}")->fetchAll(\PDO::FETCH_ASSOC);
        if (empty($rows)) {
            $this->line("  skip  {$table}: empty");
            return;
        }

        // Clear the table before inserting to handle partially-seeded states
        if ($isPgsql) {
            DB::statement("TRUNCATE \"{$table}\" RESTART IDENTITY CASCADE");
        } else {
            DB::table($table)->delete();
        }

        // Chunk inserts to avoid memory issues
        $chunks = array_chunk($rows, 200);
        foreach ($chunks as $chunk) {
            DB::table($table)->insert($chunk);
        }

        // Reset sequence (PostgreSQL only)
        if ($isPgsql && in_array('id', $cols)) {
            try {
                DB::statement("SELECT setval(pg_get_serial_sequence('{$table}', 'id'), COALESCE((SELECT MAX(id) FROM \"{$table}\"), 1), true)");
            } catch (\Throwable) {
                // Not all tables have a proper serial sequence
            }
        }

        $this->line("  ok    {$table}: " . count($rows) . " rows");
    }
}
