<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * EVM (BAC/EV/AC) is computed as Σ(hours × users.hourly_rate). If hourly_rate
 * is NULL/0 on Railway, every BAC is 0 and EVM shows nothing — even once
 * task_resources is seeded (2026_06_09_000001).
 *
 * Backfill hourly_rate from the local snapshot values, but ONLY where the
 * Railway value is NULL or 0 (never overwrite a rate set on Railway).
 *
 * Then run a quick EVM sanity check: Σ(estimated_hours × hourly_rate) across
 * all task_resources. A non-zero total confirms EVM will populate.
 */
return new class extends Migration
{
    public function up(): void
    {
        echo "\n=== BACKFILL USER HOURLY_RATE ===\n";

        // user_id => hourly_rate (from local snapshot)
        $rates = [
            1 => 150.0, 2 => 350.0, 3 => 250.0, 4 => 95.5, 5 => 350.0,
            6 => 325.0, 7 => 490.0, 8 => 490.0, 10 => 450.0,
        ];

        $updated = 0;
        foreach ($rates as $id => $rate) {
            $current = DB::table('users')->where('id', $id)->value('hourly_rate');
            if ($current === null || (float)$current == 0.0) {
                $n = DB::table('users')->where('id', $id)
                    ->update(['hourly_rate' => $rate]);
                if ($n) {
                    echo "  user {$id}: hourly_rate " . ($current ?? 'NULL') . " -> {$rate}\n";
                    $updated++;
                }
            } else {
                echo "  user {$id}: kept existing rate {$current}\n";
            }
        }
        echo "  users updated: {$updated}\n";

        // ── EVM sanity check ─────────────────────────────────────────────────
        $bac = DB::table('task_resources as tr')
            ->join('users as u', 'u.id', '=', 'tr.user_id')
            ->selectRaw('COALESCE(SUM(tr.estimated_hours * u.hourly_rate), 0) as bac,
                         COALESCE(SUM(tr.actual_hours    * u.hourly_rate), 0) as ac,
                         COUNT(*) as resource_rows')
            ->first();

        echo "\n  EVM sanity check (across all task_resources):\n";
        echo "    resource rows : {$bac->resource_rows}\n";
        echo "    Σ BAC (est×rate): " . round((float)$bac->bac, 2) . "\n";
        echo "    Σ AC  (act×rate): " . round((float)$bac->ac, 2) . "\n";
        if ((float)$bac->bac > 0) {
            echo "    => EVM will populate (BAC > 0).\n";
        } else {
            echo "    => WARNING: BAC still 0 — check task_resources seeding / hourly rates.\n";
        }

        echo "=== DONE ===\n";
    }

    public function down(): void {}
};
