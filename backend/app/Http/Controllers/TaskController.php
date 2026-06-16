<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Task;
use App\Models\TaskDependency;
use App\Models\TaskResource;
use App\Models\User;
use App\Models\ActivityLog;
use App\Services\SchedulingEngine;
use Illuminate\Support\Facades\DB;

class TaskController extends Controller {

    // ── List ──────────────────────────────────────────────────────────────────
    public function index(Request $request) {
        $query = Task::with(['risk', 'assignedUser', 'resources.user']);

        if ($request->parent_type) $query->where('parent_type', $request->parent_type);
        if ($request->parent_id)   $query->where('parent_id',   $request->parent_id);
        if ($request->assigned_to) $query->where('assigned_to', $request->assigned_to);
        if ($request->status)      $query->where('status',      $request->status);

        // Non-admin users only see tasks they created, are Responsible for, or
        // are listed as a Resource on.
        $scope = $this->visibleScope($request);
        if ($scope !== null) {
            $query->whereIn('id', $scope['taskIds']);
        }

        $tasks = $query->orderBy('sequence')->get()->map(fn($t) => $this->formatTask($t));
        return response()->json($tasks);
    }

    // ── Detail ────────────────────────────────────────────────────────────────
    public function show(Request $request, $id) {
        $task = Task::with(['risk', 'assignedUser'])->findOrFail($id);

        $scope = $this->visibleScope($request);
        if ($scope !== null && !$scope['taskIds']->contains((int)$id)) {
            return response()->json(['error' => 'Not found'], 404);
        }

        return response()->json($this->formatTask($task));
    }

    // ── High-risk tasks ───────────────────────────────────────────────────────
    public function highRisk(Request $request) {
        $query = Task::whereHas('risk', fn($q) => $q->where('risk_rate', '>', 10))
            ->with(['risk', 'assignedUser']);

        $scope = $this->visibleScope($request);
        if ($scope !== null) {
            $query->whereIn('id', $scope['taskIds']);
        }

        $tasks = $query->get()->map(fn($t) => $this->formatTask($t));
        return response()->json($tasks);
    }

    // ── Overdue tasks ─────────────────────────────────────────────────────────
    public function overdue(Request $request) {
        $query = Task::where('status', '!=', 'completed')
            ->whereNotNull('due_date')
            ->where('due_date', '<', now()->toDateString())
            ->with(['risk', 'assignedUser']);

        $scope = $this->visibleScope($request);
        if ($scope !== null) {
            $query->whereIn('id', $scope['taskIds']);
        }

        $tasks = $query->get()->map(fn($t) => $this->formatTask($t));
        return response()->json($tasks);
    }

    // ── Over-budget tasks ─────────────────────────────────────────────────────
    public function overBudget(Request $request) {
        $query = Task::whereHas('resources', fn($q) => $q->whereRaw('actual_hours > estimated_hours'))
            ->with(['risk', 'assignedUser', 'resources.user']);

        $scope = $this->visibleScope($request);
        if ($scope !== null) {
            $query->whereIn('id', $scope['taskIds']);
        }

        $tasks = $query->get()->map(function($t) {
            $base = $this->formatTask($t);
            $totalEstimated = 0;
            $totalActual    = 0;
            $costOverrun    = 0;
            foreach ($t->resources as $res) {
                $est  = floatval($res->estimated_hours ?? 0);
                $act  = floatval($res->actual_hours    ?? 0);
                $rate = floatval($res->user?->hourly_rate ?? 0);
                $totalEstimated += $est;
                $totalActual    += $act;
                if ($act > $est) $costOverrun += ($act - $est) * $rate;
            }
            $base['total_estimated'] = round($totalEstimated, 2);
            $base['total_actual']    = round($totalActual,    2);
            $base['cost_overrun']    = round($costOverrun,    2);
            return $base;
        });

        return response()->json($tasks);
    }

