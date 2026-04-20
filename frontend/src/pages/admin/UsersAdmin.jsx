import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import client from '../../api/client';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';

// ── New User Form ──────────────────────────────────────────────────────────────
function NewUserForm({ roles, teams, onCreated, onClose }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', role_id: '', hourly_rate: '', team: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { username: form.username.trim(), email: form.email.trim(), password: form.password };
      if (form.role_id) payload.role_id = parseInt(form.role_id);
      if (form.hourly_rate !== '') payload.hourly_rate = parseFloat(form.hourly_rate);
      if (form.team.trim()) payload.team = form.team.trim();
      await client.post('/users', payload);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create user');
    } finally { setSaving(false); }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>New User</h3>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Username</label>
          <input style={styles.input} type="text" value={form.username} required autoFocus
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />

          <label style={styles.label}>Email</label>
          <input style={styles.input} type="email" value={form.email} required
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />

          <label style={styles.label}>Password</label>
          <input style={styles.input} type="password" value={form.password} required minLength={8}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 8 characters" />

          <label style={styles.label}>Role</label>
          <select style={styles.input} value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}>
            <option value="">Default (member)</option>
            {roles?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <label style={styles.label}>Hourly Rate (USD/hr) <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
          <input style={styles.input} type="number" min="0" step="0.01" value={form.hourly_rate}
            onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="e.g. 75.00" />

          <label style={styles.label}>Team <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
          <select style={styles.input} value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))}>
            <option value="">No team</option>
            {teams?.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={saving}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={saving}>{saving ? 'Creating...' : 'Create User'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit User Form ─────────────────────────────────────────────────────────────
function EditUserForm({ user: editUser, roles, teams, onSaved, onClose }) {
  const [form, setForm] = useState({ email: editUser.email, role_id: editUser.role_id, password: '', hourly_rate: editUser.hourly_rate ?? '', team_id: editUser.team_id ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { email: form.email, role_id: parseInt(form.role_id) };
      if (form.password) payload.password = form.password;
      if (form.hourly_rate !== '') payload.hourly_rate = parseFloat(form.hourly_rate);
      payload.team_id = form.team_id ? parseInt(form.team_id) : null;
      await client.put(`/users/${editUser.id}`, payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save changes');
    } finally { setSaving(false); }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>Edit User: {editUser.username}</h3>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Email</label>
          <input style={styles.input} type="email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />

          <label style={styles.label}>Role</label>
          <select style={styles.input} value={form.role_id}
            onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}>
            {roles?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <label style={styles.label}>Team <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
          <select style={styles.input} value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}>
            <option value="">No team</option>
            {teams?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <label style={styles.label}>New Password <span style={{ fontWeight: 400, color: '#9ca3af' }}>(leave blank to keep current)</span></label>
          <input style={styles.input} type="password" value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="New password (optional)" />

          <label style={styles.label}>Hourly Rate (USD/hr)</label>
          <input style={styles.input} type="number" min="0" step="0.01" value={form.hourly_rate}
            onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="e.g. 75.00" />

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={saving}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function UsersAdmin() {
  const { user: me } = useAuth();
  const { data: users, loading, refetch } = useApi('/users');
  const { data: roles } = useApi('/roles');
  const { data: teams } = useApi('/teams');
  const [editUser, setEditUser]   = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [showNew, setShowNew]     = useState(false);

  const handleDelete = async () => {
    await client.delete(`/users/${deleteUser.id}`);
    setDeleteUser(null);
    refetch();
  };

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading...</div>;

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.heading}>User Administration</h1>
        <button style={styles.newBtn} onClick={() => setShowNew(true)}>+ New User</button>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th style={styles.th}>Username</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Hourly Rate</th>
              <th style={styles.th}>Created</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map(u => (
              <tr key={u.id} style={styles.tr}>
                <td style={styles.td}>
                  <strong>{u.username}</strong>
                  {u.id === me?.id && <span style={styles.meBadge}> (you)</span>}
                </td>
                <td style={styles.td}>{u.email}</td>
                <td style={styles.td}>
                  <span style={{ ...styles.roleBadge, background: u.is_admin ? '#fef3c7' : '#f3f4f6' }}>
                    {u.role_name}
                  </span>
                </td>
                <td style={styles.td}>
                  {u.hourly_rate != null ? `$${parseFloat(u.hourly_rate).toFixed(2)}/hr` : <span style={{ color: '#9ca3af' }}>—</span>}
                </td>
                <td style={styles.td}>{u.created_at?.slice(0, 10)}</td>
                <td style={styles.td}>
                  <button style={styles.editBtn} onClick={() => setEditUser(u)}>Edit</button>
                  {u.id !== me?.id && (
                    <button style={styles.deleteBtn} onClick={() => setDeleteUser(u)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <NewUserForm
          roles={roles}
          teams={teams}
          onCreated={refetch}
          onClose={() => setShowNew(false)}
        />
      )}

      {editUser && (
        <EditUserForm
          user={editUser}
          roles={roles}
          teams={teams}
          onSaved={refetch}
          onClose={() => setEditUser(null)}
        />
      )}

      {deleteUser && (
        <ConfirmDialog
          message={`Delete user "${deleteUser.username}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteUser(null)}
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
  meBadge:    { color: '#6b7280', fontWeight: 400, fontSize: '0.8rem' },
  roleBadge:  { padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, textTransform: 'capitalize' },
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
