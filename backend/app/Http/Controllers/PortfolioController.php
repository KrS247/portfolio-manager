<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Portfolio;
use App\Models\Program;
use App\Models\Task;
use Illuminate\Support\Facades\DB;

class PortfolioController extends Controller {
    public function index(Request $request) {
        $query = Portfolio::with('owner');

        // Non-admin users only see portfolios they own or that contain tasks they
        // created / are Responsible for / are a Resource on.
        $scope = $this->visibleScope($request);
        if ($scope !== null) {
            $query->whereIn('id', $scope['portfolioIds']);
        }

        $portfolios = $query->get();

        // ── Batch-load all related data to avoid N+1 queries ─────────────────
        $portfolioIds = $portfolios->pluck('id');

        // 1 query: all programs for these portfolios
        $allPrograms = Program::whereIn('portfolio_id', $portfolioIds)->get(['id', 'portfolio_id']);
        $allProgramIds = $allPrograms->pluck('id');

        // 1 query: all projects for these programs
        $allProjects = \App\Models\Project::whereIn('program_id', $allProgramIds)->get(['id', 'program_id']);
        $allProjectIds = $allProjects->pluck('id');

        // Precompute lookup maps
        $programsByPortfolio = $allPrograms->groupBy('portfolio_id')
            ->map(fn($g) => $g->pluck('id'));

        $projectsByProgram = $allProjects->groupBy('program_id')
            ->map(fn($g) => $g->pluck('id'));

        $projectsByPortfolio = $portfolios->mapWithKeys(function ($p) use ($programsByPortfolio, $projectsByProgram) {
            $progIds = $programsByPortfolio[$p->id] ?? collect([]);
            $projIds = $progIds->flatMap(fn($id) => $projectsByProgram[$id] ?? collect([]));
            return [$p->id => $projIds];
        });

        // 1 query: count active tasks grouped by parent type + parent_id
        $rawTaskCounts = Task::where('status', '!=', 'completed')
            ->selectRaw('parent_type, parent_id, COUNT(*) as cnt')
            ->groupBy('parent_type', 'parent_id')
            ->get();
        $taskCountsByType = $rawTaskCounts->groupBy('parent_type')
            ->map(fn($g) => $g->pluck('cnt', 'parent_id')->toArray());

        // 1 query: avg percent_complete per portfolio via join
        $pctByPortfolio = DB::table('projects')
            ->join('tasks', function ($j) {
                $j->on('tasks.parent_id', '=', 'projects.id')
                  ->where('tasks.parent_type', '=', 'project');
            })
            ->join('programs', 'programs.id', '=', 'projects.program_id')
            ->whereIn('programs.portfolio_id', $portfolioIds)
            ->selectRaw('programs.portfolio_id, AVG(tasks.percent_complete) as pct')
            ->groupBy('programs.portfolio_id')
            ->pluck('pct', 'portfolio_id');

        // 1 query: avg risk rate per portfolio via join
        $riskByPortfolio = DB::table('risks')
            ->join('tasks', 'risks.task_id', '=', 'tasks.id')
            ->join('projects', function ($j) {
                $j->on('tasks.parent_id', '=', 'projects.id')
                  ->where('tasks.parent_type', '=', 'project');
            })
            ->join('programs', 'programs.id', '=', 'projects.program_id')
            ->whereIn('programs.portfolio_id', $portfolioIds)
            ->selectRaw('programs.portfolio_id, AVG(risks.risk_rate) as avg_risk')
            ->groupBy('programs.portfolio_id')
            ->pluck('avg_risk', 'portfolio_id');
        // ─────────────────────────────────────────────────────────────────────

        $result = $portfolios->map(function ($p) use (
            $programsByPortfolio, $projectsByPortfolio,
            $taskCountsByType, $pctByPortfolio, $riskByPortfolio
        ) {
            $progIds = $programsByPortfolio[$p->id] ?? collect([]);
            $projIds = $projectsByPortfolio[$p->id] ?? collect([]);

            $projectCounts  = $taskCountsByType['project']   ?? [];
            $programCounts  = $taskCountsByType['program']   ?? [];
            $portfolioCounts= $taskCountsByType['portfolio'] ?? [];

            $active_task_count =
                $projIds->sum(fn($id) => $projectCounts[$id] ?? 0)
                + $progIds->sum(fn($id) => $programCounts[$id] ?? 0)
                + ($portfolioCounts[$p->id] ?? 0);

            return array_merge($p->toArray(), [
                'program_count'     => $progIds->count(),
                'project_count'     => $projIds->count(),
                'active_task_count' => $active_task_count,
                'percent_complete'  => round($pctByPortfolio[$p->id] ?? 0, 1),
                'avg_risk_rate'     => round($riskByPortfolio[$p->id] ?? 0, 1),
                'owner_name'        => $p->owner?->username,
            ]);
        });

        return response()->json($result);
    }

    public function show(Request $request, $id) {
        $portfolio = Portfolio::with('owner')->findOrFail($id);

        $scope = $this->visibleScope($request);
        if ($scope !== null && !$scope['portfolioIds']->contains((int)$id)) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $programQuery = Program::where('portfolio_id', $id)->with('owner');
        if ($scope !== null) {
            $programQuery->whereIn('id', $scope['programIds']);
        }
        $programs = $programQuery->get()->map(function ($prog) {
            $projectIds = \App\Models\Project::where('program_id', $prog->id)->pluck('id');
            $pct = 0;
            if ($projectIds->count() > 0) {
                $pct = \Illuminate\Support\Facades\DB::table('tasks')
                    ->where('parent_type', 'project')
                    ->whereIn('parent_id', $projectIds)
                    ->avg('percent_complete') ?? 0;
            }
            return array_merge($prog->toArray(), [
                'project_count'         => $projectIds->count(),
                'completion_percentage' => round((float)$pct, 1),
            ]);
        });

        $taskQuery = Task::where('parent_type', 'portfolio')->where('parent_id', $id);
        if ($scope !== null) {
            $taskQuery->whereIn('id', $scope['taskIds']);
        }
        $tasks = $taskQuery->get();

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

        // Project managers are automatically the owner of everything they create
        if (!$this->isAdmin($request)) {
            $data['owner_id'] = $request->attributes->get('auth_user')->id;
        }

        $portfolio = Portfolio::create($data);
        return response()->json($portfolio, 201);
    }

    public function update(Request $request, $id) {
        $portfolio = Portfolio::findOrFail($id);

        if (!$this->isAdmin($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$portfolio->owner_id !== (int)$authUser->id) {
                return response()->json(['error' => 'You can only edit your own portfolios'], 403);
            }
            $fields = $request->only(['name', 'description', 'status', 'priority', 'start_date', 'end_date']);
        } else {
            $fields = $request->only(['name', 'description', 'status', 'priority', 'start_date', 'end_date', 'owner_id']);
        }

        $portfolio->update($fields);
        return response()->json($portfolio);
    }

    public function destroy(Request $request, $id) {
        $portfolio = Portfolio::findOrFail($id);

        if (!$this->isAdmin($request)) {
            $authUser = $request->attributes->get('auth_user');
            if ((int)$portfolio->owner_id !== (int)$authUser->id) {
                return response()->json(['error' => 'You can only delete your own portfolios'], 403);
            }
        }

        $portfolio->delete();
        return response()->json(['message' => 'Portfolio deleted']);
    }
}
