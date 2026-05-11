<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskComment extends Model
{
    protected $fillable = ['task_id', 'user_id', 'content'];

    public function user()  { return $this->belongsTo(User::class, 'user_id'); }
    public function task()  { return $this->belongsTo(Task::class, 'task_id'); }
}
