<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Make the legacy Laravel scaffold columns nullable so they don't block
     * user creation when the app uses username/password_hash instead.
     */
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            if (Schema::hasColumn('users', 'name')) {
                DB::statement('ALTER TABLE users ALTER COLUMN "name" DROP NOT NULL');
            }
            if (Schema::hasColumn('users', 'password')) {
                DB::statement('ALTER TABLE users ALTER COLUMN "password" DROP NOT NULL');
            }
        } elseif (in_array($driver, ['mysql', 'mariadb'])) {
            if (Schema::hasColumn('users', 'name')) {
                DB::statement("ALTER TABLE users MODIFY COLUMN `name` VARCHAR(255) NULL DEFAULT ''");
            }
            if (Schema::hasColumn('users', 'password')) {
                DB::statement("ALTER TABLE users MODIFY COLUMN `password` VARCHAR(255) NULL DEFAULT ''");
            }
        }
        // SQLite: ALTER COLUMN is not supported, but SQLite is only used locally
        // and the production DB is always pgsql or mysql on Railway.
    }

    public function down(): void
    {
        // Intentionally not reversing — restoring NOT NULL on a populated table
        // would require every existing row to have a non-null value first.
    }
};
