<?php
namespace App\Services;

use App\Models\PublicHoliday;
use App\Models\WorkingCalendarSetting;
use App\Models\UserWorkingCalendar;
use Carbon\Carbon;

class WorkingCalendarService
{
    private ?array $holidaySet     = null;   // exact dates  e.g. ['2026-12-25' => 1]
    private ?array $recurringSet   = null;   // MM-DD keys   e.g. ['12-25' => 1]
    private ?array $companyWorkDays = null;

    // ── Holiday cache ─────────────────────────────────────────────────────────

    public function getHolidaySet(): array
    {
        if ($this->holidaySet === null) {
            $this->holidaySet   = [];
            $this->recurringSet = [];
            foreach (PublicHoliday::all() as $h) {
                $dateStr = $h->holiday_date instanceof \Carbon\Carbon
                    ? $h->holiday_date->format('Y-m-d')
                    : (string) $h->holiday_date;
                if ($h->recurring) {
                    // store as MM-DD so it matches any year
                    $mmdd = substr($dateStr, 5); // '12-25'
                    $this->recurringSet[$mmdd] = 1;
                } else {
                    $this->holidaySet[$dateStr] = 1;
                }
            }
        }
        return $this->holidaySet;
    }

    public function getRecurringSet(): array
    {
        if ($this->recurringSet === null) $this->getHolidaySet(); // populates both
        return $this->recurringSet;
    }

    public function clearCache(): void
    {
        $this->holidaySet    = null;
        $this->recurringSet  = null;
        $this->companyWorkDays = null;
    }

    // ── Company work days ─────────────────────────────────────────────────────

    public function getCompanyWorkDays(): array
    {
        if ($this->companyWorkDays === null) {
            $setting = WorkingCalendarSetting::find(1);
            $this->companyWorkDays = $setting
                ? $setting->getWorkDaysArray()
                : [1, 2, 3, 4, 5];
        }
        return $this->companyWorkDays;
    }

    // ── Per-user work days (falls back to company) ────────────────────────────

    public function getWorkDaysFor(?int $userId): array
    {
        if ($userId) {
            $uc = UserWorkingCalendar::where('user_id', $userId)->first();
            if ($uc && $uc->work_days) {
                return $uc->getWorkDaysArray();
            }
        }
        return $this->getCompanyWorkDays();
    }

    // ── Core calendar predicates ──────────────────────────────────────────────

    /**
     * Carbon uses 1=Monday … 7=Sunday (ISO).
     */
    public function isWorkingDay(Carbon $date, ?int $userId = null): bool
    {
        $iso      = (int) $date->isoFormat('E'); // 1=Mon … 7=Sun
        $workDays = $this->getWorkDaysFor($userId);
        if (!in_array($iso, $workDays)) return false;

        $ymd  = $date->format('Y-m-d');
        $mmdd = $date->format('m-d');

        if (isset($this->getHolidaySet()[$ymd]))    return false;
        if (isset($this->getRecurringSet()[$mmdd])) return false;

        return true;
    }

    public function nextWorkingDay(Carbon $date, ?int $userId = null): Carbon
    {
        $d = $date->copy();
        while (!$this->isWorkingDay($d, $userId)) {
            $d->addDay();
        }
        return $d;
    }

    public function prevWorkingDay(Carbon $date, ?int $userId = null): Carbon
    {
        $d = $date->copy();
        while (!$this->isWorkingDay($d, $userId)) {
            $d->subDay();
        }
        return $d;
    }

    /**
     * Add $n working days to $date (forward if positive, backward if negative).
     */
    public function addWorkingDays(Carbon $date, int $n, ?int $userId = null): Carbon
    {
        $d    = $date->copy();
        $step = $n >= 0 ? 1 : -1;
        $rem  = abs($n);
        while ($rem > 0) {
            $d->addDays($step);
            if ($this->isWorkingDay($d, $userId)) $rem--;
        }
        return $d;
    }

    /**
     * Count working days from $start up to but NOT including $end.
     */
    public function workingDaysBetween(Carbon $start, Carbon $end, ?int $userId = null): int
    {
        if ($end->lte($start)) return 0;
        $count = 0;
        $d     = $start->copy();
        while ($d->lt($end)) {
            if ($this->isWorkingDay($d, $userId)) $count++;
            $d->addDay();
        }
        return $count;
    }

    /**
     * Add calendar lag days to a working-day result, then snap to next working day.
     */
    public function applyLag(Carbon $date, int $lagDays, ?int $userId = null): Carbon
    {
        if ($lagDays === 0) return $date->copy();
        $result = $date->copy()->addDays($lagDays);
        if ($lagDays > 0) return $this->nextWorkingDay($result, $userId);
        return $this->prevWorkingDay($result, $userId);
    }
}
