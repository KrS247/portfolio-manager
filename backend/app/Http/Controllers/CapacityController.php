<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Task;
use App\Models\WorkingCalendarSetting;
use Carbon\Carbon;

/**
 * CapacityController – Resource Capacity Planning
 *
 * GET /capacity?from=YYYY-MM-DD&to=YYYY-MM-DD&parent_type=portfolio&parent_id=1
 *
 * Distributes estimated_hours from task_resources evenly across working days
 * within each task's start_date → due_date window, then groups by ISO week.
 *
 * Returns:
 *   weeks          – array of Monday dates (YYYY-MM-DD)
 *   week_capacities – { 'YYYY-MM-DD': hours } capacity per week
 *   resources       – per-user breakdown with per-week allocated/capacity/utilisation/tasks
 */
class CapacityController extends Controller
{
    public function index(Request $request)
    {
        // ── Date range ──────────────────────────────────────────────────────
        $from = $request->from
            ? Carbon::parse($request->from)->startOfWeek(Carbon::MONDAY)
            : Carbon::today()->startOfWeek(Carbon::MONDAY);

        $to = $request->to
            ? Carbon::parse($request->to)->endOfWeek(Carbon::SUNDAY)
            : $from->copy()->addWeeks(11)->endOfWeek(Carbon::SUNDAY);

        // ── Scope ───────────────────────────────────────────────────────────
        $parentType = $request->parent_type;
        $parentId   = (int)($request->parent_id ?? 0);

        $tasks = ($parentType && $parentId)
            ? $this->loadTasks($parentType, $parentId)
            : Task::with(['resources.user'])->get();

        // ── Working calendar ────────────────────────────────────────────────
        $calendar    = WorkingCalendarSetting::first();
        $workDays    = $calendar
            ? array_map('intval', explode(',', $calendar->work_days))
            : [1, 2, 3, 4, 5]; // Mon–Fri
        $hoursPerDay = $calendar ? (float)($calendar->hours_per_day ?? 8) : 8.0;

        // ── Generate week-start dates (Mondays) ─────────────────────────────
        $weeks  = [];
        $cursor = $from->copy();
        while ($cursor->lte($to)) {
            $weeks[] = $cursor->format('Y-m-d');
            $cursor->addWeek();
        }

        // ── Per-week capacity ───────────────────────────────────────────────
        $weekCapacities = [];
        foreach ($weeks as $weekStart) {
            $ws = Carbon::parse($weekStart);
            $we = $ws->copy()->endOfWeek(Carbon::SUNDAY);
            $working = 0;
            $d = $ws->copy();
            while ($d->lte($we)) {
                if (in_array($d->dayOfWeekIso, $workDays)) $working++;
                $d->addDay();
            }
            $weekCapacities[$weekStart] = round($working * $hoursPerDay, 2);
        }

        // ── Build per-user weekly allocation ────────────────────────────────
        $users = [];

        foreach ($tasks as $task) {
            if (!$task->start_date || !$task->due_date) continue;

            $taskStart = Carbon::parse($task->start_date)->startOfDay();
            $taskEnd   = Carbon::parse($task->due_date)->startOfDay();

            // Total working days in task span
            $totalWorkDays = 0;
            $d = $taskStart->copy();
            while ($d->lte($taskEnd)) {
                if (in_array($d->dayOfWeekIso, $workDays)) $totalWorkDays++;
                $d->addDay();
            }
            $totalWorkDays = max(1, $totalWorkDays);

            foreach ($task->resources as $resource) {
                $userId = $resource->user_id;
                if (!$userId) continue;

                $estHours = (float)($resource->estimated_hours ?? 0);
                if ($estHours <= 0) continue;

                $hoursPerWorkDay = $estHours / $totalWorkDays;

                // Initialise user bucket if needed
                if (!isset($users[$userId])) {
                    $users[$userId] = [
                        'user_id'     => $userId,
                        'user_name'   => $resource->user?->username ?? "User $userId",
                        'hourly_rate' => (float)($resource->user?->hourly_rate ?? 0),
                        'weeks'       => [],
                    ];
                    foreach ($weeks as $w) {
                        $users[$userId]['weeks'][$w] = ['allocated' => 0.0, 'tasks' => []];
                    }
                }

                // Distribute hours across overlapping weeks
                foreach ($weeks as $weekStart) {
                    $ws = Carbon::parse($weekStart);
                    $we = $ws->copy()->endOfWeek(Carbon::SUNDAY);

                    $overlapStart = $taskStart->gt($ws) ? $taskStart->copy() : $ws->copy();
                    $overlapEnd   = $taskEnd->lt($we)   ? $taskEnd->copy()   : $we->copy();

                    if ($overlapStart->gt($overlapEnd)) continue;

                    // Count working days in overlap window
                    $overlapWorkDays = 0;
                    $d = $overlapStart->copy();
                    while ($d->lte($overlapEnd)) {
                        if (in_array($d->dayOfWeekIso, $workDays)) $overlapWorkDays++;
                        $d->addDay();
                    }
                    if ($overlapWorkDays <= 0) continue;

                    $weekHours = round($hoursPerWorkDay * $overlapWorkDays, 2);
                    $users[$userId]['weeks'][$weekStart]['allocated'] += $weekHours;
                    $users[$userId]['weeks'][$weekStart]['tasks'][] = [
                        'task_id'    => $task->id,
                        'task_title' => $task->title,
                        'hours'      => $weekHours,
                    ];
                }
            }
        }

        // ── Build response ──────────────────────────────────────────────────
        $result = array_values(array_map(function ($u) use ($weekCapacities) {
            $weekData = [];
            foreach ($u['weeks'] as $ws => $data) {
                $cap   = $weekCapacities[$ws] ?? 40;
                $alloc = round($data['allocated'], 2);
                $weekData[$ws] = [
                    'allocated'   => $alloc,
                    'capacity'    => $cap,
                    'utilisation' => $cap > 0 ? round(($alloc / $cap) * 100, 1) : 0,
                    'tasks'       => $data['tasks'],
                ];
            }
            return [
                'user_id'     => $u['user_id'],
                'user_name'   => $u['user_name'],
                'hourly_rate' => $u['hourly_rate'],
                'weeks'       => $weekData,
            ];
        }, $users));

        usort($result, fn($a, $b) => strcmp($a['user_name'], $b['user_name']));

        return response()->json([
            'weeks'           => $weeks,
            'week_capacities' => $weekCapacities,
            'resources'       => $result,
        ]);
    }

