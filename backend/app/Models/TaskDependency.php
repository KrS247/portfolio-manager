<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class TaskDependency extends Model {
    protected $table = 'task_dependencies';
    public $timestamps = true;
    protected $fillable = ['task_id', 'depends_on', 'lag_days', 'dependency_type'];

    public function task()        { return $this->belongsTo(Task::class, 'task_id'); }
    public function predecessor() { return $this->belongsTo(Task::class, 'depends_on'); }
}
