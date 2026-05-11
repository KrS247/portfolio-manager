<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * SecurityHeaders middleware
 *
 * Hardened HTTP response headers applied globally to every response
 * (registered in bootstrap/app.php on the global middleware stack so it
 * covers API routes, error pages, and any web routes alike).
 *
 * SOC 2: CC6.7, CC6.8
 * ISO 27001: A.8.28
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): mixed
    {
        $response = $next($request);

        // ── MIME-type sniffing protection ─────────────────────────────────────
        // Prevents browsers from executing a text/plain response as JavaScript.
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // ── Clickjacking protection ───────────────────────────────────────────
        $response->headers->set('X-Frame-Options', 'DENY');

        // ── Referrer control ──────────────────────────────────────────────────
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // ── Browser feature policy ────────────────────────────────────────────
        $response->headers->set(
            'Permissions-Policy',
            'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
        );

        // ── HSTS ──────────────────────────────────────────────────────────────
        // Tell browsers to always use HTTPS for 1 year.
        if ($request->secure() || app()->environment('production')) {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload'
            );
        }

        // ── Content-Security-Policy ───────────────────────────────────────────
        // Enforced in all environments. The API itself never serves HTML assets;
        // default-src 'none' is the strictest safe choice.
        // The frontend SPA serves its own CSP (via vercel.json / _headers).
        // frame-ancestors 'none' is redundant with X-Frame-Options but provides
        // defence-in-depth for modern browsers.
        $response->headers->set(
            'Content-Security-Policy',
            "default-src 'none'; frame-ancestors 'none'"
        );

        // ── Cache control for authenticated API responses ──────────────────────
        // Prevents proxies and browsers from caching sensitive data.
        // SOC 2 CC6.1 / ISO A.8.12
        if (!$response->headers->has('Cache-Control')) {
            $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate');
            $response->headers->set('Pragma', 'no-cache');
        }

        // ── Remove information-leaking headers ────────────────────────────────
        // Note: X-Powered-By is also removed at the SAPI level in public/index.php
        // because PHP sets it before the application runs and Response::headers
        // cannot reach SAPI-level headers.
        $response->headers->remove('X-Powered-By');
        $response->headers->remove('Server');

        return $response;
    }
}
