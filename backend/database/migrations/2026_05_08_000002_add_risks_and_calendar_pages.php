<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Add dedicated page slugs for Risk Management and My Calendar.
 *
 * Previously both pages incorrectly shared the 'tasks' slug, which prevented
 * administrators from granting or restricting access to them independently.
 * This migration adds 'risks' and 'calendar' pages and mirrors the 'tasks'
 * access level for every role that already has a tasks permission entry.
 *
 * Fix for audit finding L-6.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('pages') || !Schema::hasTable('page_permissions') || !Schema::hasTable('roles')) {
            return; // test environments without the full schema — skip silently
        }

        // Insert the two new pages (guard: idempotent on re-run)
        foreach ([
            ['name' => 'Risk Management', 'slug' => 'risks',    'description' => 'Risk register and risk management'],
            ['name' => 'My Calendar',      'slug' => 'calendar', 'description' => 'Personal task calendar view'],
        ] as $page) {
            if (!DB::table('pages')->where('slug', $page['slug'])->exists()) {
                DB::table('pages')->insert($page);
            }
        }

        $risksPageId    = DB::table('pages')->where('slug', 'risks')->value('id');
        $calendarPageId = DB::table('pages')->where('slug', 'calendar')->value('id');
        $tasksPageId    = DB::table('pages')->where('slug', 'tasks')->value('id');

        if (!$risksPageId || !$calendarPageId || !$tasksPageId) {
            return;
        }

        // Mirror the 'tasks' access_level for every role that has a tasks permission entry
        $taskPermissions = DB::table('page_permissions')
            ->where('page_id', $tasksPageId)
            ->get(['role_id', 'access_level']);

        foreach ($taskPermissions as $perm) {
            foreach ([$risksPageId, $calendarPageId] as $newPageId) {
                $exists = DB::table('page_permissions')
                    ->where('role_id', $perm->role_id)
                    ->where('page_id', $newPageId)
                    ->exists();

                if (!$exists) {
                    DB::table('page_permissions')->insert([
                        'role_id'      => $perm->role_id,
                        'page_id'      => $newPageId,
                        'access_level' => $perm->access_level,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('pages') || !Schema::hasTable('page_permissions')) {
            return;
        }

        foreach (['risks', 'calendar'] as $slug) {
            $pageId = DB::table('pages')->where('slug', $slug)->value('id');
            if ($pageId) {
                DB::table('page_permissions')->where('page_id', $pageId)->delete();
                DB::table('pages')->where('id', $pageId)->delete();
            }
        }
    }
};
