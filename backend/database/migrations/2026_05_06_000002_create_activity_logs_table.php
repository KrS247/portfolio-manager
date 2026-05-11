<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->string('loggable_type');          // 'task', 'project', 'program', 'portfolio'
            $table->unsignedBigInteger('loggable_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('action');                  // created, updated, deleted, status_changed, etc.
            $table->text('description')->nullable();   // human-readable summary
            $table->json('changes')->nullable();       // {field: [old, new], ...}
            $table->timestamp('created_at')->useCurrent();

            $table->index(['loggable_type', 'loggable_id']);
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
