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

    public function show($id) {
        $project = Project::with('owner')->findOrFail($id);
        $tasks = Task::where('parent_type', 'project')->where('parent_id', $id)
            ->with('risk', 'assignedUser')
            ->orderBy('sequence')
            ->get();

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

        $project = Project::create($data);
        return response()->json($project, 201);
    }

    public function update(Request $request, $id) {
        $project = Project::findOrFail($id);
        $project->update($request->only(['program_id', 'name', 'description', 'status', 'priority', 'start_date', 'end_date', 'owner_id', 'clickup_id']));
        return response()->json($project);
    }

    public function destroy($id) {
        Project::findOrFail($id)->delete();
        return response()->json(['message' => 'Project deleted']);
    }
}
