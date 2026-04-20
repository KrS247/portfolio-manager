import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { usePermissions } from '../hooks/usePermissions';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import PrioritySelect from '../components/PrioritySelect';

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

function CostBadge({ cost, label, icon, bg, color, border }) {
  if (cost == null || cost === 0) return <span style={{ color: '#d1d5db', fontSize: '0.78rem' }}>—</span>;
  const formatted = cost >= 1000
    ? `$${(cost / 1000).toFixed(1)}k`
    : `$${parseFloat(cost).toFixed(2)}`;
  return (
    <span title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color, border: `1px solid ${border}`, borderRadius: 20, padding: '2px 8px', fontSize: '0.74rem', fontWeight: 700 }}>
      {icon} {formatted}
    </span>
  );
}

function EstCostBadge({ cost }) {
  return <CostBadge cost={cost} label="Estimated Cost" icon="💰" bg="#f0fdf4" color="#15803d" border="#bbf7d0" />;
}
function ActualCostBadge({ cost }) {
  return <CostBadge cost={cost} label="Actual Cost" icon="🧾" bg="#eff6ff" color="#1d4ed8" border="#bfdbfe" />;
}

function ViewToggle({ view, onChange }) {
  const base = { padding: '0.3rem 0.85rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' };
  return (
    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <button style={{ ...base, borderRight: '1px solid #e5e7eb', background: view === 'card' ? '#016D2D' : '#fff', color: view === 'card' ? '#fff' : '#6b7280' }} onClick={() => onChange('card')}>⊞ Cards</button>
      <button style={{ ...base, background: view === 'table' ? '#016D2D' : '#fff', color: view === 'table' ? '#fff' : '#6b7280' }} onClick={() => onChange('table')}>☰ Table</button>
    </div>
  );
}

