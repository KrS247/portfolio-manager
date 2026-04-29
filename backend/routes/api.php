<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PortfolioController;
use App\Http\Controllers\ProgramController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\RiskController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\CompanySettingController;
use App\Http\Controllers\ClickUpController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\WorkingCalendarController;
use App\Http\Controllers\ScheduleBaselineController;
use App\Http\Controllers\EVMController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\CapacityController;
use App\Http\Controllers\CompanyController;

// Public auth routes
Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('reset-password', [AuthController::class, 'resetPassword']);
});

// Health check
Route::get('/health', fn() => response()->json(['status' => 'ok', 'timestamp' => now()]));

// Temporary DB diagnostic (remove after confirming production DB)
Route::get('/db-check', function() {
    try {
        $conn = config('database.default');
        $db   = config("database.connections.$conn.database");
        $tables = \Illuminate\Support\Facades\DB::select(
            $conn === 'sqlite'
                ? "SELECT name FROM sqlite_master WHERE type='table'"
                : "SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public'"
        );
        $userCount = \Illuminate\Support\Facades\DB::table('users')->count();
        return response()->json(['connection' => $conn, 'database' => $db, 'table_count' => count($tables), 'user_count' => $userCount]);
    } catch (\Exception $e) {
        return response()->json(['error' => $e->getMessage()]);
    }
});


