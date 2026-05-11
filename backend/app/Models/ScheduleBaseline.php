<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class ScheduleBaseline extends Model {
    use BelongsToTenant;

    protected $table = 'schedule_baselines';
    protected $fillable = ['company_id', 'name', 'parent_type', 'parent_id', 'created_by'];

    public function tasks()   { return $this->hasMany(ScheduleBaselineTask::class, 'baseline_id'); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
}
