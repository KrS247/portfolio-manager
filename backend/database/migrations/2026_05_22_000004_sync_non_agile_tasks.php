<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Diagnostic + sync migration.
 *
 * 1. Dumps every project that exists on Railway (stdout → Railway log).
 * 2. Dumps current task count per project.
 * 3. Inserts all 30 non-agile tasks that are still missing.
 *
 * Uses ILIKE (Postgres) / LIKE + LOWER (SQLite) so name-matching is
 * case-insensitive and immune to leading/trailing whitespace.
 * Falls back to a partial-match if the exact name isn't found.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        // ── 1. Diagnostic: list every project on Railway ─────────────────────
        $allProjects = DB::table('projects')
            ->select('id', 'name', 'program_id')
            ->orderBy('id')
            ->get();

        echo "\n=== PROJECTS ON RAILWAY ===\n";
        foreach ($allProjects as $p) {
            echo "  id={$p->id}  prog={$p->program_id}  name=[{$p->name}]\n";
        }

        // ── 2. Diagnostic: current task counts per project ────────────────────
        $taskCounts = DB::table('tasks')
            ->selectRaw('parent_id, count(*) as cnt')
            ->where('parent_type', 'project')
            ->groupBy('parent_id')
            ->pluck('cnt', 'parent_id');

        echo "\n=== TASK COUNTS PER PROJECT (before insert) ===\n";
        foreach ($allProjects as $p) {
            echo "  project {$p->id}: " . ($taskCounts[$p->id] ?? 0) . " tasks\n";
        }

        // ── 3. Resolve project IDs ─────────────────────────────────────────────
        // Build a name→id lookup that tolerates whitespace and case differences.
        $projectIndex = [];   // lower-trimmed-name => id
        $progIndex    = [];   // lower-trimmed-name => id

        foreach (DB::table('programs')->get() as $pr) {
            $progIndex[strtolower(trim($pr->name))] = $pr->id;
        }
        foreach ($allProjects as $p) {
            $projectIndex[strtolower(trim($p->name))][] = ['id' => $p->id, 'program_id' => $p->program_id];
        }

        // Helper: find a single project ID, optionally disambiguated by program name
        $findProject = function (string $name, ?string $programName = null) use ($projectIndex, $progIndex): ?int {
            $key = strtolower(trim($name));

            // Exact key match
            $candidates = $projectIndex[$key] ?? null;

            // Fallback: partial key match (handles minor name differences)
            if (!$candidates) {
                foreach ($projectIndex as $k => $rows) {
                    if (str_contains($k, $key) || str_contains($key, $k)) {
                        $candidates = $rows;
                        break;
                    }
                }
            }

            if (!$candidates) {
                echo "  [WARN] project not found: [{$name}]\n";
                return null;
            }

            if (count($candidates) === 1 || $programName === null) {
                return $candidates[0]['id'];
            }

            // Disambiguate using program name
            $progKey  = strtolower(trim($programName));
            $targetProg = $progIndex[$progKey] ?? null;

            // Partial program match
            if (!$targetProg) {
                foreach ($progIndex as $k => $id) {
                    if (str_contains($k, $progKey) || str_contains($progKey, $k)) {
                        $targetProg = $id;
                        break;
                    }
                }
            }

            if ($targetProg) {
                foreach ($candidates as $c) {
                    if ($c['program_id'] == $targetProg) {
                        return $c['id'];
                    }
                }
            }

            // Last resort: return first candidate
            echo "  [WARN] ambiguous project [{$name}] — using first match\n";
            return $candidates[0]['id'];
        };

        $p1  = $findProject('Phase 1 Build A service to generate Audit Protocols');
        $p2  = $findProject('Phase 2 Build a the Front end User Interface');
        $p3  = $findProject('Phase 3 Integration into Assess');
        $p4  = $findProject('Self Service Build');
        $p5  = $findProject('BDA Integration');
        $p6  = $findProject('Automated Workflow', 'Document Parsing');
        $p7  = $findProject('Automation of Trends Generation');
        $p8  = $findProject('Front UI');
        $p9  = $findProject('Automated Workflow', 'Horizons');
        $p10 = $findProject('Dover Integrations');
        $p11 = $findProject('Huntsman Integration');

        echo "\n=== RESOLVED PROJECT IDs ===\n";
        echo "  p1={$p1}  p2={$p2}  p3={$p3}  p4={$p4}  p5={$p5}\n";
        echo "  p6={$p6}  p7={$p7}  p8={$p8}  p9={$p9}  p10={$p10}  p11={$p11}\n";

        // ── 4. Task definitions ────────────────────────────────────────────────
        // [ title, status, priority, start_date, due_date, percent_complete, project_id ]
        $tasks = [
            // Project 1
            ['Development',              'in_progress', 4, '2026-06-10', '2026-06-26', 50,  $p1],
            // Project 2
            ['Analysis',                 'in_progress', 5, '2026-02-09', '2026-02-28', 95,  $p2],
            ['Development',              'in_progress', 5, '2026-03-16', '2026-03-20', 95,  $p2],
            ['Design',                   'in_progress', 5, '2026-05-05', '2026-07-09', 90,  $p2],
            // Project 3
            ['Analysis',                 'in_progress', 5, '2026-03-09', '2026-03-13', 60,  $p3],
            ['Design',                   'in_progress', 5, '2026-03-16', '2026-03-20', 25,  $p3],
            ['Development',              'in_progress', 5, '2026-03-23', '2026-03-27', 15,  $p3],
            // Project 4
            ['Test 1',                   'in_progress', 5, '2026-06-16', '2026-08-21', 25,  $p4],
            // Project 5
            ['Design',                   'in_progress', 5, '2026-03-16', '2026-06-30', 35,  $p5],
            ['Development',              'in_progress', 5, '2026-06-09', '2026-09-10', 20,  $p5],
            // Project 6 — Automated Workflow (Document Parsing)
            ['Design',                   'in_progress', 10,'2026-03-19', '2026-06-16', 55,  $p6],
            ['Analysis',                 'in_progress', 5, '2026-01-01', '2026-03-02', 80,  $p6],
            // Project 7
            ['Analysis',                 'completed',   3, '2026-03-18', '2026-03-25', 100, $p7],
            ['Design',                   'completed',   8, '2026-03-26', '2026-06-17', 100, $p7],
            ['Dev Completed',            'completed',   5, null,         '2026-06-30', 100, $p7],
            ['Development',              'completed',   5, '2026-05-04', '2026-06-30', 100, $p7],
            // Project 8
            ['Design',                   'in_progress', 9, '2026-06-01', '2026-06-26', 40,  $p8],
            ['Build',                    'in_progress', 6, '2026-09-09', '2026-11-26', 10,  $p8],
            // Project 9 — Automated Workflow (Horizons)
            ['Analysis',                 'completed',   4, '2026-03-02', '2026-04-30', 100, $p9],
            ['Design',                   'completed',   8, '2026-04-30', '2026-05-27', 100, $p9],
            ['Development',              'in_progress', 4, '2026-05-27', '2026-08-26', 75,  $p9],
            ['Test3',                    'in_progress', 5, '2026-08-26', '2026-09-23', 25,  $p9],
            ['Launch Day Milestone',     'open',        5, '2026-09-23', '2026-09-24', 0,   $p9],
            // Project 10
            ['Analysis',                 'in_progress', 5, '2026-02-02', '2026-03-31', 30,  $p10],
            // Project 11
            ['Analysis',                 'in_progress', 5, '2026-03-16', '2026-03-25', 35,  $p11],
            ['Field Mapping',            'open',        5, '2026-03-25', '2026-05-11', 0,   $p11],
            ['Web Dev',                  'open',        5, '2026-05-11', '2026-06-09', 0,   $p11],
            ['Technical Specification',  'in_progress', 5, '2026-03-16', '2026-03-25', 30,  $p11],
            ['AC Approval',              'open',        5, '2026-03-16', '2026-03-20', 0,   $p11],
            ['Input from Lead Architect','in_progress', 5, '2026-03-13', '2026-03-16', 25,  $p11],
        ];

        // ── 5. Insert missing tasks ───────────────────────────────────────────
        echo "\n=== INSERTING MISSING TASKS ===\n";

        $inserted = 0;
        $skipped  = 0;

        foreach ($tasks as [$title, $status, $priority, $start, $due, $pct, $projectId]) {
            if (!$projectId) {
                echo "  SKIP (no project) [{$title}]\n";
                $skipped++;
                continue;
            }

            $exists = DB::table('tasks')
                ->whereRaw('LOWER(TRIM(title)) = LOWER(TRIM(?))', [$title])
                ->where('parent_type', 'project')
                ->where('parent_id', $projectId)
                ->exists();

            if ($exists) {
                $skipped++;
                continue;
            }

            DB::table('tasks')->insert([
                'title'            => trim($title),
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

            echo "  INSERT project={$projectId} [{$title}]\n";
            $inserted++;
        }

        echo "\n=== DONE: inserted={$inserted}  skipped={$skipped} ===\n";
    }

    public function down(): void {}
};
