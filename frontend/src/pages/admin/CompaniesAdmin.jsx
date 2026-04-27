import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import client from '../../api/client';
import ConfirmDialog from '../../components/ConfirmDialog';

// ── New Company Form ───────────────────────────────────────────────────────────
function NewCompanyForm({ onCreated, onClose }) {
  const [name, setName]     = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError('');
    try {
      await client.post('/companies', { name: name.trim() });
      onCreated();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.errors?.name?.[0] ||
        err.response?.data?.message ||
        'Failed to create company'
      );
    } finally { setSaving(false); }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>New Company</h3>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Company Name</label>
          <input style={styles.input} type="text" value={name} required autoFocus
            onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp" />
          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={saving}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={saving || !name.trim()}>
              {saving ? 'Creating...' : 'Create Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Company Form ──────────────────────────────────────────────────────────
function EditCompanyForm({ company, onSaved, onClose }) {
  const [name, setName]     = useState(company.name);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError('');
    try {
      await client.put(`/companies/${company.id}`, { name: name.trim() });
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.errors?.name?.[0] ||
        err.response?.data?.message ||
        'Failed to update company'
      );
    } finally { setSaving(false); }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>Rename Company</h3>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Company Name</label>
          <input style={styles.input} type="text" value={name} required autoFocus
            onChange={e => setName(e.target.value)} />
          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={saving}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page-Access Permissions Panel ──────────────────────────────────────────────
function PermissionsPanel({ company, onClose }) {
  const { data: pages, loading } = useApi(`/companies/${company.id}/permissions`);
  const [localPerms, setLocalPerms] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [saveState, setSaveState]   = useState('idle'); // idle | saved | error

  useEffect(() => {
    if (pages) setLocalPerms(pages.map(p => ({ ...p })));
  }, [pages]);

  const toggle = (pageId) => {
    setLocalPerms(prev => prev.map(p =>
      p.page_id === pageId ? { ...p, can_view: !p.can_view } : p
    ));
    setSaveState('idle');
  };

  const toggleAll = (value) => {
    setLocalPerms(prev => prev.map(p => ({ ...p, can_view: value })));
    setSaveState('idle');
  };

  const handleSave = async () => {
    setSaving(true); setSaveState('idle');
    try {
      await client.put(`/companies/${company.id}/permissions`, {
        permissions: localPerms.map(p => ({ page_id: p.page_id, can_view: p.can_view })),
      });
      setSaveState('saved');
    } catch {
      setSaveState('error');
    } finally { setSaving(false); }
  };

  const mainPages  = localPerms?.filter(p => !p.page_slug.startsWith('admin.')) ?? [];
  const adminPages = localPerms?.filter(p =>  p.page_slug.startsWith('admin.')) ?? [];

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.modal, width: '520px', maxHeight: '85vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ ...styles.modalTitle, marginBottom: '0.25rem' }}>Page Access</h3>
            <div style={{ fontSize: '0.9rem', color: '#016D2D', fontWeight: 600 }}>{company.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>✕</button>
        </div>

        <p style={{ fontSize: '0.84rem', color: '#6b7280', marginBottom: '1rem', lineHeight: 1.5 }}>
          Users assigned to this company can only view pages toggled <strong>ON</strong>. Admin users are exempt from company restrictions.
        </p>

        {/* Quick actions */}
        {localPerms && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button onClick={() => toggleAll(true)}  style={styles.quickBtn}>Enable All</button>
            <button onClick={() => toggleAll(false)} style={styles.quickBtn}>Disable All</button>
          </div>
        )}

        {loading || !localPerms ? (
          <div style={{ color: '#6b7280', padding: '1rem 0', textAlign: 'center' }}>Loading pages…</div>
        ) : (
          <>
            {/* Main pages */}
            <div style={styles.permSection}>Main Pages</div>
            {mainPages.map(p => (
              <PermRow key={p.page_id} page={p} onToggle={toggle} />
            ))}

            {/* Admin pages */}
            {adminPages.length > 0 && (
              <>
                <div style={{ ...styles.permSection, marginTop: '1rem' }}>Admin Pages</div>
                {adminPages.map(p => (
                  <PermRow key={p.page_id} page={p} onToggle={toggle} />
                ))}
              </>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: '0.82rem', color: saveState === 'saved' ? '#016D2D' : saveState === 'error' ? '#991b1b' : 'transparent' }}>
            {saveState === 'saved' ? '✓ Permissions saved' : saveState === 'error' ? '✗ Save failed' : '·'}
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={onClose} style={styles.cancelBtn}>Close</button>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !localPerms}>
              {saving ? 'Saving…' : 'Save Permissions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PermRow({ page, onToggle }) {
  return (
    <div style={styles.permRow}>
      <span style={{ fontSize: '0.9rem', color: '#374151' }}>{page.page_name}</span>
      <button
        onClick={() => onToggle(page.page_id)}
        style={{ ...styles.toggle, background: page.can_view ? '#016D2D' : '#d1d5db' }}
        title={page.can_view ? 'Click to disable' : 'Click to enable'}
      >
        <span style={{
          ...styles.toggleKnob,
          transform: page.can_view ? 'translateX(20px)' : 'translateX(2px)',
        }} />
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CompaniesAdmin() {
  const { data: companies, loading, refetch } = useApi('/companies');
  const [showNew, setShowNew]           = useState(false);
  const [editCompany, setEditCompany]   = useState(null);
  const [deleteCompany, setDeleteCompany] = useState(null);
  const [permCompany, setPermCompany]   = useState(null);

  const handleDelete = async () => {
    await client.delete(`/companies/${deleteCompany.id}`);
    setDeleteCompany(null);
    refetch();
  };

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading…</div>;

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.heading}>Companies</h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.3rem' }}>
            Create client companies, assign users, and control which pages each company can access.
          </p>
        </div>
        <button style={styles.newBtn} onClick={() => setShowNew(true)}>+ New Company</button>
      </div>

      {companies?.length === 0 ? (
        <div style={styles.empty}>
          No companies yet. Create one to start assigning users and controlling page access.
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Company</th>
                <th style={styles.th}>Users</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies?.map(c => (
                <tr key={c.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 600 }}>{c.name}</td>
                  <td style={styles.td}>
                    <span style={styles.countBadge}>{c.users_count ?? 0} user{c.users_count !== 1 ? 's' : ''}</span>
                  </td>
                  <td style={styles.td}>{c.created_at?.slice(0, 10)}</td>
                  <td style={styles.td}>
                    <button style={styles.accessBtn} onClick={() => setPermCompany(c)}>Page Access</button>
                    <button style={styles.editBtn}   onClick={() => setEditCompany(c)}>Rename</button>
                    <button style={styles.deleteBtn} onClick={() => setDeleteCompany(c)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew       && <NewCompanyForm onCreated={refetch} onClose={() => setShowNew(false)} />}
      {editCompany   && <EditCompanyForm company={editCompany} onSaved={refetch} onClose={() => setEditCompany(null)} />}
      {permCompany   && <PermissionsPanel company={permCompany} onClose={() => setPermCompany(null)} />}
      {deleteCompany && (
        <ConfirmDialog
          message={`Delete "${deleteCompany.name}"? Users assigned to this company will be unlinked but not deleted.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteCompany(null)}
        />
      )}
    </div>
  );
}

const styles = {
  pageHeader:  { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', gap: '1rem' },
  heading:     { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d', margin: 0 },
  newBtn:      { padding: '0.55rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
  empty:       { background: '#f9fafb', borderRadius: '12px', padding: '3rem', textAlign: 'center', color: '#6b7280', fontSize: '0.95rem', border: '1px dashed #d1d5db' },
  tableWrap:   { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table:       { width: '100%', borderCollapse: 'collapse' },
  thead:       { background: '#f9fafb' },
  th:          { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' },
  tr:          { borderBottom: '1px solid #f3f4f6' },
  td:          { padding: '0.85rem 1rem', fontSize: '0.9rem', color: '#374151' },
  countBadge:  { background: '#f3f4f6', borderRadius: '4px', padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600, color: '#374151' },
  accessBtn:   { padding: '3px 10px', background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, marginRight: '0.4rem' },
  editBtn:     { padding: '3px 10px', background: '#d1fae5', color: '#014E20', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, marginRight: '0.4rem' },
  deleteBtn:   { padding: '3px 10px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  // modal shared
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:       { background: '#fff', borderRadius: '12px', padding: '2rem', width: '440px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalTitle:  { fontSize: '1.15rem', fontWeight: 700, margin: 0 },
  form:        { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:       { fontSize: '0.85rem', fontWeight: 600, color: '#374151' },
  input:       { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', outline: 'none' },
  actions:     { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' },
  cancelBtn:   { padding: '0.5rem 1.25rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  saveBtn:     { padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  error:       { background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.25rem', fontSize: '0.9rem' },
  // permissions panel
  permSection: { fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: '0.4rem', borderBottom: '1px solid #e5e7eb', marginBottom: '0.25rem' },
  permRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0', borderBottom: '1px solid #f9fafb' },
  toggle:      { width: '42px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', padding: 0, flexShrink: 0 },
  toggleKnob:  { position: 'absolute', top: '4px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'transform 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
  quickBtn:    { padding: '3px 10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
};
