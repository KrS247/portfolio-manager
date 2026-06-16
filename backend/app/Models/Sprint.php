<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class Sprint extends Model {
    use BelongsToTenant;

    protected $table    = 'sprints';
    protected $fillable = ['company_id', 'name', 'start_date', 'duration_weeks', 'status'];
}
