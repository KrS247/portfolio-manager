<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sprints', function (Blueprint $table) {
            $table->id();
            $table->string('name', 200);
            $table->date('start_date');
            $table->unsignedTinyInteger('duration_weeks'); // 2–6
            $table->string('status', 20)->default('planned'); // planned | active | completed
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sprints');
    }
};
