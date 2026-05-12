<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Company extends Model {
    protected $table    = 'companies';
    public    $timestamps = false;
    protected $fillable = [
        'name', 'slug', 'plan', 'status', 'trial_ends_at', 'max_users', 'owner_email',
        'onboarding_completed',
    ];
    protected $casts = [
        'trial_ends_at'        => 'datetime',
        'onboarding_completed' => 'boolean',
    ];

    const CREATED_AT = 'created_at';
    public function setUpdatedAt($value) { return $this; }

    public function permissions() {
        return $this->hasMany(CompanyPermission::class);
    }

    public function users() {
        return $this->hasMany(User::class);
    }

    /** Whether this tenant's subscription is currently active. */
    public function isActive(): bool
    {
        return $this->status === 'active'
            || ($this->status === 'trial' && $this->trial_ends_at && $this->trial_ends_at->isFuture());
    }

    /** Human-readable plan label. */
    public function planLabel(): string
    {
        return match($this->plan) {
            'professional' => 'Professional',
            'enterprise'   => 'Enterprise',
            default        => 'Starter',
        };
    }
}
