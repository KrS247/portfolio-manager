import { useState, useEffect } from 'react';
import client from '../api/client';
import PrioritySelect from './PrioritySelect';
import ProgressBar from './ProgressBar';

// ── Risk helpers ──────────────────────────────────────────────────────────────
function getRiskMeta(rate) {
  if (rate <= 5)  return { label: 'Low Risk',      color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' };
  if (rate <= 10) return { label: 'Medium Risk',   color: '#d97706', bg: '#fef3c7', border: '#fde68a' };
  if (rate <= 15) return { label: 'High Risk',     color: '#ea580c', bg: '#ffedd5', border: '#fed7aa' };
  return              { label: 'Critical Risk',    color: '#dc2626', bg: '#fee2e2', border: '#fecaca' };
}

const PROB_LABELS = { 1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very High' };
const IMP_LABELS  = { 1: 'Negligible', 2: 'Minor', 3: 'Moderate', 4: 'Major', 5: 'Severe' };

// ── Component ─────────────────────────────────────────────────────────────────
export default function TaskForm({ parentType, parentId, task, parentTaskId = null, tasks = [], onSave, onCancel, users = [] }) {
  const [activeTab, setActiveTab] = useState('task');

  // ── Task form state ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    title:            task?.title            || '',
    description:      task?.description      || '',
    notes:            task?.notes            || '',
    priority:         task?.priority         ?? 5,
    status:           task?.status           || 'open',
    percent_complete: task?.percent_complete ?? 0,
    start_date:       task?.start_date       || '',
    due_date:         task?.due_date         || '',
    assigned_to:      task?.assigned_to      || '',
    is_milestone:     task?.is_milestone     ? true : false,
    parent_task_id:   task?.parent_task_id   ?? parentTaskId ?? '',
  });

  // ── Schedule constraints state ───────────────────────────────────────────
  const [schedForm, setSchedForm] = useState({
    constraint_type: task?.constraint_type  || 'ASAP',
    constraint_date: task?.constraint_date  || '',
    schedule_mode:   task?.schedule_mode    || 'auto',
  });
  const setSched = (k, v) => setSchedForm(f => ({ ...f, [k]: v }));

  // Read-only CPM fields (display only)
  const cpmFields = task ? {
    early_start:   task.early_start,
    early_finish:  task.early_finish,
    late_start:    task.late_start,
    late_finish:   task.late_finish,
    float_days:    task.float_days,
    duration_days: task.duration_days,
  } : {};

  // ── Risk form state ──────────────────────────────────────────────────────
  const [riskForm, setRiskForm] = useState({
    name:            '',
    description:     '',
    probability:     3,
    impact:          3,
    mitigation_plan: '',
    status:          'open',
  });
  const [existingRisk, setExistingRisk] = useState(null);

  // ── Dependencies state ───────────────────────────────────────────────────
  // Multi-dependency with lag: [{ depends_on: taskId, lag_days: number }]
  const [deps, setDeps] = useState([]);
  const [newDepId, setNewDepId] = useState('');
  const [newDepLag, setNewDepLag] = useState(0);
  // Legacy single dep (keep for backward compat on load)
  const [selectedDep, setSelectedDep] = useState('');

  // ── Resourcing state ─────────────────────────────────────────────────────
  // resources: [{ user_id, estimated_hours, actual_hours, username, email, hourly_rate }]
  const [resources,    setResources]    = useState([]);
  const [addUserId,    setAddUserId]    = useState('');

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  // ── Computed risk values ─────────────────────────────────────────────────
  const riskRate = riskForm.probability * riskForm.impact;
  const riskMeta = getRiskMeta(riskRate);

  // ── Load existing risk when editing ─────────────────────────────────────
  useEffect(() => {
    if (!task?.id) return;
    client.get(`/risks?task_id=${task.id}`)
      .then(({ data }) => {
        const risk = Array.isArray(data) ? data[0] : data;
        if (risk) {
          setExistingRisk(risk);
          setRiskForm({
            name:            risk.name            || '',
            description:     risk.description     || '',
            probability:     risk.probability     || 3,
            impact:          risk.impact          || 3,
            mitigation_plan: risk.mitigation_plan || '',
            status:          risk.status          || 'open',
          });
        }
      })
      .catch(() => {});
  }, [task?.id]);

  // ── Load existing dependencies when editing ──────────────────────────────
  useEffect(() => {
    if (!task?.id) return;
    client.get(`/tasks/${task.id}/dependencies`)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setDeps(data.map(d => ({ depends_on: d.id, lag_days: d.lag_days ?? 0 })));
          setSelectedDep(data[0]?.id ?? '');
        }
      })
      .catch(() => {});
  }, [task?.id]);

  // ── Load existing resource allocations when editing ──────────────────────
  useEffect(() => {
    if (!task?.id) return;
    client.get(`/tasks/${task.id}/resources`)
      .then(({ data }) => { setResources(data || []); })
      .catch(() => {});
  }, [task?.id]);

  const set     = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setRisk = (k, v) => setRiskForm(f => ({ ...f, [k]: v }));

  // ── Resourcing helpers ───────────────────────────────────────────────────
  const addedUserIds = new Set(resources.map(r => r.user_id));
  const availableUsers = users.filter(u => !addedUserIds.has(u.id));

  const handleAddResource = () => {
    if (!addUserId) return;
    const user = users.find(u => u.id === parseInt(addUserId));
    if (!user || addedUserIds.has(user.id)) return;
    setResources(rs => [...rs, { user_id: user.id, username: user.username, email: user.email, hourly_rate: user.hourly_rate ?? null, estimated_hours: '', actual_hours: '' }]);
    setAddUserId('');
  };

  const handleRemoveResource = (userId) => {
    setResources(rs => rs.filter(r => r.user_id !== userId));
  };

  const handleHoursChange = (userId, field, val) => {
    setResources(rs => rs.map(r => r.user_id === userId ? { ...r, [field]: val } : r));
  };

  // ── Status / percent sync ────────────────────────────────────────────────
  const handleStatusChange = (newStatus) => {
    setForm(f => ({
      ...f,
      status: newStatus,
      percent_complete: newStatus === 'completed' ? 100 : f.percent_complete,
    }));
  };

  const handlePctChange = (newPct) => {
    setForm(f => ({
      ...f,
      percent_complete: newPct,
      status: newPct === 100 ? 'completed'
        : (f.status === 'completed' && newPct < 100) ? 'in_progress'
        : (f.status === 'open' && newPct > 0) ? 'in_progress'
        : f.status,
    }));
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Start date is required for non-milestone tasks
    if (!form.is_milestone && !form.start_date) {
      setError('Start date is required');
      setSaving(false);
      return;
    }

    // Due date is always required
    if (!form.due_date) {
      setError('Due date is required');
      setSaving(false);
      return;
    }

    if (form.due_date && form.start_date && form.due_date < form.start_date) {
      setError('Due date cannot be before start date');
      setSaving(false);
      return;
    }

    // Subtask date range must fit within the parent task's dates
    if (currentParentTask) {
      if (currentParentTask.start_date && form.start_date && form.start_date < currentParentTask.start_date) {
        setError(`Start date must be on or after the parent task's start date (${currentParentTask.start_date})`);
        setSaving(false);
        return;
      }
      if (currentParentTask.due_date && form.due_date && form.due_date > currentParentTask.due_date) {
        setError(`Due date must be on or before the parent task's due date (${currentParentTask.due_date})`);
        setSaving(false);
        return;
      }
    }

    try {
      // 1. Save the task
      const payload = {
        ...form,
        assigned_to:     form.assigned_to    || null,
        start_date:      form.is_milestone ? null : (form.start_date || null),
        due_date:        form.due_date       || null,
        is_milestone:    form.is_milestone ? 1 : 0,
        parent_type:     parentType,
        parent_id:       parentId,
        parent_task_id:  form.parent_task_id || null,
        constraint_type: schedForm.constraint_type,
        constraint_date: schedForm.constraint_date || null,
        schedule_mode:   schedForm.schedule_mode,
      };
      const { data: savedTask } = task
        ? await client.put(`/tasks/${task.id}`, payload)
        : await client.post('/tasks', payload);

      // 2. Save dependencies (new multi-dep format with lag)
      await client.put(`/tasks/${savedTask.id}/dependencies`, { dependencies: deps });

      // 3. Save resource hours
      await client.put(`/tasks/${savedTask.id}/resources`, {
        resources: resources.map(r => ({
          user_id:         r.user_id,
          estimated_hours: r.estimated_hours !== '' ? parseFloat(r.estimated_hours) : null,
          actual_hours:    r.actual_hours    !== '' ? parseFloat(r.actual_hours)    : null,
        })),
      });

      // 4. Save risk only if a name was entered
      if (riskForm.name.trim()) {
        const riskPayload = {
          task_id:         savedTask.id,
          name:            riskForm.name.trim(),
          description:     riskForm.description     || null,
          probability:     riskForm.probability,
          impact:          riskForm.impact,
          mitigation_plan: riskForm.mitigation_plan || null,
          status:          riskForm.status,
        };
        if (existingRisk) {
          await client.put(`/risks/${existingRisk.id}`, riskPayload);
        } else {
          await client.post('/risks', riskPayload);
        }
      }

      onSave(savedTask);
    } catch (err) {
      const msg = err.response?.data?.message
        || err.response?.data?.error?.message
        || err.response?.data?.error
        || 'Failed to save task';
      setError(typeof msg === 'string' ? msg : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const pctColor = form.percent_complete >= 75 ? '#16a34a' : form.percent_complete >= 40 ? '#d97706' : '#016D2D';

  // ── Parent task helpers ──────────────────────────────────────────────────
  // Collect all descendant IDs of the current task to prevent circular refs
  const getDescendantIds = (taskId, allTasks) => {
    const ids = new Set();
    const walk = (id) => {
      allTasks.filter(t => t.parent_task_id === id).forEach(t => { ids.add(t.id); walk(t.id); });
    };
    if (taskId) walk(taskId);
    return ids;
  };
  const descendantIds   = task?.id ? getDescendantIds(task.id, tasks) : new Set();
  const parentableTaskList = tasks.filter(t =>
    t.id !== task?.id && !descendantIds.has(t.id)
  );
  const currentParentTask = tasks.find(t => t.id === Number(form.parent_task_id));

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.title}>
          {task ? 'Edit Task' : (parentTaskId ? 'New Subtask' : 'New Task')}
        </h3>
        {/* Breadcrumb when editing/creating a subtask */}
        {currentParentTask && (
          <div style={styles.breadcrumb}>
            <span style={styles.breadcrumbParent}>{currentParentTask.title}</span>
            <span style={styles.breadcrumbSep}>›</span>
            <span style={styles.breadcrumbCurrent}>{form.title || (task ? task.title : 'New Subtask')}</span>
          </div>
        )}

        {/* ── Tab bar ────────────────────────────────────────────────── */}
        <div style={styles.tabBar}>
          <button
            type="button"
            style={{ ...styles.tab, ...(activeTab === 'task' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('task')}
          >
            📋 Task Details
          </button>
          <button
            type="button"
            style={{ ...styles.tab, ...(activeTab === 'risk' ? styles.tabActive : {}), ...(existingRisk || riskForm.name ? { color: activeTab === 'risk' ? '#fff' : '#dc2626' } : {}) }}
            onClick={() => setActiveTab('risk')}
          >
            ⚠️ Risk
            {existingRisk && (
              <span style={{ ...styles.tabBadge, background: activeTab === 'risk' ? 'rgba(255,255,255,0.25)' : getRiskMeta(existingRisk.risk_rate).bg, color: activeTab === 'risk' ? '#fff' : getRiskMeta(existingRisk.risk_rate).color }}>
                {existingRisk.risk_status}
              </span>
            )}
          </button>
          <button
            type="button"
            style={{ ...styles.tab, ...(activeTab === 'resourcing' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('resourcing')}
          >
            👥 Resourcing
            {resources.length > 0 && (
              <span style={{ ...styles.tabBadge, background: activeTab === 'resourcing' ? 'rgba(255,255,255,0.25)' : '#d1fae5', color: activeTab === 'resourcing' ? '#fff' : '#016D2D' }}>
                {resources.length}
              </span>
            )}
          </button>
          <button
            type="button"
            style={{ ...styles.tab, ...(activeTab === 'schedule' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('schedule')}
          >
            📅 Schedule
          </button>
          <button
            type="button"
            style={{ ...styles.tab, ...(activeTab === 'notes' ? styles.tabActive : {}), borderRight: 'none' }}
            onClick={() => setActiveTab('notes')}
          >
            📝 Notes
            {form.notes?.trim() && (
              <span style={{ ...styles.tabBadge, background: activeTab === 'notes' ? 'rgba(255,255,255,0.25)' : '#e0f2fe', color: activeTab === 'notes' ? '#fff' : '#0369a1' }}>✓</span>
            )}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>

          {/* ════════════════════════════════ TASK TAB ═══════════════ */}
          {activeTab === 'task' && (
            <>
              <label style={styles.label}>Title *</label>
              <input style={styles.input} value={form.title} onChange={e => set('title', e.target.value)} required placeholder="Task title" />

              <label style={styles.label}>Description</label>
              <textarea style={{ ...styles.input, height: '70px', resize: 'vertical' }}
                value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description" />

              <div style={styles.row}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Priority — 1 (Lowest) to 10 (Highest)</label>
                  <PrioritySelect value={form.priority} onChange={v => set('priority', v)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Status</label>
                  <select style={styles.input} value={form.status} onChange={e => handleStatusChange(e.target.value)}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <label style={styles.label}>% Complete</label>
              <div style={styles.sliderRow}>
                <input
                  type="range" min="0" max="100" step="5"
                  value={form.percent_complete}
                  onChange={e => handlePctChange(parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: pctColor, cursor: 'pointer' }}
                />
                <span style={{ minWidth: '3.2rem', textAlign: 'right', fontWeight: 800, fontSize: '1rem', color: pctColor }}>
                  {form.percent_complete}%
                </span>
              </div>
              <ProgressBar value={form.percent_complete} showLabel={false} />

              {/* ── Milestone toggle ───────────────────────────────── */}
              <label style={styles.milestoneRow}>
                <input
                  type="checkbox"
                  checked={form.is_milestone}
                  onChange={e => set('is_milestone', e.target.checked ? 1 : 0)}
                  style={{ accentColor: '#d97706', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 700, color: form.is_milestone ? '#d97706' : '#374151', fontSize: '0.9rem' }}>
                  ⭐ Milestone
                </span>
                {form.is_milestone && (
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
                    Milestones have a due date only — start date is not applicable.
                  </span>
                )}
              </label>

              {/* Parent date range hint for subtasks */}
              {currentParentTask && (currentParentTask.start_date || currentParentTask.due_date) && (
                <div style={styles.parentDateHint}>
                  <span>📅 Parent task date range:</span>
                  <strong>{currentParentTask.start_date || '–'}</strong>
                  <span>→</span>
                  <strong>{currentParentTask.due_date || '–'}</strong>
                  <span style={{ color: '#9ca3af' }}>(subtask dates must fall within this range)</span>
                </div>
              )}

              <div style={styles.row}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...styles.label, color: form.is_milestone ? '#d1d5db' : '#374151' }}>
                    Start Date{!form.is_milestone ? ' *' : ''}
                  </label>
                  <input
                    style={{ ...styles.input, background: form.is_milestone ? '#f9fafb' : '#fff', color: form.is_milestone ? '#9ca3af' : 'inherit', cursor: form.is_milestone ? 'not-allowed' : 'pointer' }}
                    type="date"
                    value={form.is_milestone ? '' : form.start_date}
                    disabled={!!form.is_milestone}
                    required={!form.is_milestone}
                    min={currentParentTask?.start_date || undefined}
                    max={currentParentTask?.due_date || form.due_date || undefined}
                    onChange={e => set('start_date', e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Due Date{form.is_milestone ? ' (Milestone Date)' : ' *'}</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={form.due_date}
                    required
                    min={form.start_date || currentParentTask?.start_date || undefined}
                    max={currentParentTask?.due_date || undefined}
                    onChange={e => set('due_date', e.target.value)}
                  />
                </div>
              </div>

              <label style={styles.label}>Responsible</label>
              <select style={styles.input} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>

              {/* ── Parent Task ────────────────────────────────────── */}
              {parentableTaskList.length > 0 && (
                <>
                  <label style={styles.label}>Parent Task</label>
                  <select
                    style={styles.input}
                    value={form.parent_task_id}
                    onChange={e => set('parent_task_id', e.target.value)}
                  >
                    <option value="">— None (root task) —</option>
                    {parentableTaskList.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </>
              )}

              {/* ── Dependencies (multi-dep + lag) ─────────────────── */}
              {tasks.filter(t => t.id !== task?.id).length > 0 && (
                <>
                  <label style={styles.label}>Dependencies</label>

                  {/* Existing dep rows */}
                  {deps.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.25rem' }}>
                      {deps.map((d, idx) => {
                        const depTask = tasks.find(t => t.id === d.depends_on);
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.35rem 0.65rem' }}>
                            <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>{depTask?.title || `Task #${d.depends_on}`}</span>
                            <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>Lag:</span>
                            <input
                              type="number" step="1"
                              value={d.lag_days}
                              onChange={e => {
                                const v = parseInt(e.target.value) || 0;
                                setDeps(prev => prev.map((dep, i) => i === idx ? { ...dep, lag_days: v } : dep));
                              }}
                              style={{ ...styles.input, width: '64px', padding: '0.25rem 0.4rem', fontSize: '0.85rem' }}
                              title="Lag days (positive = gap, negative = overlap)"
                            />
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>d</span>
                            <button type="button"
                              onClick={() => setDeps(prev => prev.filter((_, i) => i !== idx))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.85rem', padding: '0 4px' }}
                            >✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add a new dependency */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                      style={{ ...styles.input, flex: 1 }}
                      value={newDepId}
                      onChange={e => setNewDepId(e.target.value)}
                    >
                      <option value="">— Add predecessor —</option>
                      {tasks
                        .filter(t => t.id !== task?.id && !deps.some(d => d.depends_on === t.id))
                        .map(t => {
                          const statusIcon = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '⟳' : '○';
                          return <option key={t.id} value={t.id}>{statusIcon} {t.title}</option>;
                        })}
                    </select>
                    <input
                      type="number" step="1"
                      value={newDepLag}
                      onChange={e => setNewDepLag(parseInt(e.target.value) || 0)}
                      style={{ ...styles.input, width: '64px', padding: '0.25rem 0.4rem', fontSize: '0.85rem' }}
                      title="Lag days"
                      placeholder="lag"
                    />
                    <button
                      type="button"
                      disabled={!newDepId}
                      onClick={() => {
                        if (!newDepId) return;
                        setDeps(prev => [...prev, { depends_on: parseInt(newDepId), lag_days: newDepLag }]);
                        setNewDepId('');
                        setNewDepLag(0);
                      }}
                      style={{ ...styles.saveBtn, padding: '0.4rem 0.75rem', opacity: newDepId ? 1 : 0.45, whiteSpace: 'nowrap', fontSize: '0.85rem' }}
                    >+ Add</button>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>Lag: positive = gap days after predecessor, negative = overlap (lead time).</p>
                </>
              )}
            </>
          )}

          {/* ════════════════════════════════ RISK TAB ═══════════════ */}
          {activeTab === 'risk' && (
            <>
              <p style={styles.riskHint}>
                Leave <strong>Risk Name</strong> blank to skip adding a risk to this task.
              </p>

              <div style={styles.row}>
                <div style={{ flex: 2 }}>
                  <label style={styles.label}>Risk Name</label>
                  <input
                    style={styles.input}
                    value={riskForm.name}
                    onChange={e => setRisk('name', e.target.value)}
                    placeholder="e.g. Budget overrun, Key person dependency"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Status</label>
                  <select style={styles.input} value={riskForm.status} onChange={e => setRisk('status', e.target.value)}>
                    <option value="open">Open</option>
                    <option value="active">Active</option>
                    <option value="mitigated">Mitigated</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <label style={styles.label}>Description</label>
              <textarea
                style={{ ...styles.input, height: '64px', resize: 'vertical' }}
                value={riskForm.description}
                onChange={e => setRisk('description', e.target.value)}
                placeholder="Describe the risk in detail"
              />

              <div style={styles.row}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Probability (1–5)</label>
                  <select style={styles.input} value={riskForm.probability} onChange={e => setRisk('probability', parseInt(e.target.value))}>
                    {[1,2,3,4,5].map(n => (
                      <option key={n} value={n}>{n} — {PROB_LABELS[n]}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Impact (1–5)</label>
                  <select style={styles.input} value={riskForm.impact} onChange={e => setRisk('impact', parseInt(e.target.value))}>
                    {[1,2,3,4,5].map(n => (
                      <option key={n} value={n}>{n} — {IMP_LABELS[n]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Derived risk calculation panel */}
              <div style={{ ...styles.riskPanel, background: riskMeta.bg, borderColor: riskMeta.border }}>
                <div style={styles.riskPanelRow}>
                  <span style={styles.riskPanelLabel}>Risk Rate</span>
                  <span style={{ ...styles.riskPanelValue, color: riskMeta.color }}>
                    {riskForm.probability} × {riskForm.impact} = <strong>{riskRate}</strong> / 25
                  </span>
                </div>
                <div style={styles.riskPanelRow}>
                  <span style={styles.riskPanelLabel}>Risk Status</span>
                  <span style={{ ...styles.riskStatusBadge, color: riskMeta.color, borderColor: riskMeta.border }}>
                    {riskMeta.label}
                  </span>
                </div>
                <div style={styles.riskScale}>
                  1–5: Low &nbsp;·&nbsp; 6–10: Medium &nbsp;·&nbsp; 11–15: High &nbsp;·&nbsp; 16–25: Critical
                </div>
              </div>

              <label style={styles.label}>Risk Mitigation Plan</label>
              <textarea
                style={{ ...styles.input, height: '84px', resize: 'vertical' }}
                value={riskForm.mitigation_plan}
                onChange={e => setRisk('mitigation_plan', e.target.value)}
                placeholder="Describe steps to reduce or manage this risk"
              />
            </>
          )}

          {/* ════════════════════════════════ RESOURCING TAB ════════ */}
          {activeTab === 'resourcing' && (
            <>
              <p style={styles.riskHint}>
                Assign one or more team members to this task and set their <strong>% time allocation</strong>.
              </p>

              {/* Add user row */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select
                  style={{ ...styles.input, flex: 1 }}
                  value={addUserId}
                  onChange={e => setAddUserId(e.target.value)}
                >
                  <option value="">— Select a team member to add —</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.username}{u.hourly_rate != null ? ` ($${parseFloat(u.hourly_rate).toFixed(0)}/hr)` : ''}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddResource}
                  disabled={!addUserId}
                  style={{ ...styles.saveBtn, padding: '0.5rem 1rem', opacity: addUserId ? 1 : 0.45, whiteSpace: 'nowrap' }}
                >
                  + Add
                </button>
              </div>

              {/* Resource list */}
              {resources.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.88rem', padding: '1.5rem 0' }}>
                  No team members assigned yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.25rem' }}>
                  {resources.map(r => (
                    <div key={r.user_id} style={styles.resourceRow}>
                      {/* Header: name + rate badge + remove */}
                      <div style={styles.resourceHeader}>
                        <div>
                          <span style={styles.resourceName}>{r.username}</span>
                          {r.hourly_rate != null && (
                            <span style={styles.resourceRate}>${parseFloat(r.hourly_rate).toFixed(0)}/hr</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveResource(r.user_id)}
                          style={styles.removeBtn}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                      {/* Hours inputs */}
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={styles.resourceFieldLabel}>Estimated Hours</label>
                          <input
                            style={{ ...styles.input, marginTop: '3px' }}
                            type="number" min="0" step="0.5"
                            value={r.estimated_hours ?? ''}
                            onChange={e => handleHoursChange(r.user_id, 'estimated_hours', e.target.value)}
                            placeholder="e.g. 8"
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={styles.resourceFieldLabel}>Actual Hours</label>
                          <input
                            style={{ ...styles.input, marginTop: '3px' }}
                            type="number" min="0" step="0.5"
                            value={r.actual_hours ?? ''}
                            onChange={e => handleHoursChange(r.user_id, 'actual_hours', e.target.value)}
                            placeholder="e.g. 10"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ════════════════════════════ SCHEDULE TAB ══════════════ */}
          {activeTab === 'schedule' && (
            <>
              <p style={styles.riskHint}>
                Control how the auto-scheduler positions this task. The CPM fields below are calculated by the engine and are read-only.
              </p>

              <div style={styles.row}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Schedule Mode</label>
                  <select style={styles.input} value={schedForm.schedule_mode} onChange={e => setSched('schedule_mode', e.target.value)}>
                    <option value="auto">Auto (CPM-driven)</option>
                    <option value="manual">Manual (pin dates)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Constraint Type</label>
                  <select style={styles.input} value={schedForm.constraint_type} onChange={e => setSched('constraint_type', e.target.value)}>
                    <option value="ASAP">ASAP — As Soon As Possible</option>
                    <option value="ALAP">ALAP — As Late As Possible</option>
                    <option value="MSO">MSO — Must Start On</option>
                    <option value="MFO">MFO — Must Finish On</option>
                    <option value="SNET">SNET — Start No Earlier Than</option>
                    <option value="FNLT">FNLT — Finish No Later Than</option>
                  </select>
                </div>
              </div>

              {['MSO','MFO','SNET','FNLT'].includes(schedForm.constraint_type) && (
                <>
                  <label style={styles.label}>Constraint Date</label>
                  <input
                    type="date"
                    style={styles.input}
                    value={schedForm.constraint_date || ''}
                    onChange={e => setSched('constraint_date', e.target.value)}
                  />
                </>
              )}

              {/* Read-only CPM fields (only shown when editing an existing task) */}
              {task?.id && (
                <>
                  <div style={{ marginTop: '0.5rem', borderTop: '1.5px solid #e5e7eb', paddingTop: '0.75rem' }}>
                    <label style={{ ...styles.label, color: '#6b7280', marginBottom: '0.5rem', display: 'block' }}>
                      CPM Results (read-only — recalculated by the scheduler)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      {[
                        ['Early Start',   cpmFields.early_start],
                        ['Early Finish',  cpmFields.early_finish],
                        ['Late Start',    cpmFields.late_start],
                        ['Late Finish',   cpmFields.late_finish],
                        ['Float (days)',  cpmFields.float_days != null ? `${cpmFields.float_days}d` : null],
                        ['Duration',      cpmFields.duration_days != null ? `${cpmFields.duration_days}d` : null],
                      ].map(([lbl, val]) => (
                        <div key={lbl} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.4rem 0.75rem' }}>
                          <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lbl}</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: val ? '#1d1d1d' : '#d1d5db', marginTop: '2px' }}>{val || '–'}</div>
                        </div>
                      ))}
                    </div>
                    {cpmFields.float_days === 0 && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#dc2626', fontWeight: 600 }}>
                        ⚑ This task is on the Critical Path — zero float.
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* ════════════════════════════════ NOTES TAB ══════════ */}
          {activeTab === 'notes' && (
            <>
              <p style={styles.riskHint}>
                Capture any additional details, meeting notes, decisions, or context for this task.
              </p>
              <textarea
                style={{ ...styles.input, height: '320px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Add notes, context, decisions, links, or any other details relevant to this task…"
              />
            </>
          )}

          {/* ── Actions ───────────────────────────────────────────── */}
          <div style={styles.actions}>
            <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={saving}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={saving}>
              {saving ? 'Saving…' : 'Save Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay:         { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:           { background: '#fff', borderRadius: '12px', padding: '2rem', width: '580px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  title:           { fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1d1d1d' },
  breadcrumb:      { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', marginBottom: '1rem', padding: '0.4rem 0.75rem', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' },
  breadcrumbParent:{ color: '#1d4ed8', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  breadcrumbSep:   { color: '#93c5fd', fontWeight: 700 },
  breadcrumbCurrent:{ color: '#374151', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  tabBar:          { display: 'flex', marginBottom: '1.25rem', border: '1.5px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' },
  tab:             { flex: 1, padding: '0.55rem 1rem', background: '#f9fafb', border: 'none', borderRight: '1.5px solid #e5e7eb', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' },
  tabActive:       { background: '#016D2D', color: '#fff', borderRight: '1.5px solid #016D2D' },
  tabBadge:        { fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px' },

  form:            { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:           { fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '2px' },
  input:           { width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' },
  row:             { display: 'flex', gap: '1rem' },
  sliderRow:       { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '4px' },

  riskHint:        { margin: '0', fontSize: '0.82rem', color: '#6b7280', background: '#f9fafb', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e5e7eb' },
  riskPanel:       { borderRadius: '8px', padding: '0.85rem 1rem', border: '1.5px solid', display: 'flex', flexDirection: 'column', gap: '0.45rem' },
  riskPanelRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  riskPanelLabel:  { fontSize: '0.85rem', fontWeight: 600, color: '#374151' },
  riskPanelValue:  { fontSize: '0.95rem', fontWeight: 700 },
  riskStatusBadge: { fontSize: '0.8rem', fontWeight: 700, padding: '3px 14px', borderRadius: '20px', background: 'rgba(255,255,255,0.6)', border: '1.5px solid' },
  riskScale:       { fontSize: '0.73rem', color: '#6b7280', marginTop: '2px' },


  milestoneRow:    { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.75rem', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '6px', cursor: 'pointer', userSelect: 'none', flexWrap: 'wrap' },
  parentDateHint:  { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.78rem', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.4rem 0.75rem' },

  resourceRow:        { background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '0.65rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' },
  resourceHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  resourceName:       { fontWeight: 700, fontSize: '0.9rem', color: '#1d1d1d' },
  resourceRate:       { fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem', background: '#e5e7eb', padding: '1px 7px', borderRadius: '10px' },
  resourceFieldLabel: { fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', display: 'block' },
  removeBtn:          { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.8rem', padding: '2px 6px', borderRadius: '4px', lineHeight: 1 },

  actions:         { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' },
  cancelBtn:       { padding: '0.5rem 1.25rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  saveBtn:         { padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  error:           { background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.9rem' },
};
