<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AgilePhase extends Model {
    protected $table    = 'agile_phases';
    protected $fillable = ['name', 'description', 'sequence'];
}
