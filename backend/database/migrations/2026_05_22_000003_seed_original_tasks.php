<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Idempotent migration — seeds the 30 original tasks (projects 1–11) from the
 * local SQLite snapshot into Railway Postgres.
 *
 * Skips tasks for the "API integration" project; those were handled by the
 * earlier 2026_05_21_000002 migration.
 *
 * Idempotency key: LOWER(TRIM(title)) + parent_type + parent_id.
 * Safe to re-run; will not create duplicates.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        // ── Resolve project IDs by name + program context ────────────────────
        // Two projects share the name "Automated Workflow" — disambiguate via program.

        // Helper closure
        $proj = function (string $name, ?string $programName = null) {
            $q = DB::table('projects')->whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($name))]);
            if ($programName !== null) {
                $progId = DB::table('programs')
                    ->whereRaw('LOWER(TRIM(name)) LIKE ?', [strtolower(trim($programName)) . '%'])
                    ->value('id');
                if ($progId) {
                    $q->where('program_id', $progId);
                }
            }
            return $q->value('id');
        };

        $p1  = $proj('Phase 1 Build A service to generate Audit Protocols');
        $p2  = $proj('Phase 2 Build a the Front end User Interface');
        $p3  = $proj('Phase 3 Integration into Assess');
        $p4  = $proj('Self Service Build');
        $p5  = $proj('BDA Integration');
        $p6  = $proj('Automated Workflow', 'Document Parsing');   // program 3
        $p7  = $proj('Automation of Trends Generation');
        $p8  = $proj('Front UI');
        $p9  = $proj('Automated Workflow', 'Horizons');           // program 2
        $p10 = $proj('Dover Integrations');
        $p11 = $proj('Huntsman Integration');

        // ── Task definitions ─────────────────────────────────────────────────
        // Format: [ title, status, priority, start_date, due_date, pct, project_id ]
        // assigned_to intentionally omitted — user IDs may differ per environment.

        $tasks = [
            // Project 1 – Phase 1 Audit Protocols
            ['Development',                    'in_progress', 4, '2026-06-10', '2026-06-26', 50,  $p1],

            // Project 2 – Phase 2 Front-end UI
            ['Analysis',                       'in_progress', 5, '2026-02-09', '2026-02-28', 95,  $p2],
            ['Development',                    'in_progress', 5, '2026-03-16', '2026-03-20', 95,  $p2],
            ['Design',                         'in_progress', 5, '2026-05-05', '2026-07-09', 90,  $p2],

            // Project 3 – Phase 3 Integration into Assess
            ['Analysis',                       'in_progress', 5, '2026-03-09', '2026-03-13', 60,  $p3],
            ['Design',                         'in_progress', 5, '2026-03-16', '2026-03-20', 25,  $p3],
            ['Development',                    'in_progress', 5, '2026-03-23', '2026-03-27', 15,  $p3],

            // Project 4 – Self Service Build
            ['Test 1',                         'in_progress', 5, '2026-06-16', '2026-08-21', 25,  $p4],

            // Project 5 – BDA Integration
            ['Design',                         'in_progress', 5, '2026-03-16', '2026-06-30', 35,  $p5],
            ['Development',                    'in_progress', 5, '2026-06-09', '2026-09-10', 20,  $p5],

            // Project 6 – Automated Workflow (Document Parsing)
            ['Design',                         'in_progress', 10, '2026-03-19', '2026-06-16', 55, $p6],
            ['Analysis',                       'in_progress', 5,  '2026-01-01', '2026-03-02', 80, $p6],

            // Project 7 – Automation of Trends Generation
            ['Analysis',                       'completed',   3, '2026-03-18', '2026-03-25', 100, $p7],
            ['Design',                         'completed',   8, '2026-03-26', '2026-06-17', 100, $p7],
            ['Dev Completed',                  'completed',   5, null,          '2026-06-30', 100, $p7],
            ['Development',                    'completed',   5, '2026-05-04', '2026-06-30', 100, $p7],

            // Project 8 – Front UI
            ['Design',                         'in_progress', 9, '2026-06-01', '2026-06-26', 40,  $p8],
            ['Build',                          'in_progress', 6, '2026-09-09', '2026-11-26', 10,  $p8],

            // Project 9 – Automated Workflow (Horizons)
            ['Analysis',                       'completed',   4, '2026-03-02', '2026-04-30', 100, $p9],
            ['Design',                         'completed',   8, '2026-04-30', '2026-05-27', 100, $p9],
            ['Development',                    'in_progress', 4, '2026-05-27', '2026-08-26', 75,  $p9],
            ['Test3',                          'in_progress', 5, '2026-08-26', '2026-09-23', 25,  $p9],
            ['Launch Day Milestone',           'open',        5, '2026-09-23', '2026-09-24', 0,   $p9],

            // Project 10 – Dover Integrations
            ['Analysis',                       'in_progress', 5, '2026-02-02', '2026-03-31', 30,  $p10],

            // Project 11 – Huntsman Integration
            ['Analysis',                       'in_progress', 5, '2026-03-16', '2026-03-25', 35,  $p11],
            ['Field Mapping',                  'open',        5, '2026-03-25', '2026-05-11', 0,   $p11],
            ['Web Dev',                        'open',        5, '2026-05-11', '2026-06-09', 0,   $p11],
            ['Technical Specification',        'in_progress', 5, '2026-03-16', '2026-03-25', 30,  $p11],
            ['AC Approval',                    'open',        5, '2026-03-16', '2026-03-20', 0,   $p11],
            ['Input from Lead Architect',      'in_progress', 5, '2026-03-13', '2026-03-16', 25,  $p11],
        ];

        $inserted = 0;
        $skipped  = 0;

        foreach ($tasks as [$title, $status, $priority, $start, $due, $pct, $projectId]) {
            if (!$projectId) {
                $skipped++;
                continue;
            }

            $exists = DB::table('tasks')
                ->whereRaw('LOWER(TRIM(title)) = ?', [strtolower(trim($title))])
                ->where('parent_type', 'project')
                ->where('parent_id', $projectId)
                ->exists();

            if ($exists) {
                $skipped++;
                continue;
            }

            DB::table('tasks')->insert([
                'title'            => $title,
                'status'           => $status,
                'priority'         => $priority,
                'start_date'       => $start,
                'due_date'         => $due,
                'percent_complete' => $pct,
                'parent_type'      => 'project',
                'parent_id'        => $projectId,
                'created_at'       => $now,
                'updated_at'       => $now,
            ]);

            $inserted++;
        }

        \Log::info("seed_original_tasks: inserted={$inserted} skipped={$skipped}");
    }

    public function down(): void
    {
        // Non-destructive — down() intentionally left empty.
    }
};
