<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Task;
use App\Models\TaskResource;
use App\Models\Risk;

class ReportController extends Controller
{
    /**
     * GET /reports/resource-utilisation?parent_type=&parent_id=
     * Returns per-user resource utilisation aggregated across the requested scope.
     */
    public function resourceUtilisation(Request $request)
    {
        $parentType = $request->parent_type;
        $parentId   = (int) $request->parent_id;

        if (!$parentType || !$parentId) {
            return response()->json(['error' => 'parent_type and parent_id are required'], 422);
        }

        $tasks   = $this->loadTasks($parentType, $parentId);
        $taskIds = $tasks->pluck('id');

        $resources = TaskResource::with(['user', 'task'])
            ->whereIn('task_id', $taskIds)
            ->get();

        $byUser = [];
        foreach ($resources as $r) {
            $key = $r->user_id ?? 'unassigned';
            if (!isset($byUser[$key])) {
                $byUser[$key] = [
                    'user_id'         => $r->user_id,
                    'user_name'       => $r->user?->username ?? 'Unassigned',
                    'hourly_rate'     => (float)($r->user?->hourly_rate ?? 0),
                    'estimated_hours' => 0.0,
                    'actual_hours'    => 0.0,
                    'tasks'           => [],
                ];
            }

            $est  = (float)($r->estimated_hours ?? 0);
            $act  = (float)($r->actual_hours    ?? 0);
            $rate = (float)($r->user?->hourly_rate ?? 0);

            $byUser[$key]['estimated_hours'] += $est;
            $byUser[$key]['actual_hours']    += $act;
            $byUser[$key]['tasks'][] = [
                'task_id'         => $r->task_id,
                'task_title'      => $r->task?->title ?? '',
                'estimated_hours' => round($est, 2),
                'actual_hours'    => round($act, 2),
                'estimated_cost'  => round($est * $rate, 2),
                'actual_cost'     => round($act * $rate, 2),
            ];
        }

        $result = array_values(array_map(function ($u) {
            $est  = $u['estimated_hours'];
            $act  = $u['actual_hours'];
            $rate = $u['hourly_rate'];
            return [
                'user_id'         => $u['user_id'],
                'user_name'       => $u['user_name'],
                'hourly_rate'     => $rate,
                'estimated_hours' => round($est, 2),
                'actual_hours'    => round($act, 2),
                'estimated_cost'  => round($est * $rate, 2),
                'actual_cost'     => round($act * $rate, 2),
                'utilisation_pct' => $est > 0 ? round(($act / $est) * 100, 1) : null,
                'over_budget'     => $act > $est,
                'tasks'           => $u['tasks'],
            ];
        }, $byUser));

        usort($result, fn($a, $b) => strcmp($a['user_name'], $b['user_name']));

        return response()->json($result);
    }

    /**
     * GET /reports/risks?parent_type=&parent_id=
     * Returns all risks in scope, ordered by risk_rate descending.
     */
    public function risks(Request $request)
    {
        $parentType = $request->parent_type;
        $parentId   = (int) $request->parent_id;

        if (!$parentType || !$parentId) {
            return response()->json(['error' => 'parent_type and parent_id are required'], 422);
        }

        $tasks   = $this->loadTasks($parentType, $parentId);
        $taskIds = $tasks->pluck('id');
        $taskMap = $tasks->keyBy('id');

        $risks = Risk::whereIn('task_id', $taskIds)
            ->orderByDesc('risk_rate')
            ->get()
            ->map(function ($r) use ($taskMap) {
                $task = $taskMap[$r->task_id] ?? null;
                return [
                    'id'              => $r->id,
                    'task_id'         => $r->task_id,
                    'task_title'      => $task?->title ?? '',
                    'parent_type'     => $task?->parent_type ?? '',
                    'parent_id'       => $task?->parent_id  ?? null,
                    'name'            => $r->name,
                    'description'     => $r->description,
                    'probability'     => $r->probability,
                    'impact'          => $r->impact,
                    'risk_rate'       => $r->risk_rate,
                    'risk_status'     => $r->risk_status,
                    'mitigation_plan' => $r->mitigation_plan,
                ];
            });

        return response()->json($risks);
    }

    // ── Shared scope resolver ──────────────────────────────────────────────────
    private function loadTasks(string $parentType, int $parentId)
    {
        if ($parentType === 'portfolio') {
            $programIds = \App\Models\Program::where('portfolio_id', $parentId)->pluck('id');
            $projectIds = \App\Models\Project::whereIn('program_id', $programIds)->pluck('id');
            return Task::where(function ($q) use ($parentId, $programIds, $projectIds) {
                $q->where(fn($sq) => $sq->where('parent_type', 'portfolio')->where('parent_id', $parentId))
                  ->orWhere(fn($sq) => $sq->where('parent_type', 'program')->whereIn('parent_id', $programIds))
                  ->orWhere(fn($sq) => $sq->where('parent_type', 'project')->whereIn('parent_id', $projectIds));
            })->get();
        }

        if ($parentType === 'program') {
            $projectIds = \App\Models\Project::where('program_id', $parentId)->pluck('id');
            return Task::where(function ($q) use ($parentId, $projectIds) {
                $q->where(fn($sq) => $sq->where('parent_type', 'program')->where('parent_id', $parentId))
                  ->orWhere(fn($sq) => $sq->where('parent_type', 'project')->whereIn('parent_id', $projectIds));
            })->get();
        }

        return Task::where('parent_type', $parentType)->where('parent_id', $parentId)->get();
    }
}
