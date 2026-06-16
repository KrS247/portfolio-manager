<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller {
    public function index(Request $request) {
        $query = Project::with('owner', 'program.portfolio');
        if ($request->program_id) {
            $query->where('program_id', $request->program_id);
        }

        // Non-admin users only see projects they own or that contain tasks they
        // created / are Responsible for / are a Resource on.
        $scope = $this->visibleScope($request);
        if ($scope !== null) {
            $query->whereIn('id', $scope['projectIds']);
        }

        $projects = $query->get();
        $ids = $projects->pluck('id');

        // ── Batch all per-project aggregates (was 5 queries PER project / N+1) ──
        // 1 query: task count + avg percent_complete, grouped by project
        $taskStats = Task::where('parent_type', 'project')->whereIn('parent_id', $ids)
            ->selectRaw('parent_id, COUNT(*) as cnt, AVG(percent_complete) as pct')
            ->groupBy('parent_id')->get()->keyBy('parent_id');

        // 1 query: avg risk rate, grouped by project
        $riskAvg = DB::table('risks')
            ->join('tasks', 'risks.task_id', '=', 'tasks.id')
            ->where('tasks.parent_type', 'project')->whereIn('tasks.parent_id', $ids)
            ->selectRaw('tasks.parent_id as pid, AVG(risks.risk_rate) as r')
            ->groupBy('tasks.parent_id')->pluck('r', 'pid');

        // 1 query: estimated + actual cost, grouped by project
        $costs = DB::table('task_resources')
            ->join('tasks', 'task_resources.task_id', '=', 'tasks.id')
            ->join('users', 'task_resources.user_id', '=', 'users.id')
            ->where('tasks.parent_type', 'project')->whereIn('tasks.parent_id', $ids)
            ->selectRaw('tasks.parent_id as pid,
                         SUM(task_resources.estimated_hours * COALESCE(users.hourly_rate, 0)) as est,
                         SUM(task_resources.actual_hours    * COALESCE(users.hourly_rate, 0)) as act')
            ->groupBy('tasks.parent_id')->get()->keyBy('pid');

        $result = $projects->map(function ($proj) use ($taskStats, $riskAvg, $costs) {
            $ts   = $taskStats->get($proj->id);
            $cost = $costs->get($proj->id);
            return array_merge($proj->toArray(), [
                'task_count'       => (int) ($ts->cnt ?? 0),
                'percent_complete' => round((float) ($ts->pct ?? 0), 1),
                'avg_risk_rate'    => round((float) ($riskAvg[$proj->id] ?? 0), 1),
                'estimated_cost'   => round((float) ($cost->est ?? 0), 2),
                'actual_cost'      => round((float) ($cost->act ?? 0), 2),
                'owner_name'       => $proj->owner?->username,
                'program_name'     => $proj->program?->name,
                'portfolio_id'     => $proj->program?->portfolio_id,
                'portfolio_name'   => $proj->program?->portfolio?->name,
            ]);
        });

        return response()->json($result);
    }

    public function show(Request $request, $id) {
        $project = Project::with('owner')->findOrFail($id);

        // Non-admin users can only view projects within their visible scope
        $scope = $this->visibleScope($request);
        if ($scope !== null && !$scope['projectIds']->contains((int)$id)) {
            return response()->json(['error' => 'Project not found'], 404);
        }

        $taskQuery = Task::where('parent_type', 'project')->where('parent_id', $id)
            ->with('risk', 'assignedUser')
            ->orderBy('sequence');
        if ($scope !== null) {
            $taskQuery->whereIn('id', $scope['taskIds']);
        }
        $tasks = $taskQuery->get();

        $percent_complete = Task::where('parent_type', 'project')
            ->where('parent_id', $id)
            ->avg('percent_complete') ?? 0;

        return response()->json(array_merge($project->toArray(), [
            'tasks' => $tasks,
            'owner_name' => $project->owner?->username,
            'percent_complete' => round($percent_complete, 1),
        ]));
    }

    public function store(Request $request) {
        $data = $request->validate([
            // Fix L-5: added exists:programs,id so orphaned projects cannot be created
            'program_id'  => 'required|integer|exists:programs,id',
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string',
            'status'      => 'nullable|in:active,on_hold,completed,cancelled',
            'priority'    => 'nullable|integer|between:1,10',
            'start_date'  => 'nullable|date',
            'end_date'    => 'nullable|date',
            'owner_id'    => 'nullable|integer|exists:users,id',
            'clickup_id'  => 'nullable|string|max:100',
            'is_agile'    => 'nullable|boolean',
        ]);

        if (!$this->isAdmin($request)) {
            $data['owner_id'] = $request->attributes->get('auth_user')->id;
        }

        $project = Project::create($data);
        return response()->json($project, 201);
    }

    public function update(Request $request, $id) {
        $project = Project::findOrFail($id);

        if (!$this->isAdmin($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$project->owner_id !== (int)$authUser->id) {
                return response()->json(['error' => 'You can only edit your own projects'], 403);
            }
            // PM cannot reassign ownership
            $fields = $request->only(['program_id', 'name', 'description', 'status', 'priority', 'start_date', 'end_date', 'clickup_id', 'is_agile']);
        } else {
            $fields = $request->only(['program_id', 'name', 'description', 'status', 'priority', 'start_date', 'end_date', 'owner_id', 'clickup_id', 'is_agile']);
        }

        $project->update($fields);
        return response()->json($project);
    }

    public function destroy(Request $request, $id) {
        $project = Project::findOrFail($id);

        if (!$this->isAdmin($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$project->owner_id !== (int)$authUser->id) {
                return response()->json(['error' => 'You can only delete your own projects'], 403);
            }
        }

        $project->delete();
        return response()->json(['message' => 'Project deleted']);
    }
}
