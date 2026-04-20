/**
 * BaselinePanel
 *
 * Collapsible panel for schedule baselines: save, compare, delete.
 * Shows a variance table with colour-coded start/finish variance columns.
 *
 * Props:
 *   parentType   — 'portfolio' | 'program' | 'project'
 *   parentId     — numeric ID
 *   onBaselineSelected(tasks | null)  — called with baseline snapshot tasks
 *                                        (or null to clear)
 */
import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid #86efac', borderTopColor: '#016D2D',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  );
}

function VarianceBadge({ days }) {
  if (days == null) return <span style={{ color: '#9ca3af' }}>–</span>;
  if (days === 0)   return <span style={{ color: '#22c55e', fontWeight: 700 }}>On track</span>;
  const late  = days > 0;
  const color = late ? '#dc2626' : '#16a34a';
  const bg    = late ? '#fee2e2' : '#dcfce7';
  return (
    <span style={{ color, background: bg, padding: '1px 8px', borderRadius: '10px', fontWeight: 700, fontSize: '0.78rem' }}>
      {late ? '+' : ''}{days}d
    </span>
  );
}

export default function BaselinePanel({ parentType, parentId, onBaselineSelected }) {
  const [open,        setOpen]        = useState(false);
  const [baselines,   setBaselines]   = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [newName,     setNewName]     = useState('');
  const [msg,         setMsg]         = useState('');

  // Currently selected baseline (full detail)
  const [selectedId,  setSelectedId]  = useState(null);
  const [detail,      setDetail]      = useState(null);   // { baseline, tasks }
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Load baseline list ────────────────────────────────────────────────────
  const loadBaselines = useCallback(() => {
    if (!parentType || !parentId) return;
    setLoading(true);
    client.get('/baselines', { params: { parent_type: parentType, parent_id: parentId } })
      .then(({ data }) => setBaselines(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [parentType, parentId]);

  useEffect(() => {
    if (open) loadBaselines();
  }, [open, loadBaselines]);

  // ── Load baseline detail ──────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      if (onBaselineSelected) onBaselineSelected(null);
      return;
    }
    setDetailLoading(true);
    client.get(`/baselines/${selectedId}`)
      .then(({ data }) => {
        setDetail(data);
        // Pass the baseline snapshot tasks to parent (for Gantt overlay)
        if (onBaselineSelected) {
          onBaselineSelected(data.tasks.map(t => ({
            task_id:                t.task_id,
            baseline_start_date:    t.baseline_start_date,
            baseline_finish_date:   t.baseline_finish_date,
          })));
        }
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId, onBaselineSelected]);

  // ── Save new baseline ─────────────────────────────────────────────────────
  const saveBaseline = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setMsg('');
    try {
      await client.post('/baselines', {
        name:        newName.trim(),
        parent_type: parentType,
        parent_id:   parentId,
      });
      setNewName('');
      setMsg('✓ Baseline saved');
      await loadBaselines();
    } catch {
      setMsg('✗ Failed to save baseline');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  // ── Delete baseline ───────────────────────────────────────────────────────
  const deleteBaseline = async (id, name) => {
    if (!window.confirm(`Delete baseline "${name}"?`)) return;
    try {
      await client.delete(`/baselines/${id}`);
      if (selectedId === id) {
        setSelectedId(null);
      }
      await loadBaselines();
    } catch {
      alert('Failed to delete baseline.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.panel}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={styles.header}
      >
        <span style={styles.headerIcon}>{open ? '▾' : '▸'}</span>
        <span style={styles.headerTitle}>📐 Schedule Baselines</span>
        {baselines.length > 0 && !open && (
          <span style={styles.headerBadge}>{baselines.length}</span>
        )}
        {selectedId && (
          <span style={styles.activeTag}>
            Comparing: {baselines.find(b => b.id === selectedId)?.name || '…'}
          </span>
        )}
      </button>

      {open && (
        <div style={styles.body}>

          {/* ── Save new baseline ────────────────────────────────── */}
          <div style={styles.saveRow}>
            <input
              type="text"
              placeholder="Baseline name (e.g. Sprint 1 baseline)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={styles.input}
              onKeyDown={e => e.key === 'Enter' && saveBaseline()}
            />
            <button
              type="button"
              onClick={saveBaseline}
              disabled={saving || !newName.trim()}
              style={{ ...styles.saveBtn, opacity: newName.trim() ? 1 : 0.45 }}
            >
              {saving ? <Spinner /> : '📸 Save Baseline'}
            </button>
          </div>
          {msg && (
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: msg.startsWith('✓') ? '#016D2D' : '#dc2626', marginBottom: '0.5rem' }}>
              {msg}
            </div>
          )}

          {/* ── Baseline selector ────────────────────────────────── */}
          {loading ? (
            <div style={styles.loading}><Spinner /> Loading baselines…</div>
          ) : baselines.length === 0 ? (
            <div style={styles.empty}>No baselines saved yet. Save a baseline to snapshot the current schedule.</div>
          ) : (
            <>
              <div style={styles.blList}>
                {baselines.map(bl => (
                  <div
                    key={bl.id}
                    style={{
                      ...styles.blRow,
                      background: selectedId === bl.id ? '#f0fdf4' : '#fff',
                      borderColor: selectedId === bl.id ? '#86efac' : '#e5e7eb',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(selectedId === bl.id ? null : bl.id)}
                      style={styles.blSelectBtn}
                    >
                      <span style={{ fontWeight: 700, color: selectedId === bl.id ? '#016D2D' : '#374151' }}>{bl.name}</span>
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: '0.5rem' }}>
                        {new Date(bl.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {bl.creator && ` · ${bl.creator.username}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBaseline(bl.id, bl.name)}
                      style={styles.deleteBtn}
                      title="Delete baseline"
                    >✕</button>
                  </div>
                ))}
              </div>

              {/* ── Variance table for selected baseline ─────────── */}
              {selectedId && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={styles.tableTitle}>
                    Variance vs. Current Schedule
                    {detailLoading && <Spinner />}
                  </h4>

                  {detail && !detailLoading && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={styles.table}>
                        <thead>
                          <tr style={{ background: '#f3f4f6' }}>
                            <th style={styles.th}>Task</th>
                            <th style={styles.th}>Baseline Start</th>
                            <th style={styles.th}>Actual Start</th>
                            <th style={styles.th}>Start Var.</th>
                            <th style={styles.th}>Baseline Finish</th>
                            <th style={styles.th}>Actual Finish</th>
                            <th style={styles.th}>Finish Var.</th>
                            <th style={styles.th}>Float</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.tasks.map(row => (
                            <tr key={row.task_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ ...styles.td, fontWeight: 600 }}>{row.task_title}</td>
                              <td style={styles.td}>{row.baseline_start_date  || '–'}</td>
                              <td style={styles.td}>{row.actual_start_date    || '–'}</td>
                              <td style={{ ...styles.td, textAlign: 'center' }}><VarianceBadge days={row.start_variance_days} /></td>
                              <td style={styles.td}>{row.baseline_finish_date || '–'}</td>
                              <td style={styles.td}>{row.actual_finish_date   || '–'}</td>
                              <td style={{ ...styles.td, textAlign: 'center' }}><VarianceBadge days={row.finish_variance_days} /></td>
                              <td style={{ ...styles.td, textAlign: 'center' }}>
                                {row.float_days != null
                                  ? <span style={{ color: row.float_days === 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{row.float_days}d</span>
                                  : '–'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  panel:  { border: '1.5px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', marginTop: '1.5rem', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },

  header: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    width: '100%', padding: '0.85rem 1.25rem',
    background: '#f9fafb', border: 'none',
    cursor: 'pointer', textAlign: 'left',
    borderBottom: '1.5px solid #e5e7eb',
  },
  headerIcon:  { fontSize: '0.8rem', color: '#6b7280', flexShrink: 0 },
  headerTitle: { fontWeight: 700, fontSize: '0.95rem', color: '#374151', flex: 1 },
  headerBadge: { fontSize: '0.72rem', fontWeight: 700, background: '#d1fae5', color: '#016D2D', padding: '2px 8px', borderRadius: '10px' },
  activeTag:   { fontSize: '0.78rem', color: '#016D2D', fontWeight: 600, background: '#f0fdf4', border: '1px solid #86efac', padding: '2px 10px', borderRadius: '10px' },

  body:   { padding: '1.25rem' },

  saveRow:  { display: 'flex', gap: '0.65rem', marginBottom: '0.5rem', flexWrap: 'wrap' },
  input:    { flex: 1, padding: '0.45rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', minWidth: 180 },
  saveBtn:  { padding: '0.45rem 1rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' },

  loading: { display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.85rem', padding: '0.75rem 0' },
  empty:   { color: '#9ca3af', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem 0' },

  blList:      { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  blRow:       { display: 'flex', alignItems: 'center', border: '1.5px solid', borderRadius: '7px', overflow: 'hidden', transition: 'all 0.15s' },
  blSelectBtn: { flex: 1, padding: '0.5rem 0.85rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'baseline', gap: '0' },
  deleteBtn:   { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.85rem', padding: '0.5rem 0.75rem' },

  tableTitle: { fontSize: '0.88rem', fontWeight: 700, color: '#374151', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 },

  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' },
  th:    { padding: '0.45rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', borderBottom: '2px solid #e5e7eb' },
  td:    { padding: '0.45rem 0.75rem', color: '#374151', whiteSpace: 'nowrap' },
};
