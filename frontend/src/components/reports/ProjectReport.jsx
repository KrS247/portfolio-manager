import { useState, useEffect } from 'react';
import client from '../../api/client';

const fmt = (n) => n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtN = (n, dp = 2) => n == null ? '—' : Number(n).toFixed(dp);
const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const STATUS_COLOR  = { active: '#16a34a', on_hold: '#d97706', closed: '#6b7280', completed: '#2563eb' };
const TASK_STATUS_COLOR = { open: '#6b7280', in_progress: '#2563eb', completed: '#16a34a', cancelled: '#9ca3af' };
const HEALTH_COLOR  = { on_track: '#16a34a', at_risk: '#d97706', critical: '#dc2626' };
const PRIORITY_COLOR = (p) => p >= 8 ? '#dc2626' : p >= 5 ? '#d97706' : '#16a34a';

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0A2B14', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.4rem', marginBottom: '1rem' }}>{title}</div>
      {children}
    </div>
  );
}

function KPI({ label, value, color, sub }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '1rem', borderLeft: `4px solid ${color || '#0A2B14'}` }}>
      <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: color || '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.15rem' }}>{sub}</div>}
    </div>
  );
}

export default function ProjectReport({ parentType, parentId }) {
  const [project, setProject]   = useState(null);
  const [evm, setEvm]           = useState(null);
  const [risks, setRisks]       = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      client.get(`/projects/${parentId}`),
      client.get(`/evm?parent_type=project&parent_id=${parentId}`),
      client.get(`/reports/risks?parent_type=project&parent_id=${parentId}`),
      client.get(`/reports/resource-utilisation?parent_type=project&parent_id=${parentId}`),
    ])
      .then(([pjRes, evmRes, rRes, resRes]) => {
        setProject(pjRes.data);
        setEvm(evmRes.data);
        setRisks(rRes.data || []);
        setResources(resRes.data || []);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [parentId]);

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading report…</div>;
  if (error)   return <div style={{ padding: '2rem', color: '#dc2626' }}>Error: {error}</div>;
  if (!project) return null;

  const s = evm?.summary || {};
  const tasks = evm?.tasks || [];

  return (
    <div className="report-page" style={{ background: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #0A2B14', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00FFBC', background: '#0A2B14', display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>PROJECT REPORT</div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0A2B14' }}>{project.name}</h1>
          {project.description && <p style={{ margin: '0.4rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>{project.description}</p>}
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#6b7280', flexWrap: 'wrap' }}>
            <span>Status: <strong style={{ color: STATUS_COLOR[project.status] || '#111' }}>{project.status?.replace('_',' ').toUpperCase()}</strong></span>
            {s.health && <span>Health: <strong style={{ color: HEALTH_COLOR[s.health] }}>{s.health?.replace('_',' ').toUpperCase()}</strong></span>}
            {project.start_date && <span>Start: <strong>{project.start_date}</strong></span>}
            {project.end_date   && <span>End: <strong>{project.end_date}</strong></span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#9ca3af' }}>
          <div style={{ fontWeight: 700, color: '#0A2B14', fontSize: '0.9rem' }}>Portfolio Manager</div>
          <div>Generated: {today}</div>
        </div>
      </div>

      {/* EVM KPIs */}
      <Section title="Earned Value Summary">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          <KPI label="BAC"  value={fmt(s.bac)} color="#0A2B14" />
          <KPI label="EAC"  value={fmt(s.eac)} color={s.eac > s.bac ? '#dc2626' : '#16a34a'} />
          <KPI label="EV"   value={fmt(s.ev)}  color="#2563eb" />
          <KPI label="AC"   value={fmt(s.ac)}  color="#7c3aed" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <KPI label="CPI"  value={fmtN(s.cpi)} color={!s.cpi || s.cpi < 1 ? '#dc2626' : '#16a34a'} sub="≥1.0 = under budget" />
          <KPI label="SPI"  value={fmtN(s.spi)} color={!s.spi || s.spi < 1 ? '#d97706' : '#16a34a'} sub="≥1.0 = on schedule" />
          <KPI label="VAC"  value={fmt(s.vac)}  color={s.vac < 0 ? '#dc2626' : '#16a34a'} sub="Variance at Completion" />
          <KPI label="ETC"  value={fmt(s.etc)}  color="#374151" sub="Estimate to Complete" />
        </div>
      </Section>

      {/* Tasks Table */}
      {tasks.length > 0 && (
        <Section title={`Tasks (${tasks.length})`}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['Task', 'Status', 'Due Date', '% Done', 'BAC', 'EV', 'AC', 'CPI', 'SPI'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={t.task_id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.task_title}</td>
                  <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: TASK_STATUS_COLOR[t.status] || '#374151' }}>{t.status?.replace('_',' ').toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed' ? '#dc2626' : '#6b7280' }}>{t.due_date || '—'}</td>
                  <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6' }}>{t.pct_complete ?? 0}%</td>
                  <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6' }}>{fmt(t.bac)}</td>
                  <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6' }}>{fmt(t.ev)}</td>
                  <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6' }}>{fmt(t.ac)}</td>
                  <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: !t.cpi || t.cpi < 1 ? '#dc2626' : '#16a34a' }}>{fmtN(t.cpi)}</td>
                  <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: !t.spi || t.spi < 1 ? '#d97706' : '#16a34a' }}>{fmtN(t.spi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Resource Utilisation */}
      {resources.length > 0 && (
        <Section title={`Resource Utilisation (${resources.length} resources)`}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['Resource', 'Est. Hours', 'Act. Hours', 'Util %', 'Est. Cost', 'Act. Cost', 'Status'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map((r, i) => (
                <tr key={r.user_id || i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', ...(r.over_budget ? { background: '#fff5f5' } : {}) }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>{r.user_name}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{r.estimated_hours}h</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: r.over_budget ? '#dc2626' : '#111' }}>{r.actual_hours}h</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                    {r.utilisation_pct != null
                      ? <span style={{ fontWeight: 600, color: r.utilisation_pct > 110 ? '#dc2626' : r.utilisation_pct > 90 ? '#d97706' : '#16a34a' }}>{r.utilisation_pct}%</span>
                      : '—'
                    }
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{fmt(r.estimated_cost)}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: r.over_budget ? '#dc2626' : '#111' }}>{fmt(r.actual_cost)}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: r.over_budget ? '#dc2626' : '#16a34a' }}>
                      {r.over_budget ? 'OVER BUDGET' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Risks */}
      {risks.length > 0 && (
        <Section title={`Risk Register (${risks.length} risks)`}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['Risk', 'Task', 'P×I', 'Rate', 'Status', 'Mitigation'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risks.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || r.description?.slice(0,30) || '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#6b7280', borderBottom: '1px solid #f3f4f6', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.task_title}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{r.probability}×{r.impact}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: r.risk_rate > 15 ? '#dc2626' : r.risk_rate > 10 ? '#d97706' : '#16a34a' }}>{r.risk_rate}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.72rem', fontWeight: 600, color: r.risk_rate > 15 ? '#dc2626' : r.risk_rate > 10 ? '#d97706' : '#16a34a' }}>{r.risk_status}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.mitigation_plan || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Footer */}
      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#9ca3af' }}>
        <span>Portfolio Manager — Confidential</span>
        <span>Generated {today}</span>
      </div>
    </div>
  );
}
