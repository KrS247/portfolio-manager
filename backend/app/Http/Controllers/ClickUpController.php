<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ClickUpController extends Controller
{
    private const MCP_URL      = 'https://mcp.clickup.com/mcp';
    private const MCP_PROTO_VER = '2024-11-05';

    // ── Low-level MCP helpers ────────────────────────────────────────────────

    private function mcpHeaders(string $token, ?string $sessionId): array
    {
        $headers = [
            'Authorization' => "Bearer {$token}",
            'Content-Type'  => 'application/json',
            'Accept'        => 'application/json, text/event-stream',
        ];
        if ($sessionId) {
            $headers['Mcp-Session-Id'] = $sessionId;
        }
        return $headers;
    }

    /**
     * Parse SSE (text/event-stream) body — return last JSON-RPC result object.
     */
    private function parseSse(string $raw): ?array
    {
        $last = null;
        foreach (explode("\n", $raw) as $line) {
            if (str_starts_with($line, 'data: ')) {
                $decoded = json_decode(substr($line, 6), true);
                if ($decoded && (array_key_exists('result', $decoded) || array_key_exists('error', $decoded))) {
                    $last = $decoded;
                }
            }
        }
        return $last;
    }

    /**
     * POST to the MCP endpoint; return ['sid' => ..., 'data' => ...].
     */
    private function mcpPost(string $token, ?string $sessionId, array $payload): array
    {
        $response = Http::withoutVerifying()      // allow corporate SSL intercept
            ->withHeaders($this->mcpHeaders($token, $sessionId))
            ->timeout(20)
            ->post(self::MCP_URL, $payload);

        $status = $response->status();
        if ($status === 401) throw new \RuntimeException('MCP_AUTH_FAILED');
        if ($status >= 400) throw new \RuntimeException("MCP request failed: HTTP {$status}");

        $sid = $response->header('Mcp-Session-Id');
        $ct  = $response->header('Content-Type', '');

        $data = null;
        if (str_contains($ct, 'text/event-stream')) {
            $data = $this->parseSse($response->body());
        } else {
            $data = $response->json();
        }

        return ['sid' => $sid ?: null, 'data' => $data];
    }

    /**
     * Establish an MCP session — returns session ID string.
     */
    private function mcpInit(string $token): ?string
    {
        $result = $this->mcpPost($token, null, [
            'jsonrpc' => '2.0',
            'method'  => 'initialize',
            'id'      => 1,
            'params'  => [
                'protocolVersion' => self::MCP_PROTO_VER,
                'capabilities'    => (object)[],
                'clientInfo'      => ['name' => 'portfolio-manager', 'version' => '1.0'],
            ],
        ]);

        $sessionId = $result['sid'];

        // Send required notifications/initialized notification
        if ($sessionId) {
            try {
                $this->mcpPost($token, $sessionId, [
                    'jsonrpc' => '2.0',
                    'method'  => 'notifications/initialized',
                ]);
            } catch (\Throwable $e) {
                // Best-effort — ignore errors here
            }
        }

        return $sessionId;
    }

    /**
     * Call a specific MCP tool and return its result array.
     */
    private function mcpCallTool(string $token, ?string $sessionId, string $toolName, array $args): array
    {
        $result = $this->mcpPost($token, $sessionId, [
            'jsonrpc' => '2.0',
            'method'  => 'tools/call',
            'id'      => 2,
            'params'  => ['name' => $toolName, 'arguments' => $args],
        ]);

        $rpc = $result['data'];
        if (!$rpc) throw new \RuntimeException("Empty response from MCP tool {$toolName}");
        if (!empty($rpc['error'])) {
            $msg = $rpc['error']['message'] ?? json_encode($rpc['error']);
            throw new \RuntimeException("MCP tool error: {$msg}");
        }

        return $rpc['result'] ?? [];
    }

    /**
     * Extract concatenated text content from an MCP CallToolResult.
     */
    private function extractText(array $result): string
    {
        $content = $result['content'] ?? [];
        return implode("\n", array_map(
            fn($c) => $c['text'] ?? '',
            array_filter($content, fn($c) => ($c['type'] ?? '') === 'text')
        ));
    }

    // ── Route: GET /api/clickup/task/{id} ───────────────────────────────────

    public function task(Request $request, string $id)
    {
        $token = env('CLICKUP_MCP_TOKEN');

        if (!$token) {
            return response()->json([
                'error' => [
                    'code'    => 'NOT_CONFIGURED',
                    'message' => 'ClickUp MCP token not configured. Set CLICKUP_MCP_TOKEN in the backend .env file. Obtain the token by completing the OAuth flow: open Claude Desktop → Settings → Connected Apps → ClickUp, then copy the OAuth Bearer token.',
                ],
            ], 503);
        }

        try {
            // 1. Establish MCP session
            $sessionId = $this->mcpInit($token);

            // 2. Fetch task
            $taskResult = $this->mcpCallTool($token, $sessionId, 'clickup_get_task', ['task_id' => $id]);
            $taskText   = $this->extractText($taskResult);

            $task = json_decode($taskText, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $task = ['raw' => $taskText];
            }

            if (!empty($task['err']) || !empty($task['error'])) {
                $msg = $task['err'] ?? $task['error'] ?? 'ClickUp returned an error';
                return response()->json(['error' => ['code' => 'CLICKUP_ERROR', 'message' => $msg]], 400);
            }

            // 3. Fetch comments (best-effort)
            $comments = [];
            foreach (['clickup_get_task_comments', 'clickup_list_task_comments'] as $toolName) {
                try {
                    $cr      = $this->mcpCallTool($token, $sessionId, $toolName, ['task_id' => $id]);
                    $txt     = $this->extractText($cr);
                    $parsed  = json_decode($txt, true);
                    $comments = is_array($parsed) ? $parsed : ($parsed['comments'] ?? []);
                    break;
                } catch (\Throwable $e) {
                    // Tool not available — try next
                }
            }

            return response()->json(['task' => $task, 'comments' => $comments]);

        } catch (\RuntimeException $e) {
            if ($e->getMessage() === 'MCP_AUTH_FAILED') {
                return response()->json([
                    'error' => [
                        'code'    => 'MCP_AUTH_FAILED',
                        'message' => 'ClickUp MCP token is invalid or expired. Re-authenticate via Claude Desktop → Settings → Connected Apps → ClickUp.',
                    ],
                ], 401);
            }

            Log::error('ClickUp MCP error: ' . $e->getMessage());
            return response()->json(['error' => ['code' => 'MCP_ERROR', 'message' => $e->getMessage()]], 502);
        }
    }
}
