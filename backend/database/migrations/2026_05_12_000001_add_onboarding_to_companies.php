<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Add onboarding_completed to the companies table.
 *
 * New rows default to false (new tenants must go through the wizard).
 * Existing rows are backfilled to true (they already have data — skip wizard).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('companies', 'onboarding_completed')) {
            Schema::table('companies', function (Blueprint $table) {
                $table->boolean('onboarding_completed')->default(false)->after('owner_email');
            });

            // Backfill existing rows — they already have real data so mark as done.
            DB::table('companies')->update(['onboarding_completed' => true]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('companies', 'onboarding_completed')) {
            Schema::table('companies', function (Blueprint $table) {
                $table->dropColumn('onboarding_completed');
            });
        }
    }
};
