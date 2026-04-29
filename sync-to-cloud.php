<?php
/**
 * sync-to-cloud.php
 * Syncs the local SQLite database to Supabase via REST API (HTTPS/port 443).
 * Run with: /Users/christopherganesh/homebrew/bin/php sync-to-cloud.php
 */

// ── Config ────────────────────────────────────────────────────────────────────
$SQLITE_PATH    = __DIR__ . '/backend-node/data/portfolio.db';
$BATCH_SIZE     = 200;   // rows per REST request

// ── Load credentials from .sync-secrets (gitignored) ─────────────────────────
$secretsFile = __DIR__ . '/.sync-secrets';
if (!file_exists($secretsFile)) {
    die("❌ Missing .sync-secrets file. Create it with:\n  SUPABASE_URL=https://....supabase.co\n  SUPABASE_KEY=sb_secret_...\n");
}
$secrets = parse_ini_file($secretsFile);
$SUPABASE_URL = rtrim($secrets['SUPABASE_URL'] ?? '', '/');
$SUPABASE_KEY = $secrets['SUPABASE_KEY'] ?? '';
if (!$SUPABASE_URL || !$SUPABASE_KEY) {
    die("❌ .sync-secrets must define SUPABASE_URL and SUPABASE_KEY\n");
}

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

// ── cURL helper (shared options) ──────────────────────────────────────────────
function curlGet(string $url, string $key): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ["apikey: $key", "Authorization: Bearer $key"],
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    return [$code, $body, $err];
}

// ── Connect to SQLite ─────────────────────────────────────────────────────────
echo "🔌 Connecting to local SQLite...\n";
try {
    $sqlite = new PDO("sqlite:$SQLITE_PATH");
    $sqlite->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Exception $e) {
    die("❌ SQLite connection failed: " . $e->getMessage() . "\n");
}

echo "🔌 Using Supabase REST API ($SUPABASE_URL)...\n";

// ── Verify connectivity ───────────────────────────────────────────────────────
[$pingCode, , $pingErr] = curlGet($SUPABASE_URL . '/rest/v1/', $SUPABASE_KEY);
if ($pingErr || $pingCode === 0) {
    die("❌ Cannot reach Supabase REST API: " . ($pingErr ?: "no response") . "\n");
}
echo "  ✅ Supabase REST API reachable\n";

// ── Fetch Supabase schema (OpenAPI) to know which columns exist ───────────────
echo "  📐 Fetching Supabase schema...\n";
[$schemaCode, $schemaBody] = curlGet($SUPABASE_URL . '/rest/v1/', $SUPABASE_KEY);
$schemaColumns = [];   // ['table' => ['col1', 'col2', ...]]
if ($schemaCode === 200) {
    $api = json_decode($schemaBody, true);
    $defs = $api['definitions'] ?? [];
    foreach ($defs as $tableName => $def) {
        $schemaColumns[$tableName] = array_keys($def['properties'] ?? []);
    }
}

echo "\n🚀 Starting sync...\n\n";

// ── Upsert helper ─────────────────────────────────────────────────────────────
function supabaseUpsert(string $baseUrl, string $key, string $table, array $rows, int $batchSize): array
{
    $endpoint = "$baseUrl/rest/v1/$table";
    $synced   = 0;
    $error    = null;

    foreach (array_chunk($rows, $batchSize) as $batch) {
        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => [
                "apikey: $key",
                "Authorization: Bearer $key",
                'Content-Type: application/json',
                'Prefer: resolution=merge-duplicates,return=minimal',
            ],
            CURLOPT_POSTFIELDS     => json_encode($batch),
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);

        if ($curlErr) {
            $error = "cURL error: $curlErr";
            break;
        }

        if ($httpCode >= 200 && $httpCode < 300) {
            $synced += count($batch);
        } else {
            $body  = json_decode($response, true);
            $error = "HTTP $httpCode: " . ($body['message'] ?? $body['error'] ?? trim($response));
            break;
        }
    }

    return ['synced' => $synced, 'error' => $error];
}

// ── Sync each table ───────────────────────────────────────────────────────────
$totalRows  = 0;
$skippedCols = [];

foreach ($TABLES as $table) {
    try {
        $rows = $sqlite->query("SELECT * FROM \"$table\"")->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        echo "  ⚠️  $table — SQLite read error: " . $e->getMessage() . "\n";
        continue;
    }

    if (count($rows) === 0) {
        echo "  ⏭  $table — empty, skipping\n";
        continue;
    }

    // Filter rows to only include columns that exist in Supabase schema
    if (!empty($schemaColumns[$table])) {
        $allowed  = array_flip($schemaColumns[$table]);
        $allCols  = array_keys($rows[0]);
        $dropped  = array_diff($allCols, array_keys($allowed));
        if ($dropped) {
            $skippedCols[$table] = array_values($dropped);
        }
        $rows = array_map(fn($r) => array_intersect_key($r, $allowed), $rows);
    }

    $result = supabaseUpsert($SUPABASE_URL, $SUPABASE_KEY, $table, $rows, $BATCH_SIZE);

    if ($result['error']) {
        echo "  ❌ $table — FAILED: " . $result['error'] . "\n";
    } else {
        $note = isset($skippedCols[$table])
            ? ' (skipped new cols: ' . implode(', ', $skippedCols[$table]) . ')'
            : '';
        echo "  ✅ $table — {$result['synced']} rows synced$note\n";
        $totalRows += $result['synced'];
    }
}

echo "\n✅ Sync complete — $totalRows rows synced to Supabase.\n";

if ($skippedCols) {
    echo "\n⚠️  Some columns exist locally but not yet in Supabase (run migrations on Supabase to add them):\n";
    foreach ($skippedCols as $t => $cols) {
        echo "   $t: " . implode(', ', $cols) . "\n";
    }
}
echo "\n";