    // ── Create ────────────────────────────────────────────────────────────────
    public function store(Request $request) {
        $data = $request->validate([
            'title'           => 'required|string',
            'description'     => 'nullable|string',
            'notes'           => 'nullable|string',
            'priority'        => 'nullable|integer|between:1,10',
            'status'          => 'nullable|in:not_started,open,in_progress,completed,cancelled',
            'percent_complete'=> 'nullable|integer|between:0,100',
            'start_date'      => 'nullable|date',
            'due_date'        => 'nullable|date',
            'is_milestone'    => 'nullable|boolean',
            'assigned_to'     => 'nullable|integer',
            'parent_type'     => 'required|in:portfolio,program,project',
            'parent_id'       => 'required|integer',
            'parent_task_id'  => 'nullable|integer|exists:tasks,id',
            'sprint_id'       => 'nullable|integer|exists:sprints,id',
            'task_type'       => 'nullable|in:feature,bug_fix',
            'agile_phase_id'  => 'nullable|integer|exists:agile_phases,id',
            'estimated_hours' => 'nullable|integer|min:1|max:80',
            'actual_hours'    => 'nullable|integer|min:0',
        ]);

        $maxSeq = Task::where('parent_type', $data['parent_type'])
            ->where('parent_id', $data['parent_id'])
            ->max('sequence') ?? 0;
        $data['sequence'] = $maxSeq + 1000;

        // Always record who created this task regardless of role
        $authUser = $request->attributes->get('auth_user');
        if ($authUser) {
            $data['created_by'] = $authUser->id;
        }

        $task = Task::create($data);

        ActivityLog::record('task', $task->id, 'created',
            ($authUser?->username ?? 'System') . " created task \"{$task->title}\"",
            $authUser?->id
        );

        return response()->json($task, 201);
    }

