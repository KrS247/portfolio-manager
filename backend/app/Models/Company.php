<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Company extends Model {
    protected $table    = 'companies';
    public    $timestamps = false;
    protected $fillable = ['name'];

    const CREATED_AT = 'created_at';
    public function setUpdatedAt($value) { return $this; }

    public function permissions() {
        return $this->hasMany(CompanyPermission::class);
    }

    public function users() {
        return $this->hasMany(User::class);
    }
}
