<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Task extends Model {
    protected $table = 'tasks';
    protected $fillable = [
        'title', 'description', 'notes', 'priority', 'sequence', 'status', 'percent_complete',
        'start_date', 'due_date', 'is_milestone', 'assigned_to', 'parent_type', 'parent_id', 'parent_task_id',
        'constraint_type', 'constraint_date', 'schedule_mode',
        'early_start', 'early_finish', 'late_start', 'late_finish', 'float_days', 'duration_days',
        'created_by',
    ];
    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    public function assignedUser() { return $this->belongsTo(User::class, 'assigned_to'); }
    public function risk() { return $this->hasOne(Risk::class, 'task_id'); }
    public function resources() { return $this->hasMany(TaskResource::class, 'task_id'); }
    public function dependencies() { return $this->hasMany(TaskDependency::class, 'task_id'); }
    public function subtasks()      { return $this->hasMany(Task::class, 'parent_task_id'); }
    public function parentTask()    { return $this->belongsTo(Task::class, 'parent_task_id'); }
    public function dependencyRows(){ return $this->hasMany(TaskDependency::class, 'task_id'); }
    public function baselineSnaps() { return $this->hasMany(ScheduleBaselineTask::class, 'task_id'); }
}
