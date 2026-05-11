<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class Project extends Model {
    use BelongsToTenant;

    protected $table = 'projects';
    protected $fillable = ['company_id', 'program_id', 'name', 'description', 'status', 'priority', 'start_date', 'end_date', 'owner_id', 'clickup_id'];
    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    public function program() { return $this->belongsTo(Program::class, 'program_id'); }
    public function owner() { return $this->belongsTo(User::class, 'owner_id'); }
}
