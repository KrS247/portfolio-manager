<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('agile_phases', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('description', 500)->nullable();
            $table->unsignedInteger('sequence')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('agile_phases');
    }
};
