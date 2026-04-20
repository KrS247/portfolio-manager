import { useState, useEffect } from 'react';
import client from '../../api/client';

const fmt = (n) => n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0A2B14', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.4rem', marginBottom: '1rem' }}>{title}</div>
      {children}
    </div>
  );
}

// Simple horizontal bar chart per user
function UtilBar({ est, act, max }) {
  const W = 200;
  const estW = max > 0 ? (est / max) * W : 0;
  const actW = max > 0 ? (act / max) * W : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: `${estW}px`, height: '8px', background: '#6b7280', borderRadius: '4px', minWidth: '2px' }} />
        <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{est}h</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: `${actW}px`, height: '8px', background: act > est ? '#dc2626' : '#016D2D', borderRadius: '4px', minWidth: '2px' }} />
        <span style={{ fontSize: '0.7rem', color: act > est ? '#dc2626' : '#016D2D' }}>{act}h</span>
      </div>
    </div>
  );
}

export default function ResourceReport({ parentType, parentId }) {
  const [resources, setResources] = useState([]);
  const [expanded, setExpanded]   = useState({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    setLoading(true);
    client.get(`/reports/resource-utilisation?parent_type=${parentType}&parent_id=${parentId}`)
      .then(res => setResources(res.data || []))
      .catch(e => setError(e.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [parentType, parentId]);

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading resource report…</div>;
  if (error)   return <div style={{ padding: '2rem', color: '#dc2626' }}>Error: {error}</div>;

  if (resources.length === 0) {
    return (
      <div className="report-page" style={{ background: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No resource data found for this scope. Assign resources to tasks to generate this report.</div>
      </div>
    );
  }

  const totalEst   = resources.reduce((a, r) => a + r.estimated_hours, 0);
  const totalAct   = resources.reduce((a, r) => a + r.actual_hours, 0);
  const totalEstC  = resources.reduce((a, r) => a + r.estimated_cost, 0);
  const totalActC  = resources.reduce((a, r) => a + r.actual_cost, 0);
  const overBudget = resources.filter(r => r.over_budget).length;
  const maxHours   = Math.max(...resources.map(r => Math.max(r.estimated_hours, r.actual_hours)));

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  return (
    <div className="report-page" style={{ background: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #0A2B14', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00FFBC', background: '#0A2B14', display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>RESOURCE UTILISATION REPORT</div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0A2B14' }}>Resource Utilisation</h1>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.4rem' }}>Scope: <strong style={{ textTransform: 'capitalize' }}>{parentType}</strong> · {resources.length} resources</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#9ca3af' }}>
          <div style={{ fontWeight: 700, color: '#0A2B14', fontSize: '0.9rem' }}>Portfolio Manager</div>
          <div>Generated: {today}</div>
        </div>
      </div>

      {/* Summary */}
      <Section title="Summary">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '1rem', borderLeft: '4px solid #0A2B14' }}>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>Total Resources</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0A2B14' }}>{resources.length}</div>
          </div>
          <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '1rem', borderLeft: '4px solid #6b7280' }}>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>Est. Hours / Act. Hours</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#374151' }}>{totalEst.toFixed(0)}h / {totalAct.toFixed(0)}h</div>
          </div>
          <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '1rem', borderLeft: '4px solid #2563eb' }}>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>Est. Cost / Act. Cost</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: totalActC > totalEstC ? '#dc2626' : '#374151' }}>{fmt(totalEstC)} / {fmt(totalActC)}</div>
          </div>
          <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '1rem', borderLeft: `4px solid ${overBudget > 0 ? '#dc2626' : '#16a34a'}` }}>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>Over Budget</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: overBudget > 0 ? '#dc2626' : '#16a34a' }}>{overBudget}</div>
          </div>
        </div>
      </Section>

      {/* Per-resource table */}
      <Section title="Resource Detail">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              {['Resource', 'Rate/hr', 'Est. Hours', 'Act. Hours', 'Utilisation', 'Est. Cost', 'Act. Cost', 'Status'].map(h => (
                <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map((r, i) => (
              <>
                <tr
                  key={r.user_id || i}
                  style={{ background: r.over_budget ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#f9fafb', cursor: r.tasks?.length > 0 ? 'pointer' : 'default' }}
                  onClick={() => r.tasks?.length > 0 && toggle(r.user_id || i)}
                >
                  <td style={{ padding: '0.55rem 0.75rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>
                    {r.tasks?.length > 0 && <span style={{ marginRight: '0.4rem', fontSize: '0.7rem', color: '#9ca3af' }}>{expanded[r.user_id || i] ? '▼' : '▶'}</span>}
                    {r.user_name}
                  </td>
                  <td style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{r.hourly_rate > 0 ? `$${r.hourly_rate}/hr` : '—'}</td>
                  <td style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{r.estimated_hours}h</td>
                  <td style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: r.over_budget ? '#dc2626' : '#111', fontWeight: r.over_budget ? 700 : 400 }}>{r.actual_hours}h</td>
                  <td style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                    {r.utilisation_pct != null
                      ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '80px', height: '6px', background: '#e5e7eb', borderRadius: '3px', flexShrink: 0 }}>
                            <div style={{ width: `${Math.min(100, r.utilisation_pct)}%`, height: '100%', background: r.utilisation_pct > 110 ? '#dc2626' : r.utilisation_pct > 90 ? '#d97706' : '#016D2D', borderRadius: '3px' }} />
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: r.utilisation_pct > 110 ? '#dc2626' : r.utilisation_pct > 90 ? '#d97706' : '#16a34a' }}>{r.utilisation_pct}%</span>
                        </div>
                      : '—'
                    }
                  </td>
                  <td style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{fmt(r.estimated_cost)}</td>
                  <td style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: r.over_budget ? '#dc2626' : '#111' }}>{fmt(r.actual_cost)}</td>
                  <td style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', background: r.over_budget ? '#fee2e2' : '#dcfce7', color: r.over_budget ? '#dc2626' : '#16a34a' }}>
                      {r.over_budget ? 'OVER BUDGET' : 'OK'}
                    </span>
                  </td>
                </tr>
                {expanded[r.user_id || i] && r.tasks?.map(t => (
                  <tr key={t.task_id} style={{ background: '#f9fafb' }}>
                    <td style={{ padding: '0.4rem 0.75rem 0.4rem 2rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280', fontSize: '0.78rem' }}>↳ {t.task_title}</td>
                    <td style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid #f3f4f6' }} />
                    <td style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280', fontSize: '0.78rem' }}>{t.estimated_hours}h</td>
                    <td style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: t.actual_hours > t.estimated_hours ? '#dc2626' : '#6b7280', fontSize: '0.78rem' }}>{t.actual_hours}h</td>
                    <td colSpan="2" style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280', fontSize: '0.78rem' }}>{fmt(t.estimated_cost)}</td>
                    <td style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: t.actual_cost > t.estimated_cost ? '#dc2626' : '#6b7280', fontSize: '0.78rem' }}>{fmt(t.actual_cost)}</td>
                    <td style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid #f3f4f6' }} />
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Footer */}
      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#9ca3af' }}>
        <span>Portfolio Manager — Resource Utilisation Report — Confidential</span>
        <span>Generated {today}</span>
      </div>
    </div>
  );
}
