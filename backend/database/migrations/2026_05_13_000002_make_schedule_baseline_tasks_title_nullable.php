<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Makes schedule_baseline_tasks.title nullable.
 *
 * The local SQLite snapshot uses an older schema for this table (baseline_start_date,
 * baseline_finish_date) that predates the addition of the title column.  Keeping title
 * nullable lets the snapshot seeder import the baseline task rows without errors while
 * still allowing the application to populate the title when creating new baselines.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('schedule_baseline_tasks', 'title')) {
            Schema::table('schedule_baseline_tasks', function (Blueprint $table) {
                $table->string('title')->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('schedule_baseline_tasks', 'title')) {
            Schema::table('schedule_baseline_tasks', function (Blueprint $table) {
                $table->string('title')->nullable(false)->change();
            });
        }
    }
};
