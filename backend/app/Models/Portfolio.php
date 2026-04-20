<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Portfolio extends Model {
    protected $table = 'portfolios';
    protected $fillable = ['name', 'description', 'status', 'priority', 'start_date', 'end_date', 'owner_id'];
    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    public function owner() { return $this->belongsTo(User::class, 'owner_id'); }
    public function programs() { return $this->hasMany(Program::class, 'portfolio_id'); }
}
