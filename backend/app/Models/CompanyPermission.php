<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class CompanyPermission extends Model {
    protected $table    = 'company_permissions';
    public    $timestamps = false;
    protected $fillable = ['company_id', 'page_id', 'can_view'];

    public function page()    { return $this->belongsTo(Page::class); }
    public function company() { return $this->belongsTo(Company::class); }
}
