<?php
namespace App\Models;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject {
    protected $table = 'users';
    public $timestamps = false;

    // Fix for audit finding H-9: password_hash must NOT be fillable to prevent
    // mass-assignment attacks that could set an arbitrary hash. role_id must NOT
    // be fillable to prevent privilege escalation via mass assignment.
    // Both fields are set explicitly in AuthController and UserController only.
    protected $fillable = ['username', 'name', 'email', 'hourly_rate', 'team_id', 'company', 'company_id'];

    // Fix for audit finding H-9 (part 2): hide the legacy empty 'password' column
    // and remember_token in addition to password_hash so toArray() / toJson()
    // never expose credential-adjacent fields.
    protected $hidden = ['password', 'password_hash', 'remember_token'];

    public function getJWTIdentifier() { return $this->getKey(); }
    public function getJWTCustomClaims() { return []; }

    public function role()    { return $this->belongsTo(Role::class,    'role_id'); }
    public function company() { return $this->belongsTo(Company::class, 'company_id'); }

    // Override auth password field
    public function getAuthPassword() { return $this->password_hash; }
}
