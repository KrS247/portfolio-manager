<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class Risk extends Model {
    use BelongsToTenant;

    protected $table = 'risks';
    protected $fillable = ['company_id', 'task_id', 'name', 'description', 'probability', 'impact', 'risk_rate', 'risk_status', 'mitigation_plan', 'status'];
    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    public function task() { return $this->belongsTo(Task::class, 'task_id'); }
}
