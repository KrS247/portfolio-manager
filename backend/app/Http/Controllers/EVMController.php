<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Task;
use App\Models\TaskResource;
use Carbon\Carbon;

/**
 * EVMController – Earned Value Management metrics
 *
 * Supports any parent scope (portfolio, program, project).
 *
 * Endpoints
 *   GET /evm?parent_type={type}&parent_id={id}
 *
 * Returns
 *   summary  – rolled-up BAC, PV, EV, AC, CV, SV, CPI, SPI, EAC, ETC, VAC, TCPI
 *   tasks    – per-task EVM breakdown
 *   curve    – monthly S-curve data points {month, pv, ev, ac}
 */
class EVMController extends Controller
{
    public function index(Request $request)
    {
        $parentType = $request->parent_type;
        $parentId   = (int) $request->parent_id;

        // Load tasks for the requested scope
        if ($parentType && $parentId) {
            $tasks = $this->loadTasks($parentType, $parentId);
        } else {
            return response()->json(['error' => 'parent_type and parent_id are required'], 422);
        }

        if ($tasks->isEmpty()) {
            return response()->json([
                'summary' => $this->emptySummary(),
                'tasks'   => [],
                'curve'   => [],
            ]);
        }

        $today     = Carbon::today();
        $taskRows  = [];
        $curveData = [];  // keyed by YYYY-MM

        // ── Per-task EVM ────────────────────────────────────────────────────
        foreach ($tasks as $task) {
            // Milestones have no budget/duration — exclude from EVM calculations
            if ($task->is_milestone) continue;

            $row = $this->computeTaskEVM($task, $today);
            $taskRows[] = $row;

            // Accumulate monthly curve data
            $this->accumulateCurvePoints($curveData, $task, $row, $today);
        }

        // ── Summary rollup ──────────────────────────────────────────────────
        $summary = $this->rollup($taskRows);

        // ── Build sorted curve array ────────────────────────────────────────
        ksort($curveData);
        $curve = $this->buildCumulativeCurve($curveData);

        return response()->json([
            'summary' => $summary,
            'tasks'   => $taskRows,
            'curve'   => $curve,
        ]);
    }

    // ── Load all tasks in scope (recursively through hierarchy) ─────────────
    private function loadTasks(string $parentType, int $parentId)
    {
        // Direct tasks
        $direct = Task::with(['resources.user'])
            ->where('parent_type', $parentType)
            ->where('parent_id', $parentId)
            ->get();

        if ($parentType === 'portfolio') {
            // Portfolio → programs → projects → tasks
            $programIds = \App\Models\Program::where('portfolio_id', $parentId)->pluck('id');
            $projectIds = \App\Models\Project::whereIn('program_id', $programIds)->pluck('id');
            $tasks = Task::with(['resources.user'])
                ->where(function ($q) use ($programIds, $projectIds, $parentId) {
                    $q->where(function ($sq) use ($parentId) {
                        $sq->where('parent_type', 'portfolio')->where('parent_id', $parentId);
                    })->orWhere(function ($sq) use ($programIds) {
                        $sq->where('parent_type', 'program')->whereIn('parent_id', $programIds);
                    })->orWhere(function ($sq) use ($projectIds) {
                        $sq->where('parent_type', 'project')->whereIn('parent_id', $projectIds);
                    });
                })->get();
            return $tasks;
        }

        if ($parentType === 'program') {
            // Program → projects → tasks
            $projectIds = \App\Models\Project::where('program_id', $parentId)->pluck('id');
            $tasks = Task::with(['resources.user'])
                ->where(function ($q) use ($projectIds, $parentId) {
                    $q->where(function ($sq) use ($parentId) {
                        $sq->where('parent_type', 'program')->where('parent_id', $parentId);
                    })->orWhere(function ($sq) use ($projectIds) {
                        $sq->where('parent_type', 'project')->whereIn('parent_id', $projectIds);
                    });
                })->get();
            return $tasks;
        }

        // Project scope: direct tasks only
        return $direct;
    }

