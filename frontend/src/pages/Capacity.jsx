import { useState, useEffect } from 'react';
import client from '../api/client';
import { useApi } from '../hooks/useApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const getMondayOfWeek = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

const addWeeks = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().slice(0, 10);
};

const fmtWeek = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const fmtMonth = (yyyyMM) => {
  const d = new Date(yyyyMM + '-01T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const cellColor = (util) => {
  if (!util || util === 0) return { bg: '#f9fafb', text: '#d1d5db' };
  if (util <= 50)          return { bg: '#dcfce7', text: '#15803d' };
  if (util <= 80)          return { bg: '#86efac', text: '#166534' };
  if (util <= 100)         return { bg: '#fef3c7', text: '#92400e' };
  if (util <= 120)         return { bg: '#fed7aa', text: '#c2410c' };
  return                        { bg: '#fca5a5', text: '#991b1b' };
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function Capacity() {
  const [from, setFrom]           = useState(getMondayOfWeek);
  const [to, setTo]               = useState(() => addWeeks(getMondayOfWeek(), 11));
  const [scopeType, setScopeType] = useState('');
  const [scopeId, setScopeId]     = useState('');
  const [viewMode, setViewMode]   = useState('weeks'); // 'weeks' | 'months'
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [popup, setPopup]         = useState(null);

  const { data: portfolios } = useApi('/portfolios');
  const { data: programs }   = useApi('/programs');
  const { data: projects }   = useApi('/projects');

  const load = () => {
    setLoading(true);
    setError(null);
    setPopup(null);
    const params = new URLSearchParams({ from, to });
    if (scopeType && scopeId) {
      params.append('parent_type', scopeType);
      params.append('parent_id', scopeId);
    }
    client.get(`/capacity?${params}`)
      .then(res => setData(res.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load capacity data'))
      .finally(() => setLoading(false));
  };

  // Auto-load on mount
  useEffect(() => { load(); }, []); // eslint-disable-line

  const scopeOptions =
    scopeType === 'portfolio' ? (portfolios || []) :
    scopeType === 'program'   ? (programs   || []) :
    scopeType === 'project'   ? (projects   || []) : [];

  // ── Columns (weeks or months) ─────────────────────────────────────────────
  const getColumns = () => {
    if (!data) return [];
    if (viewMode === 'weeks') return data.weeks;
    // Group weeks into months
    const months = {};
    data.weeks.forEach(w => {
      const m = w.slice(0, 7);
      if (!months[m]) months[m] = [];
      months[m].push(w);
    });
    return Object.entries(months).map(([month, weeks]) => ({ month, weeks }));
  };

  const getColLabel = (col) =>
    viewMode === 'weeks'
      ? fmtWeek(col)
      : fmtMonth(col.month);

  const getColSub = (col) =>
    viewMode === 'weeks'
      ? col.slice(0, 4) // year
      : `${col.weeks?.length}w`;

  // ── Cell aggregation ──────────────────────────────────────────────────────
  const getCellData = (resource, col) => {
    if (viewMode === 'weeks') {
      return resource.weeks[col] || { allocated: 0, capacity: 0, utilisation: 0, tasks: [] };
    }
    const weekData = col.weeks.map(w => resource.weeks[w]).filter(Boolean);
    const allocated = weekData.reduce((a, w) => a + w.allocated, 0);
    const capacity  = weekData.reduce((a, w) => a + w.capacity,  0);
    const utilisation = capacity > 0 ? (allocated / capacity) * 100 : 0;
    // Merge task hours within the month
    const taskMap = {};
    weekData.flatMap(w => w.tasks).forEach(t => {
      if (!taskMap[t.task_id]) taskMap[t.task_id] = { ...t, hours: 0 };
      taskMap[t.task_id].hours = Math.round((taskMap[t.task_id].hours + t.hours) * 10) / 10;
    });
    return {
      allocated:    Math.round(allocated * 10) / 10,
      capacity:     Math.round(capacity  * 10) / 10,
      utilisation:  Math.round(utilisation * 10) / 10,
      tasks:        Object.values(taskMap),
    };
  };

  const columns = getColumns();

  // ── Summary stats ─────────────────────────────────────────────────────────
  const resources = data?.resources || [];
  const overAllocated = resources.filter(r =>
    Object.values(r.weeks).some(w => w.utilisation > 100)
  ).length;

  const peakWeek = data?.weeks?.reduce((best, w) => {
    if (!resources.length) return best;
    const totalUtil = resources.reduce((a, r) => a + (r.weeks[w]?.utilisation ?? 0), 0);
    const avg = totalUtil / resources.length;
    return avg > (best.avg ?? 0) ? { week: w, avg } : best;
  }, {});

  // ── Cell click ────────────────────────────────────────────────────────────
  const handleCellClick = (e, resource, col) => {
    e.stopPropagation();
    const cell = getCellData(resource, col);
    if (cell.allocated === 0) { setPopup(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({
      userName: resource.user_name,
      label:    getColLabel(col),
      cell,
      x: Math.min(rect.left + window.scrollX, window.innerWidth - 300),
      y: rect.bottom + window.scrollY + 6,
    });
  };

  useEffect(() => {
    const close = () => setPopup(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <div style={{ position: 'relative' }}>

      {/* ── Controls card ── */}
      <div style={s.card}>
        <div style={s.headerRow}>
          <h1 style={s.title}>👥 Resource Capacity Planning</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setViewMode('weeks')}  style={{ ...s.viewBtn, ...(viewMode === 'weeks'  ? s.viewActive : {}) }}>Weeks</button>
            <button onClick={() => setViewMode('months')} style={{ ...s.viewBtn, ...(viewMode === 'months' ? s.viewActive : {}) }}>Months</button>
          </div>
        </div>

        <div style={s.controls}>
          <div style={s.field}>
            <label style={s.label}>From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={s.input} />
          </div>
          <div style={s.field}>
            <label style={s.label}>To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={s.input} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Scope</label>
            <select value={scopeType} onChange={e => { setScopeType(e.target.value); setScopeId(''); }} style={s.select}>
              <option value="">All Resources</option>
              <option value="portfolio">Portfolio</option>
              <option value="program">Program</option>
              <option value="project">Project</option>
            </select>
          </div>
          {scopeType && (
            <div style={s.field}>
              <label style={s.label}>{scopeType.charAt(0).toUpperCase() + scopeType.slice(1)}</label>
              <select value={scopeId} onChange={e => setScopeId(e.target.value)} style={s.select}>
                <option value="">— Select —</option>
                {scopeOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <button onClick={load} disabled={loading} style={{ ...s.loadBtn, ...(loading ? s.loadDisabled : {}) }}>
            {loading ? '⟳ Loading…' : '↻ Load'}
          </button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      {data && resources.length > 0 && (
        <div style={s.strip}>
          <div style={s.stripItem}>
            <span style={s.stripVal}>{resources.length}</span>
            <span style={s.stripLbl}>Resources</span>
          </div>
          <div style={s.stripItem}>
            <span style={{ ...s.stripVal, color: overAllocated > 0 ? '#dc2626' : '#16a34a' }}>{overAllocated}</span>
            <span style={s.stripLbl}>Over-allocated</span>
          </div>
          {peakWeek?.week && (
            <div style={s.stripItem}>
              <span style={s.stripVal}>{fmtWeek(peakWeek.week)}</span>
              <span style={s.stripLbl}>Peak week ({Math.round(peakWeek.avg)}% avg)</span>
            </div>
          )}
          {/* Legend */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              ['#dcfce7', '≤ 50%'],
              ['#86efac', '51–80%'],
              ['#fef3c7', '81–100%'],
              ['#fed7aa', '101–120%'],
              ['#fca5a5', '> 120%'],
            ].map(([bg, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                <div style={{ width: '14px', height: '14px', background: bg, borderRadius: '3px', border: '1px solid rgba(0,0,0,0.1)' }} />
                <span style={{ color: '#6b7280' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '1rem', fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={s.emptyBox}>
          <div style={{ fontSize: '2rem', opacity: 0.3 }}>⟳</div>
          <div style={{ color: '#9ca3af', fontWeight: 500 }}>Loading capacity data…</div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && data && resources.length === 0 && (
        <div style={s.emptyBox}>
          <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>👥</div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#374151' }}>No resource allocations found</div>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '0.25rem' }}>
            Assign resources with estimated hours to tasks to see capacity data.
          </div>
        </div>
      )}

      {/* ── Heatmap ── */}
      {!loading && data && resources.length > 0 && (
        <div style={s.heatmapCard}>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.stickyTh}>Resource</th>
                  {columns.map((col, i) => (
                    <th key={i} style={s.colTh}>
                      <div style={{ fontWeight: 700, fontSize: '0.78rem' }}>{getColLabel(col)}</div>
                      <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 400 }}>{getColSub(col)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resources.map(resource => (
                  <tr key={resource.user_id}>
                    {/* Resource name cell */}
                    <td style={s.stickyCel}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', whiteSpace: 'nowrap' }}>
                        {resource.user_name}
                      </div>
                      {resource.hourly_rate > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>${resource.hourly_rate}/hr</div>
                      )}
                    </td>
                    {/* Data cells */}
                    {columns.map((col, i) => {
                      const cell = getCellData(resource, col);
                      const c    = cellColor(cell.utilisation);
                      return (
                        <td
                          key={i}
                          onClick={e => handleCellClick(e, resource, col)}
                          style={{
                            ...s.dataCell,
                            background: c.bg,
                            cursor: cell.allocated > 0 ? 'pointer' : 'default',
                          }}
                          title={cell.allocated > 0 ? `${resource.user_name} · ${getColLabel(col)}: ${cell.allocated}h / ${cell.capacity}h (${cell.utilisation}%)` : ''}
                        >
                          {cell.allocated > 0 ? (
                            <>
                              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: c.text, lineHeight: 1.2 }}>
                                {Math.round(cell.allocated)}h
                              </div>
                              <div style={{ fontSize: '0.67rem', color: c.text, opacity: 0.85 }}>
                                {Math.round(cell.utilisation)}%
                              </div>
                            </>
                          ) : (
                            <div style={{ color: '#e5e7eb', fontSize: '0.75rem' }}>—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* ── Totals row ── */}
                <tr style={{ borderTop: '2px solid #d1d5db' }}>
                  <td style={{ ...s.stickyCel, fontWeight: 700, color: '#0A2B14', background: '#f0fdf4' }}>
                    Total
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 400 }}>All resources</div>
                  </td>
                  {columns.map((col, i) => {
                    const totalAlloc = resources.reduce((a, r) => a + (getCellData(r, col).allocated || 0), 0);
                    const totalCap   = resources.reduce((a, r) => a + (getCellData(r, col).capacity  || 0), 0);
                    const totalUtil  = totalCap > 0 ? (totalAlloc / totalCap) * 100 : 0;
                    const c = cellColor(totalUtil);
                    return (
                      <td key={i} style={{ ...s.dataCell, background: c.bg, borderTop: '2px solid #d1d5db' }}>
                        {totalAlloc > 0 ? (
                          <>
                            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: c.text }}>{Math.round(totalAlloc)}h</div>
                            <div style={{ fontSize: '0.67rem', color: c.text, opacity: 0.85 }}>{Math.round(totalUtil)}%</div>
                          </>
                        ) : (
                          <div style={{ color: '#e5e7eb' }}>—</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Task breakdown popup ── */}
      {popup && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            left:  Math.max(8, Math.min(popup.x, window.innerWidth  - 296)),
            top:   Math.max(8, Math.min(popup.y, window.innerHeight - 280)),
            width: '288px',
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          {/* Popup header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#0A2B14', fontSize: '0.92rem' }}>{popup.userName}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Week of {popup.label}</div>
            </div>
            <button onClick={() => setPopup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.1rem', padding: '0', lineHeight: 1 }}>✕</button>
          </div>

          {/* Allocation summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {[
              { label: 'Allocated', value: `${popup.cell.allocated}h`, color: cellColor(popup.cell.utilisation).text },
              { label: 'Capacity',  value: `${popup.cell.capacity}h`,  color: '#374151' },
              { label: 'Util %',    value: `${popup.cell.utilisation}%`, color: cellColor(popup.cell.utilisation).text },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#f9fafb', borderRadius: '8px', padding: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Utilisation bar */}
          <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', marginBottom: '0.75rem', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, popup.cell.utilisation)}%`, background: cellColor(popup.cell.utilisation).text, borderRadius: '3px', transition: 'width 0.3s' }} />
          </div>

          {/* Task list */}
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
            Tasks ({popup.cell.tasks.length})
          </div>
          <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {popup.cell.tasks
              .slice()
              .sort((a, b) => b.hours - a.hours)
              .map(t => (
                <div key={t.task_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '0.3rem 0.5rem', background: '#f9fafb', borderRadius: '6px', gap: '0.5rem' }}>
                  <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {t.task_title}
                  </span>
                  <span style={{ fontWeight: 700, color: '#0A2B14', flexShrink: 0, fontSize: '0.82rem' }}>
                    {Math.round(t.hours * 10) / 10}h
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  card:        { background: '#fff', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  headerRow:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' },
  title:       { margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#0A2B14' },
  viewBtn:     { padding: '0.35rem 0.9rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#f9fafb', color: '#374151', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
  viewActive:  { background: '#0A2B14', color: '#fff', border: '1px solid #0A2B14' },
  controls:    { display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' },
  field:       { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  label:       { fontSize: '0.78rem', fontWeight: 600, color: '#6b7280' },
  input:       { padding: '0.45rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '0.875rem', background: '#fff' },
  select:      { padding: '0.45rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '0.875rem', background: '#fff', minWidth: '160px' },
  loadBtn:     { padding: '0.5rem 1.4rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', alignSelf: 'flex-end' },
  loadDisabled:{ opacity: 0.55, cursor: 'not-allowed' },

  strip:       { display: 'flex', gap: '2rem', alignItems: 'center', padding: '0.75rem 1.25rem', background: '#fff', borderRadius: '10px', marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexWrap: 'wrap' },
  stripItem:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' },
  stripVal:    { fontSize: '1.3rem', fontWeight: 800, color: '#0A2B14', lineHeight: 1 },
  stripLbl:    { fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600 },

  emptyBox:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '4rem', background: '#fff', borderRadius: '12px', border: '2px dashed #e5e7eb' },

  heatmapCard: { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' },
  table:       { borderCollapse: 'collapse', tableLayout: 'fixed' },

  stickyTh:   {
    position: 'sticky', left: 0, zIndex: 3,
    background: '#f3f4f6',
    padding: '0.7rem 1rem',
    textAlign: 'left',
    fontSize: '0.72rem', fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '2px solid #e5e7eb',
    minWidth: '170px', width: '170px',
    whiteSpace: 'nowrap',
  },
  colTh: {
    padding: '0.6rem 0.4rem',
    textAlign: 'center',
    borderBottom: '2px solid #e5e7eb',
    background: '#f9fafb',
    minWidth: '82px', width: '82px',
    whiteSpace: 'nowrap',
  },
  stickyCel:  {
    position: 'sticky', left: 0, zIndex: 1,
    background: '#fff',
    padding: '0.55rem 1rem',
    borderBottom: '1px solid #f3f4f6',
    minWidth: '170px', width: '170px',
  },
  dataCell:   {
    padding: '0.45rem 0.3rem',
    textAlign: 'center',
    borderBottom: '1px solid rgba(0,0,0,0.03)',
    minWidth: '82px', width: '82px',
    verticalAlign: 'middle',
    transition: 'filter 0.1s',
  },
};
