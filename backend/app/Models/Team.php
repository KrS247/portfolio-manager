<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Team extends Model {
    protected $table = 'teams';
    public $timestamps = false;
    protected $fillable = ['name'];
    const CREATED_AT = 'created_at';

    // Override timestamps to only have created_at
    public function setUpdatedAt($value) { return $this; }
}