    // ── Update ────────────────────────────────────────────────────────────────
    public function update(Request $request, $id) {
        $task = Task::findOrFail($id);

        if (!$this->isAdmin($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$task->created_by !== (int)$authUser->id) {
                return response()->json(['error' => 'You can only edit your own tasks'], 403);
            }
        }

        // Fix for audit finding H-6: validate all mutable fields, not just scheduling
        // fields. Without this, parent_type/parent_id/recurrence_type accepted
        // arbitrary values that could break downstream queries and EVM calculations.
        $request->validate([
            'title'               => 'sometimes|string|max:500',
            'description'         => 'nullable|string',
            'notes'               => 'nullable|string',
            'priority'            => 'nullable|integer|between:1,10',
            'status'              => 'nullable|in:not_started,open,in_progress,completed,cancelled',
            'percent_complete'    => 'nullable|integer|between:0,100',
            'start_date'          => 'nullable|date',
            'due_date'            => 'nullable|date',
            'is_milestone'        => 'nullable|boolean',
            'assigned_to'         => 'nullable|integer|exists:users,id',
            'parent_type'         => 'sometimes|in:portfolio,program,project',
            'parent_id'           => 'sometimes|integer',
            'parent_task_id'      => 'nullable|integer|exists:tasks,id',
            'constraint_type'     => 'nullable|in:ASAP,ALAP,MSO,MFO,SNET,FNLT',
            'constraint_date'     => 'nullable|date',
            'schedule_mode'       => 'nullable|in:auto,manual',
            'recurrence_type'     => 'nullable|in:daily,weekly,monthly,yearly',
            'recurrence_interval' => 'nullable|integer|min:1|max:365',
            'recurrence_end_date' => 'nullable|date',
            'sprint_id'           => 'nullable|integer|exists:sprints,id',
            'task_type'           => 'nullable|in:feature,bug_fix',
            'agile_phase_id'      => 'nullable|integer|exists:agile_phases,id',
            'estimated_hours'     => 'nullable|integer|min:1|max:80',
            'actual_hours'        => 'nullable|integer|min:0',
        ]);

        $oldStart  = $task->start_date;
        $oldDue    = $task->due_date;
        $oldStatus = $task->status;
        $before    = $task->only(['title','status','percent_complete','start_date','due_date','assigned_to','priority']);

        $task->update($request->only([
            'title', 'description', 'notes', 'priority', 'status', 'percent_complete',
            'start_date', 'due_date', 'is_milestone', 'assigned_to',
            'parent_type', 'parent_id', 'parent_task_id',
            'constraint_type', 'constraint_date', 'schedule_mode',
            'recurrence_type', 'recurrence_interval', 'recurrence_end_date',
            'sprint_id', 'task_type', 'agile_phase_id', 'estimated_hours', 'actual_hours',
        ]));

        // Build a diff of human-visible changes for the activity log
        $after   = $task->fresh()->only(array_keys($before));
        $changes = [];
        foreach ($before as $k => $v) {
            if ((string)$v !== (string)($after[$k] ?? '')) {
                $changes[$k] = [$v, $after[$k]];
            }
        }

        if (!empty($changes)) {
            $authUser2   = $request->attributes->get('auth_user');
            $action      = isset($changes['status']) ? 'status_changed' : 'updated';
            $description = ($authUser2?->username ?? 'System') . " updated task \"{$task->title}\"";
            if (isset($changes['status'])) {
                $description = ($authUser2?->username ?? 'System') . " changed status from \"{$changes['status'][0]}\" to \"{$changes['status'][1]}\"";
            }
            ActivityLog::record('task', $task->id, $action, $description, $authUser2?->id, $changes);
        }

        $datesChanged    = ($task->start_date !== $oldStart || $task->due_date !== $oldDue);
        $skipConstraints = in_array($task->constraint_type ?? 'ASAP', ['MSO', 'MFO']);

        if ($datesChanged && !$skipConstraints && ($task->schedule_mode ?? 'auto') === 'auto') {
            app(SchedulingEngine::class)->triggerFor($task->id);
            $task->refresh();
        }

        return response()->json($this->formatTask($task));
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    public function destroy(Request $request, $id) {
        $task = Task::findOrFail($id);

        if (!$this->isAdmin($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$task->created_by !== (int)$authUser->id) {
                return response()->json(['error' => 'You can only delete your own tasks'], 403);
            }
        }

        $authUser3 = $request->attributes->get('auth_user');
        ActivityLog::record('task', $task->id, 'deleted',
            ($authUser3?->username ?? 'System') . " deleted task \"{$task->title}\"",
            $authUser3?->id
        );

        $task->delete();
        return response()->json(['message' => 'Task deleted']);
    }

    // ── Resequence ────────────────────────────────────────────────────────────
    public function resequence(Request $request, $id) {
        $task    = Task::findOrFail($id);
        $afterId = $request->after_id;

        if (!$afterId) {
            $minSeq = Task::where('parent_type', $task->parent_type)
                ->where('parent_id', $task->parent_id)
                ->where('id', '!=', $id)
                ->min('sequence') ?? 1000;
            $task->sequence = max(1, $minSeq - 1000);
        } else {
            $afterTask = Task::findOrFail($afterId);
            $nextTask  = Task::where('parent_type', $task->parent_type)
                ->where('parent_id', $task->parent_id)
                ->where('sequence', '>', $afterTask->sequence)
                ->where('id', '!=', $id)
                ->orderBy('sequence')
                ->first();

            $task->sequence = $nextTask
                ? ($afterTask->sequence + $nextTask->sequence) / 2
                : $afterTask->sequence + 1000;
        }

        $task->save();
        return response()->json($task);
    }

    // ── Dependencies ──────────────────────────────────────────────────────────
    public function getDependencies($id) {
        $deps = TaskDependency::where('task_id', $id)
            ->join('tasks', 'task_dependencies.depends_on', '=', 'tasks.id')
            ->select('tasks.*', 'task_dependencies.id as dep_id')
            ->get();
        return response()->json($deps);
    }

    public function updateDependencies(Request $request, $id) {
        if ($request->has('dependencies')) {
            $data = $request->validate([
                'dependencies'              => 'array',
                'dependencies.*.depends_on' => 'required|integer|exists:tasks,id',
                'dependencies.*.lag_days'   => 'nullable|integer|between:-365,365',
            ]);
            TaskDependency::where('task_id', $id)->delete();
            foreach ($data['dependencies'] ?? [] as $dep) {
                if ($dep['depends_on'] != $id) {
                    TaskDependency::create([
                        'task_id'    => $id,
                        'depends_on' => $dep['depends_on'],
                        'lag_days'   => $dep['lag_days'] ?? 0,
                    ]);
                }
            }
        } else {
            $data = $request->validate(['dependency_ids' => 'array']);
            TaskDependency::where('task_id', $id)->delete();
            foreach ($data['dependency_ids'] ?? [] as $depId) {
                if ($depId != $id) {
                    TaskDependency::create(['task_id' => $id, 'depends_on' => $depId, 'lag_days' => 0]);
                }
            }
        }

        $task = Task::findOrFail($id);
        app(SchedulingEngine::class)->triggerFor($task->id);
        return response()->json(['message' => 'Dependencies updated']);
    }

    // ── Resources ─────────────────────────────────────────────────────────────
    public function getResources($id) {
        $resources = TaskResource::where('task_id', $id)
            ->join('users', 'task_resources.user_id', '=', 'users.id')
            ->select('task_resources.*', 'users.username', 'users.email')
            ->get();
        return response()->json($resources);
    }

    public function updateResources(Request $request, $id) {
        // Fix for audit finding H-7: validate each resource item explicitly.
        // Without this, arbitrary user_id values (non-existent users) and negative
        // or astronomically large hour values could corrupt EVM/cost calculations.
        $data = $request->validate([
            'resources'                   => 'array|max:50',
            'resources.*.user_id'         => 'required|integer|exists:users,id',
            'resources.*.estimated_hours' => 'nullable|numeric|min:0|max:99999',
            'resources.*.actual_hours'    => 'nullable|numeric|min:0|max:99999',
            'resources.*.allocation_pct'  => 'nullable|numeric|min:0|max:100',
        ]);
        TaskResource::where('task_id', $id)->delete();
        foreach ($data['resources'] ?? [] as $res) {
            TaskResource::create([
                'task_id'          => $id,
                'user_id'          => $res['user_id'],
                'estimated_hours'  => $res['estimated_hours'] ?? 0,
                'actual_hours'     => $res['actual_hours']    ?? 0,
                'allocation_pct'   => $res['allocation_pct']  ?? 100,
            ]);
        }
        return response()->json(['message' => 'Resources updated']);
    }

    // ── Subtasks ──────────────────────────────────────────────────────────────
    public function subtasks(Request $request, $id) {
        $task = Task::findOrFail($id);

        // Non-admin users can only view subtasks when they can see the parent task
        $scope = $this->visibleScope($request);
        if ($scope !== null && !$scope['taskIds']->contains((int)$id)) {
            return response()->json(['error' => 'Task not found'], 404);
        }

        $children = Task::with(['risk', 'assignedUser'])
            ->where('parent_task_id', $id)
            ->orderBy('sequence')
            ->get()
            ->map(fn($t) => $this->formatTask($t));

        return response()->json($children);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    // Request-scoped caches so formatTask() doesn't re-query the same
    // project/program/portfolio once per task (was an N+1 on every task list).
    private array $projectCache   = [];
    private array $programCache   = [];
    private array $portfolioCache = [];

    private function cachedProject($id) {
        if (!array_key_exists($id, $this->projectCache)) {
            $this->projectCache[$id] = \App\Models\Project::with(['program.portfolio'])->find($id);
        }
        return $this->projectCache[$id];
    }
    private function cachedProgram($id) {
        if (!array_key_exists($id, $this->programCache)) {
            $this->programCache[$id] = \App\Models\Program::with(['portfolio'])->find($id);
        }
        return $this->programCache[$id];
    }
    private function cachedPortfolio($id) {
        if (!array_key_exists($id, $this->portfolioCache)) {
            $this->portfolioCache[$id] = \App\Models\Portfolio::find($id);
        }
        return $this->portfolioCache[$id];
    }

    private function formatTask($task) {
        $projectName   = null;
        $programName   = null;
        $portfolioName = null;

        $projectId   = $task->parent_type === 'project'   ? $task->parent_id : null;
        $programId   = $task->parent_type === 'program'   ? $task->parent_id : null;
        $portfolioId = $task->parent_type === 'portfolio' ? $task->parent_id : null;

        if ($task->parent_type === 'project') {
            $project = $this->cachedProject($task->parent_id);
            if ($project) {
                $projectName   = $project->name;
                $programName   = $project->program?->name;
                $portfolioName = $project->program?->portfolio?->name;
                $portfolioId   = $project->program?->portfolio_id;
            }
        } elseif ($task->parent_type === 'program') {
            $program = $this->cachedProgram($task->parent_id);
            if ($program) {
                $programName   = $program->name;
                $portfolioName = $program->portfolio?->name;
                $portfolioId   = $program->portfolio_id;
            }
        } elseif ($task->parent_type === 'portfolio') {
            $portfolio = $this->cachedPortfolio($task->parent_id);
            if ($portfolio) $portfolioName = $portfolio->name;
        }

        $resourceNames = $task->relationLoaded('resources')
            ? $task->resources->map(fn($r) => $r->user?->username)->filter()->values()->all()
            : [];

        return array_merge($task->toArray(), [
            'assigned_username' => $task->assignedUser?->username,
            'resource_names'    => $resourceNames,
            'risk_rate'         => $task->risk?->risk_rate,
            'risk_status'       => $task->risk?->risk_status,
            'parent_task_id'    => $task->parent_task_id,
            'project_id'        => $projectId,
            'program_id'        => $programId,
            'portfolio_id'      => $portfolioId,
            'project_name'      => $projectName,
            'program_name'      => $programName,
            'portfolio_name'    => $portfolioName,
            'constraint_type'   => $task->constraint_type  ?? 'ASAP',
            'constraint_date'   => $task->constraint_date,
            'schedule_mode'     => $task->schedule_mode    ?? 'auto',
            'early_start'       => $task->early_start,
            'early_finish'      => $task->early_finish,
            'late_start'        => $task->late_start,
            'late_finish'       => $task->late_finish,
            'float_days'        => $task->float_days,
            'duration_days'     => $task->duration_days,
        ]);
    }
}
