/**
 * InteractiveGanttChart
 *
 * Wraps GanttChart with drag-to-move and drag-to-resize behaviour.
 * On drag start it calls previewMove (debounced) so the user sees a live
 * ghost preview. On drag end it calls commitMove to persist + re-run CPM.
 *
 * Usage:
 *   <InteractiveGanttChart
 *     parentType="project"
 *     parentId={123}
 *     items={tasks}
 *     canEdit={true}
 *     onEdit={openTaskModal}
 *     timeUnit="month"
 *     baselineTasks={baselineSnaps}   // optional
 *   />
 */
import { useRef, useState, useCallback } from 'react';
import GanttChart from './GanttChart';
import { useSchedule } from '../hooks/useSchedule';
import { addDays, diffDays, toISODate, parseDate } from '../utils/dateUtils';

// Pixels-per-day lookup (must match GanttChart constants)
const WEEK_W  = 72;
const MONTH_W = 90;

function getDayW(timeUnit, totalDays) {
  if (timeUnit === 'month') return MONTH_W / 30.4375;
  if (timeUnit === 'week')  return WEEK_W / 7;
  return Math.min(40, Math.max(14, Math.round(720 / (totalDays || 60))));
}

// ── Scheduling state banner ──────────────────────────────────────────────────
function ScheduleBanner({ isScheduling, error, onDismiss }) {
  if (!isScheduling && !error) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.5rem 1rem',
      background: error ? '#fef2f2' : '#f0fdf4',
      border: `1px solid ${error ? '#fca5a5' : '#86efac'}`,
      borderRadius: '6px', marginBottom: '0.5rem',
      fontSize: '0.82rem',
      color: error ? '#dc2626' : '#15803d',
    }}>
      {isScheduling && (
        <span style={{
          display: 'inline-block', width: 14, height: 14,
          border: '2px solid #22c55e', borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'spin 0.7s linear infinite',
        }} />
      )}
      <span style={{ flex: 1 }}>
        {error || 'Re-calculating schedule…'}
      </span>
      {error && (
        <button onClick={onDismiss} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#dc2626', fontWeight: 700, fontSize: '1rem', lineHeight: 1,
        }}>×</button>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function InteractiveGanttChart({
  parentType,
  parentId,
  items = [],
  nameField    = 'title',
  endDateField = 'due_date',
  canEdit      = false,
  onEdit,
  showCriticalPath = true,
  timeUnit     = 'month',
  baselineTasks = null,
}) {
  const {
    tasks,
    previewTasks,
    affectedIds,
    isScheduling,
    error,
    syncTasks,
    runSchedule,
    previewMove,
    commitMove,
    clearPreview,
  } = useSchedule(parentType, parentId, items);

  // Keep internal tasks in sync when parent passes new items
  const prevItemsRef = useRef(null);
  if (prevItemsRef.current !== items) {
    prevItemsRef.current = items;
    syncTasks(items);
  }

  // ── Drag state ────────────────────────────────────────────────────────────
  const dragRef = useRef(null);   // { type:'move'|'resize', item, origStart, origDue, startX, dayW }
  const [isDragging, setIsDragging] = useState(false);

  // Compute approximate dayW from the current task set + timeUnit
  const getDayWApprox = useCallback(() => {
    const taskItems = tasks.length ? tasks : items;
    const allDates = taskItems.flatMap(t =>
      [parseDate(t.start_date), parseDate(t[endDateField])].filter(Boolean)
    );
    if (allDates.length === 0) return getDayW(timeUnit, 60);
    const minD = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxD = new Date(Math.max(...allDates.map(d => d.getTime())));
    const total = diffDays(minD, maxD) || 60;
    return getDayW(timeUnit, total);
  }, [tasks, items, endDateField, timeUnit]);

  // ── mousemove / mouseup handlers (attached to window during drag) ─────────
  const onMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const { type, item, origStart, origDue, startX, dayW } = dragRef.current;

    const dx    = e.clientX - startX;
    const dDays = Math.round(dx / dayW);
    if (dDays === dragRef.current.lastDDays) return;
    dragRef.current.lastDDays = dDays;

    let newStart = origStart;
    let newDue   = origDue;

    if (type === 'move') {
      newStart = toISODate(addDays(parseDate(origStart), dDays));
      newDue   = toISODate(addDays(parseDate(origDue),   dDays));
    } else {
      // resize: only shift end date, minimum 1-day duration
      const origDuration = diffDays(parseDate(origStart), parseDate(origDue));
      const newDuration  = Math.max(1, origDuration + dDays);
      newDue = toISODate(addDays(parseDate(origStart), newDuration));
    }

    dragRef.current.newStart = newStart;
    dragRef.current.newDue   = newDue;

    previewMove(item.id, newStart, newDue);
  }, [previewMove]);

  const onMouseUp = useCallback(async () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup',  onMouseUp);
    setIsDragging(false);

    if (!dragRef.current) return;
    const { item, newStart, newDue, origStart, origDue } = dragRef.current;
    dragRef.current = null;

    // Only commit if dates actually changed
    if (newStart && newDue && (newStart !== origStart || newDue !== origDue)) {
      await commitMove(item.id, newStart, newDue);
    } else {
      clearPreview();
    }
  }, [onMouseMove, commitMove, clearPreview]);

  // ── Bar drag start (move) ─────────────────────────────────────────────────
  const handleBarDragStart = useCallback((e, item) => {
    if (!canEdit) return;
    e.preventDefault();
    const dayW = getDayWApprox();
    dragRef.current = {
      type:      'move',
      item,
      origStart: item.start_date,
      origDue:   item[endDateField],
      startX:    e.clientX,
      dayW,
      newStart:  item.start_date,
      newDue:    item[endDateField],
      lastDDays: 0,
    };
    setIsDragging(true);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',  onMouseUp);
  }, [canEdit, endDateField, getDayWApprox, onMouseMove, onMouseUp]);

  // ── Resize drag start ─────────────────────────────────────────────────────
  const handleResizeDragStart = useCallback((e, item) => {
    if (!canEdit) return;
    e.preventDefault();
    const dayW = getDayWApprox();
    dragRef.current = {
      type:      'resize',
      item,
      origStart: item.start_date,
      origDue:   item[endDateField],
      startX:    e.clientX,
      dayW,
      newStart:  item.start_date,
      newDue:    item[endDateField],
      lastDDays: 0,
    };
    setIsDragging(true);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',  onMouseUp);
  }, [canEdit, endDateField, getDayWApprox, onMouseMove, onMouseUp]);

  return (
    <div style={{ userSelect: isDragging ? 'none' : undefined, cursor: isDragging ? 'grabbing' : undefined }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <ScheduleBanner
        isScheduling={isScheduling}
        error={error}
        onDismiss={clearPreview}
      />

      <GanttChart
        items={tasks.length ? tasks : items}
        nameField={nameField}
        endDateField={endDateField}
        canEdit={canEdit}
        onEdit={onEdit}
        showCriticalPath={showCriticalPath}
        timeUnit={timeUnit}
        baselineTasks={baselineTasks}
        previewItems={previewTasks}
        affectedTaskIds={affectedIds}
        onBarDragStart={canEdit ? handleBarDragStart : null}
        onResizeDragStart={canEdit ? handleResizeDragStart : null}
      />
    </div>
  );
}
