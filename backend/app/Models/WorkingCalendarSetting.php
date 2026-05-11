<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class WorkingCalendarSetting extends Model {
    use BelongsToTenant;

    protected $table = 'working_calendar_settings';
    protected $fillable = ['company_id', 'work_days', 'hours_per_day', 'timezone'];

    public function getWorkDaysArray(): array {
        return array_map('intval', explode(',', $this->work_days));
    }
}
