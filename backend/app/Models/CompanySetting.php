<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class CompanySetting extends Model
{
    use BelongsToTenant;

    protected $table = 'company_settings';
    public $timestamps = false;
    protected $fillable = ['company_id', 'company_name', 'logo_path', 'updated_at'];
}
