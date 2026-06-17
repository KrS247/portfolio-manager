<?php

namespace Tests\Unit;

use Tests\TestCase;
use Illuminate\Http\Request;
use App\Http\Middleware\VerifyCsrfForCookieAuth;

/**
 * Direct unit tests of the CSRF middleware logic (cookie-auth requests must
 * carry a valid X-XSRF-TOKEN on mutating methods; Bearer/x-api-key and safe
 * methods are exempt). End-to-end cookie auth is verified separately on a
 * deployed preview (cross-origin cookies can't be exercised in the test HTTP
 * harness).
 */
class CsrfMiddlewareTest extends TestCase
{
    private function dispatch(Request $request)
    {
        return (new VerifyCsrfForCookieAuth())->handle($request, fn () => response('ok', 200));
    }

    private function req(string $method, array $cookies = [], array $headers = []): Request
    {
        $req = Request::create('/api/portfolios', $method, [], $cookies);
        foreach ($headers as $k => $v) {
            $req->headers->set($k, $v);
        }
        return $req;
    }

    public function test_cookie_post_without_token_is_rejected(): void
    {
        $res = $this->dispatch($this->req('POST', ['jwt_token' => 'jwt-abc']));
        $this->assertSame(419, $res->getStatusCode());
    }

    public function test_cookie_post_with_valid_token_passes(): void
    {
        $jwt   = 'jwt-abc';
        $token = VerifyCsrfForCookieAuth::tokenFor($jwt);
        $res = $this->dispatch($this->req('POST', ['jwt_token' => $jwt], ['X-XSRF-TOKEN' => $token]));
        $this->assertSame(200, $res->getStatusCode());
    }

    public function test_cookie_post_with_wrong_token_is_rejected(): void
    {
        $res = $this->dispatch($this->req('POST', ['jwt_token' => 'jwt-abc'], ['X-XSRF-TOKEN' => 'nope']));
        $this->assertSame(419, $res->getStatusCode());
    }

    public function test_bearer_request_is_exempt(): void
    {
        // Authorization header present → exempt even without a CSRF token.
        $res = $this->dispatch($this->req('POST', ['jwt_token' => 'jwt-abc'], ['Authorization' => 'Bearer xyz']));
        $this->assertSame(200, $res->getStatusCode());
    }

    public function test_api_key_request_is_exempt(): void
    {
        $res = $this->dispatch($this->req('POST', ['jwt_token' => 'jwt-abc'], ['x-api-key' => 'pm_mcp_xyz']));
        $this->assertSame(200, $res->getStatusCode());
    }

    public function test_get_is_exempt(): void
    {
        $res = $this->dispatch($this->req('GET', ['jwt_token' => 'jwt-abc']));
        $this->assertSame(200, $res->getStatusCode());
    }

    public function test_no_cookie_no_csrf_required(): void
    {
        // No cookie auth (e.g. login itself) → middleware does not enforce CSRF.
        $res = $this->dispatch($this->req('POST'));
        $this->assertSame(200, $res->getStatusCode());
    }
}
