<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Task;

class CalendarController extends Controller {

    public function index(Request $request) {
        $authUser = $request->attributes->get('auth_user');
        $start    = $request->query('start');
        $end      = $request->query('end');

        // Tasks where the logged-in user is assigned as a resource OR as assigned_to
        $query = Task::where(function ($q) use ($authUser) {
            $q->whereHas('resources', fn($r) => $r->where('user_id', $authUser->id))
              ->orWhere('assigned_to', $authUser->id);
        })
        ->whereNotNull('start_date')
        ->whereNotNull('due_date');

        // Overlap filter: task overlaps the requested window
        if ($start) $query->where('due_date',   '>=', $start);
        if ($end)   $query->where('start_date', '<=', $end);

        $tasks = $query->with(['risk'])->orderBy('start_date')->get()->map(fn($t) => $this->shape($t));

        return response()->json($tasks);
    }

    private function shape($task) {
        $projectId = $projectName = $programId = $programName = null;

        if ($task->parent_type === 'project') {
            $project = \App\Models\Project::with('program')->find($task->parent_id);
            if ($project) {
                $projectId   = $project->id;
                $projectName = $project->name;
                $programId   = $project->program?->id;
                $programName = $project->program?->name;
            }
        } elseif ($task->parent_type === 'program') {
            $program = \App\Models\Program::find($task->parent_id);
            if ($program) { $programId = $program->id; $programName = $program->name; }
        }

        return [
            'id'               => $task->id,
            'title'            => $task->title,
            'status'           => $task->status,
            'priority'         => $task->priority,
            'percent_complete' => $task->percent_complete ?? 0,
            'start_date'       => $task->start_date,
            'due_date'         => $task->due_date,
            'is_milestone'     => (bool) $task->is_milestone,
            'risk_rate'        => $task->risk?->risk_rate,
            'project_id'       => $projectId,
            'project_name'     => $projectName,
            'program_id'       => $programId,
            'program_name'     => $programName,
            'parent_type'      => $task->parent_type,
            'parent_id'        => $task->parent_id,
        ];
    }
}
