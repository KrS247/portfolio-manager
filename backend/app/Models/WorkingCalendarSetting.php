<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class WorkingCalendarSetting extends Model {
    protected $table = 'working_calendar_settings';
    protected $fillable = ['work_days', 'hours_per_day', 'timezone'];

    public function getWorkDaysArray(): array {
        return array_map('intval', explode(',', $this->work_days));
    }
}
