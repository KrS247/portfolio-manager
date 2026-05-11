<?php

namespace App\Models\Concerns;

use App\Models\Company;
use App\Scopes\TenantScope;

/**
 * BelongsToTenant
 *
 * Mix this trait into any Eloquent model that must be isolated per tenant.
 *
 * What it does:
 *  - Registers TenantScope as a global scope so every SELECT is automatically
 *    filtered to the current user's company_id.
 *  - Sets company_id automatically on CREATE so controllers never have to
 *    remember to pass it.
 *  - Exposes a scopeForTenant() helper for admin operations that need to
 *    bypass the automatic scope (e.g. super-admin views).
 *  - Exposes a scopeWithoutTenant() shortcut for raw cross-tenant queries.
 *
 * Usage:
 *   class Portfolio extends Model {
 *       use BelongsToTenant;
 *       ...
 *   }
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        // ── Read: automatic tenant filter ────────────────────────────────────
        static::addGlobalScope(new TenantScope());

        // ── Write: auto-populate company_id on new records ───────────────────
        static::creating(function ($model) {
            if (empty($model->company_id) && $user = auth()->user()) {
                $model->company_id = $user->company_id;
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Scope a query to a specific tenant.
     * Use this in admin/super-admin contexts where the normal scope is bypassed.
     *
     *   Portfolio::forTenant(5)->get();
     */
    public function scopeForTenant($query, int $companyId)
    {
        return $query->withoutGlobalScope(TenantScope::class)
                     ->where($this->getTable() . '.company_id', $companyId);
    }

    /**
     * Scope a query across ALL tenants (super-admin only).
     *
     *   Portfolio::withoutTenant()->get();
     */
    public function scopeWithoutTenant($query)
    {
        return $query->withoutGlobalScope(TenantScope::class);
    }

    /**
     * Relationship: the Company (tenant) this record belongs to.
     */
    public function tenant()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}
