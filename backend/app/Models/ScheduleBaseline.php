<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class ScheduleBaseline extends Model {
    protected $table = 'schedule_baselines';
    protected $fillable = ['name', 'parent_type', 'parent_id', 'created_by'];

    public function tasks()   { return $this->hasMany(ScheduleBaselineTask::class, 'baseline_id'); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
}
