import { useState, useEffect } from 'react';
import client from '../../api/client';

const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const STATUS_COLOR = { open: '#6b7280', in_progress: '#2563eb', completed: '#16a34a', cancelled: '#9ca3af' };
const STATUS_BG    = { open: '#f3f4f6', in_progress: '#eff6ff', completed: '#f0fdf4', cancelled: '#f9fafb' };

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0A2B14', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.4rem', marginBottom: '1rem' }}>{title}</div>
      {children}
    </div>
  );
}

export default function TaskStatusReport({ parentType, parentId }) {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState('all');
  const [sortBy, setSortBy]   = useState('status');

  useEffect(() => {
    setLoading(true);
    // Use EVM to get recursively scoped tasks (includes all child tasks)
    client.get(`/evm?parent_type=${parentType}&parent_id=${parentId}`)
      .then(res => setTasks(res.data?.tasks || []))
      .catch(e => setError(e.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [parentType, parentId]);

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading task status report…</div>;
  if (error)   return <div style={{ padding: '2rem', color: '#dc2626' }}>Error: {error}</div>;

  const isOverdue = (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';

  let filtered = [...tasks];
  if (filter === 'overdue')    filtered = filtered.filter(t => isOverdue(t));
  if (filter === 'open')       filtered = filtered.filter(t => t.status === 'open');
  if (filter === 'in_progress')filtered = filtered.filter(t => t.status === 'in_progress');
  if (filter === 'completed')  filtered = filtered.filter(t => t.status === 'completed');

  if (sortBy === 'status')    filtered.sort((a, b) => a.status.localeCompare(b.status));
  if (sortBy === 'due_date')  filtered.sort((a, b) => (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1);
  if (sortBy === 'pct')       filtered.sort((a, b) => (b.pct_complete || 0) - (a.pct_complete || 0));

  const stats = {
    total:       tasks.length,
    open:        tasks.filter(t => t.status === 'open').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed:   tasks.filter(t => t.status === 'completed').length,
    cancelled:   tasks.filter(t => t.status === 'cancelled').length,
    overdue:     tasks.filter(t => isOverdue(t)).length,
  };
  const avgComplete = stats.total > 0
    ? Math.round(tasks.reduce((a, t) => a + (t.pct_complete || 0), 0) / stats.total)
    : 0;

  return (
    <div className="report-page" style={{ background: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #0A2B14', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00FFBC', background: '#0A2B14', display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>TASK STATUS REPORT</div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0A2B14' }}>Task Status</h1>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.4rem' }}>
            Scope: <strong style={{ textTransform: 'capitalize' }}>{parentType}</strong> · {tasks.length} tasks
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#9ca3af' }}>
          <div style={{ fontWeight: 700, color: '#0A2B14', fontSize: '0.9rem' }}>Portfolio Manager</div>
          <div>Generated: {today}</div>
        </div>
      </div>

      {/* Summary */}
      <Section title="Task Overview">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Total',       value: stats.total,       color: '#374151' },
            { label: 'Open',        value: stats.open,        color: '#6b7280' },
            { label: 'In Progress', value: stats.in_progress, color: '#2563eb' },
            { label: 'Completed',   value: stats.completed,   color: '#16a34a' },
            { label: 'Overdue',     value: stats.overdue,     color: '#dc2626' },
            { label: 'Avg Complete',value: `${avgComplete}%`, color: '#7c3aed' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#f9fafb', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, lineHeight: 1.2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ background: '#f3f4f6', borderRadius: '8px', height: '20px', overflow: 'hidden', display: 'flex' }}>
          {stats.completed   > 0 && <div style={{ width: `${(stats.completed   / stats.total) * 100}%`, background: '#16a34a', transition: 'width 0.3s' }} title={`Completed: ${stats.completed}`} />}
          {stats.in_progress > 0 && <div style={{ width: `${(stats.in_progress / stats.total) * 100}%`, background: '#2563eb', transition: 'width 0.3s' }} title={`In Progress: ${stats.in_progress}`} />}
          {stats.open        > 0 && <div style={{ width: `${(stats.open        / stats.total) * 100}%`, background: '#d1d5db', transition: 'width 0.3s' }} title={`Open: ${stats.open}`} />}
          {stats.cancelled   > 0 && <div style={{ width: `${(stats.cancelled   / stats.total) * 100}%`, background: '#9ca3af', transition: 'width 0.3s' }} title={`Cancelled: ${stats.cancelled}`} />}
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.72rem', color: '#6b7280' }}>
          {[['#16a34a','Completed'],['#2563eb','In Progress'],['#d1d5db','Open'],['#9ca3af','Cancelled']].map(([bg, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '10px', background: bg, borderRadius: '2px' }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Filters + sort (no-print) */}
      <div className="no-print" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['all','open','in_progress','completed','overdue'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '0.3rem 0.65rem', border: `1px solid ${filter === f ? '#0A2B14' : '#e5e7eb'}`, borderRadius: '6px', background: filter === f ? '#0A2B14' : '#f9fafb', color: filter === f ? '#fff' : '#374151', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, textTransform: 'capitalize' }}>
              {f.replace('_',' ')} {f === 'all' ? `(${stats.total})` : f === 'overdue' ? `(${stats.overdue})` : `(${stats[f] ?? 0})`}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
          <label style={{ color: '#6b7280', fontWeight: 600 }}>Sort:</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '0.3rem 0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.8rem', background: '#fff' }}>
            <option value="status">Status</option>
            <option value="due_date">Due Date</option>
            <option value="pct">% Complete</option>
          </select>
        </div>
      </div>

      {/* Task table */}
      <Section title={`Tasks (${filtered.length})`}>
        {filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No tasks match the current filter.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['Task Title', 'Status', 'Due Date', '% Complete', 'Start', 'Finish', 'BAC', 'EAC'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const overdue = isOverdue(t);
                return (
                  <tr key={t.task_id} style={{ background: overdue ? '#fff5f5' : STATUS_BG[t.status] || '#fff' }}>
                    <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {overdue && <span style={{ color: '#dc2626', marginRight: '4px' }}>⚠</span>}
                      {t.task_title}
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: STATUS_COLOR[t.status] || '#374151', textTransform: 'uppercase' }}>{t.status?.replace('_',' ')}</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: overdue ? '#dc2626' : '#6b7280', fontWeight: overdue ? 700 : 400 }}>{t.due_date || '—'}</td>
                    <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ width: '60px', height: '6px', background: '#e5e7eb', borderRadius: '3px' }}>
                          <div style={{ width: `${t.pct_complete || 0}%`, height: '100%', background: '#016D2D', borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{t.pct_complete ?? 0}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{t.start_date || '—'}</td>
                    <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{t.due_date || '—'}</td>
                    <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{t.bac > 0 ? `$${Number(t.bac).toLocaleString('en-US', {maximumFractionDigits:0})}` : '—'}</td>
                    <td style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: t.eac > t.bac ? '#dc2626' : '#374151' }}>{t.bac > 0 ? `$${Number(t.eac).toLocaleString('en-US', {maximumFractionDigits:0})}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* Footer */}
      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#9ca3af' }}>
        <span>Portfolio Manager — Task Status Report — Confidential</span>
        <span>Generated {today}</span>
      </div>
    </div>
  );
}
