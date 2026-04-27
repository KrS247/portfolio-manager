<?php
namespace App\Models;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject {
    protected $table = 'users';
    public $timestamps = false;
    protected $hidden = ['password_hash'];
    protected $fillable = ['username', 'email', 'password_hash', 'role_id', 'hourly_rate', 'team_id', 'company', 'company_id'];

    public function getJWTIdentifier() { return $this->getKey(); }
    public function getJWTCustomClaims() { return []; }

    public function role()    { return $this->belongsTo(Role::class,    'role_id'); }
    public function company() { return $this->belongsTo(Company::class, 'company_id'); }

    // Override auth password field
    public function getAuthPassword() { return $this->password_hash; }
}
