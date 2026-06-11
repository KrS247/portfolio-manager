<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Http\Request;
use App\Models\User;
use App\Http\Controllers\PortfolioController;
use App\Http\Controllers\ProgramController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\TaskController;

/**
 * READ-ONLY DIAGNOSTIC (no schema or data changes).
 *
 * Proves the live API returns data through the real controller stack —
 * including the TenantScope (company_id) and visibleScope (ownership)
 * filters that were previously hiding everything.
 *
 * For each test user we authenticate in-process (no token printed) and
 * invoke each list controller exactly as the HTTP layer would, then echo
 * ONLY the item counts to the deploy log. No row data is emitted.
 *
 *   user 2  → admin  (bypasses visibleScope; sees all company-1 data)
 *   user 3  → member (subject to visibleScope; should now see data via
 *                     the assigned_to / created_by stamps)
 */
return new class extends Migration
{
    public function up(): void
    {
        echo "\n=== VERIFY API VISIBILITY (read-only) ===\n";

        $controllers = [
            'portfolios' => PortfolioController::class,
            'programs'   => ProgramController::class,
            'projects'   => ProjectController::class,
            'tasks'      => TaskController::class,
        ];

        foreach ([2 => 'admin', 3 => 'member'] as $uid => $label) {
            $user = User::with('role')->find($uid);
            if (!$user) {
                echo "  [skip] user {$uid} not found\n";
                continue;
            }

            // Authenticate for both filter mechanisms:
            //  - auth()->setUser()  → TenantScope reads auth()->user()->company_id
            //  - request attribute  → visibleScope reads attributes['auth_user']
            auth()->setUser($user);

            echo "\n  user {$uid} ({$user->username}, role={$label}, company={$user->company_id}):\n";

            foreach ($controllers as $name => $class) {
                try {
                    $req = Request::create('/api/' . $name, 'GET');
                    $req->attributes->set('auth_user', $user);

                    $response = (new $class)->index($req);
                    $payload  = json_decode($response->getContent(), true);

                    if (is_array($payload)) {
                        $count = array_is_list($payload)
                            ? count($payload)
                            : (isset($payload['data']) && is_array($payload['data'])
                                ? count($payload['data'])
                                : 'obj');
                    } else {
                        $count = 'non-array';
                    }
                    $status = method_exists($response, 'getStatusCode') ? $response->getStatusCode() : '?';
                    echo "    {$name}: HTTP {$status}, items={$count}\n";
                } catch (\Throwable $e) {
                    echo "    {$name}: ERROR " . get_class($e) . ": " . $e->getMessage() . "\n";
                }
            }

            auth()->forgetGuards();
        }

        echo "\n=== DONE ===\n";
    }

    public function down(): void {}
};
