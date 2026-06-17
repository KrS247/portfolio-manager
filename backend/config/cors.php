<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    // SOC 2 CC6.7 / ISO A.8.28: restrict to only the HTTP methods the API actually uses
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => env('FRONTEND_ORIGIN', 'http://localhost:5173') === '*'
        ? ['*']
        : array_filter(array_map('trim', explode(',', env('FRONTEND_ORIGIN', 'http://localhost:5173')))),

    'allowed_origins_patterns' => [],

    // SOC 2 CC6.7: whitelist only the headers the API actually requires
    'allowed_headers' => [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'X-Backup-Token',
        'X-XSRF-TOKEN',
    ],

    'exposed_headers' => [],

    // Cache preflight for 1 hour to reduce OPTIONS request overhead
    'max_age' => 3600,

    // Fix for audit finding H-10: HttpOnly cookie-based JWT requires credentials.
    // Must be false (and cannot be true) when allowed_origins is ['*'].
    // With a specific FRONTEND_ORIGIN, cookies are sent cross-origin correctly.
    'supports_credentials' => env('FRONTEND_ORIGIN', 'http://localhost:5173') !== '*',

];
