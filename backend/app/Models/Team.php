<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class Team extends Model {
    use BelongsToTenant;

    protected $table = 'teams';
    public $timestamps = false;
    protected $fillable = ['company_id', 'name'];
    const CREATED_AT = 'created_at';

    // Override timestamps to only have created_at
    public function setUpdatedAt($value) { return $this; }
}
