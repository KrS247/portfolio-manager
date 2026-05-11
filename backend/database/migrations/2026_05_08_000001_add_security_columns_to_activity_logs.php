<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add ip_address and user_agent to activity_logs.
 *
 * Required for SOC 2 CC7.2 (anomaly detection) and ISO 27001 A.8.15 (logging).
 * Without the originating IP and browser fingerprint, security events cannot be
 * correlated with intrusion or account-takeover investigations.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('activity_logs')) {
            return;
        }

        Schema::table('activity_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('activity_logs', 'ip_address')) {
                $table->string('ip_address', 45)->nullable()->after('user_id');
            }
            if (!Schema::hasColumn('activity_logs', 'user_agent')) {
                $table->string('user_agent', 512)->nullable()->after('ip_address');
            }
            if (!Schema::hasColumn('activity_logs', 'created_at')) {
                $table->timestamp('created_at')->nullable()->useCurrent();
            }
        });
    }

    public function down(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropColumn(array_filter(
                ['ip_address', 'user_agent'],
                fn ($col) => Schema::hasColumn('activity_logs', $col)
            ));
        });
    }
};
