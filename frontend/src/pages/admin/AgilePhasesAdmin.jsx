import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import client from '../../api/client';
import ConfirmDialog from '../../components/ConfirmDialog';

/* ── Phase form modal ──────────────────────────────────────────── */
function PhaseForm({ phase, onSave, onCancel }) {
  const [form, setForm]   = useState({ name: phase?.name || '', description: phase?.description || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      phase
        ? await client.put(`/agile-phases/${phase.id}`, form)
        : await client.post('/agile-phases', form);
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>{phase ? 'Edit Phase' : 'New Phase'}</h3>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Phase Name *</label>
          <input
            style={styles.input}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Backlog, In Progress, Done"
            autoFocus
            required
          />
          <label style={styles.label}>Description</label>
          <input
            style={styles.input}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Optional description"
          />
          <div style={styles.actions}>
            <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={saving}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────── */
export default function AgilePhasesAdmin() {
  const { data: phases, loading, refetch } = useApi('/agile-phases');
  const [showForm,   setShowForm]   = useState(false);
  const [editPhase,  setEditPhase]  = useState(null);
  const [deletePhase, setDeletePhase] = useState(null);
  const [moving, setMoving] = useState(null); // id currently being reordered

  /* ── Reorder helpers ── */
  const move = async (index, direction) => {
    const list = [...(phases || [])];
    const swapIdx = index + direction;
    if (swapIdx < 0 || swapIdx >= list.length) return;

    [list[index], list[swapIdx]] = [list[swapIdx], list[index]];
    const ids = list.map(p => p.id);

    setMoving(ids[swapIdx]); // highlight the moved item
    try {
      await client.put('/agile-phases/reorder', { ids });
      refetch();
    } catch {
      alert('Failed to reorder phases');
    } finally { setMoving(null); }
  };

  /* ── Delete ── */
  const handleDelete = async () => {
    try {
      await client.delete(`/agile-phases/${deletePhase.id}`);
      setDeletePhase(null);
      refetch();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
      setDeletePhase(null);
    }
  };

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading…</div>;

  const list = phases || [];

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={styles.heading}>Agile Phases</h1>
          <p style={styles.subheading}>
            Define and sequence the phases used in your Kanban board. Drag the order buttons to arrange phases from left to right on the board.
          </p>
        </div>
        <button style={styles.addBtn} onClick={() => setShowForm(true)}>+ New Phase</button>
      </div>

      {/* ── Empty state ── */}
      {list.length === 0 && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>⬜</div>
          <div style={styles.emptyTitle}>No phases yet</div>
          <div style={styles.emptyDesc}>Add your first phase to start building your Kanban workflow.</div>
          <button style={styles.addBtn} onClick={() => setShowForm(true)}>+ Add First Phase</button>
        </div>
      )}

      {/* ── Phase sequence board ── */}
      {list.length > 0 && (
        <>
          {/* Visual flow strip */}
          <div style={styles.flowStrip}>
            {list.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  ...styles.flowChip,
                  background: moving === p.id ? '#d1fae5' : '#f0fdf4',
                  border: `2px solid ${moving === p.id ? '#016D2D' : '#bbf7d0'}`,
                }}>
                  <span style={styles.flowSeq}>{i + 1}</span>
                  <span style={styles.flowName}>{p.name}</span>
                </div>
                {i < list.length - 1 && (
                  <div style={styles.flowArrow}>→</div>
                )}
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={{ ...styles.th, width: 56 }}>Order</th>
                  <th style={styles.th}>Phase Name</th>
                  <th style={styles.th}>Description</th>
                  <th style={{ ...styles.th, width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p, i) => (
                  <tr
                    key={p.id}
                    className="pm-row"
                    style={{
                      ...styles.tr,
                      background: moving === p.id ? '#f0fdf4' : undefined,
                      transition: 'background 0.2s',
                    }}
                  >
                    {/* Sequence controls */}
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <div style={styles.seqCell}>
                        <span style={styles.seqNum}>{i + 1}</span>
                        <div style={styles.arrowBtns}>
                          <button
                            style={{ ...styles.arrowBtn, opacity: i === 0 ? 0.3 : 1 }}
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            title="Move up"
                          >▲</button>
                          <button
                            style={{ ...styles.arrowBtn, opacity: i === list.length - 1 ? 0.3 : 1 }}
                            onClick={() => move(i, 1)}
                            disabled={i === list.length - 1}
                            title="Move down"
                          >▼</button>
                        </div>
                      </div>
                    </td>

                    {/* Name */}
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: PHASE_COLORS[i % PHASE_COLORS.length],
                          flexShrink: 0,
                        }} />
                        <strong style={{ fontSize: '0.95rem' }}>{p.name}</strong>
                      </div>
                    </td>

                    {/* Description */}
                    <td style={{ ...styles.td, color: '#6b7280' }}>{p.description || '—'}</td>

                    {/* Actions */}
                    <td style={styles.td}>
                      <button style={styles.editBtn} onClick={() => setEditPhase(p)}>Edit</button>
                      <button style={styles.deleteBtn} onClick={() => setDeletePhase(p)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {(showForm || editPhase) && (
        <PhaseForm
          phase={editPhase}
          onSave={() => { setShowForm(false); setEditPhase(null); refetch(); }}
          onCancel={() => { setShowForm(false); setEditPhase(null); }}
        />
      )}
      {deletePhase && (
        <ConfirmDialog
          message={`Delete phase "${deletePhase.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletePhase(null)}
        />
      )}
    </div>
  );
}

/* ── Colour palette for phase dots ── */
const PHASE_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#3b82f6',
  '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6',
];

/* ── Styles ── */
const styles = {
  heading:    { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d', margin: 0 },
  subheading: { fontSize: '0.875rem', color: '#6b7280', marginTop: '0.35rem', maxWidth: 520 },
  addBtn:     { padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' },

  emptyState: { background: '#fff', borderRadius: '12px', padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: '1rem' },
  emptyIcon:  { fontSize: '2.5rem', marginBottom: '0.75rem' },
  emptyTitle: { fontSize: '1.1rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' },
  emptyDesc:  { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.25rem' },

  /* Flow strip */
  flowStrip:  { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem', background: '#fff', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem' },
  flowChip:   { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', borderRadius: '20px', transition: 'all 0.2s' },
  flowSeq:    { fontSize: '0.7rem', fontWeight: 800, color: '#016D2D', background: '#d1fae5', width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  flowName:   { fontSize: '0.85rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' },
  flowArrow:  { fontSize: '0.95rem', color: '#9ca3af', padding: '0 0.1rem' },

  /* Table */
  tableWrap:  { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table:      { width: '100%', borderCollapse: 'collapse' },
  thead:      { background: '#f9fafb' },
  th:         { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' },
  tr:         { borderBottom: '1px solid #f3f4f6' },
  td:         { padding: '0.85rem 1rem', fontSize: '0.9rem', color: '#374151', verticalAlign: 'middle' },

  /* Sequence controls */
  seqCell:    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  seqNum:     { fontSize: '0.8rem', fontWeight: 700, color: '#9ca3af', minWidth: 16, textAlign: 'center' },
  arrowBtns:  { display: 'flex', flexDirection: 'column', gap: 2 },
  arrowBtn:   { background: 'none', border: '1px solid #e5e7eb', borderRadius: 3, cursor: 'pointer', fontSize: '0.6rem', color: '#6b7280', padding: '1px 4px', lineHeight: 1, transition: 'all 0.1s' },

  editBtn:    { padding: '3px 12px', background: '#d1fae5', color: '#014E20', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, marginRight: '0.4rem' },
  deleteBtn:  { padding: '3px 12px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },

  /* Modal */
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#fff', borderRadius: '12px', padding: '2rem', width: '440px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalTitle: { fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' },
  form:       { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:      { fontSize: '0.85rem', fontWeight: 600, color: '#374151' },
  input:      { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', outline: 'none' },
  actions:    { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' },
  cancelBtn:  { padding: '0.5rem 1.25rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  saveBtn:    { padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  error:      { background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.9rem' },
};
