<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class ScheduleBaselineTask extends Model {
    protected $table = 'schedule_baseline_tasks';
    public $timestamps = false;
    protected $fillable = ['baseline_id', 'task_id', 'baseline_start_date', 'baseline_finish_date'];

    public function baseline() { return $this->belongsTo(ScheduleBaseline::class); }
    public function task()     { return $this->belongsTo(Task::class); }
}
