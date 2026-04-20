<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanySetting extends Model
{
    protected $table = 'company_settings';
    public $timestamps = false;
    protected $fillable = ['company_name', 'logo_path', 'updated_at'];
}
