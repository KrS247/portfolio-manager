import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import client from '../../api/client';
import { clearPermissionsCache } from '../../hooks/usePermissions';

const LEVELS = ['none', 'view', 'edit'];

export default function PermissionsAdmin() {
  const { data, loading, refetch } = useApi('/permissions');
  const [matrix, setMatrix] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data?.matrix) setMatrix(JSON.parse(JSON.stringify(data.matrix))); }, [data]);

  const handleChange = (roleId, pageId, value) => {
    setMatrix(m => ({ ...m, [roleId]: { ...(m[roleId] || {}), [pageId]: value } }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = [];
    for (const roleId of Object.keys(matrix)) {
      for (const pageId of Object.keys(matrix[roleId])) {
        updates.push({ role_id: parseInt(roleId), page_id: parseInt(pageId), access_level: matrix[roleId][pageId] });
      }
    }
    await client.put('/permissions', { updates });
    clearPermissionsCache();
    setSaved(true);
    setSaving(false);
    refetch();
  };

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading...</div>;
  if (!data)   return null;

  const { roles, pages } = data;
  const adminRoles = roles.filter(r => r.is_admin);
  const normalRoles = roles.filter(r => !r.is_admin);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d' }}>Permissions Matrix</h1>
          <p style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: '0.25rem' }}>Configure per-page access for each role. Admin roles always have full access.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {saved && <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.9rem' }}>Saved!</span>}
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.5rem 1.5rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {adminRoles.length > 0 && (
        <div style={{ background: '#fef3c7', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.88rem', color: '#92400e' }}>
          Admin roles ({adminRoles.map(r => r.name).join(', ')}) bypass the permission matrix and always have full access to all pages.
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={styles.th}>Page</th>
              {normalRoles.map(role => (
                <th key={role.id} style={{ ...styles.th, textAlign: 'center' }}>{role.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pages.map(page => (
              <tr key={page.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ ...styles.td, fontWeight: 600 }}>
                  <div>{page.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace', fontWeight: 400 }}>{page.slug}</div>
                </td>
                {normalRoles.map(role => {
                  const current = matrix[role.id]?.[page.id] || 'none';
                  return (
                    <td key={role.id} style={{ ...styles.td, textAlign: 'center' }}>
                      <select
                        value={current}
                        onChange={e => handleChange(role.id, page.id, e.target.value)}
                        style={{
                          padding: '4px 8px', borderRadius: '5px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', outline: 'none',
                          border: '1.5px solid #d1d5db',
                          background: current === 'edit' ? '#d1fae5' : current === 'view' ? '#dbeafe' : '#f3f4f6',
                          color: current === 'edit' ? '#065f46' : current === 'view' ? '#1e40af' : '#6b7280',
                        }}
                      >
                        {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' },
  td: { padding: '0.85rem 1rem', fontSize: '0.9rem', color: '#374151' },
};
