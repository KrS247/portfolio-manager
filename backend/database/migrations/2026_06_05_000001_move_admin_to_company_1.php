<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The default 'admin' account (user 1, admin@localhost) was assigned to
 * company 2 (ERM), but all portfolios/programs/projects/tasks live in
 * company 1. Because TenantScope filters by the logged-in user's company_id,
 * the admin account saw an empty app.
 *
 * Move user 1 to company_id = 1 so it can administer the company-1 data.
 * Matched by username + email to avoid touching the wrong row if IDs differ
 * between environments.
 */
return new class extends Migration
{
    public function up(): void
    {
        echo "\n=== MOVE ADMIN TO COMPANY 1 ===\n";

        $before = DB::table('users')
            ->where('username', 'admin')
            ->orWhere('email', 'admin@localhost')
            ->get(['id', 'username', 'email', 'company_id']);

        foreach ($before as $u) {
            echo "  before: user {$u->id} [{$u->username}] company_id=" . ($u->company_id ?? 'NULL') . "\n";
        }

        $updated = DB::table('users')
            ->where(function ($q) {
                $q->where('username', 'admin')->orWhere('email', 'admin@localhost');
            })
            ->update(['company_id' => 1]);

        echo "  rows updated: {$updated}\n";

        $after = DB::table('users')
            ->where('username', 'admin')
            ->orWhere('email', 'admin@localhost')
            ->get(['id', 'username', 'company_id']);

        foreach ($after as $u) {
            echo "  after:  user {$u->id} [{$u->username}] company_id=" . ($u->company_id ?? 'NULL') . "\n";
        }

        echo "=== DONE ===\n";
    }

    public function down(): void {}
};
