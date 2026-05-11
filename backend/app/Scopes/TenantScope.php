<?php

namespace App\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * TenantScope
 *
 * Automatically restricts every Eloquent query on a tenant-scoped model to
 * the current user's company_id.  Applied globally via the BelongsToTenant
 * trait so no controller code needs to remember to add the WHERE clause.
 *
 * When no authenticated user is present (e.g. unauthenticated routes or test
 * helpers that insert rows directly via DB::table()) the scope is a no-op —
 * it does NOT add a WHERE clause, which keeps direct DB inserts visible to
 * subsequent assertions in tests.
 */
class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        if ($user = auth()->user()) {
            $builder->where($model->getTable() . '.company_id', $user->company_id);
        }
    }
}
