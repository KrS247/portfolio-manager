import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';

const RISK_COLOR = {
  'Critical Risk': { bg: '#fef2f2', border: '#fca5a5', badge: '#dc2626', text: '#991b1b' },
  'High Risk':     { bg: '#fff7ed', border: '#fdba74', badge: '#ea580c', text: '#9a3412' },
  'Medium Risk':   { bg: '#fefce8', border: '#fde047', badge: '#ca8a04', text: '#854d0e' },
  'Low Risk':      { bg: '#f0fdf4', border: '#86efac', badge: '#16a34a', text: '#166534' },
};

const STATUS_ORDER = ['Critical Risk', 'High Risk', 'Medium Risk', 'Low Risk'];

const taskUrl = (risk) => {
  if (risk.project_id) return `/projects/${risk.project_id}`;
  if (risk.program_id) return `/programs/${risk.program_id}`;
  return '/tasks';
};

export default function RiskManagement() {
  const { data: risks, loading } = useApi('/risks');

  const [search,     setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPortfolio, setFilterPortfolio] = useState('all');
  const [sortField, setSortField]   = useState('risk_rate');
  const [sortDir,   setSortDir]     = useState('desc');

  const portfolios = useMemo(() => {
    if (!risks) return [];
    const seen = new Set();
    const list = [];
    risks.forEach(r => {
      if (r.portfolio_name && !seen.has(r.portfolio_id)) {
        seen.add(r.portfolio_id);
        list.push({ id: r.portfolio_id, name: r.portfolio_name });
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [risks]);

  const filtered = useMemo(() => {
    if (!risks) return [];
    let list = risks.filter(r => r.task_title); // skip risks with deleted tasks
    if (filterStatus !== 'all') list = list.filter(r => r.risk_status === filterStatus);
    if (filterPortfolio !== 'all') list = list.filter(r => String(r.portfolio_id) === filterPortfolio);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.task_title?.toLowerCase().includes(q) ||
        r.name?.toLowerCase().includes(q) ||
        r.project_name?.toLowerCase().includes(q) ||
        r.program_name?.toLowerCase().includes(q) ||
        r.portfolio_name?.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (sortField === 'risk_status') {
        av = STATUS_ORDER.indexOf(av);
        bv = STATUS_ORDER.indexOf(bv);
      }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [risks, filterStatus, filterPortfolio, search, sortField, sortDir]);

  const counts = useMemo(() => {
    if (!risks) return {};
    return risks.reduce((acc, r) => {
      acc[r.risk_status] = (acc[r.risk_status] || 0) + 1;
      return acc;
    }, {});
  }, [risks]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir(field === 'risk_rate' ? 'desc' : 'asc'); }
  };

  const sortIcon = (field) => sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div>
      <h1 style={styles.heading}>⚠️ Risk Management</h1>
      <p style={styles.sub}>All risks across portfolios, programs, and projects.</p>

      {/* Summary chips */}
      <div style={styles.summaryRow}>
        {STATUS_ORDER.map(s => {
          const c = RISK_COLOR[s];
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              style={{
                ...styles.summaryChip,
                background: filterStatus === s ? c.badge : c.bg,
                color: filterStatus === s ? '#fff' : c.text,
                border: `1px solid ${c.border}`,
              }}
            >
              {s} <span style={{ fontWeight: 800 }}>{counts[s] || 0}</span>
            </button>
          );
        })}
        <span style={styles.totalChip}>Total: {risks?.length ?? 0}</span>
      </div>

      {/* Filters */}
      <div style={styles.filtersRow}>
        <input
          style={styles.searchInput}
          placeholder="Search tasks, risks, projects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={styles.select} value={filterPortfolio} onChange={e => setFilterPortfolio(e.target.value)}>
          <option value="all">All Portfolios</option>
          {portfolios.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
        <select style={styles.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Risk Levels</option>
          {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading && <div style={styles.loading}>Loading risks…</div>}

      {!loading && filtered.length === 0 && (
        <div style={styles.empty}>✅ No risks match the current filters.</div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.theadRow}>
                <Th label="Risk Level"  field="risk_status" sort={toggleSort} icon={sortIcon('risk_status')} />
                <Th label="Task"        field="task_title"  sort={toggleSort} icon={sortIcon('task_title')} />
                <Th label="Risk Name"   field="name"        sort={toggleSort} icon={sortIcon('name')} />
                <Th label="Rating"      field="risk_rate"   sort={toggleSort} icon={sortIcon('risk_rate')} />
                <Th label="P × I"       field={null} />
                <Th label="Project"     field="project_name" sort={toggleSort} icon={sortIcon('project_name')} />
                <Th label="Program"     field="program_name" sort={toggleSort} icon={sortIcon('program_name')} />
                <Th label="Portfolio"   field="portfolio_name" sort={toggleSort} icon={sortIcon('portfolio_name')} />
                <Th label="Risk Status"  field="status"      sort={toggleSort} icon={sortIcon('status')} />
                <Th label="Task Status" field="task_status" sort={toggleSort} icon={sortIcon('task_status')} />
              </tr>
            </thead>
            <tbody>
              {filtered.map(risk => {
                const c = RISK_COLOR[risk.risk_status] || RISK_COLOR['Low Risk'];
                return (
                  <tr key={risk.id} style={styles.tbodyRow}>
                    {/* Risk level badge */}
                    <td style={styles.td}>
                      <span style={{ ...styles.levelBadge, background: c.badge, color: '#fff' }}>
                        {risk.risk_status}
                      </span>
                    </td>

                    {/* Task — clickable, navigates to parent project/program */}
                    <td style={styles.td}>
                      <Link to={taskUrl(risk)} style={styles.taskLink}>
                        {risk.task_title}
                      </Link>
                    </td>

                    {/* Risk name */}
                    <td style={{ ...styles.td, color: '#374151', fontSize: '0.85rem' }}>
                      {risk.name || <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>

                    {/* Rating pill */}
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <span style={{ ...styles.ratingPill, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                        {risk.risk_rate}
                      </span>
                    </td>

                    {/* P × I */}
                    <td style={{ ...styles.td, textAlign: 'center', color: '#6b7280', fontSize: '0.8rem' }}>
                      {risk.probability} × {risk.impact}
                    </td>

                    {/* Project */}
                    <td style={styles.td}>
                      {risk.project_id
                        ? <Link to={`/projects/${risk.project_id}`} style={styles.hierLink}>📁 {risk.project_name}</Link>
                        : <span style={styles.dimText}>—</span>
                      }
                    </td>

                    {/* Program */}
                    <td style={styles.td}>
                      {risk.program_id
                        ? <Link to={`/programs/${risk.program_id}`} style={styles.hierLink}>📂 {risk.program_name}</Link>
                        : <span style={styles.dimText}>—</span>
                      }
                    </td>

                    {/* Portfolio */}
                    <td style={styles.td}>
                      {risk.portfolio_id
                        ? <Link to={`/portfolios/${risk.portfolio_id}`} style={{ ...styles.hierLink, color: '#0891b2' }}>🗂 {risk.portfolio_name}</Link>
                        : <span style={styles.dimText}>—</span>
                      }
                    </td>

                    {/* Risk status */}
                    <td style={styles.td}>
                      <span style={{ ...styles.statusPill, ...riskStatusStyle(risk.status) }}>
                        {risk.status ? risk.status.charAt(0).toUpperCase() + risk.status.slice(1) : 'Open'}
                      </span>
                    </td>

                    {/* Task status */}
                    <td style={styles.td}>
                      <span style={{ ...styles.statusPill, ...taskStatusStyle(risk.task_status) }}>
                        {risk.task_status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ label, field, sort, icon }) {
  return (
    <th
      style={{ ...styles.th, cursor: sort && field ? 'pointer' : 'default' }}
      onClick={() => sort && field && sort(field)}
    >
      {label}{icon}
    </th>
  );
}

function riskStatusStyle(status) {
  if (status === 'active')    return { background: '#dbeafe', color: '#1e40af' };
  if (status === 'mitigated') return { background: '#dcfce7', color: '#166534' };
  if (status === 'closed')    return { background: '#f3f4f6', color: '#6b7280' };
  return { background: '#fef9c3', color: '#854d0e' }; // open
}

function taskStatusStyle(status) {
  if (status === 'completed')  return { background: '#dcfce7', color: '#166534' };
  if (status === 'in_progress') return { background: '#dbeafe', color: '#1e40af' };
  if (status === 'cancelled')  return { background: '#f3f4f6', color: '#6b7280' };
  return { background: '#fef9c3', color: '#854d0e' }; // open
}

const styles = {
  heading:     { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d', marginBottom: '0.25rem' },
  sub:         { color: '#6b7280', marginBottom: '1.5rem' },
  summaryRow:  { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' },
  summaryChip: { padding: '4px 14px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: 'none', display: 'flex', gap: '0.35rem', alignItems: 'center', transition: 'background 0.15s' },
  totalChip:   { marginLeft: 'auto', fontSize: '0.82rem', color: '#6b7280', fontWeight: 600 },
  filtersRow:  { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' },
  searchInput: { flex: '1 1 220px', padding: '0.45rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.88rem', outline: 'none' },
  select:      { padding: '0.45rem 0.65rem', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.88rem', background: '#fff', cursor: 'pointer' },
  loading:     { color: '#9ca3af', padding: '2rem 0', textAlign: 'center' },
  empty:       { color: '#6b7280', padding: '2rem 0', textAlign: 'center', fontSize: '0.95rem' },
  tableWrap:   { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto' },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  theadRow:    { background: '#f9fafb', borderBottom: '2px solid #e5e7eb' },
  th:          { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', userSelect: 'none' },
  tbodyRow:    { borderBottom: '1px solid #f3f4f6' },
  td:          { padding: '0.75rem 1rem', verticalAlign: 'middle' },
  levelBadge:  { display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' },
  taskLink:    { color: '#016D2D', fontWeight: 600, textDecoration: 'none', fontSize: '0.88rem' },
  ratingPill:  { display: 'inline-block', minWidth: '32px', textAlign: 'center', padding: '3px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.9rem' },
  hierLink:    { color: '#016D2D', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 500 },
  dimText:     { color: '#d1d5db', fontSize: '0.8rem' },
  statusPill:  { display: 'inline-block', padding: '2px 9px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap' },
};
