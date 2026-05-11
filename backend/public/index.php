<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Remove PHP version disclosure header at SAPI level before the framework boots.
// SecurityHeaders middleware cannot remove SAPI-set headers via Response::headers;
// header_remove() here operates at the PHP output layer.
// SOC 2 CC6.7 / ISO A.8.28
if (function_exists('header_remove')) {
    header_remove('X-Powered-By');
}

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

$app->handleRequest(Request::capture());
