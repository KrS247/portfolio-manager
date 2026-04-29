<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Task;
use App\Models\TaskDependency;
use App\Models\TaskResource;
use App\Models\User;
use App\Services\SchedulingEngine;
use Illuminate\Support\Facades\DB;

class TaskController extends Controller {

    // ── List ──────────────────────────────────────────────────────────────────
    public function index(Request $request) {
        $query = Task::with(['risk', 'assignedUser']);

        if ($request->parent_type) $query->where('parent_type', $request->parent_type);
        if ($request->parent_id)   $query->where('parent_id',   $request->parent_id);
        if ($request->assigned_to) $query->where('assigned_to', $request->assigned_to);
        if ($request->status)      $query->where('status',      $request->status);

        // PM sees only tasks they created
        if ($this->isPM($request)) {
            $query->where('created_by', $request->attributes->get('auth_user')->id);
        }

        $tasks = $query->orderBy('sequence')->get()->map(fn($t) => $this->formatTask($t));
        return response()->json($tasks);
    }

    // ── Detail ────────────────────────────────────────────────────────────────
    public function show(Request $request, $id) {
        $task = Task::with(['risk', 'assignedUser'])->findOrFail($id);

        if ($this->isPM($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$task->created_by !== (int)$authUser->id) {
                return response()->json(['error' => 'Task not found'], 404);
            }
        }

        return response()->json($this->formatTask($task));
    }

    // ── High-risk tasks ───────────────────────────────────────────────────────
    public function highRisk(Request $request) {
        $query = Task::whereHas('risk', fn($q) => $q->where('risk_rate', '>', 10))
            ->with(['risk', 'assignedUser']);

        if ($this->isPM($request)) {
            $query->where('created_by', $request->attributes->get('auth_user')->id);
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

        if ($this->isPM($request)) {
            $query->where('created_by', $request->attributes->get('auth_user')->id);
        }

        $tasks = $query->get()->map(fn($t) => $this->formatTask($t));
        return response()->json($tasks);
    }

    // ── Over-budget tasks ─────────────────────────────────────────────────────
    public function overBudget(Request $request) {
        $query = Task::whereHas('resources', fn($q) => $q->whereRaw('actual_hours > estimated_hours'))
            ->with(['risk', 'assignedUser', 'resources.user']);

        if ($this->isPM($request)) {
            $query->where('created_by', $request->attributes->get('auth_user')->id);
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
            'status'          => 'nullable|in:open,in_progress,completed,cancelled',
            'percent_complete'=> 'nullable|integer|between:0,100',
            'start_date'      => 'nullable|date',
            'due_date'        => 'nullable|date',
            'is_milestone'    => 'nullable|boolean',
            'assigned_to'     => 'nullable|integer',
            'parent_type'     => 'required|in:portfolio,program,project',
            'parent_id'       => 'required|integer',
            'parent_task_id'  => 'nullable|integer|exists:tasks,id',
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
        return response()->json($task, 201);
    }

    // ── Update ────────────────────────────────────────────────────────────────
    public function update(Request $request, $id) {
        $task = Task::findOrFail($id);

        if ($this->isPM($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$task->created_by !== (int)$authUser->id) {
                return response()->json(['error' => 'You can only edit your own tasks'], 403);
            }
        }

        $request->validate([
            'constraint_type' => 'nullable|in:ASAP,ALAP,MSO,MFO,SNET,FNLT',
            'constraint_date' => 'nullable|date',
            'schedule_mode'   => 'nullable|in:auto,manual',
        ]);

        $oldStart = $task->start_date;
        $oldDue   = $task->due_date;

        $task->update($request->only([
            'title', 'description', 'notes', 'priority', 'status', 'percent_complete',
            'start_date', 'due_date', 'is_milestone', 'assigned_to',
            'parent_type', 'parent_id', 'parent_task_id',
            'constraint_type', 'constraint_date', 'schedule_mode',
        ]));

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

        if ($this->isPM($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$task->created_by !== (int)$authUser->id) {
                return response()->json(['error' => 'You can only delete your own tasks'], 403);
            }
        }

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
        $data = $request->validate(['resources' => 'array']);
        TaskResource::where('task_id', $id)->delete();
        foreach ($data['resources'] ?? [] as $res) {
            TaskResource::create([
                'task_id'          => $id,
                'user_id'          => $res['user_id'],
                'estimated_hours'  => $res['estimated_hours'] ?? 0,
                'actual_hours'     => $res['actual_hours']    ?? 0,
            ]);
        }
        return response()->json(['message' => 'Resources updated']);
    }

    // ── Subtasks ──────────────────────────────────────────────────────────────
    public function subtasks(Request $request, $id) {
        $task = Task::findOrFail($id);

        // PM must own the parent task to see its subtasks
        if ($this->isPM($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$task->created_by !== (int)$authUser->id) {
                return response()->json(['error' => 'Task not found'], 404);
            }
        }

        $children = Task::with(['risk', 'assignedUser'])
            ->where('parent_task_id', $id)
            ->orderBy('sequence')
            ->get()
            ->map(fn($t) => $this->formatTask($t));

        return response()->json($children);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private function formatTask($task) {
        $projectName   = null;
        $programName   = null;
        $portfolioName = null;

        if ($task->parent_type === 'project') {
            $project = \App\Models\Project::with(['program.portfolio'])->find($task->parent_id);
            if ($project) {
                $projectName   = $project->name;
                $programName   = $project->program?->name;
                $portfolioName = $project->program?->portfolio?->name;
            }
        } elseif ($task->parent_type === 'program') {
            $program = \App\Models\Program::with(['portfolio'])->find($task->parent_id);
            if ($program) {
                $programName   = $program->name;
                $portfolioName = $program->portfolio?->name;
            }
        } elseif ($task->parent_type === 'portfolio') {
            $portfolio = \App\Models\Portfolio::find($task->parent_id);
            if ($portfolio) $portfolioName = $portfolio->name;
        }

        $projectId   = $task->parent_type === 'project'   ? $task->parent_id : null;
        $programId   = $task->parent_type === 'program'   ? $task->parent_id : null;
        $portfolioId = $task->parent_type === 'portfolio' ? $task->parent_id : null;

        if ($projectId)       $portfolioId = $portfolioId ?? \App\Models\Project::find($projectId)?->program?->portfolio_id;
        elseif ($programId)   $portfolioId = $portfolioId ?? \App\Models\Program::find($programId)?->portfolio_id;

        return array_merge($task->toArray(), [
            'assigned_username' => $task->assignedUser?->username,
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
