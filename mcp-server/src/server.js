/**
 * Portfolio Manager MCP Server
 *
 * Exposes Portfolio Manager data and operations as Model Context Protocol (MCP)
 * tools so any MCP-capable AI assistant (Claude Code, Claude Desktop, etc.) can
 * read and write projects, tasks, sprints, capacity, and risks in real time.
 *
 * Transport: Streamable HTTP (POST /mcp)
 * Auth:      x-api-key header — validated per-request against the Portfolio Manager API
 *
 * Connection (Claude Code):
 *   claude mcp add portfolio-manager --url https://<this-host>/mcp \
 *          --header "x-api-key: pm_mcp_<your-key>"
 */
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { registerProjectTools  } from './tools/projects.js';
import { registerTaskTools     } from './tools/tasks.js';
import { registerSprintTools   } from './tools/sprints.js';
import { registerAnalyticsTools} from './tools/analytics.js';

const PORT    = parseInt(process.env.PORT || '3002', 10);
const PM_API  = (process.env.PM_API_URL || 'http://localhost:8080/api').replace(/\/$/, '');

// ── Server factory ─────────────────────────────────────────────────────────
// A fresh McpServer per session keeps state isolated across concurrent clients.

function buildMcpServer(apiKey) {
  const server = new McpServer({
    name:    'Portfolio Manager',
    version: '1.0.0',
  });

  // Inject apiKey into every tool handler via a closure-based context.
  // The SDK's tool handler signature is (args, extra) — we wrap each module
  // so it can read apiKey without needing a global.
  const ctx = { apiKey };

  // Patch server.tool to automatically thread apiKey into every handler
  const origTool = server.tool.bind(server);
  server.tool = (name, descOrSchema, schemaOrHandler, handlerOrUndefined) => {
    // Normalise overloads: (name, description, schema, handler) or (name, schema, handler)
    let description, schema, handler;
    if (typeof descOrSchema === 'string') {
      description = descOrSchema;
      schema      = schemaOrHandler;
      handler     = handlerOrUndefined;
    } else {
      description = undefined;
      schema      = descOrSchema;
      handler     = schemaOrHandler;
    }

    const wrappedHandler = (args, extra) => handler(args, { ...extra, ...ctx });

    if (description !== undefined) {
      return origTool(name, description, schema, wrappedHandler);
    }
    return origTool(name, schema, wrappedHandler);
  };

  registerProjectTools(server);
  registerTaskTools(server);
  registerSprintTools(server);
  registerAnalyticsTools(server);

  return server;
}

// ── Express app ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Health check (public)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'portfolio-manager-mcp', pm_api: PM_API });
});

// MCP endpoint (Streamable HTTP)
app.post('/mcp', async (req, res) => {
  // Resolve API key from x-api-key header or Authorization Bearer
  const apiKey =
    req.headers['x-api-key'] ||
    (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') ||
    null;

  if (!apiKey || !apiKey.startsWith('pm_mcp_')) {
    return res.status(401).json({
      error: 'Missing or invalid API key. Provide a pm_mcp_... key via x-api-key header.',
    });
  }

  try {
    const mcpServer = buildMcpServer(apiKey);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    // Clean up after request
    res.on('close', () => transport.close().catch(() => {}));

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[MCP] Unhandled error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal MCP server error' });
    }
  }
});

// SSE endpoint for legacy MCP clients that use GET + SSE
app.get('/mcp', async (req, res) => {
  res.status(405).json({
    error: 'Use POST /mcp with Streamable HTTP transport.',
    docs:  'https://modelcontextprotocol.io/docs/concepts/transports',
  });
});

// ── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Portfolio Manager MCP server listening on port ${PORT}`);
  console.log(`  POST /mcp  — Streamable HTTP (MCP clients)`);
  console.log(`  GET  /health — Status check`);
  console.log(`  PM API: ${PM_API}`);
});
