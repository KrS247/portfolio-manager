import { useState } from 'react';
import client from '../api/client';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import ProgressBar from './ProgressBar';
import TaskForm from './TaskForm';
import ConfirmDialog from './ConfirmDialog';
import InteractiveGanttChart from './InteractiveGanttChart';
import BaselinePanel from './BaselinePanel';

const RISK_COLORS = {
  'Low Risk':      { color: '#16a34a', bg: '#dcfce7' },
  'Medium Risk':   { color: '#d97706', bg: '#fef3c7' },
  'High Risk':     { color: '#ea580c', bg: '#ffedd5' },
  'Critical Risk': { color: '#dc2626', bg: '#fee2e2' },
};

// Build a tree from a flat task array using parent_task_id
function buildTree(tasks) {
  const byId = {};
  tasks.forEach(t => { byId[t.id] = { ...t, _children: [] }; });
  const roots = [];
  tasks.forEach(t => {
    if (t.parent_task_id && byId[t.parent_task_id]) {
      byId[t.parent_task_id]._children.push(byId[t.id]);
    } else {
      roots.push(byId[t.id]);
    }
  });
  return roots;
}

// Collect all descendant IDs of a task node (to guard circular refs in form)
function collectDescendantIds(node) {
  const ids = new Set();
  const walk = (n) => { ids.add(n.id); n._children.forEach(walk); };
  node._children.forEach(walk);
  return ids;
}