    // ── Shared scope resolver ──────────────────────────────────────────────
    private function loadTasks(string $parentType, int $parentId)
    {
        if ($parentType === 'portfolio') {
            $programIds = \App\Models\Program::where('portfolio_id', $parentId)->pluck('id');
            $projectIds = \App\Models\Project::whereIn('program_id', $programIds)->pluck('id');
            return Task::with(['resources.user'])
                ->where(function ($q) use ($parentId, $programIds, $projectIds) {
                    $q->where(fn($sq) => $sq->where('parent_type', 'portfolio')->where('parent_id', $parentId))
                      ->orWhere(fn($sq) => $sq->where('parent_type', 'program')->whereIn('parent_id', $programIds))
                      ->orWhere(fn($sq) => $sq->where('parent_type', 'project')->whereIn('parent_id', $projectIds));
                })->get();
        }

        if ($parentType === 'program') {
            $projectIds = \App\Models\Project::where('program_id', $parentId)->pluck('id');
            return Task::with(['resources.user'])
                ->where(function ($q) use ($parentId, $projectIds) {
                    $q->where(fn($sq) => $sq->where('parent_type', 'program')->where('parent_id', $parentId))
                      ->orWhere(fn($sq) => $sq->where('parent_type', 'project')->whereIn('parent_id', $projectIds));
                })->get();
        }

        return Task::with(['resources.user'])
            ->where('parent_type', $parentType)
            ->where('parent_id', $parentId)
            ->get();
    }
}
