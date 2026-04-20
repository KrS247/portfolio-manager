import { useState, useEffect } from 'react';
import client from '../../api/client';

const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const RISK_COLOR = (rate) => {
  if (rate > 15) return { bg: '#fee2e2', color: '#dc2626', label: 'Critical' };
  if (rate > 10) return { bg: '#fef3c7', color: '#d97706', label: 'High' };
  if (rate > 5)  return { bg: '#fefce8', color: '#ca8a04', label: 'Medium' };
  return             { bg: '#dcfce7', color: '#16a34a', label: 'Low' };
};

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0A2B14', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.4rem', marginBottom: '1rem' }}>{title}</div>
      {children}
    </div>
  );
}

// 5×5 heat map
function HeatMap({ risks }) {
  const grid = {};
  risks.forEach(r => {
    const k = `${r.probability}_${r.impact}`;
    grid[k] = (grid[k] || 0) + 1;
  });

  const cellColor = (p, i) => {
    const rate = p * i;
    if (rate > 15) return '#fca5a5';
    if (rate > 10) return '#fde68a';
    if (rate > 5)  return '#fef08a';
    return '#bbf7d0';
  };

  return (
    <div>
      <div style={{ display: 'inline-grid', gridTemplateColumns: 'auto repeat(5, 48px)', gap: '2px', fontSize: '0.72rem' }}>
        <div />
        {[1,2,3,4,5].map(i => <div key={i} style={{ textAlign: 'center', fontWeight: 700, color: '#6b7280', padding: '4px' }}>I={i}</div>)}
        {[5,4,3,2,1].map(p => (
          <>
            <div key={`p${p}`} style={{ fontWeight: 700, color: '#6b7280', display: 'flex', alignItems: 'center', paddingRight: '4px' }}>P={p}</div>
            {[1,2,3,4,5].map(i => {
              const k = `${p}_${i}`;
              const count = grid[k] || 0;
              return (
                <div key={i} style={{ background: cellColor(p, i), borderRadius: '4px', width: '48px', height: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div style={{ fontSize: '0.65rem', color: '#374151', fontWeight: 600 }}>{p * i}</div>
                  {count > 0 && <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#111' }}>{count}</div>}
                </div>
              );
            })}
          </>
        ))}
      </div>
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', fontSize: '0.72rem' }}>
        {[['#fca5a5','Critical (>15)'],['#fde68a','High (11-15)'],['#fef08a','Medium (6-10)'],['#bbf7d0','Low (≤5)']].map(([bg, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', background: bg, borderRadius: '2px', border: '1px solid rgba(0,0,0,0.1)' }} />
            <span style={{ color: '#6b7280' }}>{label}</span>
          </div>
        ))}
        <span style={{ color: '#9ca3af' }}>(numbers = risk count)</span>
      </div>
    </div>
  );
}

export default function RiskRegisterReport({ parentType, parentId }) {
  const [risks, setRisks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState('all');

  useEffect(() => {
    setLoading(true);
    client.get(`/reports/risks?parent_type=${parentType}&parent_id=${parentId}`)
      .then(res => setRisks(res.data || []))
      .catch(e => setError(e.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [parentType, parentId]);

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading risk register…</div>;
  if (error)   return <div style={{ padding: '2rem', color: '#dc2626' }}>Error: {error}</div>;

  const filtered = filter === 'all' ? risks
    : filter === 'critical' ? risks.filter(r => r.risk_rate > 15)
    : filter === 'high' ? risks.filter(r => r.risk_rate > 10 && r.risk_rate <= 15)
    : risks.filter(r => r.risk_rate <= 10);

  const critical = risks.filter(r => r.risk_rate > 15).length;
  const high     = risks.filter(r => r.risk_rate > 10 && r.risk_rate <= 15).length;
  const medium   = risks.filter(r => r.risk_rate > 5  && r.risk_rate <= 10).length;
  const low      = risks.filter(r => r.risk_rate <= 5).length;

  return (
    <div className="report-page" style={{ background: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #0A2B14', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00FFBC', background: '#0A2B14', display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>RISK REGISTER REPORT</div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0A2B14' }}>Risk Register</h1>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.4rem' }}>
            Scope: <strong style={{ textTransform: 'capitalize' }}>{parentType}</strong> · {risks.length} total risks
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#9ca3af' }}>
          <div style={{ fontWeight: 700, color: '#0A2B14', fontSize: '0.9rem' }}>Portfolio Manager</div>
          <div>Generated: {today}</div>
        </div>
      </div>

      {risks.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af', background: '#f9fafb', borderRadius: '8px' }}>
          No risks found for this scope.
        </div>
      ) : (
        <>
          {/* Summary counts */}
          <Section title="Risk Summary">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Critical', count: critical, color: '#dc2626', bg: '#fee2e2' },
                { label: 'High',     count: high,     color: '#d97706', bg: '#fef3c7' },
                { label: 'Medium',   count: medium,   color: '#ca8a04', bg: '#fefce8' },
                { label: 'Low',      count: low,      color: '#16a34a', bg: '#dcfce7' },
              ].map(({ label, count, color, bg }) => (
                <div key={label} style={{ background: bg, borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color }}>{count}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color }}>{label}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Heat map */}
          <Section title="Risk Heat Map (Probability × Impact)">
            <HeatMap risks={risks} />
          </Section>

          {/* Filter */}
          <div className="no-print" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {['all', 'critical', 'high', 'medium/low'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{ padding: '0.35rem 0.75rem', border: `1px solid ${filter === f ? '#0A2B14' : '#e5e7eb'}`, borderRadius: '6px', background: filter === f ? '#0A2B14' : '#f9fafb', color: filter === f ? '#fff' : '#374151', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize' }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Risk table */}
          <Section title={`Risk Register (${filtered.length} risks)`}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  {['#', 'Risk Name', 'Task', 'P', 'I', 'Rate', 'Status', 'Description', 'Mitigation Plan'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const rc = RISK_COLOR(r.risk_rate);
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: '#9ca3af', fontSize: '0.72rem' }}>{i + 1}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', fontWeight: 600, maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || '—'}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.task_title}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', textAlign: 'center', fontWeight: 600 }}>{r.probability}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', textAlign: 'center', fontWeight: 600 }}>{r.impact}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ background: rc.bg, color: rc.color, fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem' }}>{r.risk_rate}</span>
                      </td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.72rem', fontWeight: 600, color: rc.color }}>{rc.label}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</td>
                      <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: '#374151', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.mitigation_plan || '—'}</td>
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
        <span>Portfolio Manager — Risk Register — Confidential</span>
        <span>Generated {today}</span>
      </div>
    </div>
  );
}
