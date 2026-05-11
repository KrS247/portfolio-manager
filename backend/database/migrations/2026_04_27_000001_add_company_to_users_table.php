<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'company')) {
            return;
        }
        Schema::table('users', function (Blueprint $table) {
            $table->string('company')->nullable()->after('email');
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('users', 'company')) {
            return;
        }
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('company');
        });
    }
};
