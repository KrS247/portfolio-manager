<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Risk extends Model {
    protected $table = 'risks';
    protected $fillable = ['task_id', 'name', 'description', 'probability', 'impact', 'risk_rate', 'risk_status', 'mitigation_plan', 'status'];
    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    public function task() { return $this->belongsTo(Task::class, 'task_id'); }
}
