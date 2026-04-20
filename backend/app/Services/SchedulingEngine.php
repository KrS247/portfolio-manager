<?php
namespace App\Services;

use App\Models\Task;
use App\Models\TaskDependency;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SchedulingEngine
{
    public function __construct(private WorkingCalendarService $cal) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Public entry points
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Run a full CPM pass for every task belonging to (parentType, parentId).
     * Returns the collection of updated Task models.
     */
    public function run(string $parentType, int $parentId): Collection
    {
        $tasks = Task::where('parent_type', $parentType)
            ->where('parent_id', $parentId)
            ->get();

        if ($tasks->isEmpty()) return $tasks;

        $deps = TaskDependency::whereIn('task_id', $tasks->pluck('id'))
            ->orWhereIn('depends_on', $tasks->pluck('id'))
            ->get();

        $this->cal->clearCache();
        $updated = $this->compute($tasks, $deps);

        DB::transaction(function () use ($updated) {
            foreach ($updated as $task) {
                $task->save();
            }
        });

        return $updated;
    }

    /**
     * Convenience: find the parent scope of a single task and re-run.
     */
    public function triggerFor(int $taskId): Collection
    {
        $task = Task::find($taskId);
        if (!$task) return collect();
        return $this->run($task->parent_type, $task->parent_id);
    }

    /**
     * Preview: compute without saving. Returns only tasks whose dates differ.
     */
    public function preview(string $parentType, int $parentId, int $taskId, string $newStart, string $newDue): array
    {
        $tasks = Task::where('parent_type', $parentType)
            ->where('parent_id', $parentId)
            ->get();

        // Temporarily apply new dates to the target task in memory
        $target = $tasks->firstWhere('id', $taskId);
        if (!$target) return [];

        $originalStart = $target->start_date;
        $originalDue   = $target->due_date;
        $target->start_date  = $newStart;
        $target->due_date    = $newDue;
        $target->duration_days = $this->cal->workingDaysBetween(
            Carbon::parse($newStart), Carbon::parse($newDue)
        );

        $deps = TaskDependency::whereIn('task_id', $tasks->pluck('id'))
            ->orWhereIn('depends_on', $tasks->pluck('id'))
            ->get();

        $this->cal->clearCache();
        $updated = $this->compute($tasks, $deps);

        // Find tasks with changed dates
        $affected = [];
        foreach ($updated as $t) {
            $orig = $tasks->firstWhere('id', $t->id);
            if ($t->id === $taskId) {
                $affected[] = $this->taskToArray($t);
            } elseif ($orig && ($orig->start_date !== $t->start_date || $orig->due_date !== $t->due_date)) {
                $affected[] = $this->taskToArray($t);
            }
        }

        // Restore original values so we don't accidentally save
        $target->start_date  = $originalStart;
        $target->due_date    = $originalDue;

        return $affected;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core CPM computation (no DB writes)
    // ─────────────────────────────────────────────────────────────────────────

    private function compute(Collection $tasks, Collection $deps): Collection
    {
        // Index tasks by id
        $byId = $tasks->keyBy('id');

        // Build adjacency: successors[taskId] = [taskId, ...]
        // and predecessors[taskId] = [{task_id, depends_on, lag_days}]
        $successors   = [];
        $predecessors = [];
        foreach ($tasks as $t) {
            $successors[$t->id]   = [];
            $predecessors[$t->id] = [];
        }
        foreach ($deps as $dep) {
            if (!isset($byId[$dep->task_id]) || !isset($byId[$dep->depends_on])) continue;
            $successors[$dep->depends_on][] = $dep->task_id;
            $predecessors[$dep->task_id][]  = $dep;
        }

        // Recalculate duration_days for tasks that have both dates
        foreach ($tasks as $t) {
            if ($t->start_date && $t->due_date) {
                $t->duration_days = $this->cal->workingDaysBetween(
                    Carbon::parse($t->start_date),
                    Carbon::parse($t->due_date)
                );
                if ($t->duration_days < 1) $t->duration_days = 1;
            } elseif (!$t->duration_days) {
                $t->duration_days = 1;
            }
        }

        // Topological sort (Kahn's algorithm)
        $order = $this->topoSort($tasks->pluck('id')->all(), $successors, $predecessors);

        // Forward pass — compute early_start / early_finish
        $earlyStart  = [];
        $earlyFinish = [];

        foreach ($order as $id) {
            $t   = $byId[$id];
            $dur = max(1, (int)($t->duration_days ?? 1));

            if ($t->schedule_mode === 'manual') {
                // Manual tasks don't move — use their current dates as anchors
                $es = $t->start_date ? Carbon::parse($t->start_date) : Carbon::today();
                $ef = $t->due_date   ? Carbon::parse($t->due_date)   : $this->cal->addWorkingDays($es, $dur);
                $earlyStart[$id]  = $es;
                $earlyFinish[$id] = $ef;
                continue;
            }

            // Compute earliest possible start from predecessors
            $preds = $predecessors[$id] ?? [];
            if (empty($preds)) {
                // No predecessors: use task's current start date or today
                $es = $t->start_date ? Carbon::parse($t->start_date) : Carbon::today();
                $es = $this->cal->nextWorkingDay($es);
            } else {
                $latestFinish = null;
                foreach ($preds as $dep) {
                    $predEF = $earlyFinish[$dep->depends_on] ?? null;
                    if (!$predEF) continue;
                    $candidate = $this->cal->applyLag($predEF, (int)($dep->lag_days ?? 0));
                    $candidate = $this->cal->nextWorkingDay($candidate);
                    if (!$latestFinish || $candidate->gt($latestFinish)) {
                        $latestFinish = $candidate;
                    }
                }
                $es = $latestFinish ?? ($t->start_date ? Carbon::parse($t->start_date) : Carbon::today());
                $es = $this->cal->nextWorkingDay($es);
            }

            // Apply constraints
            switch ($t->constraint_type ?? 'ASAP') {
                case 'MSO':
                    // Must Start On — pin to constraint_date, ignore predecessors
                    if ($t->constraint_date) $es = Carbon::parse($t->constraint_date);
                    break;
                case 'SNET':
                    // Start No Earlier Than
                    if ($t->constraint_date) {
                        $floor = Carbon::parse($t->constraint_date);
                        if ($es->lt($floor)) $es = $floor;
                        $es = $this->cal->nextWorkingDay($es);
                    }
                    break;
                case 'FNLT':
                case 'MFO':
                    // We'll fix the finish in post; start is driven by predecessors
                    break;
            }

            $ef = $this->cal->addWorkingDays($es, $dur);

            // Apply FNLT / MFO ceiling on finish
            if (in_array($t->constraint_type ?? 'ASAP', ['FNLT', 'MFO']) && $t->constraint_date) {
                $ceiling = Carbon::parse($t->constraint_date);
                if ($ef->gt($ceiling)) {
                    // Log a warning but don't crash; clamp finish
                    Log::warning("SchedulingEngine: Task {$id} ({$t->title}) cannot finish by {$t->constraint_date} — clamping.");
                    $ef = $ceiling;
                    $es = $this->cal->addWorkingDays($ef, -$dur);
                    $es = $this->cal->nextWorkingDay($es);
                }
            }

            $earlyStart[$id]  = $es;
            $earlyFinish[$id] = $ef;

            // Update task start/due for ASAP / SNET (not ALAP — handled in backward pass)
            if (in_array($t->constraint_type ?? 'ASAP', ['ASAP', 'SNET', 'FNLT', 'MFO'])) {
                $t->start_date = $es->format('Y-m-d');
                $t->due_date   = $ef->format('Y-m-d');
            }
            $t->early_start  = $es->format('Y-m-d');
            $t->early_finish = $ef->format('Y-m-d');
        }

        // Determine project end = latest early_finish
        $projectEnd = collect($earlyFinish)->max();
        $projectEnd = $projectEnd ? Carbon::parse($projectEnd) : Carbon::today()->addMonths(3);

        // Backward pass — compute late_start / late_finish / float
        $lateFinish = [];
        $lateStart  = [];

        foreach (array_reverse($order) as $id) {
            $t   = $byId[$id];
            $dur = max(1, (int)($t->duration_days ?? 1));

            $succs = $successors[$id] ?? [];
            if (empty($succs)) {
                $lf = $projectEnd->copy();
            } else {
                $earliestSuccStart = null;
                foreach ($succs as $succId) {
                    $ls = $lateStart[$succId] ?? null;
                    // Get the lag for this dependency
                    $lagDays = 0;
                    foreach (($predecessors[$succId] ?? []) as $dep) {
                        if ((int)$dep->depends_on === $id) {
                            $lagDays = (int)($dep->lag_days ?? 0);
                            break;
                        }
                    }
                    if ($ls) {
                        $candidate = $this->cal->applyLag($ls, -$lagDays);
                        if (!$earliestSuccStart || $candidate->lt($earliestSuccStart)) {
                            $earliestSuccStart = $candidate;
                        }
                    }
                }
                $lf = $earliestSuccStart ?? $projectEnd->copy();
            }

            $ls = $this->cal->addWorkingDays($lf, -$dur);

            // Apply ALAP: push task to latest possible
            if (($t->constraint_type ?? 'ASAP') === 'ALAP') {
                $t->start_date = $ls->format('Y-m-d');
                $t->due_date   = $lf->format('Y-m-d');
            }

            $lateFinish[$id] = $lf;
            $lateStart[$id]  = $ls;

            $es = $earlyStart[$id] ?? $ls;
            $float = $this->cal->workingDaysBetween($es, $ls);

            $t->late_start  = $ls->format('Y-m-d');
            $t->late_finish = $lf->format('Y-m-d');
            $t->float_days  = max(0, $float);
        }

        return $tasks;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Topological sort (Kahn's algorithm)
    // ─────────────────────────────────────────────────────────────────────────

    private function topoSort(array $ids, array $successors, array $predecessors): array
    {
        $inDegree = array_fill_keys($ids, 0);
        foreach ($ids as $id) {
            foreach ($successors[$id] ?? [] as $succId) {
                if (isset($inDegree[$succId])) $inDegree[$succId]++;
            }
        }

        $queue = [];
        foreach ($ids as $id) {
            if ($inDegree[$id] === 0) $queue[] = $id;
        }

        $order = [];
        while (!empty($queue)) {
            $id     = array_shift($queue);
            $order[] = $id;
            foreach ($successors[$id] ?? [] as $succId) {
                if (!isset($inDegree[$succId])) continue;
                $inDegree[$succId]--;
                if ($inDegree[$succId] === 0) $queue[] = $succId;
            }
        }

        // Cycle detection: any node not in $order is part of a cycle
        if (count($order) < count($ids)) {
            $missing = array_diff($ids, $order);
            Log::warning('SchedulingEngine: cycle detected involving task IDs: ' . implode(', ', $missing));
            // Append cycle members at end so they still get processed
            foreach ($missing as $m) $order[] = $m;
        }

        return $order;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private function taskToArray(Task $t): array
    {
        return [
            'id'            => $t->id,
            'start_date'    => $t->start_date,
            'due_date'      => $t->due_date,
            'early_start'   => $t->early_start,
            'early_finish'  => $t->early_finish,
            'late_start'    => $t->late_start,
            'late_finish'   => $t->late_finish,
            'float_days'    => $t->float_days,
            'duration_days' => $t->duration_days,
        ];
    }
}
