<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Seed the admin.agile-phases page and grant admin roles edit access.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('pages') || !Schema::hasTable('page_permissions') || !Schema::hasTable('roles')) {
            return;
        }

        // Insert the page (idempotent)
        if (!DB::table('pages')->where('slug', 'admin.agile-phases')->exists()) {
            DB::table('pages')->insert([
                'name'        => 'Agile Phases',
                'slug'        => 'admin.agile-phases',
                'description' => 'Manage Kanban board phases and their sequence',
            ]);
        }

        $pageId = DB::table('pages')->where('slug', 'admin.agile-phases')->value('id');
        if (!$pageId) {
            return;
        }

        // Grant edit access to every admin role
        $adminRoles = DB::table('roles')->where('is_admin', true)->pluck('id');

        foreach ($adminRoles as $roleId) {
            $exists = DB::table('page_permissions')
                ->where('role_id', $roleId)
                ->where('page_id', $pageId)
                ->exists();

            if (!$exists) {
                DB::table('page_permissions')->insert([
                    'role_id'      => $roleId,
                    'page_id'      => $pageId,
                    'access_level' => 'edit',
                ]);
            }
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('pages') || !Schema::hasTable('page_permissions')) {
            return;
        }

        $pageId = DB::table('pages')->where('slug', 'admin.agile-phases')->value('id');
        if ($pageId) {
            DB::table('page_permissions')->where('page_id', $pageId)->delete();
            DB::table('pages')->where('id', $pageId)->delete();
        }
    }
};
