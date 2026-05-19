import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import client from '../../api/client';
import ConfirmDialog from '../../components/ConfirmDialog';

/* ── Helpers ───────────────────────────────────────────────────── */

/**
 * Serialize a Date object to YYYY-MM-DD using LOCAL date components.
 * Never use toISOString() for date arithmetic — it returns UTC and will
 * produce wrong dates for anyone in a UTC+ timezone (e.g. Australia).
 */
function toLocalDateStr(d) {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

/** Snap a date string to the next Monday on or after it. */
function snapToMonday(dateStr) {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun, 1=Mon … 6=Sat
  if (day !== 1) {
    d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day));
  }
  return toLocalDateStr(d);
}

/** End date = start (Monday) + N weeks − 3 days = Friday of the last week. */
function sprintEndDate(startDateStr, durationWeeks) {
  return addDays(startDateStr, durationWeeks * 7 - 3);
}

/** The Monday immediately following a sprint's Friday end date. */
function nextSprintStart(sprint) {
  return addDays(sprintEndDate(sprint.start_date, sprint.duration_weeks), 3);
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const STATUS_META = {
  planned:   { label: 'Planned',   bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  active:    { label: 'Active',    bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  completed: { label: 'Completed', bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
};

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.planned;
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      {m.label}
    </span>
  );
}

/* ── Sprint form modal ─────────────────────────────────────────── */
/**
 * prevSprint  – the last sprint in the sequence (undefined when creating the first sprint)
 * sprint      – the sprint being edited (undefined when creating)
 *
 * When prevSprint is supplied the start date is locked to the day after
 * prevSprint ends — the user cannot change it.
 */
function SprintForm({ sprint, prevSprint, onSave, onCancel }) {
  const lockedStart = prevSprint ? nextSprintStart(prevSprint) : null;

  const [form, setForm] = useState({
    name:           sprint?.name           || '',
    start_date:     sprint?.start_date     || lockedStart || '',
    duration_weeks: sprint?.duration_weeks ?? 2,
    status:         sprint?.status         || 'planned',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const endDate = form.start_date
    ? sprintEndDate(form.start_date, form.duration_weeks)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      sprint
        ? await client.put(`/sprints/${sprint.id}`, form)
        : await client.post('/sprints', form);
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const isNew = !sprint;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>{isNew ? 'New Sprint' : 'Edit Sprint'}</h3>

        {/* "Continues from" banner — only for new sprints that follow a previous one */}
        {isNew && prevSprint && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.65rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.82rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>🔗</span>
            <div>
              <strong>Continues from:</strong> {prevSprint.name}
              <span style={{ color: '#3b82f6', marginLeft: 6 }}>ends Fri {fmtDate(sprintEndDate(prevSprint.start_date, prevSprint.duration_weeks))}</span>
            </div>
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>

          <label style={styles.label}>Sprint Name *</label>
          <input
            style={styles.input}
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Sprint 1 — MVP Alpha"
            autoFocus
            required
          />

          <label style={styles.label}>
            Start Date
            {lockedStart && isNew
              ? <span style={{ marginLeft: 6, fontWeight: 400, fontSize: '0.75rem', color: '#6b7280' }}>— set automatically to maintain sequence</span>
              : <span style={{ marginLeft: 6, fontWeight: 400, fontSize: '0.78rem', color: '#9ca3af' }}>— must be a Monday</span>
            }
          </label>

          {lockedStart && isNew ? (
            /* Locked: shown as a read-only display, not an editable input */
            <div style={{ ...styles.input, background: '#f3f4f6', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'not-allowed' }}>
              <span style={{ fontSize: '0.9rem' }}>📅</span>
              <strong>Mon {fmtDate(lockedStart)}</strong>
              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#9ca3af', background: '#e5e7eb', padding: '1px 8px', borderRadius: 10 }}>auto</span>
            </div>
          ) : (
            <>
              <input
                style={styles.input}
                type="date"
                value={form.start_date}
                onChange={e => set('start_date', snapToMonday(e.target.value))}
                required
              />
              {form.start_date && (
                <p style={{ margin: '-0.25rem 0 0', fontSize: '0.74rem', color: '#6b7280' }}>
                  📌 Automatically snapped to Monday · End date will always land on a Friday
                </p>
              )}
            </>
          )}

          <label style={styles.label}>Duration</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
            {[2, 3, 4, 5, 6].map(w => (
              <button
                key={w}
                type="button"
                onClick={() => set('duration_weeks', w)}
                style={{
                  padding: '0.5rem 0',
                  border: `2px solid ${form.duration_weeks === w ? '#016D2D' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  background: form.duration_weeks === w ? '#016D2D' : '#fff',
                  color: form.duration_weeks === w ? '#fff' : '#374151',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {w}w
              </button>
            ))}
          </div>

          {endDate && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.82rem', color: '#065f46' }}>
              📅 <strong>Mon</strong> {fmtDate(form.start_date)} → <strong>Fri</strong> {fmtDate(endDate)}
              <span style={{ marginLeft: 8, color: '#6b7280' }}>({form.duration_weeks} weeks)</span>
            </div>
          )}

          <label style={styles.label}>Status</label>
          <select style={styles.input} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>

          <div style={styles.actions}>
            <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={saving}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={saving}>{saving ? 'Saving…' : 'Save Sprint'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────── */
export default function SprintManagementAdmin() {
  const { data: sprints, loading, refetch } = useApi('/sprints');
  const [showForm,     setShowForm]     = useState(false);
  const [editSprint,   setEditSprint]   = useState(null);
  const [deleteSprint, setDeleteSprint] = useState(null);

  const handleDelete = async () => {
    try {
      await client.delete(`/sprints/${deleteSprint.id}`);
      setDeleteSprint(null);
      refetch();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
      setDeleteSprint(null);
    }
  };

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading…</div>;

  // Always work with sprints sorted by start_date ascending
  const list = [...(sprints || [])].sort((a, b) => a.start_date.localeCompare(b.start_date));

  // The sprint that the next new sprint must follow
  const lastSprint = list.length > 0 ? list[list.length - 1] : null;

  const counts = list.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={styles.heading}>Sprint Management</h1>
          <p style={styles.subheading}>
            Sprints run in sequence — each sprint starts the Monday after the previous one ends.
          </p>
        </div>
        <button style={styles.addBtn} onClick={() => setShowForm(true)}>+ New Sprint</button>
      </div>

      {/* ── Summary chips ── */}
      {list.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {Object.entries(STATUS_META).map(([key, m]) =>
            counts[key] ? (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: m.bg, border: `1px solid ${m.border}`, borderRadius: 20, padding: '4px 14px', fontSize: '0.8rem', fontWeight: 700, color: m.color }}>
                <span>{key === 'active' ? '▶' : key === 'completed' ? '✓' : '○'}</span>
                {counts[key]} {m.label}
              </div>
            ) : null
          )}
          {lastSprint && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '4px 14px', fontSize: '0.8rem', fontWeight: 700, color: '#065f46', marginLeft: 'auto' }}>
              Next sprint starts: Mon {fmtDate(nextSprintStart(lastSprint))}
            </div>
          )}
        </div>
      )}

      {/* ── Timeline strip ── */}
      {list.length > 0 && (
        <div style={styles.timelineStrip}>
          {list.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                ...styles.timelineChip,
                background: STATUS_META[s.status]?.bg || '#f1f5f9',
                border: `2px solid ${STATUS_META[s.status]?.border || '#cbd5e1'}`,
              }}>
                <span style={styles.chipNum}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1d1d1d', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ fontSize: '0.68rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {fmtDate(s.start_date)} → {fmtDate(sprintEndDate(s.start_date, s.duration_weeks))}
                  </div>
                </div>
              </div>
              {i < list.length - 1 && <div style={styles.timelineArrow}>→</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {list.length === 0 && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🏃</div>
          <div style={styles.emptyTitle}>No sprints yet</div>
          <div style={styles.emptyDesc}>Create your first sprint to kick off your agile cycle.</div>
          <button style={styles.addBtn} onClick={() => setShowForm(true)}>+ Create First Sprint</button>
        </div>
      )}

      {/* ── Sprint table ── */}
      {list.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Sprint Name</th>
                <th style={styles.th}>Start (Mon)</th>
                <th style={styles.th}>Duration</th>
                <th style={styles.th}>End (Fri)</th>
                <th style={styles.th}>Status</th>
                <th style={{ ...styles.th, width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => {
                const endDate = sprintEndDate(s.start_date, s.duration_weeks);
                return (
                  <tr key={s.id} className="pm-row" style={styles.tr}>
                    <td style={{ ...styles.td, color: '#9ca3af', fontWeight: 700, fontSize: '0.8rem' }}>{i + 1}</td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: SPRINT_COLORS[i % SPRINT_COLORS.length] }} />
                        <strong style={{ fontSize: '0.95rem' }}>{s.name}</strong>
                      </div>
                    </td>
                    <td style={{ ...styles.td, color: '#374151', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtDate(s.start_date)}</td>
                    <td style={styles.td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', color: '#016D2D', border: '1px solid #bbf7d0', borderRadius: 20, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                        {s.duration_weeks} weeks
                      </span>
                    </td>
                    <td style={{ ...styles.td, color: '#374151', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtDate(endDate)}</td>
                    <td style={styles.td}><StatusPill status={s.status} /></td>
                    <td style={styles.td}>
                      <button style={styles.editBtn}   onClick={() => setEditSprint(s)}>Edit</button>
                      <button style={styles.deleteBtn} onClick={() => setDeleteSprint(s)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ── */}
      {(showForm || editSprint) && (
        <SprintForm
          sprint={editSprint}
          prevSprint={!editSprint ? lastSprint : undefined}
          onSave={() => { setShowForm(false); setEditSprint(null); refetch(); }}
          onCancel={() => { setShowForm(false); setEditSprint(null); }}
        />
      )}
      {deleteSprint && (
        <ConfirmDialog
          message={`Delete sprint "${deleteSprint.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteSprint(null)}
        />
      )}
    </div>
  );
}

const SPRINT_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#3b82f6',
  '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6',
];

const styles = {
  heading:    { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d', margin: 0 },
  subheading: { fontSize: '0.875rem', color: '#6b7280', marginTop: '0.35rem', maxWidth: 560 },
  addBtn:     { padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' },

  timelineStrip: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem', background: '#fff', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem' },
  timelineChip:  { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.85rem', borderRadius: '10px', transition: 'all 0.2s' },
  chipNum:       { fontSize: '0.68rem', fontWeight: 800, color: '#016D2D', background: '#d1fae5', width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineArrow: { fontSize: '0.95rem', color: '#9ca3af', padding: '0 0.15rem' },

  emptyState: { background: '#fff', borderRadius: '12px', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: '1rem' },
  emptyIcon:  { fontSize: '2.5rem', marginBottom: '0.75rem' },
  emptyTitle: { fontSize: '1.1rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' },
  emptyDesc:  { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.25rem' },

  tableWrap: { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  thead:     { background: '#f9fafb' },
  th:        { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' },
  tr:        { borderBottom: '1px solid #f3f4f6' },
  td:        { padding: '0.85rem 1rem', fontSize: '0.9rem', color: '#374151', verticalAlign: 'middle' },

  editBtn:   { padding: '3px 12px', background: '#d1fae5', color: '#014E20', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, marginRight: '0.4rem' },
  deleteBtn: { padding: '3px 12px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },

  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:     { background: '#fff', borderRadius: '12px', padding: '2rem', width: '460px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalTitle:{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' },
  form:      { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:     { fontSize: '0.85rem', fontWeight: 600, color: '#374151' },
  input:     { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', outline: 'none', width: '100%', boxSizing: 'border-box' },
  actions:   { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' },
  cancelBtn: { padding: '0.5rem 1.25rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  saveBtn:   { padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  error:     { background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.9rem' },
};
