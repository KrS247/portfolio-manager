<?php
namespace App\Http\Controllers;

use App\Models\ScheduleBaseline;
use App\Models\ScheduleBaselineTask;
use App\Models\Task;
use Illuminate\Http\Request;

class ScheduleBaselineController extends Controller
{
    /** GET /baselines?parent_type=X&parent_id=Y */
    public function index(Request $request)
    {
        $request->validate([
            'parent_type' => 'required|in:portfolio,program,project',
            'parent_id'   => 'required|integer',
        ]);

        $baselines = ScheduleBaseline::where('parent_type', $request->parent_type)
            ->where('parent_id', $request->parent_id)
            ->with('creator:id,username')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($baselines);
    }

    /** POST /baselines */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name'        => 'required|string|max:255',
            'parent_type' => 'required|in:portfolio,program,project',
            'parent_id'   => 'required|integer',
        ]);

        $user = $request->attributes->get('auth_user');
        // Fallback: resolve from JWT directly if attributes bag was cleared
        if (!$user) {
            try {
                $u = \Tymon\JWTAuth\Facades\JWTAuth::parseToken()->authenticate();
                if ($u) $user = \App\Models\User::find($u->getKey());
            } catch (\Exception $e) {}
        }

        $baseline = ScheduleBaseline::create([
            'name'        => $data['name'],
            'parent_type' => $data['parent_type'],
            'parent_id'   => $data['parent_id'],
            'created_by'  => $user?->id,
        ]);

        // Snapshot all tasks in scope
        $tasks = Task::where('parent_type', $data['parent_type'])
            ->where('parent_id', $data['parent_id'])
            ->get();

        $snapshots = $tasks->map(fn($t) => [
            'baseline_id'           => $baseline->id,
            'task_id'               => $t->id,
            'baseline_start_date'   => $t->start_date,
            'baseline_finish_date'  => $t->due_date,
        ])->all();

        ScheduleBaselineTask::insert($snapshots);

        return response()->json($baseline->load('creator:id,username'), 201);
    }

    /** GET /baselines/{id} — returns baseline with snapshot data + variance vs current */
    public function show(int $id)
    {
        $baseline = ScheduleBaseline::with(['creator:id,username', 'tasks.task:id,title,start_date,due_date,float_days'])
            ->findOrFail($id);

        $rows = $baseline->tasks->map(function ($snap) {
            $task = $snap->task;
            if (!$task) return null;

            $baselineStart  = $snap->baseline_start_date;
            $actualStart    = $task->start_date;
            $baselineFinish = $snap->baseline_finish_date;
            $actualFinish   = $task->due_date;

            $startVariance  = null;
            $finishVariance = null;

            if ($baselineStart && $actualStart) {
                $startVariance = \Carbon\Carbon::parse($actualStart)
                    ->diffInDays(\Carbon\Carbon::parse($baselineStart), false) * -1;
            }
            if ($baselineFinish && $actualFinish) {
                $finishVariance = \Carbon\Carbon::parse($actualFinish)
                    ->diffInDays(\Carbon\Carbon::parse($baselineFinish), false) * -1;
            }

            return [
                'task_id'               => $task->id,
                'task_title'            => $task->title,
                'baseline_start_date'   => $baselineStart,
                'baseline_finish_date'  => $baselineFinish,
                'actual_start_date'     => $actualStart,
                'actual_finish_date'    => $actualFinish,
                'start_variance_days'   => $startVariance,
                'finish_variance_days'  => $finishVariance,
                'float_days'            => $task->float_days,
            ];
        })->filter()->values();

        return response()->json([
            'baseline' => [
                'id'         => $baseline->id,
                'name'       => $baseline->name,
                'parent_type'=> $baseline->parent_type,
                'parent_id'  => $baseline->parent_id,
                'created_by' => $baseline->creator?->username,
                'created_at' => $baseline->created_at,
            ],
            'tasks' => $rows,
        ]);
    }

    /** DELETE /baselines/{id} */
    public function destroy(int $id)
    {
        ScheduleBaseline::findOrFail($id)->delete();
        return response()->json(['message' => 'Baseline deleted.']);
    }
}
