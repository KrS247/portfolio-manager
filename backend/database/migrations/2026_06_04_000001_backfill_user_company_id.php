<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Root-cause fix for "logged-in admin sees an empty app".
 *
 * TenantScope filters EVERY tenant-scoped query (portfolios, programs,
 * projects, tasks…) by the *logged-in user's* company_id. Admins bypass the
 * ownership filter (visibleScope) but NOT the tenant filter — so an admin
 * whose own company_id is NULL (or anything other than 1) sees nothing, even
 * though all the data lives in company_id = 1.
 *
 * The users table's company_id column was never backfilled on Railway, so any
 * user created/imported without it is effectively locked out of all data.
 *
 * Fix: stamp company_id = 1 on every user whose company_id IS NULL.
 * Users that already have a non-NULL company_id (e.g. the company-2 accounts)
 * are left untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        echo "\n=== BACKFILL USER COMPANY_ID ===\n";

        // ── Diagnostic dump (no secrets — id / username / company_id / admin) ─
        $users = DB::table('users')
            ->leftJoin('roles', 'users.role_id', '=', 'roles.id')
            ->select('users.id', 'users.username', 'users.company_id', 'roles.name as role', 'roles.is_admin')
            ->orderBy('users.id')
            ->get();

        echo "  Before:\n";
        foreach ($users as $u) {
            echo "    user {$u->id} [{$u->username}] company_id="
                . ($u->company_id ?? 'NULL')
                . " role=" . ($u->role ?? '-')
                . " admin=" . ($u->is_admin ? 'yes' : 'no') . "\n";
        }

        // ── Backfill NULL company_id → 1 (single active tenant) ───────────────
        $nullCount = DB::table('users')->whereNull('company_id')->count();
        echo "  users with NULL company_id: {$nullCount}\n";

        if ($nullCount > 0) {
            $fixed = DB::table('users')
                ->whereNull('company_id')
                ->update(['company_id' => 1]);
            echo "  users backfilled to company_id=1: {$fixed}\n";
        } else {
            echo "  nothing to backfill\n";
        }

        // ── After breakdown ───────────────────────────────────────────────────
        echo "  After:\n";
        $breakdown = DB::table('users')
            ->selectRaw('company_id, count(*) as cnt')
            ->groupBy('company_id')
            ->orderBy('company_id')
            ->get();
        foreach ($breakdown as $row) {
            echo "    company_id=" . ($row->company_id ?? 'NULL') . ": {$row->cnt} users\n";
        }

        echo "=== DONE ===\n";
    }

    public function down(): void {}
};