    // ── Compute EVM metrics for a single task ────────────────────────────────
    private function computeTaskEVM(Task $task, Carbon $today): array
    {
        $resources = $task->resources ?? collect();

        // BAC: budget at completion = Σ estimated_hours × hourly_rate
        $bac = 0;
        $ac  = 0;
        foreach ($resources as $r) {
            $rate = (float)($r->user?->hourly_rate ?? $r->hourly_rate ?? 0);
            $bac += (float)($r->estimated_hours ?? 0) * $rate;
            $ac  += (float)($r->actual_hours    ?? 0) * $rate;
        }

        $pct = (float)($task->percent_complete ?? 0) / 100.0;
        $ev  = $bac * $pct;

        // PV: time-phased planned value as of today
        $pv = $this->computePV($task, $bac, $today);

        // Derived metrics
        $cv  = $ev - $ac;                                          // Cost Variance
        $sv  = $ev - $pv;                                          // Schedule Variance
        $cpi = $ac  > 0 ? round($ev / $ac,  4) : ($ev > 0 ? 1.0 : null);
        $spi = $pv  > 0 ? round($ev / $pv,  4) : ($ev > 0 ? 1.0 : null);

        // EAC: Estimate at Completion (forecasted total cost)
        // Use CPI-based method: EAC = BAC / CPI (if behind/over)
        // Fallback: EAC = AC + (BAC - EV)  [assumes remaining work at budget]
        if ($cpi && $cpi > 0) {
            $eac = $bac / $cpi;
        } else {
            $eac = $ac + ($bac - $ev);
        }
        $etc  = $eac - $ac;                                        // Estimate to Complete
        $vac  = $bac - $eac;                                       // Variance at Completion

        // TCPI: To-Complete Performance Index
        $denominator = $bac - $ac;
        $tcpi = $denominator > 0 ? round(($bac - $ev) / $denominator, 4) : null;

        // SV% and CV% for easy interpretation
        $cv_pct = $bac > 0 ? round($cv / $bac * 100, 1) : null;
        $sv_pct = $bac > 0 ? round($sv / $bac * 100, 1) : null;

        return [
            'task_id'     => $task->id,
            'task_title'  => $task->title,
            'status'      => $task->status,
            'pct_complete'=> $task->percent_complete ?? 0,
            'start_date'  => $task->start_date,
            'due_date'    => $task->due_date,
            'bac'         => round($bac,  2),
            'pv'          => round($pv,   2),
            'ev'          => round($ev,   2),
            'ac'          => round($ac,   2),
            'cv'          => round($cv,   2),
            'sv'          => round($sv,   2),
            'cv_pct'      => $cv_pct,
            'sv_pct'      => $sv_pct,
            'cpi'         => $cpi  !== null ? round($cpi,  2) : null,
            'spi'         => $spi  !== null ? round($spi,  2) : null,
            'eac'         => round($eac,  2),
            'etc'         => round($etc,  2),
            'vac'         => round($vac,  2),
            'tcpi'        => $tcpi !== null ? round($tcpi, 2) : null,
        ];
    }

    // ── Time-phased Planned Value ────────────────────────────────────────────
    // Linear budget spread: PV today = BAC × min(elapsed_ratio, 1)
    private function computePV(Task $task, float $bac, Carbon $today): float
    {
        if ($bac <= 0) return 0;
        if (!$task->start_date || !$task->due_date) return 0;

        $start = Carbon::parse($task->start_date)->startOfDay();
        $end   = Carbon::parse($task->due_date)->startOfDay();

        if ($today->lt($start)) return 0;                    // task hasn't started yet
        if ($today->gte($end))  return $bac;                 // task should be done by now

        $total   = max(1, $start->diffInDays($end));
        $elapsed = $start->diffInDays($today);
        $ratio   = min(1.0, $elapsed / $total);

        return $bac * $ratio;
    }

