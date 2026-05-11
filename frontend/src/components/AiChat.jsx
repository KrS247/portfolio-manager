import { useState, useRef, useEffect } from 'react';
import client from '../api/client';
import SmartToyIcon     from '@mui/icons-material/SmartToy';
import CloseIcon        from '@mui/icons-material/Close';
import SendIcon         from '@mui/icons-material/Send';
import AttachFileIcon   from '@mui/icons-material/AttachFile';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import CancelIcon       from '@mui/icons-material/Cancel';
import ArticleIcon      from '@mui/icons-material/Article';
import ExpandMoreIcon   from '@mui/icons-material/ExpandMore';

// ─── Mini markdown renderer (bold, bullet lists, line breaks) ─────────────────
function MiniMD({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div>
      {lines.map((line, i) => {
        // Bold
        const parts = line.split(/\*\*([^*]+)\*\*/g);
        const rendered = parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p);
        const isBullet = line.startsWith('- ') || line.startsWith('• ');
        return isBullet
          ? <div key={i} style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              <span style={{ flexShrink: 0, color: '#016D2D' }}>•</span>
              <span>{rendered.slice(isBullet ? 1 : 0)}</span>
            </div>
          : <div key={i} style={{ marginTop: i > 0 && line ? 4 : 0 }}>{rendered}</div>;
      })}
    </div>
  );
}

// ─── Pending action confirmation card ─────────────────────────────────────────
function PendingCard({ action, onConfirm, onCancel }) {
  const typeLabel = {
    create_portfolio: 'Create Portfolio',
    create_program:   'Create Program',
    create_project:   'Create Project',
  }[action.type] ?? action.type;

  const fields = Object.entries(action.params).filter(([, v]) => v !== null && v !== '');

  return (
    <div style={S.pendingCard}>
      <div style={S.pendingHeader}>
        <span style={S.pendingBadge}>CONFIRMATION REQUIRED</span>
        <span style={S.pendingType}>{typeLabel}</span>
      </div>
      <div style={S.pendingFields}>
        {fields.map(([k, v]) => (
          <div key={k} style={S.pendingRow}>
            <span style={S.pendingKey}>{k.replace(/_/g, ' ')}</span>
            <span style={S.pendingVal}>{String(v)}</span>
          </div>
        ))}
      </div>
      <div style={S.pendingBtns}>
        <button onClick={onCancel}  style={S.cancelBtn}><CancelIcon style={{ fontSize: 15 }} /> Cancel</button>
        <button onClick={onConfirm} style={S.confirmBtn}><CheckCircleIcon style={{ fontSize: 15 }} /> Confirm & Create</button>
      </div>
    </div>
  );
}

