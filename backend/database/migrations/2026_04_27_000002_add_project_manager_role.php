<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Add created_by to tasks
        if (!Schema::hasColumn('tasks', 'created_by')) {
            Schema::table('tasks', function ($table) {
                $table->unsignedBigInteger('created_by')->nullable()->after('updated_at');
            });
        }

        // Insert role if it doesn't exist
        $exists = DB::table('roles')->where('name', 'project_manager')->exists();
        if (!$exists) {
            $roleId = DB::table('roles')->insertGetId([
                'name' => 'project_manager',
                'description' => 'Create and manage own portfolios, programmes, projects and tasks',
                'is_admin' => false,
            ]);

            $pages = DB::table('pages')->pluck('id', 'slug');
            $permissions = [
                'dashboard'          => 'edit',
                'portfolios'         => 'edit',
                'programs'           => 'edit',
                'projects'           => 'edit',
                'tasks'              => 'edit',
                'admin.users'        => 'none',
                'admin.roles'        => 'none',
                'admin.permissions'  => 'none',
                'admin.dashboard'    => 'none',
                'admin.teams'        => 'none',
                'admin.company'      => 'none',
                'reports'            => 'edit',
                'capacity'           => 'edit',
            ];

            foreach ($permissions as $slug => $level) {
                if (isset($pages[$slug])) {
                    DB::table('page_permissions')->insert([
                        'role_id'      => $roleId,
                        'page_id'      => $pages[$slug],
                        'access_level' => $level,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        $role = DB::table('roles')->where('name', 'project_manager')->first();
        if ($role) {
            DB::table('page_permissions')->where('role_id', $role->id)->delete();
            DB::table('roles')->where('id', $role->id)->delete();
        }
    }
};
