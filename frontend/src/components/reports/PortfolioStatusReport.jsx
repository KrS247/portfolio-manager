import { useState, useEffect } from 'react';
import client from '../../api/client';

const fmt = (n, prefix = '$') => n == null ? '—' : `${prefix}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtN = (n, dp = 2) => n == null ? '—' : Number(n).toFixed(dp);
const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

// ─── Gantt helpers ────────────────────────────────────────────────────────────

function buildMonths(startStr, endStr) {
  const months = [];
  let [y, m] = startStr.split('-').map(Number);
  const [ey, em] = endStr.split('-').map(Number);
  const MAX = 72; // cap at 6 years
  while ((y < ey || (y === ey && m <= em)) && months.length < MAX) {
    months.push({
      year: y, month: m,
      label: new Date(y, m - 1).toLocaleString('default', { month: 'short', year: '2-digit' }),
      ym: `${y}-${String(m).padStart(2, '0')}`,
    });
    if (++m > 12) { m = 1; y++; }
  }
  return months;
}

function mIdx(dateStr, months) {
  if (!dateStr) return -1;
  const [y, mo] = dateStr.split('-').map(Number);
  return months.findIndex(m => m.year === y && m.month === mo);
}

const BAR_COLORS = {
  active:    '#016D2D',
  on_hold:   '#d97706',
  completed: '#2563eb',
  closed:    '#9ca3af',
};

function ProjectGantt({ projects }) {
  const dated = projects.filter(p => p.start_date && p.end_date);

  if (!dated.length) return (
    <div style={{ color: '#9ca3af', fontSize: '0.88rem', padding: '1.25rem', textAlign: 'center', border: '1px dashed #e5e7eb', borderRadius: '8px' }}>
      No projects have both a start date and end date set.
    </div>
  );

  const minDate = [...dated].sort((a, b) => a.start_date.localeCompare(b.start_date))[0].start_date;
  const maxDate = [...dated].sort((a, b) => b.end_date.localeCompare(a.end_date))[0].end_date;
  const months  = buildMonths(minDate, maxDate);

  const todayYM   = new Date().toISOString().slice(0, 7);
  const todayIdx  = months.findIndex(m => m.ym === todayYM);

  const COL_W  = 58;   // px per month column
  const NAME_W = 200;  // px for the project name column

  // Group months by year for a two-row header
  const yearGroups = months.reduce((acc, m) => {
    if (!acc.length || acc[acc.length - 1].year !== m.year) acc.push({ year: m.year, count: 1 });
    else acc[acc.length - 1].count++;
    return acc;
  }, []);

  return (
    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem' }}>
      <div style={{ minWidth: `${NAME_W + months.length * COL_W}px` }}>

        {/* Year header row */}
        <div style={{ display: 'flex', background: '#0A2B14', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ width: NAME_W, minWidth: NAME_W, flexShrink: 0 }} />
          {yearGroups.map(g => (
            <div key={g.year} style={{ width: g.count * COL_W, minWidth: g.count * COL_W, textAlign: 'center', padding: '0.3rem 0', fontSize: '0.7rem', fontWeight: 700, color: '#00FFBC', borderLeft: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
              {g.year}
            </div>
          ))}
        </div>

        {/* Month header row */}
        <div style={{ display: 'flex', background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
          <div style={{ width: NAME_W, minWidth: NAME_W, padding: '0.4rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
            Project
          </div>
          {months.map((m, i) => (
            <div key={i} style={{ width: COL_W, minWidth: COL_W, textAlign: 'center', padding: '0.4rem 0', fontSize: '0.66rem', fontWeight: 700, color: i === todayIdx ? '#016D2D' : '#6b7280', borderLeft: '1px solid #e5e7eb', background: i === todayIdx ? '#f0fdf4' : 'transparent', flexShrink: 0 }}>
              {m.label}
            </div>
          ))}
        </div>

        {/* Project rows */}
        {dated.map((proj, ri) => {
          const rawSi = mIdx(proj.start_date, months);
          const rawEi = mIdx(proj.end_date,   months);
          // Clamp to grid range (handles dates outside the computed window)
          const si = rawSi < 0 ? 0                   : Math.min(rawSi, months.length - 1);
          const ei = rawEi < 0 ? months.length - 1   : Math.min(rawEi, months.length - 1);
          const barColor = BAR_COLORS[proj.status] || BAR_COLORS.active;

          return (
            <div key={proj.id} style={{ display: 'flex', alignItems: 'center', height: 38, borderBottom: '1px solid #f0f0f0', background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
              {/* Name cell */}
              <div style={{ width: NAME_W, minWidth: NAME_W, padding: '0 0.75rem', fontWeight: 600, color: '#1d1d1d', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flexShrink: 0 }} title={proj.name}>
                {proj.name}
              </div>

              {/* Month cells */}
              {months.map((_, i) => {
                const inBar  = i >= si && i <= ei;
                const isFirst = i === si;
                const isLast  = i === ei;
                const isTodayCol = i === todayIdx;

                return (
                  <div key={i} style={{ width: COL_W, minWidth: COL_W, height: '100%', borderLeft: '1px solid #f0f0f0', position: 'relative', flexShrink: 0, background: isTodayCol ? 'rgba(1,109,45,0.04)' : 'transparent' }}>
                    {inBar && (
                      <div style={{
                        position: 'absolute',
                        top: 7, bottom: 7,
                        left:  isFirst ? 4 : 0,
                        right: isLast  ? 4 : 0,
                        background: barColor,
                        opacity: 0.88,
                        borderRadius: `${isFirst ? 4 : 0}px ${isLast ? 4 : 0}px ${isLast ? 4 : 0}px ${isFirst ? 4 : 0}px`,
                        display: 'flex', alignItems: 'center', overflow: 'hidden',
                      }}>
                        {isFirst && (
                          <span style={{ fontSize: '0.62rem', color: '#fff', fontWeight: 700, paddingLeft: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {proj.name}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Today vertical line */}
                    {isTodayCol && (
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, background: '#016D2D', opacity: 0.25 }} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1.5rem', padding: '0.6rem 0.75rem', borderTop: '1px solid #e5e7eb', background: '#f9fafb', flexWrap: 'wrap', alignItems: 'center' }}>
          {Object.entries({ active: 'Active', on_hold: 'On Hold', completed: 'Completed', closed: 'Closed' }).map(([st, lbl]) => (
            <div key={st} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#6b7280' }}>
              <div style={{ width: 14, height: 10, borderRadius: 2, background: BAR_COLORS[st] }} />
              {lbl}
            </div>
          ))}
          {todayIdx >= 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#016D2D', fontWeight: 600 }}>
              <div style={{ width: 2, height: 14, background: '#016D2D', opacity: 0.5 }} />
              Current month
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STATUS_COLOR = { active: '#16a34a', on_hold: '#d97706', closed: '#6b7280' };
const HEALTH_COLOR = { on_track: '#16a34a', at_risk: '#d97706', critical: '#dc2626' };
const HEALTH_LABEL = { on_track: 'On Track', at_risk: 'At Risk', critical: 'Critical' };

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0A2B14', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.4rem', marginBottom: '1rem' }}>{title}</div>
      {children}
    </div>
  );
}

function KPI({ label, value, sub, color }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '1rem', borderLeft: `4px solid ${color || '#0A2B14'}` }}>
      <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: color || '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  );
}

export default function PortfolioStatusReport({ parentType, parentId }) {
  const [portfolio,    setPortfolio]    = useState(null);
  const [evm,          setEvm]          = useState(null);
  const [allProjects,  setAllProjects]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      client.get(`/portfolios/${parentId}`),
      client.get(`/evm?parent_type=portfolio&parent_id=${parentId}`),
      client.get('/projects'),
    ])
      .then(([pRes, evmRes, projRes]) => {
        setPortfolio(pRes.data);
        setEvm(evmRes.data);
        setAllProjects(projRes.data || []);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [parentId]);

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading report…</div>;
  if (error)   return <div style={{ padding: '2rem', color: '#dc2626' }}>Error: {error}</div>;
  if (!portfolio) return null;

  const s = evm?.summary || {};
  const programs = portfolio.programs || [];
  const tasks    = evm?.tasks || [];

  // Filter all projects down to those belonging to this portfolio's programs
  const programIds = new Set(programs.map(p => p.id));
  const portfolioProjects = allProjects.filter(p => programIds.has(p.program_id));

  const taskStats = {
    total:       tasks.length,
    completed:   tasks.filter(t => t.status === 'completed').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    open:        tasks.filter(t => t.status === 'open').length,
    overdue:     tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length,
  };

  const pctComplete = taskStats.total > 0
    ? Math.round((tasks.reduce((a, t) => a + (t.pct_complete || 0), 0) / taskStats.total))
    : 0;

  return (
    <div className="report-page" style={{ background: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #0A2B14', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00FFBC', background: '#0A2B14', display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>PORTFOLIO STATUS REPORT</div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0A2B14' }}>{portfolio.name}</h1>
          {portfolio.description && <p style={{ margin: '0.4rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>{portfolio.description}</p>}
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#6b7280' }}>
            <span>Status: <strong style={{ color: STATUS_COLOR[portfolio.status] || '#111' }}>{portfolio.status?.replace('_', ' ').toUpperCase()}</strong></span>
            {s.health && <span>Health: <strong style={{ color: HEALTH_COLOR[s.health] }}>{HEALTH_LABEL[s.health]}</strong></span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#9ca3af' }}>
          <div style={{ fontWeight: 700, color: '#0A2B14', fontSize: '0.9rem' }}>Portfolio Manager</div>
          <div>Generated: {today}</div>
        </div>
      </div>

      {/* KPIs */}
      <Section title="Summary Metrics">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          <KPI label="Budget at Completion (BAC)"   value={fmt(s.bac)}  color="#0A2B14" />
          <KPI label="Estimate at Completion (EAC)" value={fmt(s.eac)}  color={s.eac > s.bac ? '#dc2626' : '#16a34a'} />
          <KPI label="Earned Value (EV)"            value={fmt(s.ev)}   color="#2563eb" />
          <KPI label="Actual Cost (AC)"             value={fmt(s.ac)}   color="#7c3aed" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <KPI label="Cost Performance Index (CPI)" value={fmtN(s.cpi)} color={s.cpi < 1 ? '#dc2626' : '#16a34a'} sub="≥1.0 = under budget" />
          <KPI label="Schedule Performance Index"   value={fmtN(s.spi)} color={s.spi < 1 ? '#d97706' : '#16a34a'} sub="≥1.0 = on schedule" />
          <KPI label="Variance at Completion (VAC)" value={fmt(s.vac)}  color={s.vac < 0 ? '#dc2626' : '#16a34a'} />
          <KPI label="Overall Completion"           value={`${pctComplete}%`} color="#2563eb" sub={`${taskStats.completed} of ${taskStats.total} tasks done`} />
        </div>
      </Section>

      {/* Task Breakdown */}
      <Section title="Task Breakdown">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
          {[
            { label: 'Total Tasks',   value: taskStats.total,       color: '#374151' },
            { label: 'Completed',     value: taskStats.completed,   color: '#16a34a' },
            { label: 'In Progress',   value: taskStats.in_progress, color: '#2563eb' },
            { label: 'Open',          value: taskStats.open,        color: '#6b7280' },
            { label: 'Overdue',       value: taskStats.overdue,     color: '#dc2626' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#f9fafb', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Programs */}
      {programs.length > 0 && (
        <Section title={`Programs (${programs.length})`}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['Program Name', 'Status', 'Projects', 'Start', 'End', 'Progress'].map(h => (
                  <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {programs.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>{p.name}</td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: STATUS_COLOR[p.status] || '#111', fontWeight: 600, fontSize: '0.78rem' }}>{p.status?.replace('_', ' ').toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{p.projects?.length ?? p.project_count ?? '—'}</td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{p.start_date || '—'}</td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{p.end_date || '—'}</td>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                    {p.completion_percentage != null
                      ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px' }}>
                            <div style={{ width: `${p.completion_percentage}%`, height: '100%', background: '#016D2D', borderRadius: '3px' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{p.completion_percentage}%</span>
                        </div>
                      : '—'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Project Timeline Gantt */}
      <Section title="Project Timeline">
        <ProjectGantt projects={portfolioProjects} />
      </Section>

      {/* Footer */}
      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#9ca3af' }}>
        <span>Portfolio Manager — Confidential</span>
        <span>Generated {today}</span>
      </div>
    </div>
  );
}
