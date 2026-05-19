import { useState, useEffect } from 'react';
import client from '../api/client';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import TaskForm from './TaskForm';
import ConfirmDialog from './ConfirmDialog';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
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
  // First preference: a sprint whose range contains today
  const active = sprints.find(s => s.start_date <= today && sprintEndDate(s) >= today);
  if (active) return active;
  // Next: the most recently started past sprint
  const past = sprints.filter(s => s.start_date <= today).sort((a, b) => b.start_date.localeCompare(a.start_date));
  if (past.length) return past[0];
  // Fallback: the soonest future sprint
  const future = sprints.filter(s => s.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  return future[0] || null;
}

const TASK_TYPE_META = {
  feature: { label: 'Feature', color: '#2563eb', bg: '#dbeafe', icon: <StarIcon style={{ fontSize: 11 }} /> },
  bug_fix: { label: 'Bug Fix', color: '#dc2626', bg: '#fee2e2', icon: <BugReportIcon style={{ fontSize: 11 }} /> },
};

// ── Card ──────────────────────────────────────────────────────────────────────
function TaskCard({ task, canEdit, onEdit, onDelete }) {
  const typeMeta = task.task_type ? TASK_TYPE_META[task.task_type] : null;
  const pct      = task.percent_complete ?? 0;
  const pctColor = pct >= 75 ? '#16a34a' : pct >= 40 ? '#d97706' : '#6b7280';

  return (
    <div style={cardSt.card}>
      {typeMeta && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: typeMeta.bg, color: typeMeta.color, marginBottom: 5 }}>
          {typeMeta.icon}{typeMeta.label}
        </span>
      )}
      <div style={cardSt.title}>{task.title}</div>
      {task.description && <div style={cardSt.desc}>{task.description}</div>}
      <div style={cardSt.meta}>
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={task.status} />
      </div>
      <div style={cardSt.footer}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: pctColor }}>{pct}%</span>
        {(task.assigned_username || task.assigned_to_name) && (
          <span style={{ fontSize: '0.72rem', color: '#9ca3af', background: '#f3f4f6', borderRadius: 20, padding: '1px 7px' }}>{task.assigned_username || task.assigned_to_name}</span>
        )}
        {canEdit && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            <button style={cardSt.iconBtn} onClick={() => onEdit(task)} title="Edit"><EditIcon style={{ fontSize: 14 }} /></button>
            <button style={{ ...cardSt.iconBtn, color: '#dc2626' }} onClick={() => onDelete(task)} title="Delete"><DeleteIcon style={{ fontSize: 14 }} /></button>
          </span>
        )}
      </div>
    </div>
  );
}

