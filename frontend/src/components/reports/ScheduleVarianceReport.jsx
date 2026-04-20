import { useState, useEffect } from 'react';
import client from '../../api/client';

const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

function diffDays(a, b) {
  if (!a || !b) return null;
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function VarBadge({ days }) {
  if (days == null) return <span style={{ color: '#9ca3af' }}>—</span>;
  if (days === 0)   return <span style={{ color: '#16a34a', fontWeight: 600 }}>On Time</span>;
  if (days > 0)     return <span style={{ color: '#dc2626', fontWeight: 600 }}>+{days}d late</span>;
  return               <span style={{ color: '#16a34a', fontWeight: 600 }}>{days}d early</span>;
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0A2B14', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.4rem', marginBottom: '1rem' }}>{title}</div>
      {children}
    </div>
  );
}

export default function ScheduleVarianceReport({ parentType, parentId }) {
  const [baselines, setBaselines]   = useState([]);
  const [selectedBl, setSelectedBl] = useState(null);
  const [blDetail, setBlDetail]     = useState(null);
  const [evmTasks, setEvmTasks]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadingBl, setLoadingBl]   = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      client.get(`/baselines?parent_type=${parentType}&parent_id=${parentId}`),
      client.get(`/evm?parent_type=${parentType}&parent_id=${parentId}`),
    ])
      .then(([blRes, evmRes]) => {
        const bls = blRes.data || [];
        setBaselines(bls);
        setEvmTasks(evmRes.data?.tasks || []);
        if (bls.length > 0) setSelectedBl(bls[0].id);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [parentType, parentId]);

  useEffect(() => {
    if (!selectedBl) return;
    setLoadingBl(true);
    client.get(`/baselines/${selectedBl}`)
      .then(res => setBlDetail(res.data))
      .catch(() => setBlDetail(null))
      .finally(() => setLoadingBl(false));
  }, [selectedBl]);

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading schedule variance report…</div>;
  if (error)   return <div style={{ padding: '2rem', color: '#dc2626' }}>Error: {error}</div>;

  const taskMap = {};
  evmTasks.forEach(t => { taskMap[t.task_id] = t; });

  const blTasks = blDetail?.tasks || [];

  // Compute variance for each baseline task
  const rows = blTasks.map(bt => {
    const current = taskMap[bt.task_id] || {};
    const startVar = diffDays(bt.baseline_start_date, current.start_date);
    const endVar   = diffDays(bt.baseline_finish_date, current.due_date);
    return { ...bt, current_start: current.start_date, current_end: current.due_date, start_var: startVar, end_var: endVar, status: current.status, pct: current.pct_complete };
  });

  const lateCount  = rows.filter(r => r.end_var > 0).length;
  const earlyCount = rows.filter(r => r.end_var < 0).length;
  const onTimeCount = rows.filter(r => r.end_var === 0).length;

  return (
    <div className="report-page" style={{ background: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #0A2B14', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00FFBC', background: '#0A2B14', display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>SCHEDULE VARIANCE REPORT</div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0A2B14' }}>Baseline vs. Actuals</h1>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.4rem' }}>Scope: <strong style={{ textTransform: 'capitalize' }}>{parentType}</strong></div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#9ca3af' }}>
          <div style={{ fontWeight: 700, color: '#0A2B14', fontSize: '0.9rem' }}>Portfolio Manager</div>
          <div>Generated: {today}</div>
        </div>
      </div>

      {baselines.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', background: '#f9fafb', borderRadius: '8px' }}>
          No baselines saved for this scope. Save a baseline from the Gantt view to compare schedule variance.
        </div>
      ) : (
        <>
          {/* Baseline selector */}
          <Section title="Select Baseline">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {baselines.map(bl => (
                <button
                  key={bl.id}
                  onClick={() => setSelectedBl(bl.id)}
                  style={{ padding: '0.5rem 1rem', border: `2px solid ${selectedBl === bl.id ? '#0A2B14' : '#e5e7eb'}`, borderRadius: '8px', background: selectedBl === bl.id ? '#0A2B14' : '#f9fafb', color: selectedBl === bl.id ? '#fff' : '#374151', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  {bl.name}
                  <span style={{ fontSize: '0.72rem', fontWeight: 400, marginLeft: '0.5rem', opacity: 0.7 }}>{bl.created_at?.slice(0, 10)}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* Summary stats */}
          {blDetail && !loadingBl && (
            <>
              <Section title="Variance Summary">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {[
                    { label: 'Total Tasks',  value: rows.length,   color: '#374151' },
                    { label: 'Late',         value: lateCount,     color: '#dc2626' },
                    { label: 'On Time',      value: onTimeCount,   color: '#16a34a' },
                    { label: 'Early',        value: earlyCount,    color: '#2563eb' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: '#f9fafb', borderRadius: '10px', padding: '1rem', borderLeft: `4px solid ${color}` }}>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title={`Task Variance Details — ${blDetail.name}`}>
                {loadingBl
                  ? <div style={{ color: '#6b7280', padding: '1rem' }}>Loading baseline…</div>
                  : rows.length === 0
                    ? <div style={{ color: '#9ca3af', padding: '1rem' }}>No tasks in this baseline.</div>
                    : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: '#f3f4f6' }}>
                            {['Task', 'Status', '%', 'BL Start', 'Actual Start', 'Start Var', 'BL Finish', 'Actual Finish', 'Finish Var'].map(h => (
                              <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={r.task_id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', ...(r.end_var > 5 ? { background: '#fff5f5' } : {}) }}>
                              <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.task_title}</td>
                              <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase' }}>{r.status?.replace('_',' ') || '—'}</td>
                              <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6' }}>{r.pct ?? 0}%</td>
                              <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{r.baseline_start_date || '—'}</td>
                              <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{r.current_start || '—'}</td>
                              <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6' }}><VarBadge days={r.start_var} /></td>
                              <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{r.baseline_finish_date || '—'}</td>
                              <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{r.current_end || '—'}</td>
                              <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6' }}><VarBadge days={r.end_var} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                }
              </Section>
            </>
          )}
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#9ca3af' }}>
        <span>Portfolio Manager — Schedule Variance Report — Confidential</span>
        <span>Generated {today}</span>
      </div>
    </div>
  );
}
