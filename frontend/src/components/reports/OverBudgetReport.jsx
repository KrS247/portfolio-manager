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

export default function OverBudgetReport({ parentType, parentId }) {
  const [evmTasks, setEvmTasks] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    setLoading(true);
    client.get(`/evm?parent_type=${parentType}&parent_id=${parentId}`)
      .then(res => setEvmTasks(res.data?.tasks || []))
      .catch(e => setError(e.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [parentType, parentId]);

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading over-budget report…</div>;
  if (error)   return <div style={{ padding: '2rem', color: '#dc2626' }}>Error: {error}</div>;

  // Over budget: AC > EV (negative cost variance)
  const overBudget = evmTasks
    .filter(t => t.bac > 0 && t.cv < 0)
    .sort((a, b) => a.cv - b.cv); // most negative first

  const totalOverrun = overBudget.reduce((a, t) => a - t.cv, 0); // cv is negative
  const totalBAC     = overBudget.reduce((a, t) => a + t.bac, 0);
  const pctOverrun   = totalBAC > 0 ? ((totalOverrun / totalBAC) * 100).toFixed(1) : 0;

  const severity = (cv) => {
    const pct = Math.abs(cv);
    if (pct > 5000) return { bg: '#fee2e2', color: '#dc2626', label: 'Severe' };
    if (pct > 1000) return { bg: '#fef3c7', color: '#d97706', label: 'High' };
    return                { bg: '#fefce8', color: '#ca8a04', label: 'Moderate' };
  };

  return (
    <div className="report-page" style={{ background: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #0A2B14', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00FFBC', background: '#0A2B14', display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>OVER-BUDGET REPORT</div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0A2B14' }}>Over-Budget Tasks</h1>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.4rem' }}>
            Scope: <strong style={{ textTransform: 'capitalize' }}>{parentType}</strong> · Tasks where AC &gt; EV (negative cost variance)
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#9ca3af' }}>
          <div style={{ fontWeight: 700, color: '#0A2B14', fontSize: '0.9rem' }}>Portfolio Manager</div>
          <div>Generated: {today}</div>
        </div>
      </div>

      {overBudget.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#f0fdf4', borderRadius: '12px', border: '2px solid #bbf7d0' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#16a34a' }}>All tasks are within budget!</div>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.4rem' }}>No tasks have negative cost variance in this scope.</div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <Section title="Summary">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              <div style={{ background: '#fee2e2', borderRadius: '10px', padding: '1rem', borderLeft: '4px solid #dc2626' }}>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>Over-Budget Tasks</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#dc2626' }}>{overBudget.length}</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>of {evmTasks.filter(t => t.bac > 0).length} budgeted tasks</div>
              </div>
              <div style={{ background: '#fee2e2', borderRadius: '10px', padding: '1rem', borderLeft: '4px solid #dc2626' }}>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>Total Cost Overrun</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626' }}>{fmt(totalOverrun)}</div>
              </div>
              <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '1rem', borderLeft: '4px solid #d97706' }}>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>% of Budget Overrun</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706' }}>{pctOverrun}%</div>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '1rem', borderLeft: '4px solid #374151' }}>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>Affected Budget (BAC)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#374151' }}>{fmt(totalBAC)}</div>
              </div>
            </div>
          </Section>

          {/* Over-budget tasks table */}
          <Section title={`Over-Budget Tasks (${overBudget.length})`}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  {['Task', 'Status', '% Done', 'BAC', 'EV', 'AC', 'Cost Variance', 'CV %', 'CPI', 'EAC', 'Severity'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overBudget.map((t, i) => {
                  const sev = severity(t.cv);
                  return (
                    <tr key={t.task_id} style={{ background: sev.bg }}>
                      <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600, borderBottom: '1px solid rgba(0,0,0,0.05)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.task_title}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase' }}>{t.status?.replace('_',' ')}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>{t.pct_complete ?? 0}%</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>{fmt(t.bac)}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid rgba(0,0,0,0.05)', color: '#2563eb' }}>{fmt(t.ev)}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid rgba(0,0,0,0.05)', color: '#dc2626', fontWeight: 600 }}>{fmt(t.ac)}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid rgba(0,0,0,0.05)', color: '#dc2626', fontWeight: 700 }}>{fmt(t.cv)}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid rgba(0,0,0,0.05)', color: '#dc2626', fontWeight: 600 }}>{t.cv_pct}%</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid rgba(0,0,0,0.05)', color: '#dc2626', fontWeight: 700 }}>{t.cpi != null ? t.cpi.toFixed(2) : '—'}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid rgba(0,0,0,0.05)', color: '#dc2626' }}>{fmt(t.eac)}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: sev.color }}>{sev.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#9ca3af' }}>
        <span>Portfolio Manager — Over-Budget Report — Confidential</span>
        <span>Generated {today}</span>
      </div>
    </div>
  );
}
