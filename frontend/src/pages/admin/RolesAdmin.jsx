import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import client from '../../api/client';
import ConfirmDialog from '../../components/ConfirmDialog';

function RoleForm({ role, onSave, onCancel }) {
  const [form, setForm] = useState({ name: role?.name || '', description: role?.description || '', is_admin: role?.is_admin || 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      role ? await client.put(`/roles/${role.id}`, form) : await client.post('/roles', form);
      onSave();
    } catch (err) { setError(err.response?.data?.error?.message || 'Failed'); } finally { setSaving(false); }
  };
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>{role ? 'Edit Role' : 'New Role'}</h3>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Name *</label>
          <input style={styles.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <label style={styles.label}>Description</label>
          <input style={styles.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.is_admin} onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked ? 1 : 0 }))} />
            Grant full admin access (bypasses all permission checks)
          </label>
          <div style={styles.actions}><button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={saving}>Cancel</button><button type="submit" style={styles.saveBtn} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></div>
        </form>
      </div>
    </div>
  );
}

export default function RolesAdmin() {
  const { data: roles, loading, refetch } = useApi('/roles');
  const [showForm, setShowForm] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [deleteRole, setDeleteRole] = useState(null);

  const handleDelete = async () => {
    try { await client.delete(`/roles/${deleteRole.id}`); setDeleteRole(null); refetch(); }
    catch (err) { alert(err.response?.data?.error?.message || 'Failed to delete'); setDeleteRole(null); }
  };

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={styles.heading}>Role Administration</h1>
        <button style={styles.addBtn} onClick={() => setShowForm(true)}>+ New Role</button>
      </div>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead><tr style={styles.thead}>
            <th style={styles.th}>Name</th><th style={styles.th}>Description</th><th style={styles.th}>Admin</th><th style={styles.th}>Actions</th>
          </tr></thead>
          <tbody>
            {roles?.map(r => (
              <tr key={r.id} style={styles.tr}>
                <td style={styles.td}><strong>{r.name}</strong></td>
                <td style={styles.td}>{r.description || '—'}</td>
                <td style={styles.td}>{r.is_admin ? <span style={{ color: '#d97706', fontWeight: 700 }}>Yes</span> : 'No'}</td>
                <td style={styles.td}>
                  <button style={styles.editBtn} onClick={() => setEditRole(r)}>Edit</button>
                  {r.name !== 'admin' && <button style={styles.deleteBtn} onClick={() => setDeleteRole(r)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(showForm || editRole) && <RoleForm role={editRole} onSave={() => { setShowForm(false); setEditRole(null); refetch(); }} onCancel={() => { setShowForm(false); setEditRole(null); }} />}
      {deleteRole && <ConfirmDialog message={`Delete role "${deleteRole.name}"? Users with this role must be reassigned first.`} onConfirm={handleDelete} onCancel={() => setDeleteRole(null)} />}
    </div>
  );
}

const styles = {
  heading:    { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d' },
  addBtn:     { padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 },
  tableWrap:  { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table:      { width: '100%', borderCollapse: 'collapse' },
  thead:      { background: '#f9fafb' },
  th:         { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' },
  tr:         { borderBottom: '1px solid #f3f4f6' },
  td:         { padding: '0.85rem 1rem', fontSize: '0.9rem', color: '#374151' },
  editBtn:    { padding: '3px 12px', background: '#d1fae5', color: '#014E20', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, marginRight: '0.4rem' },
  deleteBtn:  { padding: '3px 12px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
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
