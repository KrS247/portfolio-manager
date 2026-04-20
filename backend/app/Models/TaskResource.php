<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class TaskResource extends Model {
    protected $table = 'task_resources';
    public $timestamps = false;
    protected $fillable = ['task_id', 'user_id', 'estimated_hours', 'actual_hours'];

    public function user() { return $this->belongsTo(User::class, 'user_id'); }
}