const cardSt = {
  card:    { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '0.75rem', marginBottom: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'default' },
  title:   { fontWeight: 700, fontSize: '0.9rem', color: '#1d1d1d', marginBottom: 4, lineHeight: 1.3 },
  desc:    { fontSize: '0.78rem', color: '#6b7280', marginBottom: 6, lineHeight: 1.4 },
  meta:    { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 },
  footer:  { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px 4px', borderRadius: 4, display: 'inline-flex', alignItems: 'center' },
};

// ── Column ────────────────────────────────────────────────────────────────────
function PhaseColumn({ phase, tasks, canEdit, onAddTask, onEdit, onDelete, totalCols }) {
  const minColWidth = Math.max(240, Math.floor((window.innerWidth - 320) / Math.max(totalCols, 1)));
  return (
    <div style={{ minWidth: Math.min(minColWidth, 300), flex: '1 1 260px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '0.75rem 0.75rem 1rem' }}>
      {/* Column header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {phase.color && (
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: phase.color, flexShrink: 0 }} />
          )}
          <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{phase.name}</span>
          <span style={{ background: '#e5e7eb', color: '#6b7280', borderRadius: 20, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{tasks.length}</span>
        </div>
        {canEdit && (
          <button
            style={{ background: '#016D2D', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}
            onClick={() => onAddTask(phase)}
            title={`Add task to ${phase.name}`}
          >
            <AddIcon style={{ fontSize: 14 }} />
          </button>
        )}
      </div>

      {/* Cards */}
      {tasks.length === 0 && (
        <div style={{ color: '#d1d5db', fontSize: '0.8rem', textAlign: 'center', padding: '1.5rem 0', fontStyle: 'italic' }}>No tasks</div>
      )}
      {tasks.map(t => (
        <TaskCard key={t.id} task={t} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

// ── Main board ────────────────────────────────────────────────────────────────
export default function SprintBoard({ projectId, parentType = 'project', canEdit, users = [] }) {
  const [sprints,      setSprints]      = useState([]);
  const [phases,       setPhases]       = useState([]);
  const [tasks,        setTasks]        = useState([]);
  const [selectedId,   setSelectedId]   = useState(null); // sprint id
  const [loading,      setLoading]      = useState(true);

  // Task form state
  const [showForm,     setShowForm]     = useState(false);
  const [editTask,     setEditTask]     = useState(null);
  const [deleteTask,   setDeleteTask]   = useState(null);
  const [defaultPhase, setDefaultPhase] = useState(null); // pre-fill phase when adding from column

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
      setSprints(sprintList);
      setPhases(pRes.data || []);
      setTasks(tRes.data || []);

      // Only set default sprint on first load
      setSelectedId(prev => {
        if (prev !== null) return prev;
        const cur = findCurrentSprint(sprintList);
        return cur ? cur.id : (sprintList[0]?.id ?? null);
      });
    } catch (e) {
      console.error('SprintBoard load error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ──────────────────────────────────────────────────────────
  const selectedSprint = sprints.find(s => s.id === selectedId) || null;
  const boardTasks     = tasks.filter(t => t.sprint_id === selectedId);

  // Group tasks by agile_phase_id; one bucket per phase + unassigned
  const tasksByPhase = {};
  phases.forEach(p => { tasksByPhase[p.id] = []; });
  tasksByPhase['unassigned'] = [];
  boardTasks.forEach(t => {
    if (t.agile_phase_id && tasksByPhase[t.agile_phase_id]) {
      tasksByPhase[t.agile_phase_id].push(t);
    } else {
      tasksByPhase['unassigned'].push(t);
    }
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddTask = (phase) => {
    setDefaultPhase(phase?.id !== 'unassigned' ? phase : null);
    setEditTask(null);
    setShowForm(true);
  };

  const handleEdit = (task) => {
    setEditTask(task);
    setDefaultPhase(null);
    setShowForm(true);
  };

  const handleDelete = async () => {
    try {
      await client.delete(`/tasks/${deleteTask.id}`);
      setDeleteTask(null);
      loadAll();
    } catch { /* ignore */ }
  };

  const handleSave = () => {
    setShowForm(false);
    setEditTask(null);
    setDefaultPhase(null);
    loadAll();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: '#9ca3af' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTop: '3px solid #016D2D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 12 }} />
        Loading board…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const totalCols = phases.length + (tasksByPhase['unassigned'].length > 0 || canEdit ? 1 : 0);

  return (
    <div>
      {/* ── Sprint selector bar ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <ViewKanbanIcon style={{ color: '#016D2D', fontSize: 22 }} />
        <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1d1d1d' }}>Sprint Board</span>

        {sprints.length === 0 ? (
          <span style={{ fontSize: '0.85rem', color: '#9ca3af', fontStyle: 'italic' }}>No sprints configured — create sprints in Admin → Agile Projects → Sprint Management</span>
        ) : (
          <select
            value={selectedId ?? ''}
            onChange={e => setSelectedId(Number(e.target.value))}
            style={{ padding: '0.35rem 0.75rem', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: '0.88rem', fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' }}
          >
            {sprints.map(s => {
              const end  = sprintEndDate(s);
              const today = toLocalDateStr(new Date());
              const isCurrent = s.start_date <= today && end >= today;
              return (
                <option key={s.id} value={s.id}>
                  {isCurrent ? '▶ ' : ''}{s.name}  ({s.start_date} → {end})
                </option>
              );
            })}
          </select>
        )}

        {selectedSprint && (
          <span style={{ fontSize: '0.8rem', color: '#6b7280', background: '#f3f4f6', borderRadius: 20, padding: '3px 10px' }}>
            <DirectionsRunIcon style={{ fontSize: 13, verticalAlign: 'middle', marginRight: 3 }} />
            {selectedSprint.duration_weeks}w · {selectedSprint.start_date} → {sprintEndDate(selectedSprint)}
          </span>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#9ca3af' }}>
          {boardTasks.length} task{boardTasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── No phases message ─────────────────────────────────────────────── */}
      {phases.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem', border: '2px dashed #e5e7eb', borderRadius: 12 }}>
          No Agile Phases configured. Go to <strong>Admin → Agile Projects → Agile Phases</strong> to create your workflow columns.
        </div>
      )}

      {/* ── Kanban columns ───────────────────────────────────────────────── */}
      {phases.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', alignItems: 'flex-start' }}>
          {phases.map(phase => (
            <PhaseColumn
              key={phase.id}
              phase={phase}
              tasks={tasksByPhase[phase.id] || []}
              canEdit={canEdit}
              onAddTask={handleAddTask}
              onEdit={handleEdit}
              onDelete={setDeleteTask}
              totalCols={totalCols}
            />
          ))}

          {/* Unassigned column — only show if there are unassigned tasks */}
          {tasksByPhase['unassigned'].length > 0 && (
            <PhaseColumn
              key="unassigned"
              phase={{ id: 'unassigned', name: 'Unassigned', color: '#9ca3af' }}
              tasks={tasksByPhase['unassigned']}
              canEdit={canEdit}
              onAddTask={() => handleAddTask(null)}
              onEdit={handleEdit}
              onDelete={setDeleteTask}
              totalCols={totalCols}
            />
          )}
        </div>
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
          defaultPhaseId={editTask?.agile_phase_id ?? defaultPhase?.id ?? null}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTask(null); setDefaultPhase(null); }}
        />
      )}

      {deleteTask && (
        <ConfirmDialog
          message={`Delete "${deleteTask.title}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTask(null)}
        />
      )}
    </div>
  );
}
