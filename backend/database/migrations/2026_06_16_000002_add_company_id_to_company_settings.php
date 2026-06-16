<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Make company_settings per-tenant (audit H1).
 *
 * The table was a global singleton (find(1)), so one tenant's admin overwrote
 * the company name/logo for every tenant and the public /logo route served
 * whichever tenant uploaded last. Add company_id, backfill the existing row(s)
 * to the lowest company id, and BelongsToTenant on the model keys settings per
 * company. Idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('company_settings') && !Schema::hasColumn('company_settings', 'company_id')) {
            Schema::table('company_settings', function (Blueprint $t) {
                $t->unsignedBigInteger('company_id')->nullable()->index()->after('id');
            });
        }

        $fallback = DB::table('companies')->min('id');
        if ($fallback && Schema::hasTable('company_settings')) {
            DB::table('company_settings')->whereNull('company_id')->update(['company_id' => $fallback]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('company_settings') && Schema::hasColumn('company_settings', 'company_id')) {
            Schema::table('company_settings', function (Blueprint $t) {
                $t->dropColumn('company_id');
            });
        }
    }
};
