<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * ActivityLog
 *
 * Append-only audit trail for all meaningful application events.
 *
 * Columns added for compliance:
 *  - ip_address  (IPv4/IPv6, max 45 chars)
 *  - user_agent  (truncated to 512 chars)
 *
 * SOC 2: CC7.2, CC7.3
 * ISO 27001: A.8.15, A.8.16
 */
class ActivityLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'loggable_type',
        'loggable_id',
        'user_id',
        'ip_address',
        'user_agent',
        'action',
        'description',
        'changes',
        'created_at',
    ];

    protected $casts = [
        'changes'    => 'array',
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // ── Static helpers ────────────────────────────────────────────────────────

    /**
     * Record an audit event.
     *
     * @param  string       $type     Loggable type (e.g. 'task', 'user', 'auth')
     * @param  int          $id       Loggable ID (use 0 for non-model events like login)
     * @param  string       $action   Machine-readable verb (e.g. 'login', 'status_changed')
     * @param  string       $desc     Human-readable description
     * @param  int|null     $userId   Acting user's ID
     * @param  array        $changes  Optional before/after change set
     * @param  Request|null $request  HTTP request (for IP + user-agent capture)
     */
    public static function record(
        string   $type,
        int      $id,
        string   $action,
        string   $desc,
        ?int     $userId  = null,
        array    $changes = [],
        ?Request $request = null
    ): void {
        // Auto-resolve request from container if not passed explicitly
        $req = $request ?? app('request');

        static::create([
            'loggable_type' => $type,
            'loggable_id'   => $id,
            'user_id'       => $userId,
            'ip_address'    => $req?->ip(),
            'user_agent'    => mb_substr($req?->userAgent() ?? '', 0, 512),
            'action'        => $action,
            'description'   => $desc,
            'changes'       => empty($changes) ? null : $changes,
            'created_at'    => now(),
        ]);
    }
}
