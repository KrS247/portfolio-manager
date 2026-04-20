<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class PublicHoliday extends Model {
    protected $table = 'public_holidays';
    protected $fillable = ['holiday_date', 'name', 'recurring'];
    protected $casts = ['holiday_date' => 'date:Y-m-d', 'recurring' => 'boolean'];
}
