import { useState, useEffect } from 'react';
import client from '../api/client';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import ProgressBar from './ProgressBar';
import TaskForm from './TaskForm';
import ConfirmDialog from './ConfirmDialog';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import BugReportIcon from '@mui/icons-material/BugReport';
import StarIcon from '@mui/icons-material/Star';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// ── Helpers ───────────────────────────────────────────────────────────────────
function toLocalDateStr(d) {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

function sprintEndDate(sprint) {
  if (!sprint) return '';
  const d = new Date(sprint.start_date + 'T00:00:00');
  d.setDate(d.getDate() + sprint.duration_weeks * 7 - 3);
  return toLocalDateStr(d);
}

function findCurrentSprint(sprints) {
  const today = toLocalDateStr(new Date());
  const active = sprints.find(s => s.start_date <= today && sprintEndDate(s) >= today);
  if (active) return active;
  const past = sprints.filter(s => s.start_date <= today).sort((a, b) => b.start_date.localeCompare(a.start_date));
  if (past.length) return past[0];
  const future = sprints.filter(s => s.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  return future[0] || null;
}

const SPRINT_STATUS_META = {
  planned:   { label: 'Planned',   bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  active:    { label: 'Active',    bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  completed: { label: 'Completed', bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
};

const TASK_TYPE_META = {
  feature: { label: 'Feature', color: '#2563eb', bg: '#dbeafe', icon: <StarIcon style={{ fontSize: 11 }} /> },
  bug_fix: { label: 'Bug Fix', color: '#dc2626', bg: '#fee2e2', icon: <BugReportIcon style={{ fontSize: 11 }} /> },
};

// ── Task table ────────────────────────────────────────────────────────────────
function TaskRow({ task, canEdit, onEdit, onDelete, zebra }) {
  const [hovered, setHovered] = useState(false);
  const typeMeta = task.task_type ? TASK_TYPE_META[task.task_type] : null;
  const pct      = task.percent_complete ?? 0;
  const today    = toLocalDateStr(new Date());
  const overdue  = task.due_date && task.due_date < today && task.status !== 'completed';
  const rowBg    = hovered ? '#f0fdf4' : zebra ? '#fafafa' : '#fff';

  return (
    <tr
      style={{ background: rowBg, transition: 'background 0.1s', cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Title — clicking opens edit form */}
      <td style={tbl.td} onClick={() => onEdit(task)}>
        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#016D2D', textDecoration: hovered ? 'underline' : 'none' }}>
          {task.title}
        </span>
        {task.description && (
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.description}
          </div>
        )}
      </td>
      {/* Estimated Duration */}
      <td style={{ ...tbl.td, whiteSpace: 'nowrap' }}>
        {task.estimated_hours
          ? <span style={{ fontSize: '0.82rem', color: '#374151' }}>{task.estimated_hours}h</span>
          : <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>—</span>}
      </td>
      {/* Type */}
      <td style={tbl.td}>
        {typeMeta ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: typeMeta.bg, color: typeMeta.color }}>
            {typeMeta.icon}{typeMeta.label}
          </span>
        ) : (
          <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>—</span>
        )}
      </td>
      {/* Priority */}
      <td style={tbl.td}><PriorityBadge priority={task.priority} /></td>
      {/* Status */}
      <td style={tbl.td}><StatusBadge status={task.status} /></td>
      {/* Progress */}
      <td style={tbl.td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <ProgressBar value={pct} size="sm" showLabel={false} />
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: pct >= 75 ? '#16a34a' : pct >= 40 ? '#d97706' : '#6b7280', minWidth: 30, textAlign: 'right' }}>
            {pct}%
          </span>
        </div>
      </td>
      {/* Resources */}
      <td style={tbl.td}>
        {task.resource_names && task.resource_names.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {task.resource_names.map((name, i) => (
              <span key={i} style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', color: '#016D2D', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>
                {name}
              </span>
            ))}
          </div>
        ) : (
          <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>—</span>
        )}
      </td>
      {/* Due date */}
      <td style={tbl.td}>
        {task.due_date ? (
          <span style={{ fontSize: '0.82rem', fontWeight: overdue ? 700 : 400, color: overdue ? '#dc2626' : '#374151' }}>
            {overdue && '⚠ '}{task.due_date}
          </span>
        ) : (
          <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>—</span>
        )}
      </td>
      {/* Actions */}
      {canEdit && (
        <td style={{ ...tbl.td, textAlign: 'center' }}>
          <button style={tbl.editBtn} onClick={(e) => { e.stopPropagation(); onEdit(task); }} title="Edit">
            <EditIcon style={{ fontSize: 15 }} />
          </button>
          <button style={tbl.deleteBtn} onClick={(e) => { e.stopPropagation(); onDelete(task); }} title="Delete">
            <DeleteIcon style={{ fontSize: 15 }} />
          </button>
        </td>
      )}
    </tr>
  );
}

