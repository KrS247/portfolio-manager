import { useMemo } from 'react';

// ── Constants ──────────────────────────────────────────────────────────────
const ROW_H  = 42;
const HEAD_H = 44;
const LEFT_W = 220;
const WEEK_W  = 72;   // pixels per week  when timeUnit='week'
const MONTH_W = 90;   // pixels per month when timeUnit='month'

const CP_COLOR   = '#dc2626'; // red for critical path
const CP_BG      = 'rgba(220,38,38,0.10)';

// Covers task statuses (open/in_progress/completed/cancelled)
// and project/program statuses (active/on_hold/closed)
const STATUS_COLORS = {
  open:        '#016D2D',
  in_progress: '#f59e0b',
  completed:   '#22c55e',
  cancelled:   '#9ca3af',
  active:      '#016D2D',
  on_hold:     '#f59e0b',
  closed:      '#9ca3af',
};

const STATUS_LABELS = {
  open:        'Open',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
  active:      'Active',
  on_hold:     'On Hold',
  closed:      'Closed',
};

// ── Date helpers ───────────────────────────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, n) {
  const r = new Date(date);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a, b) {
  return Math.round((b - a) / 86400000);
}

function fmtShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMonth(d) {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// First day of the month containing d
function monthStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// First day of the month N months after d
function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// ── Critical Path Method (CPM) ─────────────────────────────────────────────
// Returns a Set of task ids that lie on the critical path.
function computeCriticalPath(tasks, endDateField) {
  if (!tasks || tasks.length === 0) return new Set();

  const taskMap = Object.fromEntries(tasks.map(t => [t.id, t]));

  const getDuration = (t) => {
    const s = parseDate(t.start_date);
    const e = parseDate(t[endDateField]);
    if (!s || !e) return 0;
    return Math.max(1, diffDays(s, e));
  };

  const hasDeps = tasks.some(t => t.depends_on && t.depends_on.length > 0);

  // ── Fallback (no dependency data): critical = tasks ending latest ──────
  if (!hasDeps) {
    const endTimes = tasks
      .map(t => parseDate(t[endDateField]))
      .filter(Boolean)
      .map(d => d.getTime());
    if (endTimes.length === 0) return new Set();
    const maxEnd = Math.max(...endTimes);
    return new Set(
      tasks
        .filter(t => { const e = parseDate(t[endDateField]); return e && e.getTime() === maxEnd; })
        .map(t => t.id)
    );
  }

  // ── Forward pass: Earliest Finish (EF) ────────────────────────────────
  const EF = {};
  const ES = {};

  const computeEF = (id, seen = new Set()) => {
    if (EF[id] !== undefined) return EF[id];
    if (seen.has(id)) { EF[id] = 0; return 0; }
    seen.add(id);
    const t = taskMap[id];
    if (!t) { EF[id] = 0; return 0; }
    const deps = (t.depends_on || []).filter(d => taskMap[d]);
    ES[id] = deps.length === 0 ? 0 : Math.max(...deps.map(d => computeEF(d, new Set(seen))));
    EF[id] = ES[id] + getDuration(t);
    return EF[id];
  };

  tasks.forEach(t => computeEF(t.id));
  const projectEF = Math.max(...Object.values(EF), 0);

  // ── Backward pass: Latest Finish (LF) ─────────────────────────────────
  const LF = {};
  const LS = {};

  // Build successor map (who depends on this task?)
  const successors = {};
  tasks.forEach(t => {
    (t.depends_on || []).forEach(depId => {
      if (!successors[depId]) successors[depId] = [];
      successors[depId].push(t.id);
    });
  });

  const computeLF = (id, seen = new Set()) => {
    if (LF[id] !== undefined) return LF[id];
    if (seen.has(id)) { LF[id] = projectEF; return projectEF; }
    seen.add(id);
    const succs = successors[id] || [];
    if (succs.length === 0) {
      LF[id] = projectEF;
    } else {
      succs.forEach(sId => computeLF(sId, new Set(seen)));
      LF[id] = Math.min(...succs.map(sId => LS[sId] !== undefined ? LS[sId] : LF[sId] - getDuration(taskMap[sId])));
    }
    LS[id] = LF[id] - getDuration(taskMap[id]);
    (taskMap[id].depends_on || []).forEach(depId => computeLF(depId, new Set(seen)));
    return LF[id];
  };

  [...tasks].reverse().forEach(t => computeLF(t.id));

  // Float = LF - EF; critical path = float ≈ 0
  return new Set(
    tasks
      .filter(t => {
        const dur = getDuration(t);
        if (dur === 0) return false;
        const float = Math.round((LF[t.id] ?? 0) - (EF[t.id] ?? 0));
        return float === 0;
      })
      .map(t => t.id)
  );
}

// ── Tree flattening ────────────────────────────────────────────────────────
// Returns [{ item, depth }] in depth-first tree order, parents before children.
function flattenTree(items) {
  const byParent = {};
  items.forEach(t => {
    const key = t.parent_task_id ?? null;
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(t);
  });

  const result = [];
  const walk = (parentId, depth) => {
    (byParent[parentId] || []).forEach(item => {
      result.push({ item, depth });
      walk(item.id, depth + 1);
    });
  };
  walk(null, 0);

  // If no parent_task_id fields exist (e.g. program/project items), fall back to original order
  if (result.length === 0) return items.map(item => ({ item, depth: 0 }));
  return result;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function GanttChart({
  items,
  nameField    = 'title',
  endDateField = 'due_date',
  canEdit,
  onEdit,
  showCriticalPath = true,
  timeUnit = 'day',   // 'day' | 'week' | 'month'
  // ── Scheduling / interactive props ──────────────────────────────────────
  baselineTasks    = null,   // [{ task_id, baseline_start_date, baseline_finish_date }]
  previewItems     = null,   // replacement items array during drag preview
  affectedTaskIds  = null,   // Set of task IDs to highlight amber
  onBarDragStart   = null,
  onBarDrag        = null,
  onBarDragEnd     = null,
  onResizeDragStart = null,
  onResizeDrag     = null,
  onResizeDragEnd  = null,
}) {
  // Use preview items when a drag preview is active, otherwise use authoritative items
  const renderItems = previewItems ?? items;

  // Build a quick lookup for baseline dates
  const baselineMap = useMemo(() => {
    if (!baselineTasks) return {};
    return Object.fromEntries(baselineTasks.map(b => [b.task_id, b]));
  }, [baselineTasks]);

  // Flatten into tree order with depths
  const flatRows = useMemo(() => flattenTree(renderItems), [renderItems]);

  const criticalIds = useMemo(
    () => showCriticalPath ? computeCriticalPath(renderItems, endDateField) : new Set(),
    [renderItems, endDateField, showCriticalPath]
  );

  const chart = useMemo(() => {
    const allDates = renderItems.flatMap(t =>
      [parseDate(t.start_date), parseDate(t[endDateField])].filter(Boolean)
    );
    // Also include baseline dates in the chart range
    const baselineDates = baselineTasks
      ? baselineTasks.flatMap(b => [parseDate(b.baseline_start_date), parseDate(b.baseline_finish_date)].filter(Boolean))
      : [];
    const combinedDates = [...allDates, ...baselineDates];
    if (combinedDates.length === 0) return null;

    let minD = new Date(Math.min(...combinedDates.map(d => d.getTime())));
    let maxD = new Date(Math.max(...combinedDates.map(d => d.getTime())));

    if (timeUnit === 'month') {
      // Snap to 1st of the previous month / next month for clean column boundaries
      minD = monthStart(minD);
      maxD = addMonths(maxD, 1);
    } else {
      minD = addDays(minD, -7);
      maxD = addDays(maxD, 7);
      // Snap minD to Monday
      const dow = minD.getDay();
      minD = addDays(minD, dow === 0 ? -6 : -(dow - 1));
    }

    const totalDays = diffDays(minD, maxD);

    // DAY_W: pixels per calendar day for each granularity mode.
    // Month mode uses MONTH_W / 30.4375 (avg days/month) so each month
    // column is proportional to its actual day count.
    const DAY_W = timeUnit === 'month'
      ? MONTH_W / 30.4375
      : timeUnit === 'week'
      ? WEEK_W / 7
      : Math.min(40, Math.max(14, Math.round(720 / totalDays)));

    // Week tick marks (used for shading + header in day/week modes)
    const weeks = [];
    let cur = new Date(minD);
    while (cur <= maxD) {
      weeks.push(new Date(cur));
      cur = addDays(cur, 7);
    }

    // Month tick marks (used for shading + header in month mode)
    const months = [];
    let mc = new Date(minD.getFullYear(), minD.getMonth(), 1);
    while (mc < maxD) {
      months.push(new Date(mc));
      mc = addMonths(mc, 1);
    }

    return { minD, totalDays, DAY_W, weeks, months, totalW: totalDays * DAY_W };
  }, [items, endDateField, timeUnit]);

  // Critical path span (for the summary line row)
  const cpSpan = useMemo(() => {
    if (!showCriticalPath || criticalIds.size === 0 || !chart) return null;
    const cpItems = renderItems.filter(t => criticalIds.has(t.id));
    const starts = cpItems.map(t => parseDate(t.start_date) || parseDate(t[endDateField])).filter(Boolean);
    const ends   = cpItems.map(t => parseDate(t[endDateField])).filter(Boolean);
    if (starts.length === 0 || ends.length === 0) return null;
    const spanStart = new Date(Math.min(...starts.map(d => d.getTime())));
    const spanEnd   = new Date(Math.max(...ends.map(d => d.getTime())));
    return { spanStart, spanEnd };
  }, [renderItems, criticalIds, chart, showCriticalPath, endDateField]);

  if (!chart) {
    return (
      <div style={styles.empty}>
        <span style={{ fontSize: '1.5rem' }}>📅</span>
        <p>No items have dates yet. Add start or end dates to see the Gantt chart.</p>
      </div>
    );
  }

  const { minD, DAY_W, weeks, months, totalW } = chart;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayX = diffDays(minD, today) * DAY_W + DAY_W / 2;
  const showToday = todayX >= 0 && todayX <= totalW;

  const presentStatuses = [...new Set(renderItems.map(i => i.status).filter(Boolean))];

  // Total rows = tasks + optional CP summary row
  const hasCpRow = showCriticalPath && cpSpan !== null;
  const totalRows = flatRows.length + (hasCpRow ? 1 : 0);

  return (
    <div>
      {/* ── Main grid ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderRadius: '8px', border: '1.5px solid #e5e7eb', overflow: 'hidden', background: '#fff' }}>

        {/* Left: fixed name column */}
        <div style={{ width: LEFT_W, flexShrink: 0, borderRight: '2px solid #e5e7eb', zIndex: 2 }}>
          <div style={{ height: HEAD_H, background: '#f3f4f6', borderBottom: '1.5px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 14px' }}>
            <span style={styles.colHeader}>Name</span>
          </div>

          {flatRows.map(({ item, depth }, i) => (
            <div
              key={item.id}
              style={{
                height: ROW_H,
                display: 'flex', alignItems: 'center', gap: '6px',
                paddingLeft: 14 + depth * 14,
                paddingRight: 14,
                background: criticalIds.has(item.id) ? CP_BG : (i % 2 === 0 ? '#fff' : '#fafafa'),
                borderBottom: '1px solid #f0f0f0',
                borderLeft: depth > 0 ? '3px solid #d1fae5' : 'none',
                cursor: canEdit ? 'pointer' : 'default',
                overflow: 'hidden',
              }}
              onClick={canEdit && onEdit ? () => onEdit(item) : undefined}
              title={canEdit ? `Edit: ${item[nameField]}` : item[nameField]}
            >
              {depth > 0 && (
                <span style={{ color: '#9ca3af', fontSize: '0.7rem', flexShrink: 0 }}>↳</span>
              )}
              <span style={{
                width: 8, height: 8, borderRadius: depth > 0 ? '2px' : '50%', flexShrink: 0,
                background: criticalIds.has(item.id) ? CP_COLOR : (STATUS_COLORS[item.status] || '#016D2D'),
                boxShadow: '0 0 0 2px rgba(0,0,0,0.07)',
              }} />
              <span style={{
                fontSize: depth > 0 ? '0.76rem' : '0.82rem',
                fontWeight: depth > 0 ? 500 : 600,
                color: criticalIds.has(item.id) ? CP_COLOR : (depth > 0 ? '#6b7280' : '#374151'),
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {item[nameField]}
              </span>
            </div>
          ))}

          {/* Critical Path summary label row */}
          {hasCpRow && (
            <div style={{
              height: ROW_H,
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '0 14px',
              background: 'rgba(220,38,38,0.06)',
              borderTop: `2px solid ${CP_COLOR}`,
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: CP_COLOR, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                ⚑ Critical Path
              </span>
            </div>
          )}
        </div>

        {/* Right: horizontally-scrollable timeline */}
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
          <div style={{ width: Math.max(totalW, 400), position: 'relative', height: HEAD_H + totalRows * ROW_H }}>

            {/* Alternating column shading — monthly in month mode, weekly otherwise */}
            {timeUnit === 'month'
              ? months.map((mo, i) => {
                  const nextMo = addMonths(mo, 1);
                  const colW = diffDays(mo, nextMo) * DAY_W;
                  return (
                    <div key={i} style={{
                      position: 'absolute',
                      left: diffDays(minD, mo) * DAY_W,
                      top: 0, width: colW, height: '100%',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.022)',
                      borderLeft: '1px solid #e5e7eb',
                    }} />
                  );
                })
              : weeks.map((wk, i) => (
                  <div key={i} style={{
                    position: 'absolute',
                    left: diffDays(minD, wk) * DAY_W,
                    top: 0, width: 7 * DAY_W, height: '100%',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.018)',
                    borderLeft: '1px solid #f0f0f0',
                  }} />
                ))
            }

            {/* Today vertical rule */}
            {showToday && (
              <div style={{
                position: 'absolute', left: todayX - 1,
                top: 0, width: 2, height: '100%',
                background: '#016D2D', opacity: 0.55, zIndex: 1,
              }} />
            )}

            {/* ── Header: month labels (month mode) or week labels (day/week mode) ── */}
            <div style={{
              position: 'sticky', top: 0, height: HEAD_H,
              background: '#f3f4f6', borderBottom: '1.5px solid #e5e7eb', zIndex: 3,
            }}>
              {timeUnit === 'month'
                ? months.map((mo, i) => {
                    const nextMo = addMonths(mo, 1);
                    const colW = diffDays(mo, nextMo) * DAY_W;
                    return (
                      <div key={i} style={{
                        position: 'absolute', left: diffDays(minD, mo) * DAY_W,
                        height: '100%', width: colW,
                        display: 'flex', alignItems: 'center', padding: '0 8px',
                        borderLeft: i === 0 ? 'none' : '1px solid #e5e7eb',
                        overflow: 'hidden',
                      }}>
                        <span style={{ ...styles.weekLabel, fontSize: '0.7rem' }}>{fmtMonth(mo)}</span>
                      </div>
                    );
                  })
                : weeks.map((wk, i) => (
                    <div key={i} style={{
                      position: 'absolute', left: diffDays(minD, wk) * DAY_W,
                      height: '100%', width: 7 * DAY_W,
                      display: 'flex', alignItems: 'center', padding: '0 8px',
                      borderLeft: i === 0 ? 'none' : '1px solid #e5e7eb',
                    }}>
                      <span style={styles.weekLabel}>{fmtShort(wk)}</span>
                    </div>
                  ))
              }
              {showToday && (
                <div style={{
                  position: 'absolute', left: todayX,
                  top: '50%', transform: 'translate(-50%, -50%)',
                  background: '#016D2D', color: '#fff',
                  fontSize: '0.63rem', fontWeight: 800,
                  padding: '2px 7px', borderRadius: 10, zIndex: 4,
                  whiteSpace: 'nowrap',
                }}>
                  Today
                </div>
              )}
            </div>

            {/* ── Item bar rows ────────────────────────────────────── */}
            {flatRows.map(({ item }, i) => {
              const isMilestone = !!(item.is_milestone);
              const endD   = parseDate(item[endDateField]);
              const startD = isMilestone ? endD : (parseDate(item.start_date) || endD);
              const hasDate = !!(endD);
              const isCP   = criticalIds.has(item.id);
              const isAffected = affectedTaskIds ? affectedTaskIds.has(item.id) : false;

              const milestoneX = hasDate ? diffDays(minD, endD) * DAY_W + DAY_W / 2 : null;

              const barL = (!isMilestone && startD && endD) ? diffDays(minD, startD) * DAY_W : 0;
              const barR = (!isMilestone && endD) ? diffDays(minD, endD) * DAY_W + DAY_W : 0;
              const barW = (!isMilestone && startD && endD) ? Math.max(DAY_W, barR - barL) : 0;
              const hasBar = !isMilestone && !!(startD && endD);

              // Baseline data for this task
              const bl = baselineMap[item.id];
              const blStartD  = bl ? parseDate(bl.baseline_start_date)  : null;
              const blFinishD = bl ? parseDate(bl.baseline_finish_date) : null;
              const hasBaseline = !!(blStartD && blFinishD);
              const blL = hasBaseline ? diffDays(minD, blStartD)  * DAY_W : 0;
              const blR = hasBaseline ? diffDays(minD, blFinishD) * DAY_W + DAY_W : 0;
              const blW = hasBaseline ? Math.max(DAY_W, blR - blL) : 0;

              // Schedule variance (positive = late, negative = early)
              const svDays = (hasBaseline && endD && blFinishD)
                ? diffDays(blFinishD, endD)   // actual finish - baseline finish
                : null;

              // Row background: affected tasks get amber tint, CP gets red tint
              let rowBg = i % 2 === 0 ? '#fff' : '#fafafa';
              if (isCP) rowBg = CP_BG;
              if (isAffected) rowBg = 'rgba(251,191,36,0.15)';

              // Bar colour
              let color = isCP ? CP_COLOR : (STATUS_COLORS[item.status] || STATUS_COLORS.open);
              if (isAffected) color = '#f59e0b';   // amber when preview-affected

              const pct   = item.percent_complete ?? 0;

              // Extended tooltip
              let tooltipParts = [`${item[nameField]}`, `${item.start_date || '–'} → ${item[endDateField] || '–'}`];
              if (pct) tooltipParts.push(`${pct}% complete`);
              if (item.float_days != null) tooltipParts.push(`Float: ${item.float_days}d`);
              if (svDays != null) tooltipParts.push(`SV: ${svDays >= 0 ? '+' : ''}${svDays}d vs baseline`);
              if (isCP) tooltipParts.push('⚑ Critical Path');
              const tooltip = tooltipParts.join('  |  ');

              return (
                <div key={item.id} style={{
                  position: 'absolute',
                  top: HEAD_H + i * ROW_H, left: 0, right: 0, height: ROW_H,
                  background: rowBg,
                  borderBottom: '1px solid #f0f0f0',
                  borderLeft: isAffected ? '3px solid #f59e0b' : undefined,
                  zIndex: 2,
                }}>
                  {/* ── Baseline bar (thin, behind main bar) ─────── */}
                  {hasBaseline && !isMilestone && (
                    <div style={{
                      position: 'absolute',
                      left: blL + 3, top: '50%',
                      transform: 'translateY(calc(-50% + 14px))',
                      width: blW - 6, height: 5,
                      borderRadius: 3,
                      background: svDays > 0 ? '#ef4444' : svDays < 0 ? '#22c55e' : '#94a3b8',
                      opacity: 0.75,
                      zIndex: 1,
                    }} title={`Baseline: ${bl.baseline_start_date} → ${bl.baseline_finish_date}`}
                    />
                  )}

                  {/* ── Milestone ─────────────────────────────────── */}
                  {isMilestone && milestoneX !== null && (
                    <>
                      <div style={{
                        position: 'absolute',
                        left: milestoneX - 1, top: 0, width: 2, height: '100%',
                        background: isCP ? 'rgba(220,38,38,0.3)' : 'rgba(217,119,6,0.25)',
                      }} />
                      <div
                        style={{
                          position: 'absolute',
                          left: milestoneX,
                          top: '50%',
                          transform: 'translate(-50%, -50%) rotate(45deg)',
                          width: 18, height: 18,
                          background: isAffected ? '#f59e0b' : isCP ? CP_COLOR : '#f59e0b',
                          border: `2.5px solid ${isCP ? '#b91c1c' : '#d97706'}`,
                          boxShadow: `0 2px 6px ${isCP ? 'rgba(220,38,38,0.5)' : 'rgba(217,119,6,0.5)'}`,
                          cursor: canEdit ? 'pointer' : 'default',
                          zIndex: 3,
                        }}
                        onClick={canEdit && onEdit ? () => onEdit(item) : undefined}
                        title={tooltip}
                      />
                      <div style={{
                        position: 'absolute',
                        left: milestoneX + 14, top: '50%', transform: 'translateY(-50%)',
                        fontSize: '0.68rem', fontWeight: 800,
                        color: isCP ? CP_COLOR : '#d97706',
                        whiteSpace: 'nowrap',
                      }}>
                        {item[endDateField] || ''}
                      </div>
                    </>
                  )}

                  {/* ── Regular bar ──────────────────────────────── */}
                  {hasBar && (
                    <div
                      style={{
                        position: 'absolute',
                        left: barL + 3,
                        top: '50%', transform: 'translateY(-50%)',
                        width: barW - 6, height: 26,
                        borderRadius: 5,
                        background: color,
                        overflow: 'visible',
                        cursor: canEdit ? 'pointer' : 'default',
                        boxShadow: isCP
                          ? `0 0 0 2px ${CP_COLOR}, 0 2px 8px rgba(220,38,38,0.35)`
                          : isAffected
                          ? '0 0 0 2px #f59e0b, 0 2px 8px rgba(245,158,11,0.35)'
                          : '0 1px 4px rgba(0,0,0,0.18)',
                        zIndex: 3,
                      }}
                      onMouseDown={onBarDragStart ? (e) => onBarDragStart(e, item) : undefined}
                      onClick={canEdit && onEdit ? () => onEdit(item) : undefined}
                      title={tooltip}
                    >
                      {/* Progress fill */}
                      <div style={{
                        position: 'absolute', left: 0, top: 0,
                        width: barW - 6, height: 26, borderRadius: 5, overflow: 'hidden',
                        pointerEvents: 'none',
                      }}>
                        {pct > 0 && (
                          <div style={{
                            position: 'absolute', left: 0, top: 0,
                            width: `${pct}%`, height: '100%',
                            background: 'rgba(255,255,255,0.30)',
                            borderRight: pct < 100 ? '2px solid rgba(255,255,255,0.6)' : 'none',
                          }} />
                        )}
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', padding: '0 8px',
                          fontSize: '0.7rem', fontWeight: 800, color: '#fff',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                        }}>
                          {pct > 0 ? `${pct}%` : ''}
                        </div>
                      </div>

                      {/* Float indicator: thin green strip on the right if float > 0 */}
                      {item.float_days > 0 && (
                        <div style={{
                          position: 'absolute',
                          left: barW - 6, top: '50%', transform: 'translateY(-50%)',
                          width: Math.min(item.float_days * DAY_W, 60),
                          height: 8, borderRadius: '0 4px 4px 0',
                          background: 'rgba(34,197,94,0.45)',
                          border: '1px solid rgba(34,197,94,0.6)',
                          pointerEvents: 'none',
                        }} title={`Float: ${item.float_days} days`} />
                      )}

                      {/* Resize handle on the right edge */}
                      {(onResizeDragStart) && (
                        <div
                          style={{
                            position: 'absolute', right: 0, top: 0,
                            width: 8, height: 26,
                            cursor: 'ew-resize',
                            background: 'rgba(255,255,255,0.3)',
                            borderRadius: '0 5px 5px 0',
                            zIndex: 5,
                          }}
                          onMouseDown={(e) => { e.stopPropagation(); onResizeDragStart(e, item); }}
                        />
                      )}
                    </div>
                  )}

                  {/* ── No dates ─────────────────────────────────── */}
                  {!isMilestone && !hasBar && (
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: '#d1d5db', fontStyle: 'italic' }}>
                      no dates
                    </span>
                  )}
                </div>
              );
            })}

            {/* ── Dependency arrow SVG overlay ─────────────────────── */}
            {flatRows.some(({ item: t }) => t.depends_on && t.depends_on.length > 0) && (() => {
              const taskIndexMap = Object.fromEntries(flatRows.map(({ item: t }, i) => [t.id, i]));
              const arrows = [];

              flatRows.forEach(({ item: succ }) => {
                if (!succ.depends_on || succ.depends_on.length === 0) return;
                const succIdx = taskIndexMap[succ.id];
                const succIsMilestone = !!(succ.is_milestone);
                const succEndD   = parseDate(succ[endDateField]);
                const succStartD = succIsMilestone ? succEndD : (parseDate(succ.start_date) || succEndD);
                if (!succEndD) return;

                // Successor anchor: left edge of bar, or milestone centre
                const x2 = succIsMilestone
                  ? diffDays(minD, succEndD) * DAY_W + DAY_W / 2
                  : (succStartD ? diffDays(minD, succStartD) * DAY_W + 3 : null);
                if (x2 === null) return;
                const y2 = HEAD_H + succIdx * ROW_H + ROW_H / 2;

                succ.depends_on.forEach(predId => {
                  const predIdx = taskIndexMap[predId];
                  if (predIdx === undefined) return;
                  const pred = flatRows[predIdx].item;

                  // Predecessor anchor: right edge of bar, or milestone centre
                  const predIsMilestone = !!(pred.is_milestone);
                  const predEndD = parseDate(pred[endDateField]);
                  if (!predEndD) return;

                  const x1 = predIsMilestone
                    ? diffDays(minD, predEndD) * DAY_W + DAY_W / 2
                    : diffDays(minD, predEndD) * DAY_W + DAY_W - 3;
                  const y1 = HEAD_H + predIdx * ROW_H + ROW_H / 2;

                  const isCPLink = criticalIds.has(pred.id) && criticalIds.has(succ.id);
                  const color  = isCPLink ? CP_COLOR : '#64748b';
                  const strokeW = isCPLink ? 2 : 1.5;
                  const dash   = isCPLink ? undefined : '5 3';

                  // L-shaped elbow: exit pred bar right → vertical → enter succ bar left
                  const elbowX = Math.max(x1 + 8, x2 - 8);
                  const path = `M ${x1} ${y1} L ${elbowX} ${y1} L ${elbowX} ${y2} L ${x2} ${y2}`;
                  // Arrowhead pointing right at (x2, y2)
                  const ah = `${x2},${y2} ${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4}`;

                  arrows.push(
                    <g key={`dep-${predId}-${succ.id}`} opacity={0.85}>
                      <path d={path} stroke={color} strokeWidth={strokeW} fill="none"
                        strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" />
                      <polygon points={ah} fill={color} />
                    </g>
                  );
                });
              });

              if (arrows.length === 0) return null;

              return (
                <svg style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%',
                  pointerEvents: 'none', zIndex: 6, overflow: 'visible',
                }}>
                  <defs>
                    <filter id="dep-glow">
                      <feDropShadow dx="0" dy="0" stdDeviation="1.2"
                        floodColor="#fff" floodOpacity="0.9" />
                    </filter>
                  </defs>
                  <g filter="url(#dep-glow)">{arrows}</g>
                </svg>
              );
            })()}

            {/* ── Critical Path summary line row ───────────────────── */}
            {hasCpRow && (() => {
              const cpRowTop = HEAD_H + flatRows.length * ROW_H;
              const lineX1 = diffDays(minD, cpSpan.spanStart) * DAY_W;
              const lineX2 = diffDays(minD, cpSpan.spanEnd)   * DAY_W + DAY_W;
              const lineW  = Math.max(DAY_W, lineX2 - lineX1);
              const midY   = ROW_H / 2;

              return (
                <div style={{
                  position: 'absolute',
                  top: cpRowTop, left: 0, right: 0, height: ROW_H,
                  background: 'rgba(220,38,38,0.06)',
                  borderTop: `2px solid ${CP_COLOR}`,
                  zIndex: 2,
                }}>
                  {/* Horizontal spine line */}
                  <div style={{
                    position: 'absolute',
                    left: lineX1,
                    top: midY - 2,
                    width: lineW,
                    height: 4,
                    background: CP_COLOR,
                    borderRadius: 2,
                    zIndex: 3,
                  }} />
                  {/* Left cap */}
                  <div style={{
                    position: 'absolute',
                    left: lineX1,
                    top: midY - 8,
                    width: 3, height: 16,
                    background: CP_COLOR,
                    borderRadius: 2,
                    zIndex: 3,
                  }} />
                  {/* Right arrowhead */}
                  <div style={{
                    position: 'absolute',
                    left: lineX1 + lineW - 1,
                    top: midY - 8,
                    width: 0, height: 0,
                    borderTop: '9px solid transparent',
                    borderBottom: '9px solid transparent',
                    borderLeft: `12px solid ${CP_COLOR}`,
                    zIndex: 3,
                  }} />
                  {/* "Critical Path" label above the line */}
                  <div style={{
                    position: 'absolute',
                    left: lineX1 + 6,
                    top: midY - 20,
                    fontSize: '0.67rem',
                    fontWeight: 800,
                    color: CP_COLOR,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    zIndex: 4,
                    textShadow: '0 0 4px #fff, 0 0 4px #fff',
                  }}>
                    Critical Path
                  </div>
                  {/* Duration label */}
                  <div style={{
                    position: 'absolute',
                    left: lineX1 + lineW + 16,
                    top: '50%', transform: 'translateY(-50%)',
                    fontSize: '0.72rem', fontWeight: 700, color: CP_COLOR,
                    whiteSpace: 'nowrap',
                    zIndex: 4,
                  }}>
                    {diffDays(cpSpan.spanStart, cpSpan.spanEnd)} days
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.65rem', alignItems: 'center' }}>
        {presentStatuses.map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: 14, height: 10, borderRadius: 2, background: STATUS_COLORS[s] || '#016D2D' }} />
            <span style={{ fontSize: '0.74rem', color: '#6b7280' }}>{STATUS_LABELS[s] || s}</span>
          </div>
        ))}
        {renderItems.some(i => i.is_milestone) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: 12, height: 12, background: '#f59e0b', border: '2px solid #d97706', transform: 'rotate(45deg)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.74rem', color: '#6b7280' }}>Milestone</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: 3, height: 16, borderRadius: 1, background: '#016D2D' }} />
          <span style={{ fontSize: '0.74rem', color: '#6b7280' }}>Today</span>
        </div>
        {renderItems.some(t => t.depends_on && t.depends_on.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <svg width="26" height="12" style={{ overflow: 'visible', flexShrink: 0 }}>
              <line x1="0" y1="6" x2="17" y2="6" stroke="#64748b" strokeWidth="1.5" strokeDasharray="5 3" />
              <polygon points="17,6 10,3 10,9" fill="#64748b" />
            </svg>
            <span style={{ fontSize: '0.74rem', color: '#6b7280' }}>Dependency</span>
          </div>
        )}
        {showCriticalPath && criticalIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: 22, height: 4, borderRadius: 2, background: CP_COLOR }} />
            <span style={{ fontSize: '0.74rem', color: CP_COLOR, fontWeight: 700 }}>Critical Path</span>
          </div>
        )}
        {baselineTasks && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: 22, height: 5, borderRadius: 3, background: '#94a3b8' }} />
            <span style={{ fontSize: '0.74rem', color: '#6b7280' }}>Baseline</span>
          </div>
        )}
        {affectedTaskIds && affectedTaskIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: 14, height: 10, borderRadius: 2, background: '#f59e0b' }} />
            <span style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 600 }}>Preview change</span>
          </div>
        )}
        <span style={{ fontSize: '0.72rem', color: '#bbbfc8' }}>Bar shading = % complete · Click to edit</span>
      </div>
    </div>
  );
}

const styles = {
  colHeader: { fontSize: '0.74rem', fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase' },
  weekLabel:  { fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap' },
  empty:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '2rem', color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center' },
};