    // ── Accumulate monthly S-curve data points ───────────────────────────────
    private function accumulateCurvePoints(array &$curveData, Task $task, array $row, Carbon $today): void
    {
        if (!$task->start_date || !$task->due_date) return;
        if ($row['bac'] <= 0) return;

        $start    = Carbon::parse($task->start_date)->startOfMonth();
        $end      = Carbon::parse($task->due_date)->startOfMonth();
        $bac      = $row['bac'];
        $totalDays = max(1, Carbon::parse($task->start_date)->diffInDays(Carbon::parse($task->due_date)));
        $pctComp  = ($task->percent_complete ?? 0) / 100.0;

        // Generate monthly data points from task start through end (or today, whichever is later)
        $cursor = $start->copy();
        $plotEnd = $end->copy()->addMonth();

        while ($cursor->lte($plotEnd)) {
            $key = $cursor->format('Y-m');
            if (!isset($curveData[$key])) {
                $curveData[$key] = ['pv' => 0, 'ev' => 0, 'ac' => 0];
            }

            $monthEnd = $cursor->copy()->endOfMonth();

            // PV: planned budget through end of this month
            if ($cursor->gt(Carbon::parse($task->due_date))) {
                $curveData[$key]['pv'] += $bac;
            } else {
                $elapsed = max(0, Carbon::parse($task->start_date)->diffInDays($monthEnd));
                $pvRatio = min(1.0, $elapsed / $totalDays);
                $curveData[$key]['pv'] += $bac * $pvRatio;
            }

            // EV and AC only through "now" — show actual progress
            if ($cursor->lte($today)) {
                $curveData[$key]['ev'] += $row['ev'];
                $curveData[$key]['ac'] += $row['ac'];
            }

            $cursor->addMonth();
        }
    }

    // ── Build cumulative S-curve ─────────────────────────────────────────────
    // Curves are shown as period totals (not cumulative) since tasks overlap;
    // summing EV/AC across tasks already gives the cumulative picture at each month.
    private function buildCumulativeCurve(array $curveData): array
    {
        $result = [];
        foreach ($curveData as $month => $vals) {
            $result[] = [
                'month' => $month,
                'pv'    => round($vals['pv'], 2),
                'ev'    => round($vals['ev'], 2),
                'ac'    => round($vals['ac'], 2),
            ];
        }
        return $result;
    }

    // ── Rollup across all tasks ──────────────────────────────────────────────
    private function rollup(array $rows): array
    {
        $bac = array_sum(array_column($rows, 'bac'));
        $pv  = array_sum(array_column($rows, 'pv'));
        $ev  = array_sum(array_column($rows, 'ev'));
        $ac  = array_sum(array_column($rows, 'ac'));

        $cv  = $ev - $ac;
        $sv  = $ev - $pv;
        $cpi = $ac > 0 ? round($ev / $ac, 2) : ($ev > 0 ? 1.0 : null);
        $spi = $pv > 0 ? round($ev / $pv, 2) : ($ev > 0 ? 1.0 : null);

        if ($cpi && $cpi > 0) {
            $eac = $bac / $cpi;
        } else {
            $eac = $ac + ($bac - $ev);
        }
        $etc  = $eac - $ac;
        $vac  = $bac - $eac;

        $denominator = $bac - $ac;
        $tcpi = $denominator > 0 ? round(($bac - $ev) / $denominator, 2) : null;

        $cv_pct = $bac > 0 ? round($cv / $bac * 100, 1) : null;
        $sv_pct = $bac > 0 ? round($sv / $bac * 100, 1) : null;

        // Health signal
        $health = 'on_track';
        if ($cpi !== null && $cpi < 0.8)  $health = 'critical';
        elseif ($cpi !== null && $cpi < 0.95) $health = 'at_risk';
        elseif ($spi !== null && $spi < 0.8)  $health = 'critical';
        elseif ($spi !== null && $spi < 0.95) $health = 'at_risk';

        $task_count  = count($rows);
        $has_budget  = array_filter($rows, fn($r) => $r['bac'] > 0);

        return [
            'bac'        => round($bac,  2),
            'pv'         => round($pv,   2),
            'ev'         => round($ev,   2),
            'ac'         => round($ac,   2),
            'cv'         => round($cv,   2),
            'sv'         => round($sv,   2),
            'cv_pct'     => $cv_pct,
            'sv_pct'     => $sv_pct,
            'cpi'        => $cpi,
            'spi'        => $spi,
            'eac'        => round($eac,  2),
            'etc'        => round($etc,  2),
            'vac'        => round($vac,  2),
            'tcpi'       => $tcpi,
            'health'     => $health,
            'task_count' => $task_count,
            'budgeted_task_count' => count($has_budget),
        ];
    }

    private function emptySummary(): array
    {
        return [
            'bac' => 0, 'pv' => 0, 'ev' => 0, 'ac' => 0,
            'cv' => 0, 'sv' => 0, 'cv_pct' => null, 'sv_pct' => null,
            'cpi' => null, 'spi' => null,
            'eac' => 0, 'etc' => 0, 'vac' => 0, 'tcpi' => null,
            'health' => 'on_track', 'task_count' => 0, 'budgeted_task_count' => 0,
        ];
    }
}