function TaskTable({ tasks, canEdit, onEdit, onDelete }) {
  if (tasks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#c4c4c4', fontSize: '0.9rem', border: '2px dashed #f0f0f0', borderRadius: 12 }}>
        No tasks in this phase for the selected sprint.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1.5px solid #e5e7eb' }}>
      <table style={tbl.table}>
        <thead>
          <tr>
            <th style={tbl.th}>Task</th>
            <th style={{ ...tbl.th, width: 90 }}>Est. Duration</th>
            <th style={tbl.th}>Type</th>
            <th style={tbl.th}>Priority</th>
            <th style={tbl.th}>Status</th>
            <th style={{ ...tbl.th, width: 130 }}>Progress</th>
            <th style={tbl.th}>Resources</th>
            <th style={tbl.th}>Due Date</th>
            {canEdit && <th style={{ ...tbl.th, width: 80, textAlign: 'center' }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, i) => (
            <TaskRow
              key={task.id}
              task={task}
              canEdit={canEdit}
              onEdit={onEdit}
              onDelete={onDelete}
              zebra={i % 2 !== 0}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tbl = {
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' },
  th:        { padding: '0.6rem 0.85rem', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  td:        { padding: '0.65rem 0.85rem', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  editBtn:   { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '3px 4px', borderRadius: 4, display: 'inline-flex', alignItems: 'center' },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '3px 4px', borderRadius: 4, display: 'inline-flex', alignItems: 'center' },
};

// ── Main board ────────────────────────────────────────────────────────────────
export default function SprintBoard({ projectId, parentType = 'project', canEdit, users = [] }) {
  const [sprints,       setSprints]       = useState([]);
  const [phases,        setPhases]        = useState([]);
  const [tasks,         setTasks]         = useState([]);
  const [selectedId,    setSelectedId]    = useState(null); // sprint id
  const [activePhaseId, setActivePhaseId] = useState(null); // phase tab id
  const [loading,       setLoading]       = useState(true);

  // Task form state
  const [showForm,          setShowForm]          = useState(false);
  const [editTask,          setEditTask]          = useState(null);
  const [deleteTask,        setDeleteTask]        = useState(null);
  const [showFinaliseConfirm, setShowFinaliseConfirm] = useState(false);
  const [showComingSoon,    setShowComingSoon]    = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    try {
      const [sRes, pRes, tRes] = await Promise.all([
        client.get('/sprints'),
        client.get('/agile-phases'),
        client.get(`/tasks?parent_type=${parentType}&parent_id=${projectId}`),
      ]);
      const sprintList = sRes.data || [];
      const phaseList  = pRes.data || [];
      setSprints(sprintList);
      setPhases(phaseList);
      setTasks(tRes.data || []);

      setSelectedId(prev => {
        if (prev !== null) return prev;
        const cur = findCurrentSprint(sprintList);
        return cur ? cur.id : (sprintList[0]?.id ?? null);
      });
      setActivePhaseId(prev => prev ?? (phaseList[0]?.id ?? null));
    } catch (e) {
      console.error('SprintBoard load error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedSprint = sprints.find(s => s.id === selectedId) || null;
  const sprintTasks    = tasks.filter(t => t.sprint_id === selectedId);

  const countByPhase = {};
  phases.forEach(p => { countByPhase[p.id] = 0; });
  countByPhase['unassigned'] = 0;
  sprintTasks.forEach(t => {
    if (t.agile_phase_id && countByPhase[t.agile_phase_id] !== undefined) {
      countByPhase[t.agile_phase_id]++;
    } else {
      countByPhase['unassigned']++;
    }
  });

  const visibleTasks = activePhaseId === 'unassigned'
    ? sprintTasks.filter(t => !t.agile_phase_id || !phases.find(p => p.id === t.agile_phase_id))
    : sprintTasks.filter(t => t.agile_phase_id === activePhaseId);

  const unassignedTab = countByPhase['unassigned'] > 0 ? [{ id: 'unassigned', name: 'Unassigned', color: '#9ca3af' }] : [];

  // Row 1: Backlog → Parked
  // Row 2: PM Scoping → PM Review
  // Row 3: Awaiting Deployment → end (+ unassigned)
  const parkedIdx   = phases.findIndex(p => p.name.toUpperCase() === 'PARKED');
  const pmReviewIdx = phases.findIndex(p => p.name.toUpperCase() === 'PM REVIEW');
  const row1Phases  = parkedIdx   >= 0 ? phases.slice(0, parkedIdx + 1)                       : phases;
  const row2Phases  = parkedIdx   >= 0 && pmReviewIdx >= 0 ? phases.slice(parkedIdx + 1, pmReviewIdx + 1) : (parkedIdx >= 0 ? phases.slice(parkedIdx + 1) : []);
  const row3Phases  = pmReviewIdx >= 0 ? [...phases.slice(pmReviewIdx + 1), ...unassignedTab]  : unassignedTab;
  const phaseTabs   = [...row1Phases, ...row2Phases, ...row3Phases]; // kept for any code that references it

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleEdit   = (task) => { setEditTask(task); setShowForm(true); };
  const handleDelete = async () => {
    try { await client.delete(`/tasks/${deleteTask.id}`); setDeleteTask(null); loadAll(); }
    catch { /* ignore */ }
  };
  const handleSave = () => { setShowForm(false); setEditTask(null); loadAll(); };

  const handleSprintStatusChange = async (newStatus) => {
    if (!selectedId) return;
    // Optimistically update local state
    setSprints(prev => prev.map(s => s.id === selectedId ? { ...s, status: newStatus } : s));
    try {
      await client.put(`/sprints/${selectedId}`, { status: newStatus });
    } catch {
      // Revert on failure
      loadAll();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: '#9ca3af' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTop: '3px solid #016D2D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 12 }} />
        Loading board…
      </div>
    );
  }

  return (
    <div>
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>

        {sprints.length === 0 ? (
          <span style={{ fontSize: '0.85rem', color: '#9ca3af', fontStyle: 'italic' }}>
            No sprints configured — go to Admin → Agile Projects → Sprint Management
          </span>
        ) : (
          <select
            value={selectedId ?? ''}
            onChange={e => setSelectedId(Number(e.target.value))}
            style={{ padding: '0.4rem 0.85rem', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: '0.88rem', fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' }}
          >
            {sprints.map(s => {
              const end   = sprintEndDate(s);
              const today = toLocalDateStr(new Date());
              const isCur = s.start_date <= today && end >= today;
              return (
                <option key={s.id} value={s.id}>
                  {isCur ? '▶ ' : ''}{s.name}  ({s.start_date} → {end})
                </option>
              );
            })}
          </select>
        )}

        {/* Sprint Status selector */}
        {selectedSprint && (() => {
          const statusMeta = SPRINT_STATUS_META[selectedSprint.status] || SPRINT_STATUS_META.planned;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.75rem', borderRadius: 8, border: `1.5px solid ${statusMeta.border}`, background: statusMeta.bg }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: statusMeta.color, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Sprint Status</span>
              <select
                value={selectedSprint.status || 'planned'}
                onChange={e => handleSprintStatusChange(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 700, color: statusMeta.color, cursor: 'pointer', outline: 'none', padding: '0 4px' }}
              >
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          );
        })()}

        {/* Finalise Sprint button — only when sprint is completed */}
        {selectedSprint?.status === 'completed' && (
          <button
            onClick={() => setShowFinaliseConfirm(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0.4rem 1rem', background: '#5b21b6', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            🏁 Finalise Sprint
          </button>
        )}

        {selectedSprint && (
          <span style={{ fontSize: '0.8rem', color: '#6b7280', background: '#f3f4f6', borderRadius: 20, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <DirectionsRunIcon style={{ fontSize: 13 }} />
            {selectedSprint.duration_weeks}w · {selectedSprint.start_date} → {sprintEndDate(selectedSprint)}
          </span>
        )}

        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
          {sprintTasks.length} task{sprintTasks.length !== 1 ? 's' : ''} in sprint
        </span>

        {canEdit && phases.length > 0 && sprints.length > 0 && (
          <button
            onClick={() => { setEditTask(null); setShowForm(true); }}
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0.45rem 1rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
          >
            <AddIcon style={{ fontSize: 16 }} />New Task
          </button>
        )}
      </div>

      {/* ── No phases ─────────────────────────────────────────────────────── */}
      {phases.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem', border: '2px dashed #e5e7eb', borderRadius: 12 }}>
          No Agile Phases configured. Go to <strong>Admin → Agile Projects → Agile Phases</strong> to set up your workflow stages.
        </div>
      )}

      {/* ── Phase tabs (three rows) ───────────────────────────────────────── */}
      {phaseTabs.length > 0 && (
        <>
          <div style={{ border: '1.5px solid #6b7280', borderRadius: 8, overflow: 'hidden', marginBottom: '1.25rem' }}>
          {[['Planning', row1Phases], ['Building', row2Phases], ['Rollout', row3Phases]].map(([rowLabel, rowTabs], rowIdx) => rowTabs.length === 0 ? null : (
            <div key={rowIdx} style={{ display: 'flex', alignItems: 'stretch', borderBottom: rowIdx === 2 ? 'none' : '1.5px solid #6b7280', background: rowIdx === 0 ? '#f0fdf4' : rowIdx === 1 ? '#dcfce7' : '#bbf7d0' }}>
              {/* Row label */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.75rem', width: 80, minWidth: 80, maxWidth: 80, borderRight: '1.5px solid #6b7280', flexShrink: 0, boxSizing: 'border-box' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6b7280', writingMode: 'horizontal-tb' }}>{rowLabel}</span>
              </div>
              <div style={{ display: 'flex', overflowX: 'auto', flex: 1 }}>
              {rowTabs.map(phase => {
                const isActive = activePhaseId === phase.id;
                const count    = countByPhase[phase.id] ?? 0;
                const accent   = phase.color || '#016D2D';
                return (
                  <button
                    key={phase.id}
                    onClick={() => setActivePhaseId(phase.id)}
                    style={{
                      padding: '0.55rem 1.1rem',
                      background: 'none',
                      border: 'none',
                      borderBottom: isActive ? `3px solid ${accent}` : '3px solid transparent',
                      marginBottom: -2,
                      cursor: 'pointer',
                      fontWeight: isActive ? 800 : 600,
                      fontSize: '0.82rem',
                      color: isActive ? accent : '#6b7280',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                  >
                    {phase.color && phase.id !== 'unassigned' && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: phase.color, flexShrink: 0 }} />
                    )}
                    {phase.name}
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700,
                      padding: '1px 7px', borderRadius: 20,
                      background: isActive ? accent : '#f3f4f6',
                      color: isActive ? '#fff' : '#6b7280',
                      transition: 'background 0.15s, color 0.15s',
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
              </div>{/* end scrollable tabs */}
            </div>
          ))}
          </div>{/* end border wrapper */}

          {/* ── Task table for active phase ────────────────────────────────── */}
          <TaskTable
            tasks={visibleTasks}
            canEdit={canEdit}
            onEdit={handleEdit}
            onDelete={setDeleteTask}
          />
        </>
      )}

      {/* ── Task form modal ───────────────────────────────────────────────── */}
      {(showForm || editTask) && (
        <TaskForm
          parentType={parentType}
          parentId={parseInt(projectId)}
          task={editTask || undefined}
          tasks={tasks}
          users={users}
          isAgile={true}
          sprints={sprints}
          agilePhases={phases}
          defaultSprintId={editTask?.sprint_id ?? selectedId}
          defaultPhaseId={editTask?.agile_phase_id ?? (activePhaseId !== 'unassigned' ? activePhaseId : null)}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTask(null); }}
        />
      )}

      {deleteTask && (
        <ConfirmDialog
          message={`Delete "${deleteTask.title}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTask(null)}
        />
      )}

      {/* ── Finalise Sprint confirmation ──────────────────────────────────── */}
      {showFinaliseConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', width: 460, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1d1d1d', marginBottom: '0.75rem' }}>Finalise Sprint</div>
            <p style={{ fontSize: '0.92rem', color: '#374151', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Are you sure you want to Finalise the Sprint and Generate the Sprint Report and Release Notes?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setShowFinaliseConfirm(false)}
                style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', fontSize: '0.88rem', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
              >
                No
              </button>
              <button
                onClick={() => { setShowFinaliseConfirm(false); setShowComingSoon(true); }}
                style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', background: '#5b21b6', fontSize: '0.88rem', fontWeight: 700, color: '#fff', cursor: 'pointer' }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Coming soon notice ────────────────────────────────────────────── */}
      {showComingSoon && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', width: 380, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🚧</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1d1d1d', marginBottom: '0.5rem' }}>Coming Soon</div>
            <p style={{ fontSize: '0.92rem', color: '#6b7280', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              This feature will be available soon.
            </p>
            <button
              onClick={() => setShowComingSoon(false)}
              style={{ padding: '0.5rem 1.5rem', borderRadius: 8, border: 'none', background: '#016D2D', fontSize: '0.88rem', fontWeight: 700, color: '#fff', cursor: 'pointer' }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
