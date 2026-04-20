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

    public function show($id) {
        $program = Program::with('owner')->findOrFail($id);
        $projects = Project::where('program_id', $id)->with('owner')->get();
        $tasks = Task::where('parent_type', 'program')->where('parent_id', $id)->get();

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

        $program = Program::create($data);
        return response()->json($program, 201);
    }

    public function update(Request $request, $id) {
        $program = Program::findOrFail($id);
        $program->update($request->only(['portfolio_id', 'name', 'description', 'status', 'priority', 'start_date', 'end_date', 'owner_id']));
        return response()->json($program);
    }

    public function destroy($id) {
        Program::findOrFail($id)->delete();
        return response()->json(['message' => 'Program deleted']);
    }
}
