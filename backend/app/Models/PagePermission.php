<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class PagePermission extends Model {
    protected $table = 'page_permissions';
    public $timestamps = false;
    protected $fillable = ['role_id', 'page_id', 'access_level'];

    public function role() { return $this->belongsTo(Role::class, 'role_id'); }
    public function page() { return $this->belongsTo(Page::class, 'page_id'); }
}
