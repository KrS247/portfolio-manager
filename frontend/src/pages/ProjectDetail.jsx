import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { usePermissions } from '../hooks/usePermissions';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import TaskList from '../components/TaskList';
import ProgressBar from '../components/ProgressBar';
import EVMPanel from '../components/EVMPanel';

// ─── Risk helpers ────────────────────────────────────────────────────────────
function getRiskMeta(rate) {
  if (rate == null) return null;
  if (rate <= 5)  return { label: 'Low Risk',    color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' };
  if (rate <= 10) return { label: 'Medium Risk', color: '#d97706', bg: '#fef3c7', border: '#fde68a' };
  if (rate <= 15) return { label: 'High Risk',   color: '#ea580c', bg: '#ffedd5', border: '#fed7aa' };
  return              { label: 'Critical Risk',  color: '#dc2626', bg: '#fee2e2', border: '#fecaca' };
}

// ─── Insights helpers ────────────────────────────────────────────────────────
const RISK_WORDS = [
  'blocker', 'blocked', 'risk', 'issue', 'concern', 'delay', 'delayed', 'stuck',
  'problem', 'critical', 'urgent', 'escalate', 'fail', 'failed', 'behind schedule',
  'off track', 'broken', 'not working', 'overdue', 'missing', 'obstacle',
];
const PROGRESS_WORDS = [
  'completed', 'done', 'finished', 'resolved', 'fixed', 'deployed',
  'merged', 'approved', 'ready', 'delivered', 'shipped', 'closed',
];

function extractCommentText(comment) {
  if (typeof comment.comment_text === 'string' && comment.comment_text.trim()) {
    return comment.comment_text;
  }
  if (Array.isArray(comment.comment)) {
    return comment.comment.map((c) => c.text || '').join('').trim();
  }
  return '';
}

function formatMs(ms) {
  if (!ms) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m > 0 ? ` ${m}m` : ''}`.trim();
  return `${m}m`;
}

function daysFromNow(tsMs) {
  const diff = parseInt(tsMs) - Date.now();
  const days = Math.round(diff / 86400000);
  if (days < 0) return { overdue: true, label: `${Math.abs(days)}d overdue`, days };
  if (days === 0) return { overdue: false, label: 'Due today', days };
  return { overdue: false, label: `${days}d remaining`, days };
}

function formatDate(tsMs) {
  if (!tsMs) return null;
  return new Date(parseInt(tsMs)).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function highlightRiskWords(text) {
  const lower = text.toLowerCase();
  const found = RISK_WORDS.filter((w) => lower.includes(w));
  return found;
}

const PRIORITY_META = {
  1: { label: 'Urgent', color: '#dc2626', bg: '#fee2e2', icon: '🔴' },
  2: { label: 'High',   color: '#ea580c', bg: '#ffedd5', icon: '🟠' },
  3: { label: 'Normal', color: '#d97706', bg: '#fef3c7', icon: '🟡' },
  4: { label: 'Low',    color: '#16a34a', bg: '#dcfce7', icon: '🟢' },
};

// ─── Insights Modal ──────────────────────────────────────────────────────────
function InsightsModal({ clickupId, projectName, onClose }) {
  const [phase, setPhase] = useState('loading'); // 'loading' | 'error' | 'ready'
  const [data, setData] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    client.get(`/clickup/task/${clickupId}`)
      .then((r) => { setData(r.data); setPhase('ready'); })
      .catch((err) => {
        setErrMsg(err.response?.data?.error?.message || 'Failed to load ClickUp data.');
        setPhase('error');
      });
  }, [clickupId]);

  // Close on overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div style={ms.overlay} onClick={handleOverlayClick}>
      <div style={ms.modal}>
        {/* Header */}
        <div style={ms.modalHeader}>
          <div>
            <div style={ms.modalTitle}>🔍 Detailed Insights</div>
            <div style={ms.modalSub}>
              {projectName}
              <span style={ms.idPill}>🔗 {clickupId}</span>
            </div>
          </div>
          <button style={ms.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Loading */}
        {phase === 'loading' && (
          <div style={ms.centerMsg}>
            <div style={ms.spinner} />
            <p style={{ color: '#6b7280', marginTop: '1rem' }}>Fetching insights from ClickUp…</p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div style={ms.errorBox}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚠️</div>
            <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Unable to load ClickUp data</p>
            <p style={{ fontSize: '0.85rem', color: '#991b1b' }}>{errMsg}</p>
            {(errMsg.includes('CLICKUP_MCP_TOKEN') || errMsg.includes('NOT_CONFIGURED')) && (
              <p style={{ fontSize: '0.8rem', marginTop: '0.75rem', color: '#6b7280' }}>
                In Claude Desktop go to <strong>Settings → Connected Apps → ClickUp</strong> and complete the OAuth flow.
                Then copy the Bearer token and add <code style={ms.code}>CLICKUP_MCP_TOKEN=&lt;token&gt;</code> to your backend <code style={ms.code}>.env</code> file and restart the server.
              </p>
            )}
          </div>
        )}

        {/* Insights */}
        {phase === 'ready' && data && <InsightsBody task={data.task} comments={data.comments} />}
      </div>
    </div>
  );
}

// Build a plain-text summary from the comment list
function buildCommentSummary(comments) {
  if (!comments || comments.length === 0) return 'No comments have been recorded for this task yet.';

  const sorted = [...comments].sort((a, b) => parseInt(a.date || 0) - parseInt(b.date || 0));
  const first = sorted[0];
  const last  = sorted[sorted.length - 1];

  const firstDate  = formatDate(first.date);
  const lastDate   = formatDate(last.date);
  const totalCount = sorted.length;

  // Collect unique authors
  const authors = [...new Set(
    sorted.map((c) => c.user?.username || c.user?.email).filter(Boolean)
  )];
  const authorStr = authors.length === 1
    ? authors[0]
    : authors.length === 2
      ? `${authors[0]} and ${authors[1]}`
      : `${authors.slice(0, -1).join(', ')}, and ${authors[authors.length - 1]}`;

  // Extract non-empty comment texts (most recent first for summarising)
  const texts = sorted
    .map(extractCommentText)
    .filter(Boolean);

  // Pull up to 3 meaningful sentences (>30 chars) from the most recent comments
  const keyPoints = [];
  for (const t of [...texts].reverse()) {
    const sentences = t.split(/[.!?\n]+/).map((s) => s.trim()).filter((s) => s.length > 30);
    for (const s of sentences) {
      if (!keyPoints.includes(s) && keyPoints.length < 3) keyPoints.push(s);
    }
    if (keyPoints.length >= 3) break;
  }

  // Build narrative
  const intro = totalCount === 1
    ? `There is 1 comment on this task`
    : `There are ${totalCount} comments on this task`;

  const period = firstDate && lastDate && firstDate !== lastDate
    ? ` spanning ${firstDate} to ${lastDate}`
    : firstDate ? ` from ${firstDate}` : '';

  const contrib = authors.length > 0 ? `, contributed by ${authorStr}` : '';

  let summary = `${intro}${period}${contrib}.`;

  if (keyPoints.length > 0) {
    summary += ' Key points include: ' + keyPoints.map((p) => `"${p}"`).join('; ') + '.';
  }

  // Append risk/progress signal
  const allText = texts.join(' ').toLowerCase();
  const risks   = RISK_WORDS.filter((w) => allText.includes(w));
  const progressed = PROGRESS_WORDS.filter((w) => allText.includes(w));

  if (risks.length > 0) {
    summary += ` ⚠️ Risk signals detected in comments (${risks.slice(0, 3).join(', ')}).`;
  } else if (progressed.length > 0) {
    summary += ` ✅ Progress indicators noted (${progressed.slice(0, 3).join(', ')}).`;
  }

  return summary;
}

function InsightsBody({ task, comments }) {
  // ── Derived values ───────────────────────────────────────────────────────
  const priorityMeta = PRIORITY_META[task.priority?.priority] || PRIORITY_META[3];
  const dueInfo = task.due_date ? daysFromNow(task.due_date) : null;
  const estimatedTime = formatMs(task.time_estimate);
  const spentTime = formatMs(task.time_spent);

  // Checklist progress
  const allItems = (task.checklists || []).flatMap((cl) => cl.items || []);
  const checklistPct = allItems.length > 0
    ? Math.round(allItems.filter((i) => i.resolved).length / allItems.length * 100)
    : null;

  // Comment analysis
  const recentComments = comments.slice(-10).reverse(); // last 10, newest first
  const allCommentText = recentComments.map(extractCommentText).join(' ').toLowerCase();
  const riskMatches = RISK_WORDS.filter((w) => allCommentText.includes(w));
  const progressMatches = PROGRESS_WORDS.filter((w) => allCommentText.includes(w));

  // Comment summary
  const commentSummary = buildCommentSummary(comments);

  // ── Risk flags ───────────────────────────────────────────────────────────
  const riskFlags = [];
  if (dueInfo?.overdue)                 riskFlags.push({ icon: '🔴', text: `Task is ${dueInfo.label}`, sev: 'high' });
  if ([1, 2].includes(task.priority?.priority)) riskFlags.push({ icon: '🟠', text: `${priorityMeta.label} priority task`, sev: 'med' });
  if (riskMatches.length > 0)           riskFlags.push({ icon: '🔴', text: `${riskMatches.length} risk keyword${riskMatches.length > 1 ? 's' : ''} found in recent comments (${riskMatches.slice(0, 3).join(', ')})`, sev: 'high' });
  if (!task.assignees?.length)          riskFlags.push({ icon: '🟡', text: 'Task has no assignee', sev: 'med' });
  if (!task.due_date)                   riskFlags.push({ icon: '🟡', text: 'No due date set', sev: 'low' });
  if (dueInfo && !dueInfo.overdue && dueInfo.days <= 7) riskFlags.push({ icon: '🟠', text: `Due very soon — ${dueInfo.label}`, sev: 'med' });
  if (riskFlags.length === 0)           riskFlags.push({ icon: '✅', text: 'No significant risks detected', sev: 'ok' });

  const sevColor = { high: '#dc2626', med: '#d97706', low: '#6b7280', ok: '#16a34a' };

  return (
    <div style={ms.body}>

      {/* ── Summary ────────────────────────────────────────────────────── */}
      <div style={ms.section}>
        <div style={ms.sectionTitle}>📝 Summary</div>
        <p style={ms.summaryText}>{commentSummary}</p>
      </div>

      {/* ── Status strip ───────────────────────────────────────────────── */}
      <div style={ms.stripRow}>
        <span style={{ ...ms.statusChip, background: task.status?.color || '#6b7280', color: '#fff' }}>
          {task.status?.status || 'Unknown'}
        </span>
        <span style={{ ...ms.chip, background: priorityMeta.bg, color: priorityMeta.color }}>
          {priorityMeta.icon} {priorityMeta.label}
        </span>
        {dueInfo && (
          <span style={{ ...ms.chip, background: dueInfo.overdue ? '#fee2e2' : '#f0fdf4', color: dueInfo.overdue ? '#dc2626' : '#15803d' }}>
            {dueInfo.overdue ? '⚠️' : '📅'} {dueInfo.label}
          </span>
        )}
        {task.assignees?.map((a) => (
          <span key={a.id} style={{ ...ms.chip, background: '#eff6ff', color: '#1d4ed8' }}>
            👤 {a.username || a.email}
          </span>
        ))}
      </div>

      {/* ── Progress ───────────────────────────────────────────────────── */}
      <div style={ms.section}>
        <div style={ms.sectionTitle}>📊 Progress Analysis</div>

        <div style={ms.infoGrid}>
          <div style={ms.infoCell}>
            <div style={ms.cellLabel}>Current Status</div>
            <div style={{ ...ms.cellValue, textTransform: 'capitalize' }}>{task.status?.status || '—'}</div>
          </div>
          {estimatedTime && (
            <div style={ms.infoCell}>
              <div style={ms.cellLabel}>Estimated Time</div>
              <div style={ms.cellValue}>{estimatedTime}</div>
            </div>
          )}
          {spentTime && (
            <div style={ms.infoCell}>
              <div style={ms.cellLabel}>Time Spent</div>
              <div style={{ ...ms.cellValue, color: task.time_spent > task.time_estimate && task.time_estimate ? '#dc2626' : '#374151' }}>
                {spentTime}
                {task.time_spent > task.time_estimate && task.time_estimate && ' ⚠️ over estimate'}
              </div>
            </div>
          )}
          {task.start_date && (
            <div style={ms.infoCell}>
              <div style={ms.cellLabel}>Start Date</div>
              <div style={ms.cellValue}>{formatDate(task.start_date)}</div>
            </div>
          )}
          {task.due_date && (
            <div style={ms.infoCell}>
              <div style={ms.cellLabel}>Due Date</div>
              <div style={ms.cellValue}>{formatDate(task.due_date)}</div>
            </div>
          )}
        </div>

        {checklistPct !== null && (
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px' }}>
              <span>Checklist Completion</span>
              <strong style={{ color: checklistPct >= 75 ? '#16a34a' : checklistPct >= 40 ? '#d97706' : '#dc2626' }}>{checklistPct}%</strong>
            </div>
            <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${checklistPct}%`, background: checklistPct >= 75 ? '#16a34a' : checklistPct >= 40 ? '#d97706' : '#dc2626', borderRadius: '4px', transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
              {allItems.filter((i) => i.resolved).length} of {allItems.length} checklist items resolved
            </div>
          </div>
        )}

        {progressMatches.length > 0 && (
          <div style={ms.progressHint}>
            ✅ {progressMatches.length} progress indicator{progressMatches.length > 1 ? 's' : ''} in recent comments ({progressMatches.slice(0, 4).join(', ')})
          </div>
        )}
      </div>

      {/* ── Risk Indicators ────────────────────────────────────────────── */}
      <div style={ms.section}>
        <div style={ms.sectionTitle}>⚠️ Risk Indicators</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {riskFlags.map((f, i) => (
            <div key={i} style={{ ...ms.riskRow, color: sevColor[f.sev] }}>
              <span style={{ fontSize: '1rem' }}>{f.icon}</span>
              <span style={{ fontSize: '0.87rem' }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent Comments ────────────────────────────────────────────── */}
      {recentComments.length > 0 && (
        <div style={ms.section}>
          <div style={ms.sectionTitle}>💬 Recent Activity ({Math.min(recentComments.length, 5)} of {comments.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentComments.slice(0, 5).map((c, i) => {
              const text = extractCommentText(c);
              if (!text) return null;
              const risks = highlightRiskWords(text);
              return (
                <div key={i} style={{ ...ms.commentCard, borderLeft: risks.length > 0 ? '3px solid #dc2626' : '3px solid #e5e7eb' }}>
                  <div style={ms.commentMeta}>
                    <strong style={{ color: '#374151' }}>{c.user?.username || c.user?.email || 'Unknown'}</strong>
                    <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{formatDate(c.date)}</span>
                  </div>
                  <div style={ms.commentText}>{text.length > 280 ? text.slice(0, 280) + '…' : text}</div>
                  {risks.length > 0 && (
                    <div style={ms.riskTag}>⚠️ Contains: {risks.join(', ')}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Open in ClickUp ─────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
        <a
          href={task.url || `https://app.clickup.com/t/${task.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={ms.cuLink}
        >
          Open in ClickUp ↗
        </a>
      </div>
    </div>
  );
}

// ─── Modal styles ────────────────────────────────────────────────────────────
const ms = {
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1100, padding: '2rem 1rem', overflowY: 'auto' },
  modal:       { background: '#fff', borderRadius: '14px', width: '640px', maxWidth: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f0f0f0' },
  modalTitle:  { fontSize: '1.1rem', fontWeight: 800, color: '#1d1d1d' },
  modalSub:    { fontSize: '0.82rem', color: '#6b7280', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  idPill:      { background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: '20px', padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 },
  closeBtn:    { background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#9ca3af', padding: '4px 8px', borderRadius: '6px' },
  body:        { padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  centerMsg:   { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1.5rem' },
  spinner:     { width: '36px', height: '36px', border: '4px solid #e5e7eb', borderTop: '4px solid #016D2D', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  errorBox:    { margin: '1.5rem', padding: '1.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', textAlign: 'center', color: '#991b1b' },
  code:        { background: '#f3f4f6', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace', fontSize: '0.82rem' },
  stripRow:    { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' },
  statusChip:  { display: 'inline-block', padding: '3px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, textTransform: 'capitalize' },
  chip:        { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, border: '1px solid transparent' },
  section:     { background: '#f9fafb', borderRadius: '10px', padding: '1rem 1.1rem', border: '1px solid #f0f0f0' },
  sectionTitle:{ fontSize: '0.85rem', fontWeight: 800, color: '#374151', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
  infoGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.6rem' },
  infoCell:    { background: '#fff', borderRadius: '8px', padding: '0.6rem 0.8rem', border: '1px solid #e5e7eb' },
  cellLabel:   { fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' },
  cellValue:   { fontSize: '0.88rem', fontWeight: 600, color: '#374151' },
  progressHint:{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '6px 10px' },
  riskRow:     { display: 'flex', alignItems: 'flex-start', gap: '0.5rem' },
  commentCard: { background: '#fff', borderRadius: '8px', padding: '0.75rem', border: '1px solid #f0f0f0' },
  commentMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' },
  commentText: { fontSize: '0.85rem', color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  riskTag:     { marginTop: '0.4rem', fontSize: '0.75rem', color: '#dc2626', background: '#fee2e2', borderRadius: '4px', padding: '2px 8px', display: 'inline-block' },
  cuLink:      { display: 'inline-block', padding: '0.45rem 1.25rem', background: '#014E20', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem' },
  summaryText: { fontSize: '0.88rem', color: '#374151', lineHeight: 1.7, margin: 0 },
};

// ─── Main page ───────────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useApi(`/projects/${id}`);
  const { canEdit } = usePermissions();
  const { data: users } = useApi('/users');
  const [showInsights, setShowInsights] = useState(false);

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading...</div>;
  if (error)   return <div style={{ padding: '1rem', color: '#991b1b', background: '#fee2e2', borderRadius: '8px' }}>{error}</div>;
  if (!data)   return null;

  const pct = data.percent_complete ?? 0;
  const riskMeta = getRiskMeta(data.avg_risk_rate);

  return (
    <div>
      {/* Spinner keyframe — injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.75rem' }}>
        <Link to="/portfolios" style={styles.breadLink}>Portfolios</Link>
        {' / '}
        <Link to={`/programs/${data.program_id}`} style={styles.breadLink}>{data.program_name}</Link>
        {' / '}{data.name}
      </div>

      <div style={styles.header}>
        <div style={{ flex: 1 }}>
          <h1 style={styles.heading}>{data.name}</h1>
          {data.description && <p style={styles.desc}>{data.description}</p>}
          <p style={styles.meta}>
            Portfolio: {data.portfolio_name} · Program: {data.program_name}
            {data.owner_name && ` · Owner: ${data.owner_name}`}
          </p>

          {/* Project-level completion bar */}
          <div style={styles.progressWrap}>
            <ProgressBar value={pct} size="lg" label="Project Completion" />
          </div>

          {riskMeta && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: riskMeta.bg, color: riskMeta.color, border: `1px solid ${riskMeta.border}`, borderRadius: '20px', padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                ⚠️ Avg Risk: {data.avg_risk_rate} · {riskMeta.label}
              </span>
            </div>
          )}

          {/* ClickUp badge + Insights button */}
          {data.clickup_id && (
            <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <a
                href={`https://app.clickup.com/t/${data.clickup_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: '20px', padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}
              >
                🔗 ClickUp: {data.clickup_id}
              </a>

              <button
                onClick={() => setShowInsights(true)}
                style={styles.insightsBtn}
              >
                🔍 Detailed Insights
              </button>
            </div>
          )}
        </div>
        <StatusBadge status={data.status} />
      </div>

      <div style={styles.card}>
        <TaskList
          tasks={data.tasks || []}
          parentType="project"
          parentId={parseInt(id)}
          canEdit={canEdit('tasks')}
          canAdd={canEdit('tasks')}
          onRefresh={refetch}
          users={users || []}
        />
      </div>

      {/* ── Earned Value Management ────────────────────────────────── */}
      <div style={styles.card}>
        <EVMPanel parentType="project" parentId={parseInt(id)} />
      </div>

      {/* Insights Modal */}
      {showInsights && (
        <InsightsModal
          clickupId={data.clickup_id}
          projectName={data.name}
          onClose={() => setShowInsights(false)}
        />
      )}
    </div>
  );
}

const styles = {
  breadLink:    { color: '#016D2D', textDecoration: 'none', fontWeight: 600 },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' },
  heading:      { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d' },
  desc:         { color: '#6b7280', marginTop: '0.25rem' },
  meta:         { fontSize: '0.82rem', color: '#9ca3af', marginTop: '0.4rem' },
  progressWrap: { marginTop: '0.75rem', maxWidth: '360px' },
  card:         { background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  insightsBtn:  {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    background: 'linear-gradient(135deg, #016D2D, #014E20)',
    color: '#fff', border: 'none', borderRadius: '20px',
    padding: '4px 14px', fontSize: '0.8rem', fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(79,70,229,0.3)',
  },
};
