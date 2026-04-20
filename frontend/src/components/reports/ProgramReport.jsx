import { useState, useEffect } from 'react';
import client from '../../api/client';

const fmt = (n) => n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtN = (n, dp = 2) => n == null ? '—' : Number(n).toFixed(dp);
const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const STATUS_COLOR = { active: '#16a34a', on_hold: '#d97706', closed: '#6b7280', completed: '#2563eb' };
const HEALTH_COLOR = { on_track: '#16a34a', at_risk: '#d97706', critical: '#dc2626' };

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
      <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: color || '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.15rem' }}>{sub}</div>}
    </div>
  );
}

export default function ProgramReport({ parentType, parentId }) {
  const [program, setProgram] = useState(null);
  const [evm, setEvm]         = useState(null);
  const [risks, setRisks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      client.get(`/programs/${parentId}`),
      client.get(`/evm?parent_type=program&parent_id=${parentId}`),
      client.get(`/reports/risks?parent_type=program&parent_id=${parentId}`),
    ])
      .then(([pRes, evmRes, rRes]) => {
        setProgram(pRes.data);
        setEvm(evmRes.data);
        setRisks(rRes.data || []);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [parentId]);

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading report…</div>;
  if (error)   return <div style={{ padding: '2rem', color: '#dc2626' }}>Error: {error}</div>;
  if (!program) return null;

  const s = evm?.summary || {};
  const tasks = evm?.tasks || [];
  const projects = program.projects || [];

  const taskStats = {
    total:       tasks.length,
    completed:   tasks.filter(t => t.status === 'completed').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    open:        tasks.filter(t => t.status === 'open').length,
    overdue:     tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length,
  };
  const criticalRisks = risks.filter(r => r.risk_rate > 15).length;
  const highRisks     = risks.filter(r => r.risk_rate > 10 && r.risk_rate <= 15).length;

  return (
    <div className="report-page" style={{ background: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #0A2B14', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00FFBC', background: '#0A2B14', display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>PROGRAM REPORT</div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0A2B14' }}>{program.name}</h1>
          {program.description && <p style={{ margin: '0.4rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>{program.description}</p>}
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
            <span>Status: <strong style={{ color: STATUS_COLOR[program.status] || '#111' }}>{program.status?.replace('_',' ').toUpperCase()}</strong></span>
            {s.health && <span>EVM Health: <strong style={{ color: HEALTH_COLOR[s.health] }}>{s.health?.replace('_',' ').toUpperCase()}</strong></span>}
            {program.start_date && <span>Start: <strong>{program.start_date}</strong></span>}
            {program.end_date   && <span>End: <strong>{program.end_date}</strong></span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#9ca3af' }}>
          <div style={{ fontWeight: 700, color: '#0A2B14', fontSize: '0.9rem' }}>Portfolio Manager</div>
          <div>Generated: {today}</div>
        </div>
      </div>

      {/* KPIs */}
      <Section title="EVM Summary">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          <KPI label="BAC"  value={fmt(s.bac)} color="#0A2B14" />
          <KPI label="EAC"  value={fmt(s.eac)} color={s.eac > s.bac ? '#dc2626' : '#16a34a'} />
          <KPI label="EV"   value={fmt(s.ev)}  color="#2563eb" />
          <KPI label="AC"   value={fmt(s.ac)}  color="#7c3aed" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <KPI label="CPI"  value={fmtN(s.cpi)} color={s.cpi < 1 ? '#dc2626' : '#16a34a'} sub="Cost Performance" />
          <KPI label="SPI"  value={fmtN(s.spi)} color={s.spi < 1 ? '#d97706' : '#16a34a'} sub="Schedule Performance" />
          <KPI label="VAC"  value={fmt(s.vac)}  color={s.vac < 0 ? '#dc2626' : '#16a34a'} sub="Variance at Completion" />
          <KPI label="TCPI" value={fmtN(s.tcpi)} color="#374151" sub="To-Complete Perf Index" />
        </div>
      </Section>

      {/* Task Stats */}
      <Section title="Task Overview">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
          {[
            { label: 'Total',       value: taskStats.total,       color: '#374151' },
            { label: 'Completed',   value: taskStats.completed,   color: '#16a34a' },
            { label: 'In Progress', value: taskStats.in_progress, color: '#2563eb' },
            { label: 'Open',        value: taskStats.open,        color: '#6b7280' },
            { label: 'Overdue',     value: taskStats.overdue,     color: '#dc2626' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#f9fafb', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Projects */}
      {projects.length > 0 && (
        <Section title={`Projects (${projects.length})`}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['Project Name', 'Status', 'Start', 'End', 'Progress'].map(h => (
                  <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>{p.name}</td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: STATUS_COLOR[p.status] || '#111', fontWeight: 600, fontSize: '0.78rem' }}>{p.status?.replace('_',' ').toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>{p.start_date || '—'}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>{p.end_date || '—'}</td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                    {p.completion_percentage != null
                      ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px' }}>
                            <div style={{ width: `${p.completion_percentage}%`, height: '100%', background: '#016D2D', borderRadius: '3px' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{p.completion_percentage}%</span>
                        </div>
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Risk Summary */}
      {risks.length > 0 && (
        <Section title={`Risk Summary (${risks.length} risks)`}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            {criticalRisks > 0 && <div style={{ padding: '0.5rem 1rem', background: '#fee2e2', borderRadius: '8px', color: '#dc2626', fontWeight: 700, fontSize: '0.85rem' }}>🔴 {criticalRisks} Critical</div>}
            {highRisks > 0 && <div style={{ padding: '0.5rem 1rem', background: '#fef3c7', borderRadius: '8px', color: '#d97706', fontWeight: 700, fontSize: '0.85rem' }}>🟠 {highRisks} High</div>}
            <div style={{ padding: '0.5rem 1rem', background: '#f3f4f6', borderRadius: '8px', color: '#6b7280', fontWeight: 700, fontSize: '0.85rem' }}>Total: {risks.length}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['Risk', 'Task', 'P', 'I', 'Rate', 'Status', 'Mitigation'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risks.slice(0, 10).map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || r.description?.slice(0, 30) || '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.task_title}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{r.probability}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{r.impact}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: r.risk_rate > 15 ? '#dc2626' : r.risk_rate > 10 ? '#d97706' : '#16a34a' }}>{r.risk_rate}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.75rem', color: r.risk_rate > 15 ? '#dc2626' : r.risk_rate > 10 ? '#d97706' : '#16a34a', fontWeight: 600 }}>{r.risk_status}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.mitigation_plan || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {risks.length > 10 && <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#9ca3af' }}>Showing top 10 of {risks.length} risks. Use Risk Register report for full list.</div>}
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
