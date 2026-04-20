import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import client from '../../api/client';
import ConfirmDialog from '../../components/ConfirmDialog';

function TeamForm({ team, onSave, onCancel }) {
  const [name, setName] = useState(team?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      team ? await client.put(`/teams/${team.id}`, { name }) : await client.post('/teams', { name });
      onSave();
    } catch (err) { setError(err.response?.data?.error?.message || 'Failed to save team'); }
    finally { setSaving(false); }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>{team ? 'Edit Team' : 'New Team'}</h3>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Team Name *</label>
          <input style={styles.input} value={name} required autoFocus
            onChange={e => setName(e.target.value)} placeholder="e.g. Engineering" />
          <div style={styles.actions}>
            <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={saving}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={saving}>{saving ? 'Saving...' : (team ? 'Save Changes' : 'Create Team')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamsAdmin() {
  const { data: teams, loading, refetch } = useApi('/teams');
  const [showForm, setShowForm] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const [deleteTeam, setDeleteTeam] = useState(null);

  const handleDelete = async () => {
    await client.delete(`/teams/${deleteTeam.id}`);
    setDeleteTeam(null);
    refetch();
  };

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading...</div>;

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.heading}>Team Administration</h1>
        <button style={styles.newBtn} onClick={() => setShowForm(true)}>+ New Team</button>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th style={styles.th}>Team Name</th>
              <th style={styles.th}>Created</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams?.length === 0 && (
              <tr><td colSpan={3} style={{ ...styles.td, color: '#9ca3af', textAlign: 'center' }}>No teams yet. Create one to get started.</td></tr>
            )}
            {teams?.map(t => (
              <tr key={t.id} style={styles.tr}>
                <td style={styles.td}><strong>{t.name}</strong></td>
                <td style={styles.td}>{t.created_at?.slice(0, 10)}</td>
                <td style={styles.td}>
                  <button style={styles.editBtn} onClick={() => setEditTeam(t)}>Edit</button>
                  <button style={styles.deleteBtn} onClick={() => setDeleteTeam(t)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <TeamForm onSave={() => { setShowForm(false); refetch(); }} onCancel={() => setShowForm(false)} />}
      {editTeam && <TeamForm team={editTeam} onSave={() => { setEditTeam(null); refetch(); }} onCancel={() => setEditTeam(null)} />}

      {deleteTeam && (
        <ConfirmDialog
          message={`Delete team "${deleteTeam.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTeam(null)}
        />
      )}
    </div>
  );
}

const styles = {
  pageHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' },
  heading:    { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d', margin: 0 },
  newBtn:     { padding: '0.55rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' },
  tableWrap:  { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table:      { width: '100%', borderCollapse: 'collapse' },
  thead:      { background: '#f9fafb' },
  th:         { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' },
  tr:         { borderBottom: '1px solid #f3f4f6' },
  td:         { padding: '0.85rem 1rem', fontSize: '0.9rem', color: '#374151' },
  editBtn:    { padding: '3px 12px', background: '#d1fae5', color: '#014E20', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, marginRight: '0.4rem' },
  deleteBtn:  { padding: '3px 12px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#fff', borderRadius: '12px', padding: '2rem', width: '400px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalTitle: { fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' },
  form:       { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:      { fontSize: '0.85rem', fontWeight: 600, color: '#374151' },
  input:      { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', outline: 'none' },
  actions:    { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' },
  cancelBtn:  { padding: '0.5rem 1.25rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  saveBtn:    { padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  error:      { background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.9rem' },
};
