import { useState, useMemo, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import GanttChart from '../components/GanttChart';
import EVMPanel from '../components/EVMPanel';
import { applyStoredOrder, applyStoredProjectOrder } from './admin/DashboardAdmin';
import client from '../api/client';

const fmt$ = (n) => n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtN = (n) => n == null ? '—' : Number(n).toFixed(2);

const taskUrl = (task) => {
  if (task.project_id)  return `/projects/${task.project_id}`;
  if (task.program_id)  return `/programs/${task.program_id}`;
  // fallback: use parent_type/parent_id if explicit fields not present
  if (task.parent_type === 'project')  return `/projects/${task.parent_id}`;
  if (task.parent_type === 'program')  return `/programs/${task.parent_id}`;
  return '/tasks';
};

const RISK_COLOR = {
  'Critical Risk': { bg: '#fef2f2', border: '#fca5a5', badge: '#dc2626', text: '#991b1b' },
  'High Risk':     { bg: '#fff7ed', border: '#fdba74', badge: '#ea580c', text: '#9a3412' },
  'Medium Risk':   { bg: '#fefce8', border: '#fde047', badge: '#ca8a04', text: '#854d0e' },
  'Low Risk':      { bg: '#f0fdf4', border: '#86efac', badge: '#16a34a', text: '#166534' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: portfolios,  loading: pLoad  } = useApi('/portfolios');
  const { data: tasks,       loading: tLoad  } = useApi('/tasks');
  const { data: highRisk,    loading: rLoad  } = useApi('/tasks/high-risk');
  const { data: overdue,     loading: oLoad  } = useApi('/tasks/overdue');
  const { data: overBudget,  loading: obLoad } = useApi('/tasks/over-budget');
  const { data: programs,    loading: prLoad } = useApi('/programs');
  const { data: projects,    loading: pjLoad } = useApi('/projects');

  const totalPrograms = portfolios?.reduce((s, p) => s + (p.program_count || 0), 0) || 0;
  const totalTasks = tasks?.length || 0;
  const openTasks = tasks?.filter(t => t.status === 'open').length || 0;
  const inProgress = tasks?.filter(t => t.status === 'in_progress').length || 0;

  // Group projects by program_id for the Schedule View
  const projectsByProgram = useMemo(() => {
    if (!projects) return {};
    return projects.reduce((acc, pj) => {
      const key = pj.program_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(pj);
      return acc;
    }, {});
  }, [projects]);

  // Ordered program list — order is driven by the Admin › Dashboard page (stored in localStorage)
  const [orderedPrograms, setOrderedPrograms] = useState([]);

  useEffect(() => {
    if (!programs || programs.length === 0) return;
    // applyStoredOrder respects the admin-configured order from localStorage
    setOrderedPrograms(applyStoredOrder(programs));
  }, [programs]);

  // Build one merged Gantt items array: programs at depth 0, projects at depth 1.
  // Use namespaced string IDs (e.g. "prog_3") to avoid collisions between
  // programs table IDs and projects table IDs.
  const ganttItems = useMemo(() => {
    if (!orderedPrograms.length) return [];
    const items = [];
    orderedPrograms.forEach(prog => {
      items.push({
        ...prog,
        id: `prog_${prog.id}`,      // namespaced so it won't clash with project IDs
        parent_task_id: null,
        _type: 'program',
      });
      const progProjects = applyStoredProjectOrder(projectsByProgram[prog.id] || [], prog.id);
      progProjects.forEach(proj => {
        items.push({
          ...proj,
          parent_task_id: `prog_${prog.id}`, // child of the program row above
          _type: 'project',
        });
      });
    });
    return items;
  }, [orderedPrograms, projectsByProgram]);

  // Map program_id → portfolio_id and project_id → portfolio_id
  const programToPortfolio = useMemo(() => {
    if (!programs) return {};
    return programs.reduce((acc, p) => { acc[p.id] = p.portfolio_id; return acc; }, {});
  }, [programs]);

  const projectToPortfolio = useMemo(() => {
    if (!projects) return {};
    return projects.reduce((acc, pj) => { acc[pj.id] = programToPortfolio[pj.program_id]; return acc; }, {});
  }, [projects, programToPortfolio]);

  const taskPortfolioId = (task) => {
    if (task.portfolio_id != null) return task.portfolio_id;
    // fallback to lookup maps for tasks without direct portfolio_id
    if (task.project_id)  return projectToPortfolio[task.project_id];
    if (task.program_id)  return programToPortfolio[task.program_id];
    return null;
  };

  // Fetch EVM summary for each portfolio
  const [evmByPortfolio, setEvmByPortfolio] = useState({});
  useEffect(() => {
    if (!portfolios || portfolios.length === 0) return;
    Promise.all(
      portfolios.map(p =>
        client.get(`/evm?parent_type=portfolio&parent_id=${p.id}`)
          .then(res => ({ id: p.id, summary: res.data.summary }))
          .catch(() => ({ id: p.id, summary: null }))
      )
    ).then(results => {
      const map = {};
      results.forEach(r => { map[r.id] = r.summary; });
      setEvmByPortfolio(map);
    });
  }, [portfolios]);

  const [riskOpen,     setRiskOpen]     = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(true);

  const totalAlerts = (highRisk?.length || 0) + (overdue?.length || 0) + (overBudget?.length || 0);

  return (
    <div>
      <h1 style={styles.heading}>Welcome, {user?.username}</h1>
      <p style={styles.sub}>Here is a summary of your portfolio landscape.</p>

      <div style={styles.cards}>
        <StatCard label="Portfolios"   value={portfolios?.length ?? '—'} bg="#1e3a8a" loading={pLoad} />
        <StatCard label="Programs"     value={totalPrograms}             bg="#1d4ed8" loading={pLoad} />
        <StatCard label="Total Tasks"  value={totalTasks}                bg="#2563eb" loading={tLoad} />
        <StatCard label="Open Tasks"   value={openTasks}                 bg="#3b82f6" loading={tLoad} />
        <StatCard label="In Progress"  value={inProgress}                bg="#60a5fa" loading={tLoad} />
      </div>

      {/* ── Portfolios ───────────────────────────────────────────────── */}
      {portfolios && portfolios.length > 0 && (
        <section style={{ ...styles.section, marginBottom: '1.5rem' }}>
          <h2 style={{ ...styles.sectionTitle, marginBottom: '1rem' }}>Portfolios</h2>
          <div style={styles.list}>
            {portfolios.slice(0, 5).map(p => (
              <Link key={p.id} to={`/portfolios/${p.id}`} style={styles.portfolioItem}>
                {/* Row 1: name + status */}
                <div style={styles.portfolioTop}>
                  <span style={styles.listName}>{p.name}</span>
                  <span style={{ ...styles.statusPill, ...statusStyle(p.status) }}>{p.status.replace('_', ' ')}</span>
                </div>
                {/* Row 2: date range */}
                <div style={styles.portfolioDate}>
                  📅&nbsp;
                  {p.task_start_date || p.start_date
                    ? <>{p.task_start_date || p.start_date} → {p.task_end_date || p.end_date || '—'}</>
                    : <span style={{ color: '#d1d5db' }}>No task dates set</span>
                  }
                </div>
                {/* Row 3: counts */}
                <div style={styles.portfolioCounts}>
                  <span style={styles.countChip}>📂 {p.program_count} program{p.program_count !== 1 ? 's' : ''}</span>
                  <span style={styles.countChip}>📁 {p.project_count ?? 0} project{p.project_count !== 1 ? 's' : ''}</span>
                  <span style={{ ...styles.countChip, color: '#059669', fontWeight: 700 }}>✅ {p.active_task_count ?? 0} active task{p.active_task_count !== 1 ? 's' : ''}</span>
                </div>
                {/* Row 4: risk, budget & EVM */}
                {(() => {
                  const hr  = (highRisk  || []).filter(t => taskPortfolioId(t) === p.id);
                  const ob  = (overBudget || []).filter(t => taskPortfolioId(t) === p.id);
                  const totalOverrun = ob.reduce((s, t) => s + (t.cost_overrun ?? 0), 0);
                  const evm = evmByPortfolio[p.id];
                  return (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid #f0f0f0', marginTop: '0.1rem' }}>
                      <span style={{ ...styles.countChip, color: hr.length > 0 ? '#dc2626' : '#16a34a', fontWeight: 700, background: hr.length > 0 ? '#fee2e2' : '#f0fdf4', border: `1px solid ${hr.length > 0 ? '#fca5a5' : '#86efac'}` }}>
                        🔴 {hr.length} high risk
                      </span>
                      <span style={{ ...styles.countChip, color: ob.length > 0 ? '#b45309' : '#16a34a', fontWeight: 700, background: ob.length > 0 ? '#fef3c7' : '#f0fdf4', border: `1px solid ${ob.length > 0 ? '#fde68a' : '#86efac'}` }}>
                        💸 {ob.length} over budget{totalOverrun > 0 ? ` · ${fmt$(totalOverrun)}` : ''}
                      </span>
                      {evm && <>
                        <span style={{ ...styles.countChip, fontWeight: 700 }}>BAC {fmt$(evm.bac)}</span>
                        <span style={{ ...styles.countChip, fontWeight: 700, color: !evm.cpi || evm.cpi < 1 ? '#dc2626' : '#16a34a' }}>CPI {fmtN(evm.cpi)}</span>
                        <span style={{ ...styles.countChip, fontWeight: 700, color: !evm.spi || evm.spi < 1 ? '#d97706' : '#16a34a' }}>SPI {fmtN(evm.spi)}</span>
                      </>}
                    </div>
                  );
                })()}
              </Link>
            ))}
          </div>
          {portfolios.length > 5 && (
            <Link to="/portfolios" style={styles.viewAll}>View all portfolios →</Link>
          )}
        </section>
      )}

      {/* ── Schedule View ────────────────────────────────────────────── */}
      <section style={{ ...styles.section, marginBottom: '1.5rem' }}>
        <button onClick={() => setScheduleOpen(o => !o)} style={styles.scheduleToggle}>
          <div style={styles.sectionTitle}>
            📅 Schedule View
            {!prLoad && programs && (
              <span style={{ ...styles.badge, background: '#0891b2' }}>{programs.length} programs</span>
            )}
          </div>
          <span style={{ ...styles.chevron, transform: scheduleOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
        </button>

        {scheduleOpen && (
          <div style={{ marginTop: '1rem' }}>
            {(prLoad || pjLoad) && <div style={styles.loading}>Loading schedule…</div>}

            {!prLoad && !pjLoad && ganttItems.length === 0 && (
              <div style={styles.empty}>No programs or projects found.</div>
            )}

            {!prLoad && !pjLoad && ganttItems.length > 0 && (
              <GanttChart
                items={ganttItems}
                nameField="name"
                endDateField="end_date"
                showCriticalPath={false}
                timeUnit="month"
              />
            )}
          </div>
        )}
      </section>

      {/* ── Risk Management group ────────────────────────────────────── */}
      <section style={{ ...styles.section, marginBottom: '1.5rem' }}>
        <button onClick={() => setRiskOpen(o => !o)} style={styles.scheduleToggle}>
          <div style={styles.sectionTitle}>
            ⚠️ Risk Management
            {totalAlerts > 0 && (
              <span style={{ ...styles.badge, background: '#dc2626' }}>{totalAlerts}</span>
            )}
          </div>
          <span style={{ ...styles.chevron, transform: riskOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
        </button>

        {riskOpen && (
        <div style={{ ...styles.panelRow, marginTop: '1.25rem', marginBottom: 0 }}>

      {/* ── High-Risk Tasks ───────────────────────────────────────────── */}
      <section style={{ ...styles.section, flex: '1 1 0', minWidth: 0 }}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>
            🔴 High &amp; Critical Risk Tasks
            {!rLoad && highRisk && (
              <span style={styles.badge}>{highRisk.length}</span>
            )}
          </h2>
          <span style={styles.sectionHint}>Tasks with a risk rating &gt; 10 (High ≥ 11, Critical &gt; 15)</span>
        </div>

        {rLoad && <div style={styles.loading}>Loading…</div>}

        {!rLoad && (!highRisk || highRisk.length === 0) && (
          <div style={styles.empty}>✅ No tasks exceed the risk threshold of 14.</div>
        )}

        {!rLoad && highRisk && highRisk.length > 0 && (
          <div style={styles.riskList}>
            {highRisk.map(task => {
              const colors = RISK_COLOR[task.risk_status] || RISK_COLOR['High Risk'];
              return (
                <Link key={task.id} to={taskUrl(task)} style={{ ...styles.riskRow, background: colors.bg, borderLeft: `4px solid ${colors.badge}`, textDecoration: 'none', color: 'inherit', display: 'flex' }}>
                  {/* Risk rate pill */}
                  <div style={{ ...styles.riskPill, background: colors.badge }}>
                    {task.risk_rate}
                  </div>

                  {/* Task info */}
                  <div style={styles.riskInfo}>
                    <div style={styles.riskTitle}>{task.title}</div>
                    <div style={styles.riskMeta}>
                      {task.project_id ? (
                        <>
                          <span style={styles.riskLink}>📁 {task.project_name}</span>
                          {task.program_name && (
                            <><span style={styles.riskSep}>·</span><span style={{ ...styles.riskLink, color: '#6b7280' }}>📂 {task.program_name}</span></>
                          )}
                        </>
                      ) : task.program_id ? (
                        <span style={styles.riskLink}>📂 {task.program_name}</span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Portfolio-level task</span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <div style={{ ...styles.riskStatus, color: colors.text, background: colors.border }}>
                    {task.risk_status}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Overdue Tasks ────────────────────────────────────────────── */}
      <section style={{ ...styles.section, flex: '1 1 0', minWidth: 0 }}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>
            ⏰ Overdue Tasks
            {!oLoad && overdue && overdue.length > 0 && (
              <span style={{ ...styles.badge, background: '#dc2626' }}>{overdue.length}</span>
            )}
          </h2>
          <span style={styles.sectionHint}>Open tasks past their due date</span>
        </div>

        {oLoad && <div style={styles.loading}>Loading…</div>}

        {!oLoad && (!overdue || overdue.length === 0) && (
          <div style={styles.empty}>✅ No overdue tasks — everything is on track!</div>
        )}

        {!oLoad && overdue && overdue.length > 0 && (
          <div style={styles.riskList}>
            {overdue.map(task => {
              const daysOver = Math.floor(
                (Date.now() - new Date(task.due_date + 'T00:00:00').getTime()) / 86400000
              );
              const urgency = daysOver >= 14
                ? { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', label: `${daysOver}d overdue` }
                : daysOver >= 7
                ? { bg: '#fff7ed', border: '#ea580c', text: '#9a3412', label: `${daysOver}d overdue` }
                : { bg: '#fefce8', border: '#ca8a04', text: '#854d0e', label: `${daysOver}d overdue` };

              return (
                <Link key={task.id} to={taskUrl(task)} style={{ ...styles.riskRow, background: urgency.bg, borderLeft: `4px solid ${urgency.border}`, textDecoration: 'none', color: 'inherit', display: 'flex' }}>
                  {/* Days overdue pill */}
                  <div style={{ ...styles.overduePill, background: urgency.border }}>
                    <span style={styles.overdueNum}>{daysOver}</span>
                    <span style={styles.overdueUnit}>d</span>
                  </div>

                  {/* Task info */}
                  <div style={styles.riskInfo}>
                    <div style={styles.riskTitle}>{task.title}</div>
                    <div style={styles.riskMeta}>
                      <span style={{ fontSize: '0.78rem', color: urgency.text, fontWeight: 600 }}>
                        Due {task.due_date}
                      </span>
                      {(task.project_id || task.program_id) && (
                        <span style={styles.riskSep}>·</span>
                      )}
                      {task.project_id ? (
                        <>
                          <span style={styles.riskLink}>📁 {task.project_name}</span>
                          {task.program_name && (
                            <>
                              <span style={styles.riskSep}>·</span>
                              <span style={{ ...styles.riskLink, color: '#6b7280' }}>📂 {task.program_name}</span>
                            </>
                          )}
                        </>
                      ) : task.program_id ? (
                        <span style={styles.riskLink}>📂 {task.program_name}</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Task status badge */}
                  <div style={{ ...styles.riskStatus, color: urgency.text, background: urgency.border + '33', border: `1px solid ${urgency.border}66` }}>
                    {task.status.replace('_', ' ')}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Over Budget Tasks ─────────────────────────────────────────── */}
      <section style={{ ...styles.section, flex: '1 1 0', minWidth: 0 }}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>
            💸 Over Budget Tasks
            {!obLoad && overBudget && overBudget.length > 0 && (
              <span style={{ ...styles.badge, background: '#b45309' }}>{overBudget.length}</span>
            )}
          </h2>
          <span style={styles.sectionHint}>Tasks where actual hours exceed estimated hours</span>
        </div>

        {obLoad && <div style={styles.loading}>Loading…</div>}

        {!obLoad && (!overBudget || overBudget.length === 0) && (
          <div style={styles.empty}>✅ No tasks are over budget — all within estimated hours!</div>
        )}

        {!obLoad && overBudget && overBudget.length > 0 && (
          <div style={styles.riskList}>
            {overBudget.map(task => {
              const hoursOver = task.total_actual != null && task.total_estimated != null
                ? Math.max(0, task.total_actual - task.total_estimated)
                : (task.hours_over ?? 0);
              const pct = task.total_estimated > 0
                ? Math.round((task.total_actual / task.total_estimated) * 100)
                : null;
              const costOverrun = task.cost_overrun ?? 0;
              const urgency = hoursOver >= 20
                ? { bg: '#fef2f2', border: '#dc2626', text: '#991b1b' }
                : hoursOver >= 8
                ? { bg: '#fff7ed', border: '#ea580c', text: '#9a3412' }
                : { bg: '#fefce8', border: '#ca8a04', text: '#854d0e' };

              return (
                <Link key={task.id} to={taskUrl(task)} style={{ ...styles.riskRow, background: urgency.bg, borderLeft: `4px solid ${urgency.border}`, textDecoration: 'none', color: 'inherit', display: 'flex' }}>
                  {/* Hours-over pill */}
                  <div style={{ ...styles.overduePill, background: urgency.border, minWidth: '52px' }}>
                    <span style={styles.overdueNum}>+{hoursOver.toFixed(1)}</span>
                    <span style={styles.overdueUnit}>h</span>
                  </div>

                  {/* Task info */}
                  <div style={styles.riskInfo}>
                    <div style={styles.riskTitle}>{task.title}</div>
                    <div style={styles.riskMeta}>
                      <span style={{ fontSize: '0.78rem', color: urgency.text, fontWeight: 600 }}>
                        {task.total_actual != null ? `${task.total_actual}h actual` : ''}{pct !== null ? ` (${pct}% of est.)` : ''}
                      </span>
                      {costOverrun > 0 && (
                        <>
                          <span style={styles.riskSep}>·</span>
                          <span style={{ fontSize: '0.78rem', color: urgency.text, fontWeight: 700, background: urgency.border + '22', border: `1px solid ${urgency.border}55`, borderRadius: '4px', padding: '1px 6px' }}>
                            ${costOverrun.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} over budget
                          </span>
                        </>
                      )}
                      {(task.project_id || task.program_id) && (
                        <span style={styles.riskSep}>·</span>
                      )}
                      {task.project_id ? (
                        <>
                          <span style={styles.riskLink}>📁 {task.project_name}</span>
                          {task.program_name && (
                            <>
                              <span style={styles.riskSep}>·</span>
                              <span style={{ ...styles.riskLink, color: '#6b7280' }}>📂 {task.program_name}</span>
                            </>
                          )}
                        </>
                      ) : task.program_id ? (
                        <span style={styles.riskLink}>📂 {task.program_name}</span>
                      ) : null}
                    </div>
                  </div>

                  {/* % over budget badge */}
                  <div style={{ ...styles.riskStatus, color: urgency.text, background: urgency.border + '33', border: `1px solid ${urgency.border}66` }}>
                    {task.status.replace('_', ' ')}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

        </div>
        )}
      </section>

      {/* ── EVM: per-portfolio earned value ──────────────────────────── */}
      {portfolios && portfolios.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>📊 Earned Value — Portfolio Overview</h2>
          {portfolios.map(p => (
            <div key={p.id} style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0A2B14', marginBottom: '0.5rem', paddingLeft: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📂 {p.name}
              </div>
              <EVMPanel parentType="portfolio" parentId={p.id} />
            </div>
          ))}
        </section>
      )}

    </div>
  );
}

function statusStyle(status) {
  if (status === 'active')  return { background: '#dcfce7', color: '#166534' };
  if (status === 'on_hold') return { background: '#fef9c3', color: '#854d0e' };
  return                           { background: '#f3f4f6', color: '#6b7280' };
}

function StatCard({ label, value, bg, loading }) {
  return (
    <div style={{ ...styles.card, background: bg }}>
      <div style={styles.cardValue}>{loading ? '...' : value}</div>
      <div style={styles.cardLabel}>{label}</div>
    </div>
  );
}

const styles = {
  heading:      { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d', marginBottom: '0.25rem' },
  sub:          { color: '#6b7280', marginBottom: '2rem' },
  cards:        { display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2.5rem' },
  card:         { borderRadius: '12px', padding: '1.25rem 1.5rem', minWidth: '140px', flex: '1 1 140px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
  cardValue:    { fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem', color: '#fff' },
  cardLabel:    { fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' },
  panelRow:     { display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'flex-start' },
  section:      { background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionHeader:{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' },
  sectionTitle: { fontSize: '1.1rem', fontWeight: 700, color: '#1d1d1d', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 },
  sectionHint:  { fontSize: '0.78rem', color: '#9ca3af' },
  badge:        { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#dc2626', color: '#fff', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, padding: '1px 8px', minWidth: '22px' },
  loading:      { color: '#9ca3af', fontSize: '0.9rem', padding: '0.5rem 0' },
  empty:        { color: '#6b7280', fontSize: '0.9rem', padding: '0.75rem 0' },
  riskList:     { display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '21rem', overflowY: 'auto', paddingRight: '4px' },
  riskRow:      { display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid transparent' },
  riskPill:     { flexShrink: 0, minWidth: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.85rem' },
  overduePill:  { flexShrink: 0, minWidth: '44px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'baseline', justifyContent: 'center', color: '#fff', gap: '1px', padding: '0 6px' },
  overdueNum:   { fontWeight: 800, fontSize: '1rem', lineHeight: 1 },
  overdueUnit:  { fontWeight: 600, fontSize: '0.65rem', lineHeight: 1 },
  riskInfo:     { flex: 1, minWidth: 0 },
  riskTitle:    { fontWeight: 600, color: '#111827', fontSize: '0.92rem', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  riskMeta:     { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' },
  riskLink:     { fontSize: '0.8rem', color: '#016D2D', textDecoration: 'none', fontWeight: 500 },
  riskSep:      { color: '#d1d5db', fontSize: '0.8rem' },
  riskStatus:   { flexShrink: 0, fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', whiteSpace: 'nowrap' },
  list:           { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' },
  listName:       { fontWeight: 700, color: '#1d1d1d', fontSize: '0.95rem' },
  viewAll:        { display: 'inline-block', marginTop: '0.75rem', color: '#016D2D', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 600 },
  portfolioItem:  { display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.85rem 1rem', background: '#f9fafb', borderRadius: '8px', textDecoration: 'none', color: 'inherit', border: '1px solid #f0f0f0', transition: 'background 0.15s' },
  portfolioTop:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' },
  portfolioDate:  { fontSize: '0.8rem', color: '#6b7280' },
  portfolioCounts:{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.1rem' },
  countChip:      { fontSize: '0.75rem', color: '#6b7280', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '999px', padding: '2px 9px', fontWeight: 500 },
  statusPill:       { fontSize: '0.7rem', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', textTransform: 'capitalize', whiteSpace: 'nowrap' },
  scheduleToggle:   { display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' },
  chevron:          { fontSize: '1rem', color: '#9ca3af', transition: 'transform 0.2s ease', flexShrink: 0 },
  scheduleProgram:  { paddingTop: '1.25rem', paddingBottom: '1.25rem' },
  programHeader:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' },
  programName:      { fontWeight: 700, color: '#1d1d1d', fontSize: '0.95rem', textDecoration: 'none', display: 'block' },
  programMeta:      { fontSize: '0.78rem', color: '#9ca3af', marginLeft: '1.25rem' },
};
