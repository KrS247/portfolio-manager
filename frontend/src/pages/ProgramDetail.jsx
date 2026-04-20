import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { usePermissions } from '../hooks/usePermissions';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import PrioritySelect, { PriorityTag } from '../components/PrioritySelect';
import ProgressBar from '../components/ProgressBar';
import GanttChart from '../components/GanttChart';
import EVMPanel from '../components/EVMPanel';

function getRiskMeta(rate) {
  if (rate == null) return null;
  if (rate <= 5)  return { label: 'Low Risk',      color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' };
  if (rate <= 10) return { label: 'Medium Risk',   color: '#d97706', bg: '#fef3c7', border: '#fde68a' };
  if (rate <= 15) return { label: 'High Risk',     color: '#ea580c', bg: '#ffedd5', border: '#fed7aa' };
  return              { label: 'Critical Risk',    color: '#dc2626', bg: '#fee2e2', border: '#fecaca' };
}

function ProjectForm({ programId, project, onSave, onCancel }) {
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
      const payload = { ...form, program_id: programId };
      project ? await client.put(`/projects/${project.id}`, payload) : await client.post('/projects', payload);
      onSave();
    } catch (err) { setError(err.response?.data?.error?.message || 'Failed'); } finally { setSaving(false); }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>{project ? 'Edit Project' : 'New Project'}</h3>
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

export default function ProgramDetail() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useApi(`/programs/${id}`);
  const { canEdit } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editProj, setEditProj] = useState(null);
  const [deleteProj, setDeleteProj] = useState(null);
  const [projView, setProjView] = useState('list');
  const handleDeleteProject = async () => { await client.delete(`/projects/${deleteProj.id}`); setDeleteProj(null); refetch(); };

  if (loading) return <div style={styles.loading}>Loading...</div>;
  if (error)   return <div style={styles.errMsg}>{error}</div>;
  if (!data)   return null;

  return (
    <div>
      <div style={styles.breadcrumb}>
        <Link to="/portfolios" style={styles.breadLink}>Portfolios</Link> / <Link to={`/portfolios/${data.portfolio_id}`} style={styles.breadLink}>{data.portfolio_name}</Link> / {data.name}
      </div>
      <div style={styles.header}>
        <div style={{ flex: 1 }}>
          <h1 style={styles.heading}>{data.name}</h1>
          {data.description && <p style={styles.desc}>{data.description}</p>}
          {/* Program-level completion bar */}
          <div style={styles.progressWrap}>
            <ProgressBar value={data.percent_complete ?? 0} size="lg" label="Program Completion" />
          </div>
          {getRiskMeta(data.avg_risk_rate) && (() => { const rm = getRiskMeta(data.avg_risk_rate); return (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: rm.bg, color: rm.color, border: `1px solid ${rm.border}`, borderRadius: '20px', padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                ⚠️ Avg Risk: {data.avg_risk_rate} · {rm.label}
              </span>
            </div>
          ); })()}
        </div>
        <StatusBadge status={data.status} />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Projects ({data.projects?.length || 0})</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={styles.viewToggle}>
              <button style={{ ...styles.viewBtn, ...(projView === 'list'  ? styles.viewBtnActive : {}) }} onClick={() => setProjView('list')}>☰ List</button>
              <button style={{ ...styles.viewBtn, ...(projView === 'gantt' ? styles.viewBtnActive : {}) }} onClick={() => setProjView('gantt')}>📊 Gantt</button>
            </div>
            {canEdit('projects') && <button style={styles.addBtn} onClick={() => setShowForm(true)}>+ Add Project</button>}
          </div>
        </div>
        {data.projects?.length === 0 && <p style={styles.empty}>No projects yet.</p>}

        {/* Gantt view */}
        {projView === 'gantt' && (data.projects?.length ?? 0) > 0 && (
          <GanttChart
            items={data.projects}
            nameField="name"
            endDateField="end_date"
            canEdit={canEdit('projects')}
            onEdit={(proj) => setEditProj(proj)}
          />
        )}

        {/* List (card grid) view */}
        <div style={{ ...styles.grid, display: projView === 'list' ? 'grid' : 'none' }}>
          {data.projects?.map(proj => (
            <div key={proj.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <Link to={`/projects/${proj.id}`} style={styles.cardTitle}>{proj.name}</Link>
                <StatusBadge status={proj.status} />
              </div>
              {proj.description && <p style={styles.cardDesc}>{proj.description}</p>}
              <div style={styles.cardTags}><PriorityTag priority={proj.priority ?? 5} /></div>
              <div style={styles.cardDates}>
                {proj.start_date && <span>📅 {proj.start_date}</span>}
                {proj.end_date   && <span>🏁 {proj.end_date}</span>}
              </div>
              <div style={styles.cardMeta}><span>{proj.task_count} tasks</span></div>
              {/* Per-project completion bar */}
              <div style={styles.cardProgress}>
                <ProgressBar value={proj.percent_complete ?? 0} size="sm" showLabel={false} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: (proj.percent_complete ?? 0) >= 75 ? '#16a34a' : (proj.percent_complete ?? 0) >= 40 ? '#d97706' : '#016D2D', minWidth: '2.4rem', textAlign: 'right' }}>
                  {proj.percent_complete ?? 0}%
                </span>
              </div>
              {getRiskMeta(proj.avg_risk_rate) && (() => { const rm = getRiskMeta(proj.avg_risk_rate); return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: rm.bg, color: rm.color, border: `1px solid ${rm.border}`, borderRadius: '20px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, marginTop: '4px' }}>
                  ⚠️ {proj.avg_risk_rate} · {rm.label}
                </span>
              ); })()}
              {canEdit('projects') && (
                <div style={styles.cardActions}>
                  <button style={styles.editBtn} onClick={() => setEditProj(proj)}>Edit</button>
                  <button style={styles.deleteBtn} onClick={() => setDeleteProj(proj)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>{/* end list grid */}
      </div>

      {(showForm || editProj) && <ProjectForm programId={parseInt(id)} project={editProj} onSave={() => { setShowForm(false); setEditProj(null); refetch(); }} onCancel={() => { setShowForm(false); setEditProj(null); }} />}
      {deleteProj && <ConfirmDialog message={`Delete project "${deleteProj.name}"?`} onConfirm={handleDeleteProject} onCancel={() => setDeleteProj(null)} />}

      {/* ── EVM ─────────────────────────────────────────────────── */}
      <EVMPanel parentType="program" parentId={parseInt(id)} />
    </div>
  );
}

const styles = {
  breadcrumb:  { fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.75rem' },
  breadLink:   { color: '#016D2D', textDecoration: 'none', fontWeight: 600 },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  heading:     { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d' },
  desc:        { color: '#6b7280', marginTop: '0.25rem' },
  section:     { background: '#fff', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  sectionTitle:{ fontSize: '1.1rem', fontWeight: 700, color: '#1d1d1d' },
  addBtn:      { padding: '0.4rem 1rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
  viewToggle:    { display: 'flex', border: '1.5px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' },
  viewBtn:       { padding: '0.3rem 0.8rem', background: '#f9fafb', border: 'none', borderRight: '1.5px solid #e5e7eb', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: '#6b7280' },
  viewBtnActive: { background: '#016D2D', color: '#fff', borderRightColor: '#016D2D' },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' },
  card:        { background: '#f9fafb', borderRadius: '10px', padding: '1rem', border: '1.5px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  cardHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle:   { fontWeight: 700, color: '#1d1d1d', textDecoration: 'none', fontSize: '0.95rem' },
  cardDesc:    { color: '#6b7280', fontSize: '0.85rem' },
  cardTags:    { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  cardDates:   { display: 'flex', gap: '0.75rem', fontSize: '0.78rem', color: '#6b7280', flexWrap: 'wrap' },
  cardMeta:    { display: 'flex', gap: '1rem', fontSize: '0.78rem', color: '#9ca3af' },
  cardActions: { display: 'flex', gap: '0.4rem' },
  editBtn:     { padding: '3px 12px', background: '#d1fae5', color: '#014E20', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  deleteBtn:   { padding: '3px 12px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  loading:     { padding: '2rem', color: '#6b7280' },
  errMsg:      { padding: '1rem', color: '#991b1b', background: '#fee2e2', borderRadius: '8px' },
  empty:       { color: '#9ca3af', fontStyle: 'italic', fontSize: '0.9rem' },
  progressWrap:{ marginTop: '0.75rem', maxWidth: '360px' },
  cardProgress:{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px' },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:       { background: '#fff', borderRadius: '12px', padding: '2rem', width: '500px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalTitle:  { fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' },
  form:        { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:       { fontSize: '0.85rem', fontWeight: 600, color: '#374151' },
  input:       { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', width: '100%', outline: 'none', boxSizing: 'border-box' },
  dateRow:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  dateField:   { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  actions:     { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' },
  cancelBtn:   { padding: '0.5rem 1.25rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  saveBtn:     { padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  error:       { background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.9rem' },
};
