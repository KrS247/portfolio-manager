<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class UserWorkingCalendar extends Model {
    protected $table = 'user_working_calendars';
    protected $fillable = ['user_id', 'work_days', 'hours_per_day'];

    public function user() { return $this->belongsTo(User::class); }

    public function getWorkDaysArray(): array {
        if (!$this->work_days) return [];
        return array_map('intval', explode(',', $this->work_days));
    }
}
