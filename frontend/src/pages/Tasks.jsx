import { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import TaskForm from '../components/TaskForm';
import ConfirmDialog from '../components/ConfirmDialog';

function ViewToggle({ view, onChange }) {
  const base = { padding: '0.3rem 0.85rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' };
  return (
    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <button style={{ ...base, borderRight: '1px solid #e5e7eb', background: view === 'card' ? '#016D2D' : '#fff', color: view === 'card' ? '#fff' : '#6b7280' }} onClick={() => onChange('card')}>⊞ List</button>
      <button style={{ ...base, background: view === 'table' ? '#016D2D' : '#fff', color: view === 'table' ? '#fff' : '#6b7280' }} onClick={() => onChange('table')}>☰ Table</button>
    </div>
  );
}

const EMPTY_FILTERS = { title: '', portfolio: '', program: '', project: '', assignee: '', status: '', priority: '', dueDate: '' };

export default function Tasks() {
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('pm_view_tasks') || 'card');
  const setView = (v) => { setViewMode(v); localStorage.setItem('pm_view_tasks', v); };
  const { data: tasks, loading, error, refetch } = useApi('/tasks');
  const { data: portfolios } = useApi('/portfolios');
  const { data: users } = useApi('/users');
  const [editTask, setEditTask]     = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [colFilters, setColFilters] = useState(EMPTY_FILTERS);

  const setColFilter = (col, val) => setColFilters(f => ({ ...f, [col]: val }));
  const hasActiveFilters = Object.values(colFilters).some(v => v !== '');
  const clearFilters = () => setColFilters(EMPTY_FILTERS);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // Unique values for dropdown filters
  const uniq = (key) => [...new Set((tasks || []).map(t => t[key]).filter(Boolean))].sort();

  const portfolioOptions = useMemo(() => uniq('portfolio_name'), [tasks]);
  const programOptions   = useMemo(() => uniq('program_name'),   [tasks]);
  const projectOptions   = useMemo(() => uniq('project_name'),   [tasks]);
  const assigneeOptions  = useMemo(() => uniq('assigned_username'), [tasks]);

  // Apply quick filter (all/mine/open/in_progress) then column filters
  const filtered = useMemo(() => {
    let list = tasks || [];
    // Quick filter
    if (filter === 'mine')        list = list.filter(t => t.assigned_to === user?.id);
    else if (filter === 'open')   list = list.filter(t => t.status === 'open');
    else if (filter === 'in_progress') list = list.filter(t => t.status === 'in_progress');

    // Column filters
    const { title, portfolio, program, project, assignee, status, priority, dueDate } = colFilters;
    if (title)     list = list.filter(t => t.title?.toLowerCase().includes(title.toLowerCase()));
    if (portfolio) list = list.filter(t => t.portfolio_name === portfolio);
    if (program)   list = list.filter(t => t.program_name   === program);
    if (project)   list = list.filter(t => t.project_name   === project);
    if (assignee)  list = list.filter(t => t.assigned_username === assignee);
    if (status)    list = list.filter(t => t.status          === status);
    if (priority)  list = list.filter(t => String(t.priority) === priority);
    if (dueDate)   list = list.filter(t => t.due_date        === dueDate);

    return list;
  }, [tasks, filter, colFilters, user]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol] ?? '';
      const bv = b[sortCol] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const handleSave = () => { setEditTask(null); setShowNewForm(false); refetch(); };
  const handleDelete = async () => { await client.delete(`/tasks/${deleteTask.id}`); setDeleteTask(null); refetch(); };

  const getHierarchyLabel = (task) => {
    const parts = [task.portfolio_name, task.program_name, task.project_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' › ') : `${task.parent_type} #${task.parent_id}`;
  };

  const SortTh = ({ col, label, style }) => {
    const active = sortCol === col;
    const icon = active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ↕';
    return (
      <th onClick={() => handleSort(col)} style={{ ...tStyles.th, cursor: 'pointer', userSelect: 'none', ...style }}>
        {label}<span style={{ opacity: active ? 1 : 0.45, fontSize: '0.65rem' }}>{icon}</span>
      </th>
    );
  };

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading...</div>;
  if (error)   return <div style={{ padding: '1rem', color: '#991b1b', background: '#fee2e2', borderRadius: '8px' }}>{error}</div>;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d' }}>Tasks</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <ViewToggle view={viewMode} onChange={setView} />
          {canEdit('tasks') && portfolios?.length > 0 && (
            <button style={{ padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
              onClick={() => setShowNewForm(true)}>+ New Task</button>
          )}
        </div>
      </div>

      {/* ── Quick filters ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'mine', 'open', 'in_progress'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '0.35rem 0.9rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem',
              background: filter === f ? '#016D2D' : '#f3f4f6', color: filter === f ? '#fff' : '#374151' }}>
            {f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        {hasActiveFilters && (
          <button onClick={clearFilters}
            style={{ padding: '0.35rem 0.9rem', borderRadius: '20px', border: '1px solid #fca5a5', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem', background: '#fee2e2', color: '#991b1b' }}>
            ✕ Clear filters
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#6b7280', alignSelf: 'center' }}>{sorted.length} tasks</span>
      </div>

      {sorted.length === 0 && <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No tasks match the current filter.</p>}

      {/* ── Card view ────────────────────────────────────────────── */}
      {viewMode === 'card' ? (
        <>
          {/* Inline filters for card view */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <FilterInput placeholder="Search title…"     value={colFilters.title}    onChange={v => setColFilter('title', v)} />
            <FilterSelect placeholder="Portfolio"        value={colFilters.portfolio} onChange={v => setColFilter('portfolio', v)} options={portfolioOptions} />
            <FilterSelect placeholder="Program"          value={colFilters.program}   onChange={v => setColFilter('program', v)}   options={programOptions} />
            <FilterSelect placeholder="Project"          value={colFilters.project}   onChange={v => setColFilter('project', v)}   options={projectOptions} />
            <FilterSelect placeholder="Responsible"       value={colFilters.assignee}  onChange={v => setColFilter('assignee', v)}  options={assigneeOptions} />
            <FilterSelect placeholder="Status"           value={colFilters.status}    onChange={v => setColFilter('status', v)}
              options={['open', 'in_progress', 'completed', 'cancelled']} labelFn={v => v.replace('_', ' ')} />
            <FilterSelect placeholder="Priority"         value={colFilters.priority}  onChange={v => setColFilter('priority', v)}
              options={[...Array(10)].map((_, i) => String(i + 1))} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sorted.map(task => (
              <div key={task.id} style={{ background: '#fff', borderRadius: '10px', padding: '1rem 1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <PriorityBadge priority={task.priority} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#1d1d1d' }}>{task.title}</div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: '#9ca3af', marginTop: '3px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#6b7280', fontStyle: 'italic' }}>{getHierarchyLabel(task)}</span>
                    {task.assigned_username && <span>→ {task.assigned_username}</span>}
                    {task.due_date && <span>Due: {task.due_date}</span>}
                  </div>
                </div>
                <StatusBadge status={task.status} />
                {canEdit('tasks') && (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => setEditTask(task)} style={{ padding: '3px 12px', background: '#d1fae5', color: '#014E20', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Edit</button>
                    <button onClick={() => setDeleteTask(task)} style={{ padding: '3px 12px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (

        /* ── Table view ─────────────────────────────────────────── */
        <div style={tStyles.tableWrap}>
          <table style={tStyles.table}>
            <thead>
              {/* Sort header row */}
              <tr>
                <SortTh col="priority"         label="Priority" />
                <SortTh col="title"            label="Title" />
                <SortTh col="portfolio_name"   label="Portfolio" />
                <SortTh col="program_name"     label="Program" />
                <SortTh col="project_name"     label="Project" />
                <SortTh col="assigned_username" label="Responsible" />
                <SortTh col="due_date"         label="Due Date" />
                <SortTh col="status"           label="Status" />
                {canEdit('tasks') && <th style={tStyles.th}>Actions</th>}
              </tr>

              {/* Filter row */}
              <tr style={{ background: '#014E20' }}>
                {/* Priority */}
                <td style={tStyles.filterCell}>
                  <select style={tStyles.filterSelect} value={colFilters.priority} onChange={e => setColFilter('priority', e.target.value)}>
                    <option value="">All</option>
                    {[...Array(10)].map((_, i) => <option key={i+1} value={String(i+1)}>{i+1}</option>)}
                  </select>
                </td>
                {/* Title */}
                <td style={tStyles.filterCell}>
                  <input style={tStyles.filterInput} placeholder="Search…" value={colFilters.title} onChange={e => setColFilter('title', e.target.value)} />
                </td>
                {/* Portfolio */}
                <td style={tStyles.filterCell}>
                  <select style={tStyles.filterSelect} value={colFilters.portfolio} onChange={e => setColFilter('portfolio', e.target.value)}>
                    <option value="">All</option>
                    {portfolioOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </td>
                {/* Program */}
                <td style={tStyles.filterCell}>
                  <select style={tStyles.filterSelect} value={colFilters.program} onChange={e => setColFilter('program', e.target.value)}>
                    <option value="">All</option>
                    {programOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </td>
                {/* Project */}
                <td style={tStyles.filterCell}>
                  <select style={tStyles.filterSelect} value={colFilters.project} onChange={e => setColFilter('project', e.target.value)}>
                    <option value="">All</option>
                    {projectOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </td>
                {/* Responsible */}
                <td style={tStyles.filterCell}>
                  <select style={tStyles.filterSelect} value={colFilters.assignee} onChange={e => setColFilter('assignee', e.target.value)}>
                    <option value="">All</option>
                    {assigneeOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </td>
                {/* Due Date — text search */}
                <td style={tStyles.filterCell}>
                  <input style={tStyles.filterInput} type="date" value={colFilters.dueDate || ''} onChange={e => setColFilter('dueDate', e.target.value)} />
                </td>
                {/* Status */}
                <td style={tStyles.filterCell}>
                  <select style={tStyles.filterSelect} value={colFilters.status} onChange={e => setColFilter('status', e.target.value)}>
                    <option value="">All</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                {canEdit('tasks') && (
                  <td style={tStyles.filterCell}>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} style={{ fontSize: '0.72rem', padding: '2px 8px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        ✕ Clear
                      </button>
                    )}
                  </td>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((task, i) => (
                <tr key={task.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                  <td style={tStyles.td}><PriorityBadge priority={task.priority} /></td>
                  <td style={tStyles.td}><div style={{ fontWeight: 600, color: '#1d1d1d', fontSize: '0.88rem' }}>{task.title}</div></td>
                  <td style={{ ...tStyles.td, fontSize: '0.82rem', color: '#6b7280' }}>{task.portfolio_name || '—'}</td>
                  <td style={{ ...tStyles.td, fontSize: '0.82rem', color: '#6b7280' }}>{task.program_name || '—'}</td>
                  <td style={{ ...tStyles.td, fontSize: '0.82rem', color: '#6b7280' }}>{task.project_name || '—'}</td>
                  <td style={{ ...tStyles.td, fontSize: '0.82rem', color: '#6b7280' }}>{task.assigned_username || '—'}</td>
                  <td style={{ ...tStyles.td, fontSize: '0.82rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{task.due_date || '—'}</td>
                  <td style={tStyles.td}><StatusBadge status={task.status} /></td>
                  {canEdit('tasks') && (
                    <td style={tStyles.td}>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button onClick={() => setEditTask(task)} style={{ padding: '3px 12px', background: '#d1fae5', color: '#014E20', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Edit</button>
                        <button onClick={() => setDeleteTask(task)} style={{ padding: '3px 12px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewForm && portfolios?.length > 0 && (
        <TaskForm parentType="portfolio" parentId={portfolios[0].id} users={users || []} onSave={handleSave} onCancel={() => setShowNewForm(false)} />
      )}
      {editTask && (
        <TaskForm parentType={editTask.parent_type} parentId={editTask.parent_id} task={editTask} users={users || []} onSave={handleSave} onCancel={() => setEditTask(null)} />
      )}
      {deleteTask && (
        <ConfirmDialog message={`Delete task "${deleteTask.title}"?`} onConfirm={handleDelete} onCancel={() => setDeleteTask(null)} />
      )}
    </div>
  );
}

/* ── Small reusable filter controls (card view) ─────────────────── */
function FilterInput({ placeholder, value, onChange }) {
  return (
    <input
      style={{ padding: '0.3rem 0.6rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.8rem', flex: '1 1 140px', minWidth: '120px' }}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}

function FilterSelect({ placeholder, value, onChange, options, labelFn }) {
  return (
    <select
      style={{ padding: '0.3rem 0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.8rem', flex: '1 1 120px', minWidth: '100px', background: '#fff' }}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map(v => <option key={v} value={v}>{labelFn ? labelFn(v) : v}</option>)}
    </select>
  );
}

const tStyles = {
  tableWrap:    { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  th:           { padding: '0.7rem 1rem', background: '#016D2D', color: '#fff', fontWeight: 700, fontSize: '0.8rem', textAlign: 'left', whiteSpace: 'nowrap' },
  filterCell:   { padding: '0.3rem 0.5rem', background: '#014E20' },
  filterInput:  { width: '100%', padding: '0.25rem 0.45rem', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '4px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.92)', color: '#1d1d1d', boxSizing: 'border-box' },
  filterSelect: { width: '100%', padding: '0.25rem 0.3rem', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '4px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.92)', color: '#1d1d1d', boxSizing: 'border-box' },
  td:           { padding: '0.65rem 1rem', fontSize: '0.88rem', color: '#374151', verticalAlign: 'middle' },
};
