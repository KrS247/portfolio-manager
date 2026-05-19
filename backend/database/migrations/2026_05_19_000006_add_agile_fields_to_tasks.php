<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('tasks', function (Blueprint $table) {
            $table->unsignedBigInteger('sprint_id')->nullable()->after('parent_task_id');
            $table->string('task_type', 50)->nullable()->after('sprint_id'); // 'feature' | 'bug_fix'
            $table->unsignedBigInteger('agile_phase_id')->nullable()->after('task_type');

            $table->foreign('sprint_id')->references('id')->on('sprints')->nullOnDelete();
            $table->foreign('agile_phase_id')->references('id')->on('agile_phases')->nullOnDelete();
        });
    }

    public function down(): void {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['sprint_id']);
            $table->dropForeign(['agile_phase_id']);
            $table->dropColumn(['sprint_id', 'task_type', 'agile_phase_id']);
        });
    }
};
