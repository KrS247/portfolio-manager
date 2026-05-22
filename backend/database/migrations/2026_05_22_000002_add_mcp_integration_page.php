<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('pages') || ! Schema::hasTable('page_permissions') || ! Schema::hasTable('roles')) {
            return;
        }

        if (! DB::table('pages')->where('slug', 'admin.mcp-integration')->exists()) {
            DB::table('pages')->insert([
                'name'        => 'MCP Integration',
                'slug'        => 'admin.mcp-integration',
                'description' => 'Configure MCP API keys for AI assistant access',
            ]);
        }

        $pageId = DB::table('pages')->where('slug', 'admin.mcp-integration')->value('id');
        if (! $pageId) return;

        foreach (DB::table('roles')->where('is_admin', true)->pluck('id') as $roleId) {
            if (! DB::table('page_permissions')->where('role_id', $roleId)->where('page_id', $pageId)->exists()) {
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
        if (! Schema::hasTable('pages') || ! Schema::hasTable('page_permissions')) return;

        $pageId = DB::table('pages')->where('slug', 'admin.mcp-integration')->value('id');
        if ($pageId) {
            DB::table('page_permissions')->where('page_id', $pageId)->delete();
            DB::table('pages')->where('id', $pageId)->delete();
        }
    }
};
