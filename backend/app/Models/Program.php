<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class Program extends Model {
    use BelongsToTenant;

    protected $table = 'programs';
    protected $fillable = ['company_id', 'portfolio_id', 'name', 'description', 'status', 'priority', 'start_date', 'end_date', 'owner_id'];
    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    public function portfolio() { return $this->belongsTo(Portfolio::class, 'portfolio_id'); }
    public function projects() { return $this->hasMany(Project::class, 'program_id'); }
    public function owner() { return $this->belongsTo(User::class, 'owner_id'); }
}
