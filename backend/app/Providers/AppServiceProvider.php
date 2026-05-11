<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        // ── HTTPS enforcement (production only) ───────────────────────────────
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        // ── Named rate limiters ───────────────────────────────────────────────

        // Login: 5 attempts per minute per IP; after exhaustion return 429
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(5)->by(
                'login:' . $request->ip()
            )->response(fn() => response()->json([
                'error' => 'Too many login attempts. Please wait 1 minute before trying again.',
            ], 429));
        });

        // Register: 3 per hour per IP (prevents mass account creation)
        RateLimiter::for('register', function (Request $request) {
            return Limit::perHour(3)->by(
                'register:' . $request->ip()
            )->response(fn() => response()->json([
                'error' => 'Too many registration attempts. Please try again later.',
            ], 429));
        });

        // Forgot-password: 3 per hour per IP (prevents email enumeration via timing)
        RateLimiter::for('forgot-password', function (Request $request) {
            return Limit::perHour(3)->by(
                'forgot-password:' . $request->ip()
            )->response(fn() => response()->json([
                'error' => 'Too many password reset requests. Please try again later.',
            ], 429));
        });

        // Backup endpoint: 1 per hour per IP
        RateLimiter::for('backup', function (Request $request) {
            return Limit::perHour(1)->by(
                'backup:' . $request->ip()
            )->response(fn() => response()->json([
                'error' => 'Rate limit exceeded for backup endpoint.',
            ], 429));
        });

        // Password reset: 10 per hour per IP (SOC 2 CC6.1 / ISO A.8.5)
        // Fix for audit finding M-5: reset-password had no throttle, enabling
        // token brute-force attacks despite large token entropy.
        RateLimiter::for('reset-password', function (Request $request) {
            return Limit::perHour(10)->by(
                'reset-password:' . $request->ip()
            )->response(fn() => response()->json([
                'error' => 'Too many password reset attempts. Please try again later.',
            ], 429));
        });
    }
}
