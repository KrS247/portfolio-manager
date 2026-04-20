import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { usePermissions } from '../hooks/usePermissions';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import PrioritySelect, { PRIORITY_LABELS, PriorityTag } from '../components/PrioritySelect';

function getRiskMeta(rate) {
  if (rate == null) return null;
  if (rate <= 5)  return { label: 'Low Risk',      color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' };
  if (rate <= 10) return { label: 'Medium Risk',   color: '#d97706', bg: '#fef3c7', border: '#fde68a' };
  if (rate <= 15) return { label: 'High Risk',     color: '#ea580c', bg: '#ffedd5', border: '#fed7aa' };
  return              { label: 'Critical Risk',    color: '#dc2626', bg: '#fee2e2', border: '#fecaca' };
}

function RiskPill({ rate }) {
  const rm = getRiskMeta(rate);
  if (!rm) return <span style={{ color: '#d1d5db', fontSize: '0.78rem' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: rm.bg, color: rm.color, border: `1px solid ${rm.border}`, borderRadius: 20, padding: '2px 8px', fontSize: '0.74rem', fontWeight: 700 }}>
      ⚠️ {rate} · {rm.label}
    </span>
  );
}

function ViewToggle({ view, onChange }) {
  const base = { padding: '0.3rem 0.85rem', border: '1px solid #e5e7eb', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.15s' };
  return (
    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <button style={{ ...base, borderRight: '1px solid #e5e7eb', borderRadius: 0, background: view === 'card' ? '#016D2D' : '#fff', color: view === 'card' ? '#fff' : '#6b7280' }} onClick={() => onChange('card')}>⊞ Cards</button>
      <button style={{ ...base, borderRadius: 0, border: 'none', background: view === 'table' ? '#016D2D' : '#fff', color: view === 'table' ? '#fff' : '#6b7280' }} onClick={() => onChange('table')}>☰ Table</button>
    </div>
  );
}

function PortfolioForm({ portfolio, onSave, onCancel }) {
  const [form, setForm] = useState({
    name:        portfolio?.name        || '',
    description: portfolio?.description || '',
    status:      portfolio?.status      || 'active',
    priority:    portfolio?.priority    ?? 5,
    start_date:  portfolio?.start_date  || '',
    end_date:    portfolio?.end_date    || '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    if (form.end_date && form.start_date && form.end_date < form.start_date) {
      setError('End date cannot be before start date'); setSaving(false); return;
    }
    try {
      portfolio
        ? await client.put(`/portfolios/${portfolio.id}`, form)
        : await client.post('/portfolios', form);
      onSave();
    } catch (err) { setError(err.response?.data?.error?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>{portfolio ? 'Edit Portfolio' : 'New Portfolio'}</h3>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Name *</label>
          <input style={styles.input} value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Portfolio name" />
          <label style={styles.label}>Description</label>
          <textarea style={{ ...styles.input, height: '70px', resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description" />
          <label style={styles.label}>Status</label>
          <select style={styles.input} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="closed">Closed</option>
          </select>
          <label style={styles.label}>Priority — 1 (Lowest) to 10 (Highest)</label>
          <PrioritySelect value={form.priority} onChange={v => set('priority', v)} />
          <div style={styles.dateRow}>
            <div style={styles.dateField}>
              <label style={styles.label}>Start Date</label>
              <input style={styles.input} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div style={styles.dateField}>
              <label style={styles.label}>End Date</label>
              <input style={styles.input} type="date" value={form.end_date} min={form.start_date || undefined} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
          <div style={styles.actions}>
            <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={saving}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Portfolios() {
  const { data: portfolios, loading, error, refetch } = useApi('/portfolios');
  const { canEdit } = usePermissions();
  const [showForm,  setShowForm]  = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [deleteItem,setDeleteItem]= useState(null);
  const [viewMode,  setViewMode]  = useState(() => localStorage.getItem('pm_view_portfolios') || 'card');

  const setView = (v) => { setViewMode(v); localStorage.setItem('pm_view_portfolios', v); };
  const handleSave   = () => { setShowForm(false); setEditItem(null); refetch(); };
  const handleDelete = async () => { await client.delete(`/portfolios/${deleteItem.id}`); setDeleteItem(null); refetch(); };

  if (loading) return <div style={styles.loading}>Loading...</div>;
  if (error)   return <div style={styles.errMsg}>{error}</div>;

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.heading}>Portfolios</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <ViewToggle view={viewMode} onChange={setView} />
          {canEdit('portfolios') && (
            <button style={styles.addBtn} onClick={() => setShowForm(true)}>+ New Portfolio</button>
          )}
        </div>
      </div>

      {portfolios?.length === 0 && <p style={styles.empty}>No portfolios yet. Create one to get started.</p>}

      {viewMode === 'card' ? (
        <div style={styles.grid}>
          {portfolios?.map(p => (
            <div key={p.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <Link to={`/portfolios/${p.id}`} style={styles.cardTitle}>{p.name}</Link>
                <StatusBadge status={p.status} />
              </div>
              {p.description && <p style={styles.cardDesc}>{p.description}</p>}
              <div style={styles.cardTags}><PriorityTag priority={p.priority ?? 5} /></div>
              <div style={styles.cardDates}>
                {p.start_date && <span>📅 Start: {p.start_date}</span>}
                {p.end_date   && <span>🏁 End: {p.end_date}</span>}
              </div>
              <div style={styles.cardMeta}>
                <span>{p.program_count} programs</span>
                <span>{p.task_count} tasks</span>
                {p.owner_name && <span>Owner: {p.owner_name}</span>}
              </div>
              <RiskPill rate={p.avg_risk_rate} />
              {canEdit('portfolios') && (
                <div style={styles.cardActions}>
                  <button style={styles.editBtn}   onClick={() => setEditItem(p)}>Edit</button>
                  <button style={styles.deleteBtn} onClick={() => setDeleteItem(p)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Name','Status','Priority','Start Date','End Date','Programs','Tasks','Avg Risk', ...(canEdit('portfolios') ? ['Actions'] : [])].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {portfolios?.map((p, i) => (
                <tr key={p.id} style={{ ...styles.tr, background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={styles.td}>
                    <Link to={`/portfolios/${p.id}`} style={styles.tableLink}>{p.name}</Link>
                    {p.description && <div style={styles.tableDesc}>{p.description}</div>}
                  </td>
                  <td style={styles.td}><StatusBadge status={p.status} /></td>
                  <td style={styles.td}><PriorityTag priority={p.priority ?? 5} /></td>
                  <td style={{ ...styles.td, ...styles.dateCell }}>{p.start_date || '—'}</td>
                  <td style={{ ...styles.td, ...styles.dateCell }}>{p.end_date   || '—'}</td>
                  <td style={{ ...styles.td, ...styles.numCell }}>{p.program_count}</td>
                  <td style={{ ...styles.td, ...styles.numCell }}>{p.task_count}</td>
                  <td style={styles.td}><RiskPill rate={p.avg_risk_rate} /></td>
                  {canEdit('portfolios') && (
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button style={styles.editBtn}   onClick={() => setEditItem(p)}>Edit</button>
                        <button style={styles.deleteBtn} onClick={() => setDeleteItem(p)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showForm || editItem) && (
        <PortfolioForm portfolio={editItem} onSave={handleSave} onCancel={() => { setShowForm(false); setEditItem(null); }} />
      )}
      {deleteItem && (
        <ConfirmDialog
          message={`Delete portfolio "${deleteItem.name}"? This will also delete all programs, projects, and tasks within it.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteItem(null)}
        />
      )}
    </div>
  );
}

const styles = {
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  heading:    { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d' },
  addBtn:     { padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' },
  card:       { background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle:  { fontWeight: 700, color: '#1d1d1d', textDecoration: 'none', fontSize: '1.05rem' },
  cardDesc:   { color: '#6b7280', fontSize: '0.88rem', lineHeight: 1.5 },
  cardTags:   { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  cardDates:  { display: 'flex', gap: '1rem', fontSize: '0.78rem', color: '#6b7280', flexWrap: 'wrap' },
  cardMeta:   { display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#9ca3af' },
  cardActions:{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' },
  editBtn:    { padding: '4px 14px', background: '#d1fae5', color: '#014E20', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 },
  deleteBtn:  { padding: '4px 14px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 },
  tableWrap:  { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table:      { width: '100%', borderCollapse: 'collapse' },
  th:         { padding: '0.7rem 1rem', background: '#016D2D', color: '#fff', fontWeight: 700, fontSize: '0.8rem', textAlign: 'left', whiteSpace: 'nowrap' },
  tr:         { borderBottom: '1px solid #f0f0f0' },
  td:         { padding: '0.7rem 1rem', fontSize: '0.88rem', color: '#374151', verticalAlign: 'middle' },
  tableLink:  { fontWeight: 700, color: '#1d1d1d', textDecoration: 'none' },
  tableDesc:  { fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' },
  dateCell:   { fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap' },
  numCell:    { textAlign: 'center', fontWeight: 600, color: '#6b7280' },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#fff', borderRadius: '12px', padding: '2rem', width: '500px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' },
  form:       { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:      { fontSize: '0.85rem', fontWeight: 600, color: '#374151' },
  input:      { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', width: '100%', outline: 'none', boxSizing: 'border-box' },
  dateRow:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  dateField:  { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  actions:    { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' },
  cancelBtn:  { padding: '0.5rem 1.25rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  saveBtn:    { padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  loading:    { padding: '2rem', color: '#6b7280' },
  errMsg:     { padding: '1rem', color: '#991b1b', background: '#fee2e2', borderRadius: '8px' },
  error:      { background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.9rem' },
  empty:      { color: '#9ca3af', fontStyle: 'italic' },
};
