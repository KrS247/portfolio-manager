<?php
namespace App\Http\Controllers;

use App\Models\PublicHoliday;
use App\Models\Task;
use App\Models\UserWorkingCalendar;
use App\Models\WorkingCalendarSetting;
use App\Services\SchedulingEngine;
use Illuminate\Http\Request;
use Carbon\Carbon;

class WorkingCalendarController extends Controller
{
    /** GET /working-calendar */
    public function show()
    {
        $setting  = WorkingCalendarSetting::firstOrCreate(
            ['id' => 1],
            ['work_days' => '1,2,3,4,5', 'hours_per_day' => 8.00, 'timezone' => 'UTC']
        );
        $holidays = PublicHoliday::orderBy('holiday_date')->get();

        return response()->json([
            'work_days'     => $setting->work_days,
            'hours_per_day' => $setting->hours_per_day,
            'timezone'      => $setting->timezone,
            'holidays'      => $holidays,
        ]);
    }

    /** PUT /working-calendar */
    public function update(Request $request)
    {
        $data = $request->validate([
            'work_days'     => 'required|string|regex:/^[1-7](,[1-7])*$/',
            'hours_per_day' => 'required|numeric|min:1|max:24',
            'timezone'      => 'required|string|max:64',
        ]);

        $setting = WorkingCalendarSetting::firstOrCreate(['id' => 1]);
        $setting->fill($data)->save();

        return response()->json(['message' => 'Working calendar updated.', 'setting' => $setting]);
    }

    /** GET /working-calendar/holidays */
    public function listHolidays()
    {
        return response()->json(PublicHoliday::orderBy('holiday_date')->get());
    }

    /** POST /working-calendar/holidays */
    public function addHoliday(Request $request)
    {
        // Accept 'date' (frontend field) or 'holiday_date' (legacy)
        $dateField = $request->has('date') ? 'date' : 'holiday_date';

        $data = $request->validate([
            $dateField    => 'required|date',
            'name'        => 'required|string|max:255',
            'recurring'   => 'nullable|boolean',
        ]);

        $holidayDate = $data[$dateField];
        $recurring   = (bool) ($data['recurring'] ?? false);

        $holiday = PublicHoliday::updateOrCreate(
            ['holiday_date' => $holidayDate],
            ['name' => $data['name'], 'recurring' => $recurring]
        );

        // Re-run the scheduler for every scope that has tasks on this date
        // so those tasks get pushed to the next working day.
        $this->rescheduleAffectedTasks($holidayDate, $recurring, app(SchedulingEngine::class));

        return response()->json($holiday, 201);
    }

    /**
     * Find all tasks whose start_date or due_date falls on the new holiday
     * (or on the same MM-DD in any year if recurring) and re-run the
     * scheduling engine for each affected parent scope.
     */
    private function rescheduleAffectedTasks(string $holidayDate, bool $recurring, SchedulingEngine $engine): void
    {
        $mmdd = substr($holidayDate, 5); // 'MM-DD'

        $query = Task::query();
        if ($recurring) {
            // Match any year — SQLite strftime, MySQL DATE_FORMAT
            $query->where(function ($q) use ($mmdd) {
                $q->whereRaw("strftime('%m-%d', start_date) = ?", [$mmdd])
                  ->orWhereRaw("strftime('%m-%d', due_date) = ?",   [$mmdd]);
            });
        } else {
            $query->where(function ($q) use ($holidayDate) {
                $q->where('start_date', $holidayDate)
                  ->orWhere('due_date', $holidayDate);
            });
        }

        // Collect unique parent scopes and re-run once per scope
        $scopes = $query->get(['parent_type', 'parent_id'])
            ->map(fn($t) => $t->parent_type . ':' . $t->parent_id)
            ->unique();

        foreach ($scopes as $scope) {
            [$parentType, $parentId] = explode(':', $scope);
            try {
                $engine->run($parentType, (int) $parentId);
            } catch (\Throwable $e) {
                // Non-fatal — log and continue
                \Log::warning("Holiday reschedule failed for {$scope}: " . $e->getMessage());
            }
        }
    }

    /** DELETE /working-calendar/holidays/{id} */
    public function deleteHoliday(int $id)
    {
        PublicHoliday::findOrFail($id)->delete();
        return response()->json(['message' => 'Holiday removed.']);
    }

    /** GET /working-calendar/user/{userId} */
    public function userCalendar(int $userId)
    {
        $cal = UserWorkingCalendar::where('user_id', $userId)->first();
        return response()->json($cal);
    }

    /** PUT /working-calendar/user/{userId} */
    public function updateUserCalendar(Request $request, int $userId)
    {
        $data = $request->validate([
            'work_days'     => 'nullable|string|regex:/^[1-7](,[1-7])*$/',
            'hours_per_day' => 'nullable|numeric|min:1|max:24',
        ]);

        $cal = UserWorkingCalendar::updateOrCreate(
            ['user_id' => $userId],
            $data
        );

        return response()->json($cal);
    }
}
