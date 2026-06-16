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

        // Non-admin users only see programs they own or that contain tasks they
        // created / are Responsible for / are a Resource on.
        $scope = $this->visibleScope($request);
        if ($scope !== null) {
            $query->whereIn('id', $scope['programIds']);
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

        $scope = $this->visibleScope($request);
        if ($scope !== null && !$scope['programIds']->contains((int)$id)) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $projectQuery = Project::where('program_id', $id)->with('owner');
        if ($scope !== null) {
            $projectQuery->whereIn('id', $scope['projectIds']);
        }
        $projects = $projectQuery->get()->map(function ($proj) {
            $pct = \Illuminate\Support\Facades\DB::table('tasks')
                ->where('parent_type', 'project')
                ->where('parent_id', $proj->id)
                ->avg('percent_complete') ?? 0;
            return array_merge($proj->toArray(), [
                'completion_percentage' => round((float)$pct, 1),
            ]);
        });

        $taskQuery = Task::where('parent_type', 'program')->where('parent_id', $id);
        if ($scope !== null) {
            $taskQuery->whereIn('id', $scope['taskIds']);
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
            // Fix L-5: added exists:portfolios,id so orphaned programs cannot be created
            'portfolio_id' => 'required|integer|exists:portfolios,id',
            'name'         => 'required|string|max:255',
            'description'  => 'nullable|string',
            'status'       => 'nullable|in:active,on_hold,completed,cancelled',
            'priority'     => 'nullable|integer|between:1,10',
            'start_date'   => 'nullable|date',
            'end_date'     => 'nullable|date',
            'owner_id'     => 'nullable|integer|exists:users,id',
        ]);

        if (!$this->isAdmin($request)) {
            $data['owner_id'] = $request->attributes->get('auth_user')->id;
        }

        $program = Program::create($data);
        return response()->json($program, 201);
    }

    public function update(Request $request, $id) {
        $program = Program::findOrFail($id);

        if (!$this->isAdmin($request)) {
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

        if (!$this->isAdmin($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$program->owner_id !== (int)$authUser->id) {
                return response()->json(['error' => 'You can only delete your own programs'], 403);
            }
        }

        $program->delete();
        return response()->json(['message' => 'Program deleted']);
    }
}
