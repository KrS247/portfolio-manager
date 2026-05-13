<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds sample_data_portfolio_id to the companies table.
 * Used to track the automatically-created sample portfolio created during
 * onboarding so that it can be cleaned up if the user skips onboarding
 * or wants to reset their sample data.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('companies', 'sample_data_portfolio_id')) {
            Schema::table('companies', function (Blueprint $table) {
                $table->unsignedBigInteger('sample_data_portfolio_id')->nullable()->after('onboarding_completed');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('companies', 'sample_data_portfolio_id')) {
            Schema::table('companies', function (Blueprint $table) {
                $table->dropColumn('sample_data_portfolio_id');
            });
        }
    }
};
