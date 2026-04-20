<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Portfolio;
use App\Models\Program;
use App\Models\Task;
use Illuminate\Support\Facades\DB;

class PortfolioController extends Controller {
    public function index() {
        $portfolios = Portfolio::with('owner')->get()->map(function($p) {
            $programIds = Program::where('portfolio_id', $p->id)->pluck('id');
            $projectIds = \App\Models\Project::whereIn('program_id', $programIds)->pluck('id');

            $program_count = $programIds->count();
            $project_count = $projectIds->count();

            $active_task_count = Task::where('parent_type', 'project')
                ->whereIn('parent_id', $projectIds)
                ->where('status', '!=', 'completed')
                ->count();
            $active_task_count += Task::where('parent_type', 'program')
                ->whereIn('parent_id', $programIds)
                ->where('status', '!=', 'completed')
                ->count();
            $active_task_count += Task::where('parent_type', 'portfolio')
                ->where('parent_id', $p->id)
                ->where('status', '!=', 'completed')
                ->count();

            // Completion: avg of programs
            $percent_complete = 0;
            if ($programIds->count() > 0) {
                $percent_complete = DB::table('projects')
                    ->join('tasks', function($j) {
                        $j->on('tasks.parent_id', '=', 'projects.id')
                          ->where('tasks.parent_type', '=', 'project');
                    })
                    ->whereIn('projects.program_id', $programIds)
                    ->avg('tasks.percent_complete') ?? 0;
            }

            $avg_risk_rate = DB::table('risks')
                ->join('tasks', 'risks.task_id', '=', 'tasks.id')
                ->where(function($q) use ($p, $programIds, $projectIds) {
                    $q->where(function($q2) use ($p) {
                        $q2->where('tasks.parent_type', 'portfolio')->where('tasks.parent_id', $p->id);
                    })->orWhere(function($q2) use ($programIds) {
                        $q2->where('tasks.parent_type', 'program')->whereIn('tasks.parent_id', $programIds);
                    })->orWhere(function($q2) use ($projectIds) {
                        $q2->where('tasks.parent_type', 'project')->whereIn('tasks.parent_id', $projectIds);
                    });
                })
                ->avg('risks.risk_rate') ?? 0;

            return array_merge($p->toArray(), [
                'program_count' => $program_count,
                'project_count' => $project_count,
                'active_task_count' => $active_task_count,
                'percent_complete' => round($percent_complete, 1),
                'avg_risk_rate' => round($avg_risk_rate, 1),
                'owner_name' => $p->owner?->username,
            ]);
        });

        return response()->json($portfolios);
    }

    public function show($id) {
        $portfolio = Portfolio::with('owner')->findOrFail($id);
        $programs = Program::where('portfolio_id', $id)->with('owner')->get();
        $tasks = Task::where('parent_type', 'portfolio')->where('parent_id', $id)->get();

        return response()->json(array_merge($portfolio->toArray(), [
            'programs' => $programs,
            'tasks' => $tasks,
            'owner_name' => $portfolio->owner?->username,
        ]));
    }

    public function store(Request $request) {
        $data = $request->validate([
            'name' => 'required|string',
            'description' => 'nullable|string',
            'status' => 'nullable|in:active,on_hold,closed',
            'priority' => 'nullable|integer|between:1,10',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'owner_id' => 'nullable|integer',
        ]);

        $portfolio = Portfolio::create($data);
        return response()->json($portfolio, 201);
    }

    public function update(Request $request, $id) {
        $portfolio = Portfolio::findOrFail($id);
        $portfolio->update($request->only(['name', 'description', 'status', 'priority', 'start_date', 'end_date', 'owner_id']));
        return response()->json($portfolio);
    }

    public function destroy($id) {
        Portfolio::findOrFail($id)->delete();
        return response()->json(['message' => 'Portfolio deleted']);
    }
}
