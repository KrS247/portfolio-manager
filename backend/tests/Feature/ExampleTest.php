<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * Verify the unauthenticated API guard is active.
     * (Replaces the default Blade-rendering test which requires a compiled-view path.)
     */
    public function test_the_application_returns_a_successful_response(): void
    {
        // The /api/portfolios endpoint requires auth — it should return 401 when
        // no token is provided, which proves the application is up and routing correctly.
        $response = $this->getJson('/api/portfolios');

        $response->assertStatus(401);
    }
}
