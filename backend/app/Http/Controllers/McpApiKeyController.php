<?php

namespace App\Http\Controllers;

use App\Models\McpApiKey;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Manages MCP API keys for the authenticated user.
 * Keys allow AI assistants (Claude Code, Claude Desktop, etc.) to
 * connect to the Portfolio Manager via the MCP server.
 */
class McpApiKeyController extends Controller
{
    /** List all active API keys for the current user */
    public function index(Request $request)
    {
        $user = $request->attributes->get('auth_user');

        $keys = McpApiKey::where('user_id', $user->id)
            ->where('is_active', true)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($k) => $this->safeKey($k));

        return response()->json($keys);
    }

    /** Create a new API key */
    public function store(Request $request)
    {
        $user = $request->attributes->get('auth_user');

        $data = $request->validate([
            'name'       => 'required|string|max:100',
            'expires_at' => 'nullable|date|after:today',
        ]);

        // Generate raw key: pm_mcp_ + 40 random hex chars
        $rawKey   = 'pm_mcp_' . bin2hex(random_bytes(20));
        $keyHash  = hash('sha256', $rawKey);
        $keyPrefix = substr($rawKey, 0, 14) . '...';   // "pm_mcp_XXXXXXX..."

        $key = McpApiKey::create([
            'user_id'    => $user->id,
            'name'       => $data['name'],
            'key_hash'   => $keyHash,
            'key_prefix' => $keyPrefix,
            'is_active'  => true,
            'expires_at' => $data['expires_at'] ?? null,
        ]);

        // Return the raw key ONCE — it is never stored and cannot be retrieved again
        return response()->json([
            ...$this->safeKey($key),
            'raw_key' => $rawKey,
        ], 201);
    }

    /** Revoke (soft-delete) an API key */
    public function destroy(Request $request, int $id)
    {
        $user = $request->attributes->get('auth_user');

        $key = McpApiKey::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $key->update(['is_active' => false]);

        return response()->json(['message' => 'Key revoked']);
    }

    /** Return MCP server info (URL, version, available tools) */
    public function info()
    {
        $mcpUrl = env('MCP_SERVER_URL', 'https://portfolio-manager-mcp.up.railway.app');

        return response()->json([
            'mcp_server_url' => rtrim($mcpUrl, '/') . '/mcp',
            'protocol_version' => '2024-11-05',
            'server_name'    => 'Portfolio Manager MCP',
            'instructions'   => [
                'claude_code'    => 'claude mcp add portfolio-manager --url ' . rtrim($mcpUrl, '/') . '/mcp --header "x-api-key: YOUR_KEY"',
                'claude_desktop' => [
                    'mcpServers' => [
                        'portfolio-manager' => [
                            'url'     => rtrim($mcpUrl, '/') . '/mcp',
                            'headers' => ['x-api-key' => 'YOUR_KEY'],
                        ],
                    ],
                ],
            ],
        ]);
    }

    private function safeKey(McpApiKey $k): array
    {
        return [
            'id'           => $k->id,
            'name'         => $k->name,
            'key_prefix'   => $k->key_prefix,
            'is_active'    => $k->is_active,
            'last_used_at' => $k->last_used_at?->toIso8601String(),
            'expires_at'   => $k->expires_at?->toIso8601String(),
            'created_at'   => $k->created_at->toIso8601String(),
        ];
    }
}
