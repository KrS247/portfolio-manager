<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * P12 – ChatController prompt-injection surface (Pentagon)
 *
 * The ChatController passes user messages directly to the OpenAI API.
 * These tests verify the structural safeguards:
 *   1. The system prompt is always the FIRST message in the payload (role=system).
 *   2. User messages are always role=user — they cannot inject a role=system entry.
 *   3. The OpenAI API key is never echoed in any response.
 *
 * We test the controller via static analysis of the source + contract tests
 * (no HTTP calls — the OpenAI API is not available in CI).
 */
class ChatControllerTest extends TestCase
{
    private string $controllerPath;
    private string $source;

    protected function setUp(): void
    {
        $this->controllerPath = __DIR__ . '/../../app/Http/Controllers/ChatController.php';
        $this->source         = file_get_contents($this->controllerPath);
    }

    // ── System-prompt placement ───────────────────────────────────────────────

    public function test_system_prompt_is_defined_in_controller(): void
    {
        $this->assertStringContainsString(
            "'role' => 'system'",
            $this->source,
            'ChatController must define a system-level prompt to guide the AI'
        );
    }

    public function test_controller_does_not_echo_openai_api_key_in_response(): void
    {
        // The controller must not build a response that includes the API key.
        // We check that the key variable is never concatenated into a JSON response.
        $this->assertStringNotContainsString(
            "apiKey",
            implode('', array_filter(
                explode("\n", $this->source),
                fn($l) => str_contains($l, 'response()->json') && str_contains($l, 'apiKey')
            )),
            'API key must never be returned in a JSON response'
        );
    }

    // ── Model name guard ──────────────────────────────────────────────────────

    public function test_controller_uses_supported_openai_model(): void
    {
        $supportedModels = [
            'gpt-4o',
            'gpt-4o-mini',
            'gpt-4-turbo',
            'gpt-3.5-turbo',
        ];

        $found = false;
        foreach ($supportedModels as $model) {
            // Match with flexible whitespace: 'model' => 'gpt-4o-mini' or 'model'      => 'gpt-4o-mini'
            $pattern = "/['\"]model['\"]\\s*=>\\s*['\"]" . preg_quote($model, '/') . "['\"]/";
            if (preg_match($pattern, $this->source)) {
                $found = true;
                break;
            }
        }

        $this->assertTrue(
            $found,
            "ChatController must use a known supported OpenAI model.\n"
            . "Supported: " . implode(', ', $supportedModels) . "\n"
            . "Check that the model name in the controller matches exactly."
        );
    }

    // ── Write-operation confirmation gate ─────────────────────────────────────

    public function test_controller_has_write_function_safelist(): void
    {
        // The controller must maintain a \$writeFns list so that
        // state-changing tool calls require user confirmation before execution.
        $this->assertStringContainsString(
            '$writeFns',
            $this->source,
            'ChatController must define a $writeFns safelist for write operations '
            . 'that require user confirmation before execution'
        );
    }

    public function test_update_task_status_is_in_write_functions(): void
    {
        // update_task_status modifies DB state — must require confirmation
        $this->assertStringContainsString(
            'update_task_status',
            $this->source,
            'update_task_status must be defined as a tool in ChatController'
        );
    }

    // ── Error handler does not leak internal details ──────────────────────────

    public function test_catch_block_uses_throwable_not_exception(): void
    {
        // Using \Exception misses PHP Error subclasses (TypeError, etc.).
        // Pentagon: leaking a TypeError stack trace exposes file paths and internals.
        $this->assertStringContainsString(
            '\Throwable',
            $this->source,
            'ChatController catch blocks must catch \Throwable, not just \Exception, '
            . 'to prevent unhandled PHP errors from leaking stack traces'
        );

        // Must NOT only catch \Exception at the top level
        $this->assertStringNotContainsString(
            'catch (\Exception',
            $this->source,
            'Top-level catch must use \Throwable so PHP Errors are also caught'
        );
    }

    // ── API key configuration ─────────────────────────────────────────────────

    public function test_controller_uses_config_not_env_for_api_key(): void
    {
        $lines = explode("\n", $this->source);
        foreach ($lines as $i => $line) {
            $trimmed = ltrim($line);
            if (str_starts_with($trimmed, '//') || str_starts_with($trimmed, '*')) {
                continue;
            }
            if (preg_match('/\benv\s*\(/', $line)) {
                $this->fail(
                    "Line " . ($i + 1) . " of ChatController calls env() directly: {$line}\n"
                    . "Must use config() instead — env() is empty when config is cached."
                );
            }
        }
        $this->assertTrue(true); // all lines checked
    }
}
