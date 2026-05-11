<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('tasks')) {
            return; // tasks created by snapshot; will be built by DatabaseTestCase in test env
        }
        Schema::table('tasks', function (Blueprint $table) {
            // Recurrence (Feature 8)
            if (!Schema::hasColumn('tasks', 'recurrence_type')) {
                $table->string('recurrence_type')->nullable();    // daily, weekly, monthly, none
            }
            if (!Schema::hasColumn('tasks', 'recurrence_interval')) {
                $table->unsignedInteger('recurrence_interval')->default(1);
            }
            if (!Schema::hasColumn('tasks', 'recurrence_end_date')) {
                $table->date('recurrence_end_date')->nullable();
            }
            if (!Schema::hasColumn('tasks', 'recurrence_parent_id')) {
                $table->unsignedBigInteger('recurrence_parent_id')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn(['recurrence_type', 'recurrence_interval', 'recurrence_end_date', 'recurrence_parent_id']);
        });
    }
};
