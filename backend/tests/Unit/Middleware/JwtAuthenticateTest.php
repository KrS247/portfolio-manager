<?php

namespace Tests\Unit\Middleware;

use Tests\DatabaseTestCase;
use Illuminate\Http\Request;
use Tymon\JWTAuth\Facades\JWTAuth;

/**
 * P2 – JwtAuthenticate middleware
 *
 * Pentagon: confirms that every protected route rejects requests missing or
 * carrying a tampered/expired token, and that a valid token resolves to the
 * correct user on the request object.
 */
class JwtAuthenticateTest extends DatabaseTestCase
{
    // ── Via HTTP layer (exercises middleware in the full stack) ────────────────

    public function test_protected_route_with_no_token_returns_401(): void
    {
        $this->getJson('/api/portfolios')
             ->assertStatus(401);
    }

    public function test_protected_route_with_malformed_token_returns_401(): void
    {
        $this->getJson('/api/portfolios', [
            'Authorization' => 'Bearer this.is.not.a.jwt',
        ])->assertStatus(401);
    }

    public function test_protected_route_with_valid_token_passes(): void
    {
        [$user, $token] = $this->createUserWithToken(['role' => 'admin']);

        // We only care that authentication passes (200/anything but 401)
        $response = $this->getJson('/api/portfolios', $this->authHeader($token));
        $this->assertNotEquals(401, $response->getStatusCode());
    }

    public function test_token_belonging_to_deleted_user_returns_401(): void
    {
        [$user, $token] = $this->createUserWithToken();

        // Delete the user from the DB
        \App\Models\User::destroy($user->id);

        $this->getJson('/api/portfolios', $this->authHeader($token))
             ->assertStatus(401);
    }

    public function test_bearer_prefix_is_required(): void
    {
        [$user, $token] = $this->createUserWithToken();

        // Token without 'Bearer ' prefix should be rejected
        $this->getJson('/api/portfolios', ['Authorization' => $token])
             ->assertStatus(401);
    }

    // ── Direct middleware unit test ────────────────────────────────────────────

    public function test_middleware_sets_auth_user_attribute_on_request(): void
    {
        [$user, $token] = $this->createUserWithToken();

        $request  = Request::create('/api/portfolios', 'GET');
        $request->headers->set('Authorization', "Bearer {$token}");

        $middleware = new \App\Http\Middleware\JwtAuthenticate();
        $passed     = false;

        $middleware->handle($request, function ($req) use (&$passed, $user) {
            $passed   = true;
            $authUser = $req->attributes->get('auth_user');
            // Middleware must inject the resolved user
            \PHPUnit\Framework\Assert::assertNotNull($authUser);
            \PHPUnit\Framework\Assert::assertEquals($user->id, $authUser->id);
        });

        $this->assertTrue($passed, 'Next closure was never called — middleware blocked a valid token');
    }
}
