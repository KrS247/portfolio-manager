/**
 * ClickUp Insights via MCP (Model Context Protocol)
 *
 * Uses the ClickUp MCP server at https://mcp.clickup.com/mcp
 * with the MCP JSON-RPC 2.0 + Streamable HTTP transport.
 *
 * Protocol flow:
 *  1. POST /mcp  { method: "initialize" }         → receive Mcp-Session-Id
 *  2. POST /mcp  { method: "notifications/initialized" }
 *  3. POST /mcp  { method: "tools/call", params: { name: "clickup_get_task", ... } }
 */

const express = require('express');
const https   = require('https');
const config  = require('../config');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// Corporate SSL proxy: allow self-signed / intercepted certs in non-production
const MCP_AGENT = new https.Agent({ rejectUnauthorized: false });

const MCP_HOST = 'mcp.clickup.com';
const MCP_PATH = '/mcp';
const MCP_PROTO_VER = '2024-11-05';

// ── Low-level HTTP helper ────────────────────────────────────────────────────
function httpsPost(hostname, path, headers, body) {
  const bodyBuf = Buffer.from(body, 'utf8');
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: 'POST',
      agent: MCP_AGENT,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Length': bodyBuf.length,
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const ct  = res.headers['content-type'] || '';
        const sid = res.headers['mcp-session-id'] || null;

        // Streamable HTTP: response may be SSE or plain JSON
        let data = null;
        if (ct.includes('text/event-stream')) {
          data = parseSse(raw);
        } else {
          try { data = JSON.parse(raw); } catch (_) { /* ignore empty/non-JSON */ }
        }

        resolve({ status: res.statusCode, headers: res.headers, sid, data });
      });
    });

    req.setTimeout(15000, () => { req.destroy(); reject(new Error('MCP request timed out')); });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

// Parse SSE data lines and return the last JSON-RPC result object found
function parseSse(raw) {
  let last = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        const obj = JSON.parse(line.slice(6));
        if (obj && (obj.result !== undefined || obj.error !== undefined)) last = obj;
      } catch (_) {}
    }
  }
  return last;
}

// ── MCP session helper ───────────────────────────────────────────────────────
function mcpHeaders(token, sessionId) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json, text/event-stream',
    ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
  };
}

async function mcpInit(token) {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    method: 'initialize',
    id: 1,
    params: {
      protocolVersion: MCP_PROTO_VER,
      capabilities: {},
      clientInfo: { name: 'portfolio-manager', version: '1.0' },
    },
  });

  const res = await httpsPost(MCP_HOST, MCP_PATH, mcpHeaders(token, null), body);

  if (res.status === 401) throw new Error('MCP_AUTH_FAILED');
  if (res.status >= 400) throw new Error(`MCP init failed: HTTP ${res.status}`);

  const sessionId = res.sid;

  // Send the required `notifications/initialized` notification (no id = notification)
  if (sessionId) {
    const notifBody = JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    await httpsPost(MCP_HOST, MCP_PATH, mcpHeaders(token, sessionId), notifBody).catch(() => {});
  }

  return sessionId;
}

async function mcpCallTool(token, sessionId, toolName, args) {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    id: 2,
    params: { name: toolName, arguments: args },
  });

  const res = await httpsPost(MCP_HOST, MCP_PATH, mcpHeaders(token, sessionId), body);

  if (res.status === 401) throw new Error('MCP_AUTH_FAILED');

  const rpc = res.data;
  if (!rpc) throw new Error(`Empty response from MCP tool ${toolName}`);
  if (rpc.error) throw new Error(`MCP tool error: ${rpc.error.message || JSON.stringify(rpc.error)}`);

  return rpc.result;          // { content: [ { type: 'text', text: '...' } ], ... }
}

// Extract the text payload from an MCP CallToolResult
function extractText(result) {
  const content = result?.content || [];
  return content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
}

// ── Route: GET /api/clickup/task/:id ────────────────────────────────────────
router.get('/task/:id', authenticate, async (req, res, next) => {
  try {
    const token = config.clickupMcpToken;
    if (!token) throw new Error('NOT_CONFIGURED');

    const { id } = req.params;

    // 1. Establish MCP session
    const sessionId = await mcpInit(token);

    // 2. Fetch task via MCP tool
    const taskResult = await mcpCallTool(token, sessionId, 'clickup_get_task', { task_id: id });
    const taskText   = extractText(taskResult);

    let task;
    try { task = JSON.parse(taskText); }
    catch (_) { task = { raw: taskText }; }   // fallback if not JSON

    if (task.err || task.error) {
      const msg = task.err || task.error || 'ClickUp returned an error';
      return res.status(400).json({ error: { code: 'CLICKUP_ERROR', message: msg } });
    }

    // 3. Attempt to fetch comments (MCP tool name may vary — best-effort)
    let comments = [];
    const commentTools = ['clickup_get_task_comments', 'clickup_list_task_comments'];
    for (const toolName of commentTools) {
      try {
        const cr  = await mcpCallTool(token, sessionId, toolName, { task_id: id });
        const txt = extractText(cr);
        const parsed = JSON.parse(txt);
        comments = Array.isArray(parsed) ? parsed : (parsed.comments || []);
        break;
      } catch (_) { /* tool not available — skip */ }
    }

    res.json({ task, comments });

  } catch (err) {
    if (err.message === 'NOT_CONFIGURED') {
      return res.status(503).json({
        error: {
          code: 'NOT_CONFIGURED',
          message:
            'ClickUp MCP token not configured. ' +
            'Set CLICKUP_MCP_TOKEN in your backend .env file. ' +
            'Obtain the token by completing the OAuth flow: ' +
            'open Claude Desktop → Settings → Connected Apps → ClickUp, ' +
            'then copy the OAuth Bearer token.',
        },
      });
    }
    if (err.message === 'MCP_AUTH_FAILED') {
      return res.status(401).json({
        error: {
          code: 'MCP_AUTH_FAILED',
          message: 'ClickUp MCP token is invalid or expired. Re-authenticate via Claude Desktop → Settings → Connected Apps → ClickUp.',
        },
      });
    }
    next(err);
  }
});

module.exports = router;
