import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

/** Returns the Monday of the week containing `date`. */
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Returns the API query window for the given view + anchor. */
function getWindowDates(view, anchor) {
  if (view === 'month') {
    const gridStart = startOfWeek(startOfMonth(anchor));
    const gridEnd = addDays(gridStart, 41); // 6 rows × 7 days
    return { start: toYMD(gridStart), end: toYMD(gridEnd) };
  }
  if (view === 'week') {
    const mon = startOfWeek(anchor);
    return { start: toYMD(mon), end: toYMD(addDays(mon, 6)) };
  }
  // day
  const d = toYMD(anchor);
  return { start: d, end: d };
}

/** Navigate to the parent project / program page for a task. */
function taskUrl(task) {
  if (task.project_id) return `/projects/${task.project_id}`;
  if (task.program_id) return `/programs/${task.program_id}`;
  return '/tasks';
}

// ─── Status colour map ────────────────────────────────────────────────────────

const STATUS_COLORS = {
  'Open':        { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  'In Progress': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  'Completed':   { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  'Cancelled':   { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
  'On Hold':     { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
};

function sc(status) {
  return STATUS_COLORS[status] || { bg: '#f9fafb', text: '#374151', border: '#e5e7eb' };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_ABBRS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Calendar() {
  const navigate = useNavigate();

  const [view,    setView]    = useState('month');
  const [anchor,  setAnchor]  = useState(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async (v, a) => {
    const { start, end } = getWindowDates(v, a);
    setLoading(true);
    setError(null);
    try {
      const res = await client.get(`/calendar?start=${start}&end=${end}`);
      setTasks(res.data || []);
    } catch {
      setError('Failed to load calendar tasks.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(view, anchor); }, [view, anchor, fetchTasks]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goToday = () => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    setAnchor(t);
  };
  const goPrev = () => {
    if (view === 'month') setAnchor(a => addMonths(a, -1));
    else if (view === 'week') setAnchor(a => addDays(a, -7));
    else setAnchor(a => addDays(a, -1));
  };
  const goNext = () => {
    if (view === 'month') setAnchor(a => addMonths(a, 1));
    else if (view === 'week') setAnchor(a => addDays(a, 7));
    else setAnchor(a => addDays(a, 1));
  };

  // ── Header label ───────────────────────────────────────────────────────────

  const headerLabel = () => {
    if (view === 'month') {
      return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
    }
    if (view === 'week') {
      const mon = startOfWeek(anchor);
      const sun = addDays(mon, 6);
      if (mon.getMonth() === sun.getMonth()) {
        return `${MONTH_NAMES[mon.getMonth()]} ${mon.getDate()}–${sun.getDate()}, ${mon.getFullYear()}`;
      }
      return `${MONTH_NAMES[mon.getMonth()]} ${mon.getDate()} – ${MONTH_NAMES[sun.getMonth()]} ${sun.getDate()}, ${sun.getFullYear()}`;
    }
    // day
    return `${DAY_ABBRS[(anchor.getDay() + 6) % 7]}, ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`;
  };

  // ── Tasks for a date string ────────────────────────────────────────────────

  const tasksOnDay = (dateStr) =>
    tasks.filter(t => t.start_date && t.due_date && t.start_date <= dateStr && t.due_date >= dateStr);

  const today = toYMD(new Date());

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      <style>{`
        .cal-day-cell:hover       { box-shadow: inset 0 0 0 2px #93c5fd; position: relative; z-index: 1; }
        .cal-day-cell.cal-today:hover { box-shadow: inset 0 0 0 2px #016D2D; }
        .cal-pill:hover           { filter: brightness(0.9); box-shadow: 0 1px 5px rgba(0,0,0,0.18); }
        .cal-week-card:hover      { filter: brightness(0.93); box-shadow: 0 2px 8px rgba(0,0,0,0.14); }
        .cal-day-card:hover       { transform: translateX(3px); box-shadow: 0 4px 14px rgba(0,0,0,0.13); }
      `}</style>

      {/* Header bar */}
      <div style={S.topBar}>
        <h1 style={S.pageTitle}>My Calendar</h1>
        <div style={S.controls}>
          {/* View selector */}
          <div style={S.viewToggle}>
            {['month', 'week', 'day'].map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ ...S.viewBtn, ...(view === v ? S.viewBtnActive : {}) }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {/* Navigation arrows + Today */}
          <div style={S.navGroup}>
            <button onClick={goPrev}  style={S.navBtn}>‹</button>
            <button onClick={goToday} style={S.todayBtn}>Today</button>
            <button onClick={goNext}  style={S.navBtn}>›</button>
          </div>
          <span style={S.rangeLabel}>{headerLabel()}</span>
        </div>
      </div>

      {error && <div style={S.errorBanner}>{error}</div>}

      {loading ? (
        <div style={S.loadingMsg}>Loading…</div>
      ) : (
        <>
          {view === 'month' && (
            <MonthView anchor={anchor} today={today} tasksOnDay={tasksOnDay}
              navigate={navigate} />
          )}
          {view === 'week' && (
            <WeekView anchor={anchor} today={today} tasksOnDay={tasksOnDay}
              navigate={navigate} />
          )}
          {view === 'day' && (
            <DayView anchor={anchor} today={today} tasksOnDay={tasksOnDay}
              navigate={navigate} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ anchor, today, tasksOnDay, navigate }) {
  const gridStart = startOfWeek(startOfMonth(anchor));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const currentMonth = anchor.getMonth();

  return (
    <div style={S.calGrid}>
      {DAY_ABBRS.map(d => (
        <div key={d} style={S.dayHeader}>{d}</div>
      ))}
      {cells.map((cellDate, i) => {
        const dateStr    = toYMD(cellDate);
        const isToday    = dateStr === today;
        const inMonth    = cellDate.getMonth() === currentMonth;
        const dayTasks   = tasksOnDay(dateStr);
        const visible    = dayTasks.slice(0, 3);
        const overflow   = dayTasks.length - visible.length;

        return (
          <div key={i}
            className={`cal-day-cell${isToday ? ' cal-today' : ''}`}
            style={{
              ...S.dayCell,
              ...(isToday  ? S.dayCellToday      : {}),
              ...(!inMonth ? S.dayCellOtherMonth : {}),
            }}>
            <div style={{ ...S.dayNum, ...(isToday ? S.dayNumToday : {}) }}>
              {cellDate.getDate()}
            </div>
            <div style={S.taskPills}>
              {visible.map(t => {
                const c = sc(t.status);
                return (
                  <div key={t.id}
                    className="cal-pill"
                    onClick={() => navigate(taskUrl(t))}
                    title={`${t.title} (${t.status})`}
                    style={{ ...S.pill, background: c.bg, color: c.text, borderLeft: `3px solid ${c.border}` }}>
                    {t.is_milestone ? '◆ ' : ''}{t.title}
                  </div>
                );
              })}
              {overflow > 0 && (
                <div style={S.overflow}>+{overflow} more</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ anchor, today, tasksOnDay, navigate }) {
  const mon  = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));

  return (
    <div style={S.weekGrid}>
      {days.map((day, i) => {
        const dateStr  = toYMD(day);
        const isToday  = dateStr === today;
        const dayTasks = tasksOnDay(dateStr);

        return (
          <div key={i} style={{ ...S.weekCol, ...(isToday ? S.weekColToday : {}) }}>
            <div style={S.weekColHeader}>
              <span style={S.weekDayAbbr}>{DAY_ABBRS[i]}</span>
              <span style={{ ...S.weekDayNum, ...(isToday ? S.weekDayNumToday : {}) }}>
                {day.getDate()}
              </span>
            </div>
            <div style={S.weekTaskList}>
              {dayTasks.length === 0 && <div style={S.noTasks}>—</div>}
              {dayTasks.map(t => {
                const c = sc(t.status);
                return (
                  <div key={t.id}
                    className="cal-week-card"
                    onClick={() => navigate(taskUrl(t))}
                    style={{ ...S.weekTaskCard, background: c.bg, borderLeft: `4px solid ${c.border}` }}>
                    <div style={{ ...S.weekTaskTitle, color: c.text }}>
                      {t.is_milestone ? '◆ ' : ''}{t.title}
                    </div>
                    <div style={S.weekTaskMeta}>
                      {t.status}
                      {t.project_name  ? ` · ${t.project_name}`  : ''}
                      {!t.project_name && t.program_name ? ` · ${t.program_name}` : ''}
                    </div>
                    {t.percent_complete > 0 && (
                      <div style={S.progressBar}>
                        <div style={{ ...S.progressFill, width: `${t.percent_complete}%`, background: c.border }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({ anchor, today, tasksOnDay, navigate }) {
  const dateStr  = toYMD(anchor);
  const isToday  = dateStr === today;
  const dayTasks = [...tasksOnDay(dateStr)].sort((a, b) => {
    const ca = a.status === 'completed' ? 1 : 0;
    const cb = b.status === 'completed' ? 1 : 0;
    if (ca !== cb) return ca - cb;
    return (b.priority ?? -Infinity) - (a.priority ?? -Infinity);
  });

  return (
    <div style={S.dayViewWrap}>
      <div style={S.dayViewHeader}>
        <div style={{ ...S.dayViewCircle, ...(isToday ? S.dayViewCircleToday : {}) }}>
          {anchor.getDate()}
        </div>
        <div>
          <div style={S.dayViewLabel}>
            {DAY_ABBRS[(anchor.getDay() + 6) % 7]}, {MONTH_NAMES[anchor.getMonth()]} {anchor.getFullYear()}
            {isToday && <span style={S.todayBadge}>Today</span>}
          </div>
          <div style={S.dayViewCount}>
            {dayTasks.length === 0 ? 'No tasks' : `${dayTasks.length} task${dayTasks.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {dayTasks.length === 0 ? (
        <div style={S.emptyDay}>No tasks are scheduled for this day.</div>
      ) : (
        <div style={S.dayTaskList}>
          {dayTasks.map(t => {
            const c = sc(t.status);
            return (
              <div key={t.id}
                className="cal-day-card"
                onClick={() => navigate(taskUrl(t))}
                style={{ ...S.dayTaskCard, borderLeft: `5px solid ${c.border}`, background: c.bg }}>
                <div style={S.dayTaskRow}>
                  <span style={{ ...S.dayTaskTitle, color: c.text }}>
                    {t.is_milestone ? '◆ ' : ''}{t.title}
                  </span>
                  <span style={{ ...S.statusBadge, background: c.border, color: c.text }}>
                    {t.status}
                  </span>
                </div>
                <div style={S.dayTaskMeta}>
                  {t.project_name  && <span>📁 {t.project_name}</span>}
                  {!t.project_name && t.program_name && <span>📋 {t.program_name}</span>}
                  {t.priority      && <span style={S.priorityTag}>Priority: {t.priority}</span>}
                  <span>{t.start_date} → {t.due_date}</span>
                </div>
                {t.percent_complete > 0 && (
                  <div style={{ position: 'relative', marginTop: '8px' }}>
                    <div style={S.progressBarWide}>
                      <div style={{ ...S.progressFill, width: `${t.percent_complete}%`, background: c.border }} />
                    </div>
                    <span style={S.progressLabel}>{t.percent_complete}% complete</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  // Layout
  page:       { display: 'flex', flexDirection: 'column', gap: '1rem' },
  topBar:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.25rem' },
  pageTitle:  { margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#111827' },
  controls:   { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },

  // View toggle
  viewToggle:     { display: 'flex', border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden' },
  viewBtn:        { padding: '0.35rem 0.85rem', fontSize: '0.85rem', border: 'none', borderRight: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer' },
  viewBtnActive:  { background: '#016D2D', color: '#fff', fontWeight: 600 },

  // Nav
  navGroup:   { display: 'flex', alignItems: 'center', gap: '0.3rem' },
  navBtn:     { padding: '0.35rem 0.75rem', fontSize: '1.15rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', color: '#374151', cursor: 'pointer', lineHeight: 1, fontWeight: 600 },
  todayBtn:   { padding: '0.35rem 0.8rem', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 500 },
  rangeLabel: { fontSize: '1rem', fontWeight: 700, color: '#1f2937', minWidth: '220px' },

  // Feedback
  errorBanner:  { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.6rem 1rem', color: '#b91c1c', fontSize: '0.9rem' },
  loadingMsg:   { textAlign: 'center', color: '#9ca3af', padding: '3rem 0', fontSize: '1rem' },

  // ── Month grid ────────────────────────────────────────────────────────────
  calGrid:            { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' },
  dayHeader:          { background: '#f9fafb', padding: '0.5rem', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' },
  dayCell:            { minHeight: '110px', padding: '0.35rem 0.4rem', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', background: '#fff', verticalAlign: 'top', boxSizing: 'border-box' },
  dayCellToday:       { background: '#f0fdf4' },
  dayCellOtherMonth:  { background: '#f9fafb' },
  dayNum:             { fontSize: '0.78rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%' },
  dayNumToday:        { background: '#016D2D', color: '#fff', fontWeight: 700 },
  taskPills:          { display: 'flex', flexDirection: 'column', gap: '2px' },
  pill:               { fontSize: '0.71rem', padding: '1px 5px', borderRadius: '3px', cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  overflow:           { fontSize: '0.7rem', color: '#9ca3af', paddingLeft: '4px', marginTop: '1px' },

  // ── Week grid ─────────────────────────────────────────────────────────────
  weekGrid:         { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' },
  weekCol:          { borderRight: '1px solid #e5e7eb', background: '#fff', display: 'flex', flexDirection: 'column', minHeight: '500px' },
  weekColToday:     { background: '#f0fdf4' },
  weekColHeader:    { padding: '0.6rem 0.4rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' },
  weekDayAbbr:      { fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' },
  weekDayNum:       { fontSize: '1.1rem', fontWeight: 600, color: '#374151', width: '32px', height: '32px', lineHeight: '32px', textAlign: 'center', borderRadius: '50%' },
  weekDayNumToday:  { background: '#016D2D', color: '#fff' },
  weekTaskList:     { padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 },
  noTasks:          { color: '#d1d5db', fontSize: '0.75rem', textAlign: 'center', padding: '0.75rem 0' },
  weekTaskCard:     { padding: '0.35rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' },
  weekTaskTitle:    { fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: '0.8rem' },
  weekTaskMeta:     { fontSize: '0.7rem', color: '#6b7280', marginTop: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },

  // Progress
  progressBar:    { height: '3px', background: '#e5e7eb', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' },
  progressBarWide:{ height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: '3px' },
  progressLabel:  { fontSize: '0.72rem', color: '#6b7280', marginTop: '3px', display: 'block' },

  // ── Day view ──────────────────────────────────────────────────────────────
  dayViewWrap:          { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  dayViewHeader:        { display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', borderBottom: '2px solid #e5e7eb' },
  dayViewCircle:        { width: '56px', height: '56px', borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, color: '#374151', flexShrink: 0 },
  dayViewCircleToday:   { background: '#016D2D', color: '#fff' },
  dayViewLabel:         { fontSize: '1.1rem', fontWeight: 700, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  dayViewCount:         { fontSize: '0.85rem', color: '#6b7280', marginTop: '2px' },
  todayBadge:           { display: 'inline-block', background: '#d1fae5', color: '#065f46', fontSize: '0.72rem', fontWeight: 700, borderRadius: '10px', padding: '2px 8px' },
  emptyDay:             { color: '#9ca3af', fontSize: '1rem', textAlign: 'center', padding: '3rem 0', border: '2px dashed #e5e7eb', borderRadius: '8px' },
  dayTaskList:          { display: 'flex', flexDirection: 'column', gap: '0.525rem' },
  dayTaskCard:          { padding: '0.595rem 1rem', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'transform 0.15s, box-shadow 0.15s' },
  dayTaskRow:           { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' },
  dayTaskTitle:         { fontSize: '0.95rem', fontWeight: 600, flex: 1 },
  statusBadge:          { fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: '12px', flexShrink: 0, whiteSpace: 'nowrap' },
  dayTaskMeta:          { display: 'flex', gap: '1rem', marginTop: '0.28rem', fontSize: '0.82rem', color: '#6b7280', flexWrap: 'wrap' },
  priorityTag:          { color: '#92400e', fontWeight: 500 },
};
