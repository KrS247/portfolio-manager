<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class PasswordResetToken extends Model {
    protected $table = 'password_reset_tokens';
    public $timestamps = false;
    protected $fillable = ['user_id', 'token', 'expires_at'];
    const CREATED_AT = 'created_at';
}
