<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sprint extends Model {
    protected $table    = 'sprints';
    protected $fillable = ['name', 'start_date', 'duration_weeks', 'status'];
}
