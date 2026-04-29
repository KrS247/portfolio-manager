<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller {
    public function index(Request $request) {
        $query = Project::with('owner');
        if ($request->program_id) {
            $query->where('program_id', $request->program_id);
        }
        if ($this->isPM($request)) {
            $query->where('owner_id', $request->attributes->get('auth_user')->id);
        }
        $projects = $query->get()->map(function($proj) {
            $taskIds = Task::where('parent_type', 'project')->where('parent_id', $proj->id)->pluck('id');
            $task_count = $taskIds->count();

            $percent_complete = Task::where('parent_type', 'project')
                ->where('parent_id', $proj->id)
                ->avg('percent_complete') ?? 0;

            $avg_risk_rate = DB::table('risks')
                ->join('tasks', 'risks.task_id', '=', 'tasks.id')
                ->where('tasks.parent_type', 'project')
                ->where('tasks.parent_id', $proj->id)
                ->avg('risks.risk_rate') ?? 0;

            // Cost calculation
            $estimated_cost = DB::table('task_resources')
                ->join('tasks', 'task_resources.task_id', '=', 'tasks.id')
                ->join('users', 'task_resources.user_id', '=', 'users.id')
                ->where('tasks.parent_type', 'project')
                ->where('tasks.parent_id', $proj->id)
                ->selectRaw('SUM(task_resources.estimated_hours * COALESCE(users.hourly_rate, 0)) as total')
                ->value('total') ?? 0;

            $actual_cost = DB::table('task_resources')
                ->join('tasks', 'task_resources.task_id', '=', 'tasks.id')
                ->join('users', 'task_resources.user_id', '=', 'users.id')
                ->where('tasks.parent_type', 'project')
                ->where('tasks.parent_id', $proj->id)
                ->selectRaw('SUM(task_resources.actual_hours * COALESCE(users.hourly_rate, 0)) as total')
                ->value('total') ?? 0;

            return array_merge($proj->toArray(), [
                'task_count' => $task_count,
                'percent_complete' => round($percent_complete, 1),
                'avg_risk_rate' => round($avg_risk_rate, 1),
                'estimated_cost' => round($estimated_cost, 2),
                'actual_cost' => round($actual_cost, 2),
                'owner_name' => $proj->owner?->username,
            ]);
        });

        return response()->json($projects);
    }

    public function show(Request $request, $id) {
        $project = Project::with('owner')->findOrFail($id);

        // PM can only access their own projects
        if ($this->isPM($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$project->owner_id !== (int)$authUser->id) {
                return response()->json(['error' => 'Project not found'], 404);
            }
        }

        $taskQuery = Task::where('parent_type', 'project')->where('parent_id', $id)
            ->with('risk', 'assignedUser')
            ->orderBy('sequence');
        if ($this->isPM($request)) {
            $taskQuery->where('created_by', $request->attributes->get('auth_user')->id);
        }
        $tasks = $taskQuery->get();

        return response()->json(array_merge($project->toArray(), [
            'tasks' => $tasks,
            'owner_name' => $project->owner?->username,
        ]));
    }

    public function store(Request $request) {
        $data = $request->validate([
            'program_id' => 'required|integer',
            'name' => 'required|string',
            'description' => 'nullable|string',
            'status' => 'nullable|string',
            'priority' => 'nullable|integer|between:1,10',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'owner_id' => 'nullable|integer',
            'clickup_id' => 'nullable|string',
        ]);

        if ($this->isPM($request)) {
            $data['owner_id'] = $request->attributes->get('auth_user')->id;
        }

        $project = Project::create($data);
        return response()->json($project, 201);
    }

    public function update(Request $request, $id) {
        $project = Project::findOrFail($id);

        if ($this->isPM($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$project->owner_id !== (int)$authUser->id) {
                return response()->json(['error' => 'You can only edit your own projects'], 403);
            }
            // PM cannot reassign ownership
            $fields = $request->only(['program_id', 'name', 'description', 'status', 'priority', 'start_date', 'end_date', 'clickup_id']);
        } else {
            $fields = $request->only(['program_id', 'name', 'description', 'status', 'priority', 'start_date', 'end_date', 'owner_id', 'clickup_id']);
        }

        $project->update($fields);
        return response()->json($project);
    }

    public function destroy(Request $request, $id) {
        $project = Project::findOrFail($id);

        if ($this->isPM($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$project->owner_id !== (int)$authUser->id) {
                return response()->json(['error' => 'You can only delete your own projects'], 403);
            }
        }

        $project->delete();
        return response()->json(['message' => 'Project deleted']);
    }
}
