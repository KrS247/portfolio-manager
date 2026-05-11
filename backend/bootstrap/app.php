<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'jwt.auth'  => \App\Http\Middleware\JwtAuthenticate::class,
            'authorize' => \App\Http\Middleware\Authorize::class,
            'throttle'  => \Illuminate\Routing\Middleware\ThrottleRequests::class,
        ]);

        // SecurityHeaders is registered on the GLOBAL middleware stack (not just
        // api) so it covers error pages, web routes, and any future additions —
        // not only /api/* routes. This ensures X-Frame-Options, X-Content-Type-
        // Options, and CSP are present on every HTTP response including 404/500
        // error pages rendered by Laravel's exception handler.
        // Fix for audit finding M-3.
        $middleware->prepend(\App\Http\Middleware\SecurityHeaders::class);

        // CORS must run before SecurityHeaders so CORS headers are set first;
        // SecurityHeaders only adds/removes headers, it does not conflict.
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
