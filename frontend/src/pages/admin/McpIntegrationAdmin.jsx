import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import client from '../../api/client';

// ── icons (inline SVG so we don't need extra MUI imports) ─────────────────
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const KeyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l3 3"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export default function McpIntegrationAdmin() {
  const { data: keys,    loading: keysLoading,    refetch: refetchKeys } = useApi('/mcp/keys');
  const { data: mcpInfo, loading: infoLoading } = useApi('/mcp/info');

  const [showCreate, setShowCreate]   = useState(false);
  const [newKeyName, setNewKeyName]   = useState('');
  const [expiresAt,  setExpiresAt]    = useState('');
  const [creating,   setCreating]     = useState(false);
  const [newRawKey,  setNewRawKey]    = useState(null);   // shown once after creation
  const [createError,setCreateError]  = useState('');

  const [revoking,   setRevoking]     = useState(null);
  const [copied,     setCopied]       = useState('');     // which string was copied

  const keyList = Array.isArray(keys) ? keys : [];
  const serverUrl = mcpInfo?.mcp_server_url || '';

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!newKeyName.trim()) { setCreateError('Key name is required'); return; }
    setCreating(true); setCreateError('');
    try {
      const res = await client.post('/mcp/keys', {
        name:       newKeyName.trim(),
        expires_at: expiresAt || undefined,
      });
      setNewRawKey(res.data.raw_key);
      setShowCreate(false);
      setNewKeyName('');
      setExpiresAt('');
      refetchKeys();
    } catch (e) {
      setCreateError(e.response?.data?.message || 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Revoke this API key? Any AI assistants using it will lose access immediately.')) return;
    setRevoking(id);
    try {
      await client.delete(`/mcp/keys/${id}`);
      refetchKeys();
    } finally {
      setRevoking(null);
    }
  };

  const copy = (text, label) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  // ── helpers ───────────────────────────────────────────────────────────────

  const claudeCodeCmd = newRawKey && serverUrl
    ? `claude mcp add portfolio-manager --url ${serverUrl} --header "x-api-key: ${newRawKey}"`
    : '';

  const desktopConfig = newRawKey && serverUrl
    ? JSON.stringify({
        mcpServers: {
          'portfolio-manager': {
            url:     serverUrl,
            headers: { 'x-api-key': newRawKey },
          },
        },
      }, null, 2)
    : '';

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';
  const fmtAgo  = (d) => {
    if (!d) return 'Never';
    const ms = Date.now() - new Date(d).getTime();
    if (ms < 60000)  return 'Just now';
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
    return `${Math.floor(ms / 86400000)}d ago`;
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 900 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111827', margin: 0 }}>
          MCP Integration
        </h1>
        <p style={{ color: '#6b7280', marginTop: '0.3rem', fontSize: '0.95rem' }}>
          Connect AI assistants (Claude Code, Claude Desktop) to Portfolio Manager via the Model Context Protocol.
        </p>
      </div>

      {/* ── What is MCP? info banner ── */}
      <div style={s.infoBanner}>
        <div style={{ fontWeight: 700, marginBottom: '0.3rem', color: '#1e40af' }}>What does MCP enable?</div>
        <div style={{ fontSize: '0.88rem', color: '#1e3a8a', lineHeight: 1.6 }}>
          MCP lets Claude query live project data, create tasks, manage sprints, and analyse
          capacity — all through natural language, without using the UI. Generate an API key
          below and add it to your AI client to get started.
        </div>
      </div>

      {/* ── Server URL ── */}
      <div style={s.card}>
        <div style={s.cardTitle}>MCP Server URL</div>
        {infoLoading ? (
          <div style={s.muted}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <code style={s.code}>{serverUrl || 'Not configured — set MCP_SERVER_URL env var'}</code>
            {serverUrl && (
              <button style={s.copyBtn} onClick={() => copy(serverUrl, 'url')}>
                {copied === 'url' ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
              </button>
            )}
          </div>
        )}
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
          Protocol: Streamable HTTP · Version: {mcpInfo?.protocol_version || '2024-11-05'}
        </div>
      </div>

      {/* ── New key revealed ── */}
      {newRawKey && (
        <div style={s.keyRevealCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontWeight: 700, color: '#065f46', marginBottom: '0.5rem' }}>
              ✅ API Key Created — copy it now, it won't be shown again
            </div>
            <button style={s.dismissBtn} onClick={() => setNewRawKey(null)}>✕ Dismiss</button>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <div style={s.fieldLabel}>Raw Key</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <code style={{ ...s.code, background: '#ecfdf5', border: '1px solid #6ee7b7', wordBreak: 'break-all' }}>
                {newRawKey}
              </code>
              <button style={s.copyBtn} onClick={() => copy(newRawKey, 'key')}>
                {copied === 'key' ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
              </button>
            </div>
          </div>

          {claudeCodeCmd && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={s.fieldLabel}>Claude Code — add to this project</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <pre style={{ ...s.codeBlock, flex: 1 }}>{claudeCodeCmd}</pre>
                <button style={s.copyBtn} onClick={() => copy(claudeCodeCmd, 'cmd')}>
                  {copied === 'cmd' ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                </button>
              </div>
            </div>
          )}

          {desktopConfig && (
            <div>
              <div style={s.fieldLabel}>Claude Desktop — add to claude_desktop_config.json</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <pre style={{ ...s.codeBlock, flex: 1 }}>{desktopConfig}</pre>
                <button style={s.copyBtn} onClick={() => copy(desktopConfig, 'cfg')}>
                  {copied === 'cfg' ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── API Keys list ── */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={s.cardTitle}>API Keys</div>
          <button style={s.primaryBtn} onClick={() => { setShowCreate(true); setNewRawKey(null); }}>
            <KeyIcon /> Generate New Key
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={s.createForm}>
            <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#111827' }}>New API Key</div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <div style={s.fieldLabel}>Key Name *</div>
                <input
                  style={s.input}
                  placeholder="e.g. My Claude Code (Laptop)"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  autoFocus
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={s.fieldLabel}>Expires (optional)</div>
                <input
                  type="date"
                  style={s.input}
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '1px' }}>
                <button style={s.primaryBtn} onClick={handleCreate} disabled={creating}>
                  {creating ? 'Creating…' : 'Create Key'}
                </button>
                <button style={s.ghostBtn} onClick={() => { setShowCreate(false); setCreateError(''); }}>
                  Cancel
                </button>
              </div>
            </div>
            {createError && <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.5rem' }}>{createError}</div>}
          </div>
        )}

        {/* Keys table */}
        {keysLoading ? (
          <div style={s.muted}>Loading keys…</div>
        ) : keyList.length === 0 ? (
          <div style={{ ...s.muted, padding: '2rem', textAlign: 'center' }}>
            No API keys yet. Generate one to connect an AI assistant.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Name', 'Key Prefix', 'Created', 'Last Used', 'Expires', ''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keyList.map((k, i) => (
                <tr key={k.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={s.td}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{k.name}</span>
                  </td>
                  <td style={s.td}>
                    <code style={{ fontSize: '0.8rem', color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                      {k.key_prefix}
                    </code>
                  </td>
                  <td style={s.td}>{fmtDate(k.created_at)}</td>
                  <td style={s.td}>{fmtAgo(k.last_used_at)}</td>
                  <td style={s.td}>
                    {k.expires_at
                      ? <span style={{ color: new Date(k.expires_at) < new Date() ? '#dc2626' : '#374151' }}>{fmtDate(k.expires_at)}</span>
                      : <span style={s.muted}>Never</span>
                    }
                  </td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    <button
                      style={s.revokeBtn}
                      onClick={() => handleRevoke(k.id)}
                      disabled={revoking === k.id}
                    >
                      {revoking === k.id ? 'Revoking…' : <><TrashIcon /> Revoke</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Available tools ── */}
      <div style={s.card}>
        <div style={s.cardTitle}>Available MCP Tools (17)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem', marginTop: '0.75rem' }}>
          {TOOLS.map(t => (
            <div key={t.name} style={s.toolRow}>
              <code style={s.toolName}>{t.name}</code>
              <span style={s.toolDesc}>{t.desc}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Tool catalogue ─────────────────────────────────────────────────────────
const TOOLS = [
  { name: 'list_portfolios',    desc: 'List all portfolios' },
  { name: 'list_programs',      desc: 'List programs by portfolio' },
  { name: 'list_projects',      desc: 'List projects with status & priority' },
  { name: 'get_project',        desc: 'Get full project details' },
  { name: 'list_tasks',         desc: 'List tasks with sprint/status filter' },
  { name: 'get_task',           desc: 'Get task details with resources' },
  { name: 'create_task',        desc: 'Create a new task' },
  { name: 'update_task',        desc: 'Update any task fields' },
  { name: 'move_task_to_sprint',desc: 'Assign a task to a sprint' },
  { name: 'list_sprints',       desc: 'List sprints by status' },
  { name: 'get_sprint_board',   desc: 'Full Agile board for a sprint' },
  { name: 'create_sprint',      desc: 'Create a new sprint' },
  { name: 'update_sprint_status',desc: 'Change sprint status' },
  { name: 'get_capacity',       desc: 'Team capacity report by date range' },
  { name: 'list_risks',         desc: 'Risk register with filters' },
  { name: 'create_risk',        desc: 'Log a new risk' },
  { name: 'update_risk',        desc: 'Update a risk entry' },
  { name: 'get_evm',            desc: 'EVM metrics (PV, EV, AC, SPI, CPI)' },
  { name: 'get_dashboard_summary', desc: 'Portfolio health overview' },
];

// ── Styles ─────────────────────────────────────────────────────────────────
const s = {
  card: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    padding: '1.25rem 1.5rem',
    marginBottom: '1.25rem',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '0.75rem',
  },
  infoBanner: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: 10,
    padding: '0.9rem 1.1rem',
    marginBottom: '1.25rem',
  },
  keyRevealCard: {
    background: '#f0fdf4',
    border: '1.5px solid #6ee7b7',
    borderRadius: 12,
    padding: '1.25rem 1.5rem',
    marginBottom: '1.25rem',
  },
  createForm: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '1rem',
    marginBottom: '1rem',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    background: '#f3f4f6',
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
  },
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    background: '#1e293b',
    color: '#e2e8f0',
    padding: '0.75rem 1rem',
    borderRadius: 8,
    margin: 0,
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  input: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: '1.5px solid #d1d5db',
    borderRadius: 7,
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    background: '#1d4ed8',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  ghostBtn: {
    background: '#fff',
    color: '#374151',
    border: '1.5px solid #d1d5db',
    borderRadius: 7,
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  copyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    background: '#fff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '0.3rem 0.7rem',
    fontSize: '0.8rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  revokeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    background: '#fff',
    color: '#dc2626',
    border: '1px solid #fca5a5',
    borderRadius: 6,
    padding: '0.3rem 0.7rem',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '0.25rem 0.5rem',
  },
  th: {
    padding: '0.6rem 0.75rem',
    textAlign: 'left',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: {
    padding: '0.7rem 0.75rem',
    fontSize: '0.875rem',
    color: '#374151',
    borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'middle',
  },
  fieldLabel: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: '0.3rem',
  },
  muted: {
    color: '#9ca3af',
    fontSize: '0.875rem',
  },
  toolRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    padding: '0.5rem 0.75rem',
    background: '#f9fafb',
    borderRadius: 7,
    border: '1px solid #e5e7eb',
  },
  toolName: {
    fontSize: '0.8rem',
    color: '#1d4ed8',
    background: 'none',
    padding: 0,
    fontWeight: 600,
  },
  toolDesc: {
    fontSize: '0.76rem',
    color: '#6b7280',
  },
};
