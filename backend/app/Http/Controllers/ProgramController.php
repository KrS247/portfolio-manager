<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Program;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Support\Facades\DB;

class ProgramController extends Controller {
    public function index(Request $request) {
        $query = Program::with('owner');
        if ($request->portfolio_id) {
            $query->where('portfolio_id', $request->portfolio_id);
        }
        if ($this->isPM($request)) {
            $query->where('owner_id', $request->attributes->get('auth_user')->id);
        }
        $programs = $query->get()->map(function($prog) {
            $projectIds = Project::where('program_id', $prog->id)->pluck('id');
            $project_count = $projectIds->count();

            $percent_complete = 0;
            if ($projectIds->count() > 0) {
                $percent_complete = DB::table('tasks')
                    ->where('parent_type', 'project')
                    ->whereIn('parent_id', $projectIds)
                    ->avg('percent_complete') ?? 0;
            }

            $avg_risk_rate = DB::table('risks')
                ->join('tasks', 'risks.task_id', '=', 'tasks.id')
                ->where(function($q) use ($prog, $projectIds) {
                    $q->where(function($q2) use ($prog) {
                        $q2->where('tasks.parent_type', 'program')->where('tasks.parent_id', $prog->id);
                    })->orWhere(function($q2) use ($projectIds) {
                        $q2->where('tasks.parent_type', 'project')->whereIn('tasks.parent_id', $projectIds);
                    });
                })
                ->avg('risks.risk_rate') ?? 0;

            return array_merge($prog->toArray(), [
                'project_count' => $project_count,
                'percent_complete' => round($percent_complete, 1),
                'avg_risk_rate' => round($avg_risk_rate, 1),
                'owner_name' => $prog->owner?->username,
            ]);
        });

        return response()->json($programs);
    }

    public function show(Request $request, $id) {
        $program = Program::with('owner')->findOrFail($id);
        $projectQuery = Project::where('program_id', $id)->with('owner');
        if ($this->isPM($request)) {
            $projectQuery->where('owner_id', $request->attributes->get('auth_user')->id);
        }
        $projects = $projectQuery->get();
        $taskQuery = Task::where('parent_type', 'program')->where('parent_id', $id);
        if ($this->isPM($request)) {
            $taskQuery->where('created_by', $request->attributes->get('auth_user')->id);
        }
        $tasks = $taskQuery->get();

        return response()->json(array_merge($program->toArray(), [
            'projects' => $projects,
            'tasks' => $tasks,
            'owner_name' => $program->owner?->username,
        ]));
    }

    public function store(Request $request) {
        $data = $request->validate([
            'portfolio_id' => 'required|integer',
            'name' => 'required|string',
            'description' => 'nullable|string',
            'status' => 'nullable|string',
            'priority' => 'nullable|integer|between:1,10',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'owner_id' => 'nullable|integer',
        ]);

        if ($this->isPM($request)) {
            $data['owner_id'] = $request->attributes->get('auth_user')->id;
        }

        $program = Program::create($data);
        return response()->json($program, 201);
    }

    public function update(Request $request, $id) {
        $program = Program::findOrFail($id);

        if ($this->isPM($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$program->owner_id !== (int)$authUser->id) {
                return response()->json(['error' => 'You can only edit your own programs'], 403);
            }
            $fields = $request->only(['portfolio_id', 'name', 'description', 'status', 'priority', 'start_date', 'end_date']);
        } else {
            $fields = $request->only(['portfolio_id', 'name', 'description', 'status', 'priority', 'start_date', 'end_date', 'owner_id']);
        }

        $program->update($fields);
        return response()->json($program);
    }

    public function destroy(Request $request, $id) {
        $program = Program::findOrFail($id);

        if ($this->isPM($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$program->owner_id !== (int)$authUser->id) {
                return response()->json(['error' => 'You can only delete your own programs'], 403);
            }
        }

        $program->delete();
        return response()->json(['message' => 'Program deleted']);
    }
}
