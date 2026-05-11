<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use PDO;

/**
 * BackupController
 *
 * Streams a full SQL dump of the SQLite database.
 *
 * Security posture (post-hardening):
 *  - Route is now inside jwt.auth + authorize:admin.dashboard,edit middleware.
 *  - Rate-limited to 1 request per hour per IP (via named throttle:backup limiter).
 *  - Token guard is retained as a defence-in-depth secondary check.
 *  - Every access attempt (success and failure) is written to the security log.
 *
 * SOC 2: CC6.1, CC6.7, CC7.2, CC9.2
 * ISO 27001: A.8.12, A.8.15
 */
class BackupController extends Controller
{
    public function download(Request $request)
    {
        $ip    = $request->ip();
        $admin = $request->attributes->get('auth_user');

        // ── Defence-in-depth: secondary token check ───────────────────────────
        // Primary auth is now jwt.auth + admin role from middleware.
        // This token provides an additional layer so that even a compromised
        // admin JWT alone cannot trigger a backup without the token.
        $token = config('services.backup.token');

        if (empty($token)) {
            Log::critical('BackupController: BACKUP_TOKEN is not configured — endpoint rejected', [
                'ip'       => $ip,
                'admin_id' => $admin?->id,
            ]);
            return response()->json(['error' => 'Backup service not configured.'], 500);
        }

        if ($request->header('X-Backup-Token') !== $token) {
            Log::warning('BackupController: invalid X-Backup-Token header', [
                'ip'       => $ip,
                'admin_id' => $admin?->id,
            ]);
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        // ── Audit log: access granted ─────────────────────────────────────────
        Log::info('BackupController: database backup downloaded', [
            'ip'         => $ip,
            'admin_id'   => $admin?->id,
            'admin_name' => $admin?->username,
            'user_agent' => $request->userAgent(),
        ]);

        $dbPath = base_path('database/portfolio.db');
        if (!file_exists($dbPath)) {
            $dbPath = database_path('portfolio.db');
        }
        if (!file_exists($dbPath)) {
            return response()->json(['error' => 'Database file not found.'], 404);
        }

        try {
            $pdo = new PDO('sqlite:' . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql  = "-- Portfolio Manager database dump\n";
            $sql .= "-- Generated: " . date('Y-m-d H:i:s') . "\n";
            $sql .= "-- Requested by admin ID: {$admin?->id}\n\n";
            $sql .= "PRAGMA foreign_keys = OFF;\nBEGIN TRANSACTION;\n\n";

            $tables = $pdo->query(
                "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )->fetchAll(PDO::FETCH_ASSOC);

            foreach ($tables as $table) {
                $name = $table['name'];
                $sql .= "-- Table: $name\n";
                $sql .= "DROP TABLE IF EXISTS \"$name\";\n";
                $sql .= $table['sql'] . ";\n\n";

                $rows = $pdo->query("SELECT * FROM \"$name\"")->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $row) {
                    $cols = implode(', ', array_map(fn ($c) => '"' . $c . '"', array_keys($row)));
                    $vals = implode(', ', array_map(
                        fn ($v) => $v === null ? 'NULL' : $pdo->quote($v),
                        array_values($row)
                    ));
                    $sql .= "INSERT INTO \"$name\" ($cols) VALUES ($vals);\n";
                }
                $sql .= "\n";
            }

            $extras = $pdo->query(
                "SELECT sql FROM sqlite_master WHERE type IN ('index','trigger') AND sql IS NOT NULL"
            )->fetchAll(PDO::FETCH_COLUMN);
            foreach ($extras as $stmt) {
                $sql .= $stmt . ";\n";
            }

            $sql .= "\nCOMMIT;\nPRAGMA foreign_keys = ON;\n";

            $filename = 'portfolio_backup_' . date('Y-m-d_His') . '.sql';

            return response($sql, 200)
                ->header('Content-Type', 'text/plain; charset=utf-8')
                ->header('Content-Disposition', 'attachment; filename="' . $filename . '"');

        } catch (\Throwable $e) {
            Log::error('BackupController: error generating dump', ['error' => $e->getMessage(), 'ip' => $ip]);
            return response()->json(['error' => 'Failed to generate backup.'], 500);
        }
    }
}
