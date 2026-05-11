<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('risks')) {
            return; // table created by snapshot; nothing to alter in test env
        }
        if (Schema::hasColumn('risks', 'status')) {
            return; // already applied
        }
        Schema::table('risks', function (Blueprint $table) {
            $table->string('status')->default('open')->after('mitigation_plan');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('risks') || !Schema::hasColumn('risks', 'status')) {
            return;
        }
        Schema::table('risks', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