function ProjectForm({ project, onSave, onCancel }) {
  const [form, setForm] = useState({
    name:        project?.name        || '',
    description: project?.description || '',
    status:      project?.status      || 'active',
    priority:    project?.priority    ?? 5,
    start_date:  project?.start_date  || '',
    end_date:    project?.end_date    || '',
    clickup_id:  project?.clickup_id  || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    if (form.end_date && form.start_date && form.end_date < form.start_date) {
      setError('End date cannot be before start date'); setSaving(false); return;
    }
    try {
      await client.put(`/projects/${project.id}`, form);
      onSave();
    } catch (err) { setError(err.response?.data?.error?.message || 'Failed to save'); } finally { setSaving(false); }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>Edit Project</h3>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Name *</label>
          <input style={styles.input} value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Project name" />

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

          <label style={styles.label}>
            ClickUp ID
            <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', fontWeight: 400, color: '#9ca3af' }}>optional</span>
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', pointerEvents: 'none' }}>🔗</span>
            <input
              style={{ ...styles.input, paddingLeft: '2rem', fontFamily: 'monospace', letterSpacing: '0.03em' }}
              value={form.clickup_id}
              onChange={e => set('clickup_id', e.target.value.trim())}
              placeholder="e.g. 869anjmfb"
            />
          </div>
          <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.74rem', color: '#9ca3af' }}>
            Paste the ClickUp task ID to link this project and sync status, comments &amp; risks.
          </p>

          <div style={styles.actions}>
            <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={saving}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Projects() {
  const { data: projects, loading, error, refetch } = useApi('/projects');
  const { canEdit } = usePermissions();
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('pm_view_projects') || 'card');
  const setView = (v) => { setViewMode(v); localStorage.setItem('pm_view_projects', v); };
  const [editProj, setEditProj] = useState(null);

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading...</div>;
  if (error)   return <div style={{ padding: '1rem', color: '#991b1b', background: '#fee2e2', borderRadius: '8px' }}>{error}</div>;

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.heading}>All Projects</h1>
        <ViewToggle view={viewMode} onChange={setView} />
      </div>

      {projects?.length === 0 && <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No projects yet. Add projects through a program detail page.</p>}

      {viewMode === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {projects?.map(p => (
            <div key={p.id} style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <Link to={`/projects/${p.id}`} style={{ fontWeight: 700, color: '#1d1d1d', textDecoration: 'none', fontSize: '1rem' }}>{p.name}</Link>
                <StatusBadge status={p.status} />
              </div>
              {p.description && <p style={{ color: '#6b7280', fontSize: '0.88rem', marginBottom: '0.5rem' }}>{p.description}</p>}
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span>Program: <Link to={`/programs/${p.program_id}`} style={{ color: '#016D2D' }}>{p.program_name}</Link></span>
                <span>Portfolio: {p.portfolio_name}</span>
                <span>{p.task_count} tasks</span>
              </div>
              <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <RiskPill rate={p.avg_risk_rate} />
                <EstCostBadge cost={p.estimated_cost} />
                <ActualCostBadge cost={p.actual_cost} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Name', 'Status', 'Program', 'Portfolio', 'Tasks', 'Start Date', 'End Date', 'Avg Risk', 'Est. Cost', 'Actual Cost', 'Actions'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects?.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                  <td style={styles.td}>
                    <Link to={`/projects/${p.id}`} style={styles.tableLink}>{p.name}</Link>
                    {p.description && <div style={styles.tableDesc}>{p.description}</div>}
                  </td>
                  <td style={styles.td}><StatusBadge status={p.status} /></td>
                  <td style={styles.td}>
                    <Link to={`/programs/${p.program_id}`} style={{ color: '#016D2D', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>{p.program_name}</Link>
                  </td>
                  <td style={{ ...styles.td, fontSize: '0.85rem', color: '#6b7280' }}>{p.portfolio_name}</td>
                  <td style={{ ...styles.td, textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>{p.task_count}</td>
                  <td style={{ ...styles.td, fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{p.start_date || '—'}</td>
                  <td style={{ ...styles.td, fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{p.end_date   || '—'}</td>
                  <td style={styles.td}><RiskPill rate={p.avg_risk_rate} /></td>
                  <td style={styles.td}><EstCostBadge cost={p.estimated_cost} /></td>
                  <td style={styles.td}><ActualCostBadge cost={p.actual_cost} /></td>
                  <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <Link to={`/projects/${p.id}`} style={styles.viewBtn}>View</Link>
                      {canEdit('projects') && (
                        <button style={styles.editBtn} onClick={() => setEditProj(p)}>Edit</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editProj && (
        <ProjectForm
          project={editProj}
          onSave={() => { setEditProj(null); refetch(); }}
          onCancel={() => setEditProj(null)}
        />
      )}
    </div>
  );
}

const styles = {
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  heading:   { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d' },
  tableWrap: { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { padding: '0.7rem 1rem', background: '#016D2D', color: '#fff', fontWeight: 700, fontSize: '0.8rem', textAlign: 'left', whiteSpace: 'nowrap' },
  td:        { padding: '0.7rem 1rem', fontSize: '0.88rem', color: '#374151', verticalAlign: 'middle' },
  tableLink: { fontWeight: 700, color: '#1d1d1d', textDecoration: 'none' },
  tableDesc: { fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' },
  viewBtn:   { display: 'inline-block', padding: '3px 12px', background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' },
  editBtn:   { padding: '3px 12px', background: '#d1fae5', color: '#014E20', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:     { background: '#fff', borderRadius: '12px', padding: '2rem', width: '500px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalTitle:{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' },
  form:      { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:     { fontSize: '0.85rem', fontWeight: 600, color: '#374151' },
  input:     { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', width: '100%', outline: 'none', boxSizing: 'border-box' },
  dateRow:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  dateField: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  actions:   { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' },
  cancelBtn: { padding: '0.5rem 1.25rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  saveBtn:   { padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  error:     { background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.9rem' },
};
