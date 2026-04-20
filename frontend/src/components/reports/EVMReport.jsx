import { useState, useEffect } from 'react';
import client from '../../api/client';

const fmt = (n) => n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtN = (n, dp = 2) => n == null ? '—' : Number(n).toFixed(dp);
const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const HEALTH = {
  on_track: { label: 'On Track',  bg: '#dcfce7', color: '#16a34a' },
  at_risk:  { label: 'At Risk',   bg: '#fef3c7', color: '#d97706' },
  critical: { label: 'Critical',  bg: '#fee2e2', color: '#dc2626' },
};

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0A2B14', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.4rem', marginBottom: '1rem' }}>{title}</div>
      {children}
    </div>
  );
}

function KPI({ label, value, color, sub, formula }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '1rem', borderLeft: `4px solid ${color || '#0A2B14'}` }}>
      <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.25rem' }}>{label}</div>
      {formula && <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginBottom: '0.25rem', fontFamily: 'monospace' }}>{formula}</div>}
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: color || '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.15rem' }}>{sub}</div>}
    </div>
  );
}

// Inline SVG S-curve
function SCurve({ curve }) {
  if (!curve || curve.length < 2) return <div style={{ color: '#9ca3af', fontSize: '0.85rem', padding: '1rem 0' }}>Not enough data for S-curve.</div>;

  const W = 700, H = 200, PAD = { t: 20, r: 20, b: 40, l: 60 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const maxVal = Math.max(...curve.flatMap(c => [c.pv, c.ev, c.ac]));
  if (maxVal === 0) return null;

  const xS = (i) => PAD.l + (i / (curve.length - 1)) * innerW;
  const yS = (v) => PAD.t + innerH - (v / maxVal) * innerH;

  const line = (key, color) => {
    const pts = curve.map((c, i) => `${xS(i)},${yS(c[key])}`).join(' ');
    return <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />;
  };

  const xLabels = curve.length <= 12 ? curve : curve.filter((_, i) => i % Math.ceil(curve.length / 10) === 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: '#fafafa', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(r => (
        <g key={r}>
          <line x1={PAD.l} y1={PAD.t + innerH * (1 - r)} x2={PAD.l + innerW} y2={PAD.t + innerH * (1 - r)} stroke="#e5e7eb" strokeWidth="1" />
          <text x={PAD.l - 5} y={PAD.t + innerH * (1 - r) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
            ${Math.round(maxVal * r / 1000)}k
          </text>
        </g>
      ))}
      {/* X labels */}
      {xLabels.map((c, i) => (
        <text key={c.month} x={xS(curve.indexOf(c))} y={H - 5} textAnchor="middle" fontSize="8" fill="#9ca3af">{c.month.slice(5)}/{c.month.slice(2, 4)}</text>
      ))}
      {/* Lines */}
      {line('pv', '#6b7280')}
      {line('ev', '#2563eb')}
      {line('ac', '#dc2626')}
      {/* Legend */}
      <rect x={PAD.l} y={PAD.t} width="8" height="3" fill="#6b7280" />
      <text x={PAD.l + 11} y={PAD.t + 3} fontSize="9" fill="#6b7280">PV (Planned)</text>
      <rect x={PAD.l + 80} y={PAD.t} width="8" height="3" fill="#2563eb" />
      <text x={PAD.l + 91} y={PAD.t + 3} fontSize="9" fill="#2563eb">EV (Earned)</text>
      <rect x={PAD.l + 160} y={PAD.t} width="8" height="3" fill="#dc2626" />
      <text x={PAD.l + 171} y={PAD.t + 3} fontSize="9" fill="#dc2626">AC (Actual)</text>
    </svg>
  );
}

export default function EVMReport({ parentType, parentId }) {
  const [evm, setEvm]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    client.get(`/evm?parent_type=${parentType}&parent_id=${parentId}`)
      .then(res => setEvm(res.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [parentType, parentId]);

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading EVM report…</div>;
  if (error)   return <div style={{ padding: '2rem', color: '#dc2626' }}>Error: {error}</div>;
  if (!evm)    return null;

  const s = evm.summary || {};
  const tasks = evm.tasks || [];
  const curve = evm.curve || [];
  const h = HEALTH[s.health] || HEALTH.on_track;

  return (
    <div className="report-page" style={{ background: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #0A2B14', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00FFBC', background: '#0A2B14', display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>EVM PERFORMANCE REPORT</div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0A2B14' }}>Earned Value Analysis</h1>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Scope: <strong style={{ textTransform: 'capitalize' }}>{parentType}</strong></span>
            <span style={{ padding: '0.25rem 0.75rem', background: h.bg, color: h.color, borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>{h.label}</span>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{s.budgeted_task_count ?? 0} of {s.task_count ?? 0} tasks budgeted</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#9ca3af' }}>
          <div style={{ fontWeight: 700, color: '#0A2B14', fontSize: '0.9rem' }}>Portfolio Manager</div>
          <div>Generated: {today}</div>
        </div>
      </div>

      {/* Core Metrics */}
      <Section title="Core EVM Metrics">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          <KPI label="Budget at Completion (BAC)"   formula="Σ estimated_hours × rate"  value={fmt(s.bac)} color="#0A2B14" />
          <KPI label="Planned Value (PV)"           formula="BAC × elapsed ratio"        value={fmt(s.pv)}  color="#6b7280" />
          <KPI label="Earned Value (EV)"            formula="BAC × % complete"           value={fmt(s.ev)}  color="#2563eb" />
          <KPI label="Actual Cost (AC)"             formula="Σ actual_hours × rate"      value={fmt(s.ac)}  color="#7c3aed" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <KPI label="Cost Variance (CV)"           formula="EV − AC"   value={fmt(s.cv)}   color={s.cv < 0 ? '#dc2626' : '#16a34a'} sub={s.cv_pct != null ? `${s.cv_pct > 0 ? '+' : ''}${s.cv_pct}% of BAC` : ''} />
          <KPI label="Schedule Variance (SV)"       formula="EV − PV"   value={fmt(s.sv)}   color={s.sv < 0 ? '#d97706' : '#16a34a'} sub={s.sv_pct != null ? `${s.sv_pct > 0 ? '+' : ''}${s.sv_pct}% of BAC` : ''} />
          <KPI label="Estimate at Completion (EAC)" formula="BAC / CPI" value={fmt(s.eac)}  color={s.eac > s.bac ? '#dc2626' : '#16a34a'} />
          <KPI label="Variance at Completion (VAC)" formula="BAC − EAC" value={fmt(s.vac)}  color={s.vac < 0 ? '#dc2626' : '#16a34a'} />
        </div>
      </Section>

      {/* Performance Indices */}
      <Section title="Performance Indices">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <KPI label="Cost Perf. Index (CPI)"       formula="EV / AC"            value={fmtN(s.cpi)} color={!s.cpi || s.cpi < 1 ? '#dc2626' : '#16a34a'} sub="≥1.0 = under budget" />
          <KPI label="Schedule Perf. Index (SPI)"   formula="EV / PV"            value={fmtN(s.spi)} color={!s.spi || s.spi < 1 ? '#d97706' : '#16a34a'} sub="≥1.0 = ahead of schedule" />
          <KPI label="Estimate to Complete (ETC)"   formula="EAC − AC"           value={fmt(s.etc)}  color="#374151" />
          <KPI label="To-Complete Perf. (TCPI)"     formula="(BAC−EV)/(BAC−AC)"  value={fmtN(s.tcpi)} color="#374151" sub="Work efficiency needed" />
        </div>
      </Section>

      {/* S-Curve */}
      {curve.length > 0 && (
        <Section title="S-Curve (Monthly)">
          <SCurve curve={curve} />
        </Section>
      )}

      {/* Per-task table */}
      {tasks.length > 0 && (
        <Section title={`Task EVM Detail (${tasks.length} tasks)`}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['Task', 'Status', '%', 'BAC', 'PV', 'EV', 'AC', 'CV', 'SV', 'CPI', 'SPI', 'EAC'].map(h => (
                  <th key={h} style={{ padding: '0.45rem 0.5rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={t.task_id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.task_title}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase' }}>{t.status?.replace('_',' ')}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6' }}>{t.pct_complete ?? 0}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6' }}>{fmt(t.bac)}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6' }}>{fmt(t.pv)}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6', color: '#2563eb' }}>{fmt(t.ev)}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6', color: '#7c3aed' }}>{fmt(t.ac)}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6', color: t.cv < 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{fmt(t.cv)}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6', color: t.sv < 0 ? '#d97706' : '#16a34a', fontWeight: 600 }}>{fmt(t.sv)}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: !t.cpi || t.cpi < 1 ? '#dc2626' : '#16a34a' }}>{fmtN(t.cpi)}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: !t.spi || t.spi < 1 ? '#d97706' : '#16a34a' }}>{fmtN(t.spi)}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6', color: t.eac > t.bac ? '#dc2626' : '#111' }}>{fmt(t.eac)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Footer */}
      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#9ca3af' }}>
        <span>Portfolio Manager — EVM Report — Confidential</span>
        <span>Generated {today}</span>
      </div>
    </div>
  );
}
