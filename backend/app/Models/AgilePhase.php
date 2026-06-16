<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class AgilePhase extends Model {
    use BelongsToTenant;

    protected $table    = 'agile_phases';
    protected $fillable = ['company_id', 'name', 'description', 'sequence'];
}
