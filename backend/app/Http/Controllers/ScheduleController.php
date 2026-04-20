<?php
namespace App\Http\Controllers;

use App\Services\SchedulingEngine;
use App\Services\WorkingCalendarService;
use Illuminate\Http\Request;

class ScheduleController extends Controller
{
    public function __construct(
        private SchedulingEngine $engine,
        private WorkingCalendarService $cal,
    ) {}

    /** POST /schedule/run — trigger a full re-schedule for a scope */
    public function run(Request $request)
    {
        $data = $request->validate([
            'parent_type' => 'required|in:portfolio,program,project',
            'parent_id'   => 'required|integer',
        ]);

        $tasks = $this->engine->run($data['parent_type'], (int) $data['parent_id']);

        return response()->json([
            'tasks'   => $tasks->map(fn($t) => $this->formatTask($t)),
            'message' => "Scheduled {$tasks->count()} tasks.",
        ]);
    }

    /** GET /schedule/preview — preview without saving */
    public function preview(Request $request)
    {
        $data = $request->validate([
            'parent_type' => 'required|in:portfolio,program,project',
            'parent_id'   => 'required|integer',
            'task_id'     => 'required|integer',
            'start_date'  => 'required|date',
            'due_date'    => 'required|date|after_or_equal:start_date',
        ]);

        $affected = $this->engine->preview(
            $data['parent_type'],
            (int) $data['parent_id'],
            (int) $data['task_id'],
            $data['start_date'],
            $data['due_date'],
        );

        return response()->json(['affected_tasks' => $affected]);
    }

    private function formatTask($task): array
    {
        return [
            'id'             => $task->id,
            'title'          => $task->title,
            'start_date'     => $task->start_date,
            'due_date'       => $task->due_date,
            'early_start'    => $task->early_start,
            'early_finish'   => $task->early_finish,
            'late_start'     => $task->late_start,
            'late_finish'    => $task->late_finish,
            'float_days'     => $task->float_days,
            'duration_days'  => $task->duration_days,
            'constraint_type'=> $task->constraint_type,
            'schedule_mode'  => $task->schedule_mode,
        ];
    }
}
