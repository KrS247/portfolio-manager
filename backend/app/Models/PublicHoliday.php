<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class PublicHoliday extends Model {
    use BelongsToTenant;

    protected $table = 'public_holidays';
    protected $fillable = ['company_id', 'holiday_date', 'name', 'recurring'];
    protected $casts = ['holiday_date' => 'date:Y-m-d', 'recurring' => 'boolean'];
}