// Protected routes
Route::middleware('jwt.auth')->group(function () {
    // Permissions
    Route::get('permissions/me', [PermissionController::class, 'me']);
    Route::get('permissions', [PermissionController::class, 'index'])->middleware('authorize:admin.permissions,view');
    Route::put('permissions', [PermissionController::class, 'update'])->middleware('authorize:admin.permissions,edit');

    // Portfolios
    Route::get('portfolios', [PortfolioController::class, 'index'])->middleware('authorize:portfolios,view');
    Route::get('portfolios/{id}', [PortfolioController::class, 'show'])->middleware('authorize:portfolios,view');
    Route::post('portfolios', [PortfolioController::class, 'store'])->middleware('authorize:portfolios,edit');
    Route::put('portfolios/{id}', [PortfolioController::class, 'update'])->middleware('authorize:portfolios,edit');
    Route::delete('portfolios/{id}', [PortfolioController::class, 'destroy'])->middleware('authorize:portfolios,edit');

    // Programs
    Route::get('programs', [ProgramController::class, 'index'])->middleware('authorize:programs,view');
    Route::get('programs/{id}', [ProgramController::class, 'show'])->middleware('authorize:programs,view');
    Route::post('programs', [ProgramController::class, 'store'])->middleware('authorize:programs,edit');
    Route::put('programs/{id}', [ProgramController::class, 'update'])->middleware('authorize:programs,edit');
    Route::delete('programs/{id}', [ProgramController::class, 'destroy'])->middleware('authorize:programs,edit');

    // Projects
    Route::get('projects', [ProjectController::class, 'index'])->middleware('authorize:projects,view');
    Route::get('projects/{id}', [ProjectController::class, 'show'])->middleware('authorize:projects,view');
    Route::post('projects', [ProjectController::class, 'store'])->middleware('authorize:projects,edit');
    Route::put('projects/{id}', [ProjectController::class, 'update'])->middleware('authorize:projects,edit');
    Route::delete('projects/{id}', [ProjectController::class, 'destroy'])->middleware('authorize:projects,edit');

    // Tasks - special routes first
    Route::get('tasks/high-risk', [TaskController::class, 'highRisk'])->middleware('authorize:tasks,view');
    Route::get('tasks/overdue', [TaskController::class, 'overdue'])->middleware('authorize:tasks,view');
    Route::get('tasks/over-budget', [TaskController::class, 'overBudget'])->middleware('authorize:tasks,view');
    Route::get('tasks/{id}/subtasks', [TaskController::class, 'subtasks'])->middleware('authorize:tasks,view');
    Route::get('tasks', [TaskController::class, 'index'])->middleware('authorize:tasks,view');
    Route::get('tasks/{id}', [TaskController::class, 'show'])->middleware('authorize:tasks,view');
    Route::post('tasks', [TaskController::class, 'store'])->middleware('authorize:tasks,edit');
    Route::put('tasks/{id}', [TaskController::class, 'update'])->middleware('authorize:tasks,edit');
    Route::delete('tasks/{id}', [TaskController::class, 'destroy'])->middleware('authorize:tasks,edit');
    Route::put('tasks/{id}/sequence', [TaskController::class, 'resequence'])->middleware('authorize:tasks,edit');
    Route::get('tasks/{id}/dependencies', [TaskController::class, 'getDependencies'])->middleware('authorize:tasks,view');
    Route::put('tasks/{id}/dependencies', [TaskController::class, 'updateDependencies'])->middleware('authorize:tasks,edit');
    Route::get('tasks/{id}/resources', [TaskController::class, 'getResources'])->middleware('authorize:tasks,view');
    Route::put('tasks/{id}/resources', [TaskController::class, 'updateResources'])->middleware('authorize:tasks,edit');

    // Risks
    Route::get('risks', [RiskController::class, 'index'])->middleware('authorize:tasks,view');
    Route::post('risks', [RiskController::class, 'store'])->middleware('authorize:tasks,edit');
    Route::put('risks/{id}', [RiskController::class, 'update'])->middleware('authorize:tasks,edit');

    // Users (admin only)
    Route::get('users', [UserController::class, 'index'])->middleware('authorize:admin.users,view');
    Route::get('users/{id}', [UserController::class, 'show'])->middleware('authorize:admin.users,view');
    Route::post('users', [UserController::class, 'store'])->middleware('authorize:admin.users,edit');
    Route::put('users/{id}', [UserController::class, 'update'])->middleware('authorize:admin.users,edit');
    Route::delete('users/{id}', [UserController::class, 'destroy'])->middleware('authorize:admin.users,edit');

    // Roles (admin only)
    Route::get('roles', [RoleController::class, 'index'])->middleware('authorize:admin.roles,view');
    Route::post('roles', [RoleController::class, 'store'])->middleware('authorize:admin.roles,edit');
    Route::put('roles/{id}', [RoleController::class, 'update'])->middleware('authorize:admin.roles,edit');
    Route::delete('roles/{id}', [RoleController::class, 'destroy'])->middleware('authorize:admin.roles,edit');

    // Company Settings
    Route::get('company-settings', [CompanySettingController::class, 'show']);
    Route::post('company-settings', [CompanySettingController::class, 'update'])->middleware('authorize:admin.company,edit');

    // ClickUp Integration
    Route::get('clickup/task/{id}', [ClickUpController::class, 'task'])->middleware('authorize:projects,view');

    // Companies
    Route::get('companies',                              [CompanyController::class, 'index']);
    Route::post('companies',                             [CompanyController::class, 'store'])->middleware('authorize:admin.companies,edit');
    Route::put('companies/{id}',                         [CompanyController::class, 'update'])->middleware('authorize:admin.companies,edit');
    Route::delete('companies/{id}',                      [CompanyController::class, 'destroy'])->middleware('authorize:admin.companies,edit');
    Route::get('companies/{id}/permissions',             [CompanyController::class, 'getPermissions'])->middleware('authorize:admin.companies,view');
    Route::put('companies/{id}/permissions',             [CompanyController::class, 'updatePermissions'])->middleware('authorize:admin.companies,edit');

    // Teams
    Route::get('teams', [TeamController::class, 'index']);
    Route::post('teams', [TeamController::class, 'store'])->middleware('authorize:admin.teams,edit');
    Route::put('teams/{id}', [TeamController::class, 'update'])->middleware('authorize:admin.teams,edit');
    Route::delete('teams/{id}', [TeamController::class, 'destroy'])->middleware('authorize:admin.teams,edit');

    // Scheduling Engine
    Route::post('schedule/run',     [ScheduleController::class, 'run'])->middleware('authorize:tasks,edit');
    Route::get('schedule/preview',  [ScheduleController::class, 'preview'])->middleware('authorize:tasks,view');

    // Working Calendar
    Route::get('working-calendar',                       [WorkingCalendarController::class, 'show']);
    Route::put('working-calendar',                       [WorkingCalendarController::class, 'update'])->middleware('authorize:admin.company,edit');
    Route::get('working-calendar/holidays',              [WorkingCalendarController::class, 'listHolidays']);
    Route::post('working-calendar/holidays',             [WorkingCalendarController::class, 'addHoliday'])->middleware('authorize:admin.company,edit');
    Route::delete('working-calendar/holidays/{id}',     [WorkingCalendarController::class, 'deleteHoliday'])->middleware('authorize:admin.company,edit');
    Route::get('working-calendar/user/{userId}',        [WorkingCalendarController::class, 'userCalendar'])->middleware('authorize:admin.users,view');
    Route::put('working-calendar/user/{userId}',        [WorkingCalendarController::class, 'updateUserCalendar'])->middleware('authorize:admin.users,edit');

    // EVM – Earned Value Management
    Route::get('evm', [EVMController::class, 'index'])->middleware('authorize:tasks,view');

    // Reports
    Route::get('reports/resource-utilisation', [ReportController::class, 'resourceUtilisation'])->middleware('authorize:tasks,view');
    Route::get('reports/risks',                [ReportController::class, 'risks'])->middleware('authorize:tasks,view');

    // Resource Capacity Planning
    Route::get('capacity', [CapacityController::class, 'index'])->middleware('authorize:tasks,view');

    // Schedule Baselines
    Route::get('baselines',         [ScheduleBaselineController::class, 'index'])->middleware('authorize:tasks,view');
    Route::post('baselines',        [ScheduleBaselineController::class, 'store'])->middleware('authorize:tasks,edit');
    Route::get('baselines/{id}',    [ScheduleBaselineController::class, 'show'])->middleware('authorize:tasks,view');
    Route::delete('baselines/{id}', [ScheduleBaselineController::class, 'destroy'])->middleware('authorize:tasks,edit');
});
