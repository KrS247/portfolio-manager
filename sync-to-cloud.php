<?php
/**
 * sync-to-cloud.php
 * Syncs the local SQLite database to the Supabase PostgreSQL database.
 * Run with: /Users/christopherganesh/homebrew/bin/php sync-to-cloud.php
 */

// ── Config ────────────────────────────────────────────────────────────────────
$SQLITE_PATH = __DIR__ . '/backend-node/data/portfolio.db';

$PG_HOST = 'db.qnlhbqjcrbtdzousaekt.supabase.co';
$PG_PORT = 5432;
$PG_DB   = 'postgres';
$PG_USER = 'postgres';
$PG_PASS = 'w5lLBLUvUT5YYKUY';

// ── Tables in dependency order (parents before children) ─────────────────────
$TABLES = [
    'roles',
    'teams',
    'users',
    'pages',
    'page_permissions',
    'company_settings',
    'working_calendar_settings',
    'public_holidays',
    'user_working_calendars',
    'portfolios',
    'programs',
    'projects',
    'tasks',
    'risks',
    'task_dependencies',
    'task_resources',
    'schedule_baselines',
    'schedule_baseline_tasks',
    'migrations',
];

// ── Connect ───────────────────────────────────────────────────────────────────
echo "🔌 Connecting to local SQLite...\n";
try {
    $sqlite = new PDO("sqlite:$SQLITE_PATH");
    $sqlite->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Exception $e) {
    die("❌ SQLite connection failed: " . $e->getMessage() . "\n");
}

echo "🔌 Connecting to Supabase PostgreSQL...\n";
try {
    $pg = new PDO("pgsql:host=$PG_HOST;port=$PG_PORT;dbname=$PG_DB", $PG_USER, $PG_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (Exception $e) {
    die("❌ Supabase connection failed: " . $e->getMessage() . "\n");
}

echo "\n🚀 Starting sync...\n\n";

$totalRows = 0;

foreach ($TABLES as $table) {
    // Fetch all rows from SQLite
    $rows = $sqlite->query("SELECT * FROM \"$table\"")->fetchAll(PDO::FETCH_ASSOC);
    $count = count($rows);

    if ($count === 0) {
        echo "  ⏭  $table — empty, skipping\n";
        continue;
    }

    // Get columns from first row
    $cols = array_keys($rows[0]);
    $quotedCols = array_map(fn($c) => "\"$c\"", $cols);
    $placeholders = array_map(fn($c) => ":$c", $cols);

    // Build UPSERT (INSERT ... ON CONFLICT DO UPDATE)
    $updateCols = array_filter($cols, fn($c) => $c !== 'id');
    $updateClause = implode(', ', array_map(fn($c) => "\"$c\" = EXCLUDED.\"$c\"", $updateCols));

    $sql = sprintf(
        'INSERT INTO "%s" (%s) VALUES (%s) ON CONFLICT (id) DO UPDATE SET %s',
        $table,
        implode(', ', $quotedCols),
        implode(', ', $placeholders),
        $updateClause
    );

    $stmt = $pg->prepare($sql);

    $pg->beginTransaction();
    $inserted = 0;
    try {
        foreach ($rows as $row) {
            // Convert SQLite booleans (0/1) for boolean columns
            $stmt->execute($row);
            $inserted++;
        }
        $pg->commit();

        // Reset the sequence to max(id) so new inserts don't conflict
        try {
            $pg->exec("SELECT setval('{$table}_id_seq', (SELECT COALESCE(MAX(id), 1) FROM \"$table\"))");
        } catch (Exception $e) {
            // Table may not have a sequence (e.g. no id column) — ignore
        }

        echo "  ✅ $table — $inserted rows synced\n";
        $totalRows += $inserted;
    } catch (Exception $e) {
        $pg->rollBack();
        echo "  ❌ $table — FAILED: " . $e->getMessage() . "\n";
    }
}

echo "\n✅ Sync complete — $totalRows rows synced to Supabase.\n\n";