function TaskNode({ task, depth, canEdit, onEdit, onDelete, onAddSubtask, expandedIds, toggleExpand, dragId, onDragStart, onDragOver, onDrop, allTasks, idx }) {
  const hasChildren = task._children.length > 0;
  const isExpanded  = expandedIds.has(task.id);
  const pct       = task.percent_complete ?? 0;
  const pctColor  = pct >= 75 ? '#16a34a' : pct >= 40 ? '#d97706' : '#016D2D';
  const indent    = Math.min(depth, 5) * 20;

  return (
    <>
      <div
        draggable={canEdit && depth === 0}
        onDragStart={canEdit && depth === 0 ? (e) => onDragStart(e, task.id) : undefined}
        onDragOver={canEdit && depth === 0 ? onDragOver : undefined}
        onDrop={canEdit && depth === 0 ? (e) => onDrop(e, idx > 0 ? allTasks[idx - 1]?.id : null) : undefined}
        style={{
          ...styles.taskCard,
          marginLeft: indent,
          opacity: dragId === task.id ? 0.5 : 1,
          borderLeft: depth > 0 ? '3px solid #d1fae5' : '1.5px solid #e5e7eb',
        }}
      >
        <div style={styles.taskMain}>
          <div style={styles.taskLeft}>
            {/* Expand/collapse toggle */}
            <span
              style={{ ...styles.toggle, visibility: hasChildren ? 'visible' : 'hidden' }}
              onClick={() => toggleExpand(task.id)}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '▼' : '▶'}
            </span>
            {canEdit && depth === 0 && <span style={styles.grip} title="Drag to reorder">⠿</span>}
            <PriorityBadge priority={task.priority} />
            <div style={{ flex: 1 }}>
              <div style={styles.taskTitle}>
                {task.is_milestone ? '⭐ ' : ''}{task.title}
                {hasChildren && (
                  <span style={styles.subtaskCount}>{task._children.length} subtask{task._children.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              {task.description && <div style={styles.taskDesc}>{task.description}</div>}
              <div style={styles.taskMeta}>
                {task.due_date && <span>Due: {task.due_date}</span>}
                {task.assigned_to_name && <span>→ {task.assigned_to_name}</span>}
                {task.risk_status && (() => {
                  const rc = RISK_COLORS[task.risk_status] || {};
                  return (
                    <span style={{ background: rc.bg, color: rc.color, fontWeight: 700, borderRadius: '20px', padding: '1px 8px', fontSize: '0.72rem' }}>
                      ⚠️ {task.risk_status}
                    </span>
                  );
                })()}
              </div>
              <div style={styles.taskProgress}>
                <div style={{ flex: 1 }}>
                  <ProgressBar value={pct} size="sm" showLabel={false} />
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: pctColor, minWidth: '2.4rem', textAlign: 'right' }}>
                  {pct}%
                </span>
              </div>
            </div>
          </div>
          <div style={styles.taskRight}>
            <StatusBadge status={task.status} />
            {canEdit && (
              <div style={styles.taskActions}>
                <button style={styles.subtaskBtn} onClick={() => onAddSubtask(task)} title="Add subtask">+ Sub</button>
                <button style={styles.editBtn} onClick={() => onEdit(task)}>Edit</button>
                <button style={styles.deleteBtn} onClick={() => onDelete(task)}>Delete</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render children recursively */}
      {isExpanded && task._children.map((child, ci) => (
        <TaskNode
          key={child.id}
          task={child}
          depth={depth + 1}
          canEdit={canEdit}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddSubtask={onAddSubtask}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          dragId={dragId}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          allTasks={allTasks}
          idx={ci}
        />
      ))}
    </>
  );
}

export default function TaskList({ tasks, parentType, parentId, canEdit, canAdd = true, onRefresh, users = [] }) {
  const [view, setView]           = useState('list');
  const [showForm, setShowForm]   = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [subtaskParent, setSubtaskParent] = useState(null); // task to add subtask to
  const [dragId, setDragId]       = useState(null);
  // All root tasks start expanded
  const [expandedIds, setExpandedIds] = useState(() => new Set(tasks.map(t => t.id)));

  // Baseline overlay for Gantt
  const [baselineTasks, setBaselineTasks] = useState(null);

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    setShowForm(false);
    setEditTask(null);
    setSubtaskParent(null);
    onRefresh();
  };

  const handleDelete = async () => {
    await client.delete(`/tasks/${deleteTask.id}`);
    setDeleteTask(null);
    onRefresh();
  };

  const handleDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver  = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = async (e, afterId) => {
    e.preventDefault();
    if (dragId === null || dragId === afterId) return;
    try { await client.put(`/tasks/${dragId}/sequence`, { after_id: afterId }); onRefresh(); }
    catch { /* ignore */ }
    setDragId(null);
  };

  const tree      = buildTree(tasks);
  const rootTasks = tasks.filter(t => !t.parent_task_id);

  return (
    <div>
      <div style={styles.header}>
        <h3 style={styles.heading}>Tasks</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={styles.viewToggle}>
            <button style={{ ...styles.viewBtn, ...(view === 'list'  ? styles.viewBtnActive : {}) }} onClick={() => setView('list')}>☰ List</button>
            <button style={{ ...styles.viewBtn, ...(view === 'gantt' ? styles.viewBtnActive : {}) }} onClick={() => setView('gantt')}>📊 Gantt</button>
          </div>
          {canEdit && canAdd && (
            <button style={styles.addBtn} onClick={() => setShowForm(true)}>+ Add Task</button>
          )}
        </div>
      </div>

      {tasks.length === 0 && <p style={styles.empty}>No tasks yet.</p>}

      {/* ── Gantt view ───────────────────────────────────────────── */}
      {view === 'gantt' && tasks.length > 0 && (
        <>
          <InteractiveGanttChart
            parentType={parentType}
            parentId={parentId}
            items={tasks}
            canEdit={canEdit}
            onEdit={(task) => setEditTask(task)}
            timeUnit="month"
            baselineTasks={baselineTasks}
          />
          <BaselinePanel
            parentType={parentType}
            parentId={parentId}
            onBaselineSelected={setBaselineTasks}
          />
        </>
      )}

      {/* ── Tree list view ───────────────────────────────────────── */}
      <div style={{ display: view === 'list' ? 'flex' : 'none', flexDirection: 'column', gap: '0.4rem' }}>
        {tree.map((task, idx) => (
          <TaskNode
            key={task.id}
            task={task}
            depth={0}
            canEdit={canEdit}
            onEdit={setEditTask}
            onDelete={setDeleteTask}
            onAddSubtask={setSubtaskParent}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
            dragId={dragId}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            allTasks={rootTasks}
            idx={idx}
          />
        ))}
      </div>

      {/* ── Forms ───────────────────────────────────────────────── */}
      {(showForm || editTask || subtaskParent) && (
        <TaskForm
          parentType={parentType}
          parentId={parentId}
          task={editTask || undefined}
          parentTaskId={subtaskParent ? subtaskParent.id : (editTask?.parent_task_id ?? null)}
          tasks={tasks}
          users={users}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTask(null); setSubtaskParent(null); }}
        />
      )}

      {deleteTask && (
        <ConfirmDialog
          message={`Delete "${deleteTask.title}"? All its subtasks will also be deleted.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTask(null)}
        />
      )}
    </div>
  );
}

const styles = {
  header:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  heading:       { fontSize: '1rem', fontWeight: 700, color: '#374151' },
  addBtn:        { padding: '0.4rem 1rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
  viewToggle:    { display: 'flex', border: '1.5px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' },
  viewBtn:       { padding: '0.3rem 0.8rem', background: '#f9fafb', border: 'none', borderRight: '1.5px solid #e5e7eb', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: '#6b7280' },
  viewBtnActive: { background: '#016D2D', color: '#fff', borderRightColor: '#016D2D' },
  taskCard:    { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '0.75rem 1rem' },
  taskMain:    { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' },
  taskLeft:    { display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flex: 1 },
  toggle:      { fontSize: '0.65rem', color: '#9ca3af', cursor: 'pointer', padding: '3px 2px', userSelect: 'none', marginTop: '2px', flexShrink: 0 },
  grip:        { fontSize: '1.2rem', color: '#9ca3af', cursor: 'grab', userSelect: 'none', marginTop: '2px' },
  taskTitle:   { fontWeight: 600, color: '#1d1d1d', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  subtaskCount:{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', background: '#f3f4f6', borderRadius: '10px', padding: '1px 8px' },
  taskDesc:    { fontSize: '0.82rem', color: '#6b7280', marginTop: '2px' },
  taskMeta:    { display: 'flex', gap: '1rem', fontSize: '0.78rem', color: '#9ca3af', marginTop: '4px', flexWrap: 'wrap' },
  taskProgress:{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '6px' },
  taskRight:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 },
  taskActions: { display: 'flex', gap: '0.3rem' },
  subtaskBtn:  { padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 },
  editBtn:     { padding: '2px 10px', background: '#d1fae5', color: '#014E20', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  deleteBtn:   { padding: '2px 10px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  empty:       { color: '#9ca3af', fontSize: '0.9rem', fontStyle: 'italic', padding: '1rem 0' },
};
