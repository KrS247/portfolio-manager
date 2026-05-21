<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Idempotent data migration: insert the "API integration" project if it does
 * not already exist in the projects table.  Safe to run on every deploy.
 */
return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::table('projects')
            ->whereRaw('LOWER(name) = ?', ['api integration'])
            ->exists();

        if ($exists) {
            return;
        }

        // Resolve the program_id — use program 1 if it exists, otherwise the first available program.
        $programId = DB::table('programs')->where('id', 1)->value('id')
            ?? DB::table('programs')->orderBy('id')->value('id');

        if (! $programId) {
            // No programs exist yet — skip silently; the project can be added manually.
            return;
        }

        // Resolve the company_id — use company 1 if present.
        $companyId = DB::table('companies')->where('id', 1)->value('id')
            ?? DB::table('companies')->orderBy('id')->value('id');

        DB::table('projects')->insert([
            'program_id'  => $programId,
            'name'        => 'API integration',
            'description' => 'INtegration the AP question into the current API',
            'status'      => 'active',
            'priority'    => 8,
            'start_date'  => '2026-05-18',
            'end_date'    => '2026-07-31',
            'is_agile'    => true,
            'company_id'  => $companyId,
            'owner_id'    => null,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('projects')
            ->whereRaw('LOWER(name) = ?', ['api integration'])
            ->delete();
    }
};
