/**
 * EVMPanel
 *
 * Earned Value Management dashboard panel.
 * Shows summary KPI cards, S-curve chart (SVG), and per-task breakdown table.
 *
 * Props:
 *   parentType  — 'portfolio' | 'program' | 'project'
 *   parentId    — numeric ID
 */
import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

// ── Number formatters ────────────────────────────────────────────────────────
const fmt$  = (v) => v == null ? '–' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtN  = (v, d = 2) => v == null ? '–' : v.toFixed(d);
const fmtPct= (v) => v == null ? '–' : `${v > 0 ? '+' : ''}${v}%`;

// ── Health colours ───────────────────────────────────────────────────────────
const HEALTH = {
  on_track: { label: 'On Track', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
  at_risk:  { label: 'At Risk',  color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
  critical: { label: 'Critical', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
};

// ── Variance colour helper ────────────────────────────────────────────────────
function varColor(v, inverse = false) {
  if (v == null) return '#6b7280';
  const good = inverse ? v < 1 : v >= 0;
  return good ? '#16a34a' : '#dc2626';
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, subLabel, subValue, color, tooltip }) {
  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '10px',
      padding: '0.85rem 1rem', minWidth: 120, flex: '1 1 120px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }} title={tooltip}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: color || '#1d1d1d', lineHeight: 1.1 }}>
        {value}
      </div>
      {subLabel && (
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.2rem' }}>
          {subLabel}: <span style={{ fontWeight: 700, color: '#374151' }}>{subValue}</span>
        </div>
      )}
    </div>
  );
}

// ── Inline SVG S-curve chart ──────────────────────────────────────────────────
function SCurve({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', padding: '2rem 0' }}>
        No curve data available — assign resources and dates to tasks.
      </div>
    );
  }

  const W = 600, H = 200, PL = 50, PR = 20, PT = 16, PB = 30;
  const iW = W - PL - PR, iH = H - PT - PB;

  const maxVal = Math.max(
    ...data.map(d => Math.max(d.pv, d.ev, d.ac)),
    1
  );

  const xScale = (i) => PL + (i / Math.max(1, data.length - 1)) * iW;
  const yScale = (v) => PT + iH - (v / maxVal) * iH;

  const line = (key, color) => {
    const pts = data.map((d, i) => `${xScale(i)},${yScale(d[key])}`).join(' ');
    return <polyline key={key} points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />;
  };

  const area = (key, color) => {
    const pts = data.map((d, i) => `${xScale(i)},${yScale(d[key])}`).join(' ');
    const first = `${xScale(0)},${yScale(0)}`;
    const last  = `${xScale(data.length - 1)},${yScale(0)}`;
    return (
      <polygon
        key={`area-${key}`}
        points={`${first} ${pts} ${last}`}
        fill={color}
        opacity={0.12}
      />
    );
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto', display: 'block' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = yScale(maxVal * f);
          return (
            <g key={f}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#e5e7eb" strokeWidth="1" />
              <text x={PL - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                {fmt$(maxVal * f)}
              </text>
            </g>
          );
        })}

        {/* Month labels on X axis */}
        {data.map((d, i) => (
          <text key={i} x={xScale(i)} y={H - 4} textAnchor="middle" fontSize="9.5" fill="#9ca3af">
            {d.month}
          </text>
        ))}

        {/* Area fills */}
        {area('pv', '#3b82f6')}
        {area('ev', '#16a34a')}
        {area('ac', '#f59e0b')}

        {/* Lines */}
        {line('pv', '#3b82f6')}
        {line('ev', '#16a34a')}
        {line('ac', '#f59e0b')}

        {/* Data point dots */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={xScale(i)} cy={yScale(d.pv)} r="3" fill="#3b82f6" />
            <circle cx={xScale(i)} cy={yScale(d.ev)} r="3" fill="#16a34a" />
            <circle cx={xScale(i)} cy={yScale(d.ac)} r="3" fill="#f59e0b" />
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', marginTop: '0.5rem' }}>
        {[['#3b82f6','PV — Planned Value'],['#16a34a','EV — Earned Value'],['#f59e0b','AC — Actual Cost']].map(([c, lbl]) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', color: '#6b7280' }}>
            <div style={{ width: 24, height: 3, background: c, borderRadius: 2 }} />
            {lbl}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CPI / SPI indicator ──────────────────────────────────────────────────────
function IndexGauge({ label, value }) {
  if (value == null) return null;
  const color = value >= 1.0 ? '#16a34a' : value >= 0.8 ? '#d97706' : '#dc2626';
  const bg    = value >= 1.0 ? '#dcfce7' : value >= 0.8 ? '#fef3c7' : '#fee2e2';
  const pct   = Math.min(100, Math.max(0, (value / 1.5) * 100));

  return (
    <div style={{ flex: '1 1 140px', minWidth: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b7280' }}>{label}</span>
        <span style={{ fontSize: '0.9rem', fontWeight: 800, color }}>{fmtN(value)}</span>
      </div>
      <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color, borderRadius: 4,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '2px' }}>
        {value >= 1.0 ? '▲ Favourable' : value >= 0.8 ? '● At Risk' : '▼ Critical'}
        &nbsp;· Target: ≥ 1.00
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EVMPanel({ parentType, parentId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [tab,     setTab]     = useState('summary');   // 'summary' | 'curve' | 'tasks'
  const [open,    setOpen]    = useState(true);

  const load = useCallback(() => {
    if (!parentType || !parentId) return;
    setLoading(true);
    setError('');
    client.get('/evm', { params: { parent_type: parentType, parent_id: parentId } })
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load EVM data'))
      .finally(() => setLoading(false));
  }, [parentType, parentId]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const health = s ? (HEALTH[s.health] || HEALTH.on_track) : null;

  return (
    <div style={styles.panel}>
      {/* ── Panel header ────────────────────────────────────────────── */}
      <button type="button" onClick={() => setOpen(o => !o)} style={styles.header}>
        <span style={styles.headerIcon}>{open ? '▾' : '▸'}</span>
        <span style={styles.headerTitle}>📊 Earned Value Management</span>
        {health && (
          <span style={{ ...styles.healthBadge, color: health.color, background: health.bg, borderColor: health.border }}>
            {health.label}
          </span>
        )}
        {s && s.bac > 0 && (
          <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: 'auto' }}>
            BAC {fmt$(s.bac)}
          </span>
        )}
      </button>

      {open && (
        <div style={styles.body}>
          {loading && (
            <div style={styles.loading}>
              <span style={styles.spinner} />
              Calculating earned value…
            </div>
          )}
          {error && <div style={styles.errorMsg}>{error}</div>}

          {!loading && !error && data && (
            <>
              {/* ── Tab bar ─────────────────────────────────────────── */}
              <div style={styles.tabBar}>
                {[['summary','📋 Summary'],['curve','📈 S-Curve'],['tasks','📑 Task Detail']].map(([t, lbl]) => (
                  <button key={t} type="button" onClick={() => setTab(t)}
                    style={{ ...styles.tabBtn, ...(tab === t ? styles.tabBtnActive : {}) }}>
                    {lbl}
                  </button>
                ))}
                <button type="button" onClick={load} style={styles.refreshBtn} title="Refresh EVM">↻</button>
              </div>

              {/* ── SUMMARY TAB ─────────────────────────────────────── */}
              {tab === 'summary' && s && (
                <>
                  {s.budgeted_task_count === 0 && (
                    <div style={styles.hint}>
                      ℹ️ No tasks have resource budgets assigned. Add resources with estimated and actual hours to see EVM metrics.
                    </div>
                  )}

                  {/* Primary KPIs */}
                  <div style={styles.kpiGrid}>
                    <KPICard label="BAC" value={fmt$(s.bac)} tooltip="Budget at Completion — total authorised budget" />
                    <KPICard label="PV"  value={fmt$(s.pv)}  tooltip="Planned Value — budgeted work scheduled to date" color="#3b82f6" />
                    <KPICard label="EV"  value={fmt$(s.ev)}  tooltip="Earned Value — budgeted cost of work performed" color="#16a34a" />
                    <KPICard label="AC"  value={fmt$(s.ac)}  tooltip="Actual Cost — actual money spent to date" color="#f59e0b" />
                  </div>

                  {/* Variance KPIs */}
                  <div style={styles.kpiGrid}>
                    <KPICard
                      label="CV — Cost Variance"
                      value={fmt$(s.cv)}
                      subLabel="%" subValue={fmtPct(s.cv_pct)}
                      color={varColor(s.cv)}
                      tooltip="EV − AC. Negative = over budget"
                    />
                    <KPICard
                      label="SV — Schedule Variance"
                      value={fmt$(s.sv)}
                      subLabel="%" subValue={fmtPct(s.sv_pct)}
                      color={varColor(s.sv)}
                      tooltip="EV − PV. Negative = behind schedule"
                    />
                    <KPICard
                      label="EAC — Forecast"
                      value={fmt$(s.eac)}
                      subLabel="ETC" subValue={fmt$(s.etc)}
                      color={s.eac > s.bac ? '#dc2626' : '#16a34a'}
                      tooltip="Estimate at Completion = BAC / CPI. ETC = money still needed"
                    />
                    <KPICard
                      label="VAC — Variance"
                      value={fmt$(s.vac)}
                      color={varColor(s.vac)}
                      tooltip="BAC − EAC. Positive = under budget"
                    />
                  </div>

                  {/* Performance indices */}
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                    <IndexGauge label="CPI — Cost Performance Index"     value={s.cpi}  />
                    <IndexGauge label="SPI — Schedule Performance Index" value={s.spi}  />
                    {s.tcpi != null && (
                      <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b7280' }}>TCPI</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: s.tcpi > 1.1 ? '#dc2626' : '#16a34a' }}>
                            {fmtN(s.tcpi)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>
                          To-Complete Performance Index — efficiency needed to meet BAC
                          {s.tcpi > 1.1 ? ' ⚠️ Difficult' : ' ✓ Achievable'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stats row */}
                  <div style={styles.statsRow}>
                    <span>{s.task_count} task{s.task_count !== 1 ? 's' : ''} in scope</span>
                    <span>·</span>
                    <span>{s.budgeted_task_count} with budget</span>
                    {s.cpi && <><span>·</span><span>CPI: every $1 spent is delivering {fmt$(s.cpi)} of value</span></>}
                  </div>
                </>
              )}

              {/* ── S-CURVE TAB ─────────────────────────────────────── */}
              {tab === 'curve' && (
                <div style={{ marginTop: '0.75rem' }}>
                  <SCurve data={data.curve} />
                </div>
              )}

              {/* ── TASK DETAIL TAB ─────────────────────────────────── */}
              {tab === 'tasks' && (
                <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                  {data.tasks.length === 0 ? (
                    <div style={styles.hint}>No tasks found in this scope.</div>
                  ) : (
                    <table style={styles.table}>
                      <thead>
                        <tr style={{ background: '#f3f4f6' }}>
                          {['Task','%','BAC','PV','EV','AC','CV','SV','CPI','SPI','EAC','VAC'].map(h => (
                            <th key={h} style={styles.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.tasks.map(t => (
                          <tr key={t.task_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ ...styles.td, fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.task_title}>
                              {t.task_title}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>{t.pct_complete}%</td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>{fmt$(t.bac)}</td>
                            <td style={{ ...styles.td, textAlign: 'right', color: '#3b82f6' }}>{fmt$(t.pv)}</td>
                            <td style={{ ...styles.td, textAlign: 'right', color: '#16a34a' }}>{fmt$(t.ev)}</td>
                            <td style={{ ...styles.td, textAlign: 'right', color: '#f59e0b' }}>{fmt$(t.ac)}</td>
                            <td style={{ ...styles.td, textAlign: 'right', color: varColor(t.cv) }}>{fmt$(t.cv)}</td>
                            <td style={{ ...styles.td, textAlign: 'right', color: varColor(t.sv) }}>{fmt$(t.sv)}</td>
                            <td style={{ ...styles.td, textAlign: 'right', color: varColor(t.cpi != null ? t.cpi - 1 : null) }}>
                              {t.cpi != null ? fmtN(t.cpi) : '–'}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right', color: varColor(t.spi != null ? t.spi - 1 : null) }}>
                              {t.spi != null ? fmtN(t.spi) : '–'}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right', color: t.eac > t.bac ? '#dc2626' : '#16a34a' }}>
                              {fmt$(t.eac)}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right', color: varColor(t.vac) }}>
                              {fmt$(t.vac)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  panel:  { border: '1.5px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', marginTop: '1.5rem', background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },

  header: {
    display: 'flex', alignItems: 'center', gap: '0.65rem',
    width: '100%', padding: '0.9rem 1.25rem',
    background: '#f9fafb', border: 'none', cursor: 'pointer',
    textAlign: 'left', borderBottom: '1.5px solid #e5e7eb',
  },
  headerIcon:  { fontSize: '0.8rem', color: '#6b7280', flexShrink: 0 },
  headerTitle: { fontWeight: 700, fontSize: '0.95rem', color: '#374151' },
  healthBadge: { fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: '10px', border: '1.5px solid', flexShrink: 0 },

  body:   { padding: '1.25rem' },

  tabBar: { display: 'flex', gap: '0.25rem', marginBottom: '1rem', borderBottom: '1.5px solid #e5e7eb', paddingBottom: '0.5rem', alignItems: 'center' },
  tabBtn: { padding: '0.35rem 0.85rem', border: '1.5px solid #e5e7eb', borderRadius: '6px', background: '#f9fafb', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600, color: '#6b7280' },
  tabBtnActive: { background: '#016D2D', color: '#fff', borderColor: '#016D2D' },
  refreshBtn: { marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#9ca3af', padding: '0.2rem 0.5rem', borderRadius: '4px' },

  kpiGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '0.65rem' },

  statsRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f0f0f0' },

  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th:    { padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 700, color: '#6b7280', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' },
  td:    { padding: '0.4rem 0.6rem', color: '#374151', whiteSpace: 'nowrap' },

  loading: { display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.85rem', padding: '1.5rem 0' },
  spinner: { display: 'inline-block', width: 16, height: 16, border: '2px solid #86efac', borderTopColor: '#016D2D', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  hint:    { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.6rem 0.9rem', fontSize: '0.83rem', color: '#6b7280', marginBottom: '0.75rem' },
  errorMsg:{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.6rem 0.9rem', fontSize: '0.83rem', color: '#dc2626' },
};
