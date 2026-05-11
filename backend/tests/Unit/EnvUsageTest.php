<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * P4 – env() must not be called directly inside app/Http/Controllers/
 *
 * Pentagon: calling env() in a controller returns an empty string whenever
 * `php artisan config:cache` has been run (standard production practice).
 * All environment-dependent values must be accessed via config().
 *
 * This is a static-analysis test — it reads the source files and
 * asserts that no `env(` call appears in controllers.
 *
 * Allowed exception: config files under config/ (that is their job).
 */
class EnvUsageTest extends TestCase
{
    /** @return string[] list of .php files under app/Http/Controllers */
    private function controllerFiles(): array
    {
        $dir   = __DIR__ . '/../../app/Http/Controllers';
        $files = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS)
        );

        $result = [];
        foreach ($files as $file) {
            if ($file->getExtension() === 'php') {
                $result[] = $file->getPathname();
            }
        }
        return $result;
    }

    public function test_no_controller_calls_env_directly(): void
    {
        $violations = [];

        foreach ($this->controllerFiles() as $path) {
            $source = file_get_contents($path);
            // Match env( but not inside a comment line
            $lines  = explode("\n", $source);
            foreach ($lines as $lineNo => $line) {
                $trimmed = ltrim($line);
                if (str_starts_with($trimmed, '//') || str_starts_with($trimmed, '*')) {
                    continue; // skip comment lines
                }
                if (preg_match('/\benv\s*\(/', $line)) {
                    $violations[] = basename($path) . ':' . ($lineNo + 1) . ' — ' . trim($line);
                }
            }
        }

        $this->assertEmpty(
            $violations,
            "Controllers must use config() not env().\n"
            . "env() returns empty string when config is cached in production.\n"
            . "Violations found:\n  " . implode("\n  ", $violations)
        );
    }

    /** Ensure config/services.php contains the keys we moved from env() */
    public function test_services_config_has_backup_token_key(): void
    {
        $services = require __DIR__ . '/../../config/services.php';
        $this->assertArrayHasKey('backup',  $services, 'config/services.php must define a backup key');
        $this->assertArrayHasKey('token',   $services['backup'], 'services.backup must contain a token entry');
    }

    public function test_services_config_has_clickup_token_key(): void
    {
        $services = require __DIR__ . '/../../config/services.php';
        $this->assertArrayHasKey('clickup', $services, 'config/services.php must define a clickup key');
        $this->assertArrayHasKey('token',   $services['clickup'], 'services.clickup must contain a token entry');
    }

    public function test_services_config_has_openai_key(): void
    {
        $services = require __DIR__ . '/../../config/services.php';
        $this->assertArrayHasKey('openai', $services);
        $this->assertArrayHasKey('key',    $services['openai']);
    }
}