// ─── Charter upload panel ─────────────────────────────────────────────────────
function CharterPanel({ onClose, onCreated }) {
  const [file,       setFile]       = useState(null);
  const [extracted,  setExtracted]  = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [log,        setLog]        = useState([]);
  const [error,      setError]      = useState('');
  const fileRef = useRef();

  const upload = async () => {
    if (!file) return;
    setLoading(true); setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await client.post('/chat/charter', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setExtracted(res.data.extracted);
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to parse document.');
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    setCreating(true); setError('');
    try {
      const res = await client.post('/chat/charter/create', { data: extracted });
      setLog(res.data.log ?? []);
      onCreated(res.data.log);
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to create records.');
    } finally {
      setCreating(false);
    }
  };

  const Field = ({ label, path }) => {
    const keys  = path.split('.');
    const obj   = keys.slice(0, -1).reduce((o, k) => o?.[k], extracted);
    const k     = keys[keys.length - 1];
    const val   = obj?.[k] ?? '';
    return (
      <div style={{ marginBottom: 8 }}>
        <label style={S.charterLabel}>{label}</label>
        <input
          style={S.charterInput}
          value={val ?? ''}
          onChange={e => {
            const next = JSON.parse(JSON.stringify(extracted));
            let o = next;
            keys.slice(0, -1).forEach(key => { o = o[key]; });
            o[keys[keys.length - 1]] = e.target.value;
            setExtracted(next);
          }}
        />
      </div>
    );
  };

  if (log.length) {
    return (
      <div style={S.charterPanel}>
        <div style={S.charterTitle}>Charter Created</div>
        {log.map((l, i) => <div key={i} style={{ fontSize: '0.82rem', padding: '3px 0', color: l.startsWith('✅') ? '#166534' : '#dc2626' }}>{l}</div>)}
        <button onClick={onClose} style={{ ...S.confirmBtn, marginTop: 12 }}>Done</button>
      </div>
    );
  }

  return (
    <div style={S.charterPanel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={S.charterTitle}><ArticleIcon style={{ fontSize: 16, marginRight: 5, verticalAlign: 'middle' }} />Import Charter</div>
        <button onClick={onClose} style={S.iconBtn}><CloseIcon style={{ fontSize: 16 }} /></button>
      </div>

      {!extracted ? (
        <>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 10px' }}>
            Upload a project charter (PDF or TXT) and AI will extract the portfolio, program and project details.
          </p>
          <div
            style={S.dropZone}
            onClick={() => fileRef.current.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); }}
          >
            <AttachFileIcon style={{ fontSize: 28, color: '#9ca3af', marginBottom: 4 }} />
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{file ? file.name : 'Click or drag a PDF / TXT file here'}</div>
            <input ref={fileRef} type="file" accept=".pdf,.txt" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
          </div>
          {error && <div style={S.errorMsg}>{error}</div>}
          <button onClick={upload} disabled={!file || loading} style={{ ...S.confirmBtn, marginTop: 10, width: '100%', justifyContent: 'center', opacity: !file || loading ? 0.6 : 1 }}>
            {loading ? 'Analysing…' : 'Extract with AI'}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: '0.78rem', color: '#374151', margin: '0 0 10px', fontWeight: 600 }}>Review & edit before creating:</p>

          <div style={S.charterSection}>Portfolio</div>
          <Field label="Name"        path="portfolio.name" />
          <Field label="Description" path="portfolio.description" />

          <div style={S.charterSection}>Program</div>
          <Field label="Name"        path="program.name" />
          <Field label="Description" path="program.description" />

          <div style={S.charterSection}>Project</div>
          <Field label="Name"        path="project.name" />
          <Field label="Description" path="project.description" />
          <Field label="Start Date"  path="project.start_date" />
          <Field label="End Date"    path="project.end_date" />

          {error && <div style={S.errorMsg}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setExtracted(null)} style={S.cancelBtn}>Back</button>
            <button onClick={create} disabled={creating} style={{ ...S.confirmBtn, flex: 1, justifyContent: 'center', opacity: creating ? 0.6 : 1 }}>
              {creating ? 'Creating…' : 'Create Portfolio, Program & Project'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main AiChat component ────────────────────────────────────────────────────
export default function AiChat() {
  const [open,         setOpen]         = useState(false);
  const [messages,     setMessages]     = useState([
    { role: 'assistant', content: "👋 Hi! I'm your Portfolio Manager assistant. Ask me about your projects, tasks, or say **\"create a portfolio\"** to get started.\n\nYou can also upload a **project charter** to automatically create a portfolio, program and project." }
  ]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [pendingAction, setPending]     = useState(null);
  const [showCharter,  setShowCharter]  = useState(false);
  const bottomRef  = useRef();
  const inputRef   = useRef();

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, pendingAction, showCharter]);

  const apiMessages = () =>
    messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    setPending(null);
    try {
      const res = await client.post('/chat', { messages: [...apiMessages(), { role: 'user', content: trimmed }] });
      const aiMsg = { role: 'assistant', content: res.data.reply };
      setMessages(m => [...m, aiMsg]);
      if (res.data.pending_action) setPending(res.data.pending_action);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: '⚠️ ' + (e.response?.data?.reply ?? e.message) }]);
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPending(null);
    setLoading(true);
    try {
      const res = await client.post('/chat', { confirm_action: action });
      setMessages(m => [...m, { role: 'assistant', content: res.data.reply }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: '⚠️ ' + (e.response?.data?.reply ?? e.message) }]);
    } finally {
      setLoading(false);
    }
  };

  const charterDone = (log) => {
    setShowCharter(false);
    const summary = log.join('\n');
    setMessages(m => [...m, { role: 'assistant', content: `Charter imported:\n${summary}` }]);
  };

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toggle button */}
      <button
        className="no-print"
        onClick={() => setOpen(o => !o)}
        style={S.toggleBtn}
        title="AI Assistant"
      >
        <SmartToyIcon style={{ fontSize: 18, marginRight: 6 }} />
        AI Chat
      </button>

      {/* Panel */}
      {open && (
        <div style={S.panel}>
          {/* Header */}
          <div style={S.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SmartToyIcon style={{ fontSize: 20, color: '#00FFBC' }} />
              <span style={S.panelTitle}>Portfolio Assistant</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={() => setShowCharter(s => !s)}
                style={{ ...S.iconBtn, color: '#00FFBC', fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(0,255,188,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}
                title="Import charter document"
              >
                <AttachFileIcon style={{ fontSize: 14 }} /> Charter
              </button>
              <button onClick={() => setOpen(false)} style={{ ...S.iconBtn, color: 'rgba(255,255,255,0.6)' }}>
                <CloseIcon style={{ fontSize: 18 }} />
              </button>
            </div>
          </div>

          {/* Charter panel (collapsible) */}
          {showCharter && (
            <CharterPanel onClose={() => setShowCharter(false)} onCreated={charterDone} />
          )}

          {/* Messages */}
          <div style={S.msgArea}>
            {messages.map((m, i) => (
              <div key={i} style={m.role === 'user' ? S.userBubble : S.aiBubble}>
                {m.role === 'assistant' && (
                  <SmartToyIcon style={{ fontSize: 15, color: '#016D2D', flexShrink: 0, marginTop: 2 }} />
                )}
                <div style={{ flex: 1 }}>
                  <MiniMD text={m.content} />
                </div>
              </div>
            ))}

            {loading && (
              <div style={S.aiBubble}>
                <SmartToyIcon style={{ fontSize: 15, color: '#016D2D', flexShrink: 0 }} />
                <div style={S.typingDots}>
                  <span /><span /><span />
                </div>
              </div>
            )}

            {pendingAction && !loading && (
              <PendingCard
                action={pendingAction}
                onConfirm={confirm}
                onCancel={() => {
                  setPending(null);
                  setMessages(m => [...m, { role: 'assistant', content: 'Cancelled. Nothing was created.' }]);
                }}
              />
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div style={S.inputRow}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask a question or give an instruction…"
              rows={1}
              style={S.textarea}
            />
            <button onClick={() => send(input)} disabled={!input.trim() || loading} style={{ ...S.sendBtn, opacity: !input.trim() || loading ? 0.5 : 1 }}>
              <SendIcon style={{ fontSize: 18 }} />
            </button>
          </div>
          <div style={S.inputHint}>Enter to send · Shift+Enter for new line</div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        .ai-typing span {
          display: inline-block;
          width: 6px; height: 6px;
          background: #016D2D;
          border-radius: 50%;
          animation: bounce 1.2s infinite ease-in-out;
        }
        .ai-typing span:nth-child(1) { animation-delay: -0.32s; }
        .ai-typing span:nth-child(2) { animation-delay: -0.16s; }
      `}</style>
    </>
  );
}

// ─── Typing dots helper ───────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="ai-typing" style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
      <span /><span /><span />
    </div>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────
const S = {
  toggleBtn: {
    position: 'fixed', bottom: '5rem', right: '1.5rem',
    padding: '0.5rem 1rem',
    background: '#0A2B14',
    color: '#00FFBC',
    border: '1.5px solid #00FFBC',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    zIndex: 1500,
    display: 'flex',
    alignItems: 'center',
  },

  panel: {
    position: 'fixed', bottom: '9.5rem', right: '1.5rem',
    width: '760px',
    maxHeight: '700px',
    background: '#fff',
    borderRadius: '14px',
    boxShadow: '0 12px 48px rgba(0,0,0,0.22)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1499,
    animation: 'slideUpIn 0.2s ease',
  },

  panelHeader: {
    background: '#0A2B14',
    padding: '0.8rem 1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  panelTitle: { color: '#fff', fontWeight: 700, fontSize: '0.9rem' },

  msgArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },

  userBubble: {
    alignSelf: 'flex-end',
    background: '#016D2D',
    color: '#fff',
    borderRadius: '12px 12px 2px 12px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.83rem',
    maxWidth: '80%',
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },

  aiBubble: {
    alignSelf: 'flex-start',
    background: '#f3f4f6',
    color: '#111',
    borderRadius: '2px 12px 12px 12px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.83rem',
    maxWidth: '88%',
    lineHeight: 1.5,
    wordBreak: 'break-word',
    display: 'flex',
    gap: 6,
    alignItems: 'flex-start',
  },

  typingDots: {
    display: 'flex',
    gap: 5,
    alignItems: 'center',
    padding: '4px 0',
  },

  inputRow: {
    display: 'flex',
    gap: 6,
    padding: '0.6rem 0.75rem 0.3rem',
    borderTop: '1px solid #e5e7eb',
    flexShrink: 0,
  },

  textarea: {
    flex: 1,
    resize: 'none',
    border: '1.5px solid #d1d5db',
    borderRadius: '8px',
    padding: '0.45rem 0.65rem',
    fontSize: '0.83rem',
    fontFamily: 'inherit',
    outline: 'none',
    lineHeight: 1.5,
  },

  sendBtn: {
    background: '#016D2D',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0 0.75rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  inputHint: {
    padding: '0 0.75rem 0.5rem',
    fontSize: '0.7rem',
    color: '#9ca3af',
    flexShrink: 0,
  },

  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: 2,
    color: 'inherit',
  },

  // Pending action card
  pendingCard: {
    background: '#fef3c7',
    border: '1.5px solid #f59e0b',
    borderRadius: '10px',
    padding: '0.75rem',
    fontSize: '0.82rem',
  },
  pendingHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  pendingBadge:  { background: '#f59e0b', color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.05em' },
  pendingType:   { fontWeight: 700, color: '#92400e', fontSize: '0.85rem' },
  pendingFields: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 },
  pendingRow:    { display: 'flex', gap: 8 },
  pendingKey:    { width: 110, flexShrink: 0, color: '#78350f', textTransform: 'capitalize', fontSize: '0.78rem' },
  pendingVal:    { color: '#1c1917', fontWeight: 600, wordBreak: 'break-word' },
  pendingBtns:   { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  cancelBtn:     { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: 7, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#374151' },
  confirmBtn:    { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 14px', background: '#016D2D', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 },

  // Charter panel
  charterPanel:  { borderBottom: '1px solid #e5e7eb', padding: '0.75rem', maxHeight: 320, overflowY: 'auto', flexShrink: 0, background: '#f9fafb' },
  charterTitle:  { fontSize: '0.85rem', fontWeight: 700, color: '#0A2B14', marginBottom: 8, display: 'flex', alignItems: 'center' },
  charterSection:{ fontSize: '0.7rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '10px 0 6px', borderBottom: '1px solid #e5e7eb', paddingBottom: 3 },
  charterLabel:  { fontSize: '0.72rem', color: '#6b7280', display: 'block', marginBottom: 2 },
  charterInput:  { width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' },
  dropZone:      { border: '2px dashed #d1d5db', borderRadius: 8, padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', background: '#fff', marginBottom: 4 },
  errorMsg:      { color: '#dc2626', fontSize: '0.78rem', marginTop: 6 },
};
