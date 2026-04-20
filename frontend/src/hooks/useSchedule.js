import { useState, useCallback, useRef } from 'react';
import client from '../api/client';

/**
 * Manages scheduling state for a given parent scope (parentType + parentId).
 * Provides preview (debounced, no save) and commit (save + re-run CPM) operations.
 */
export function useSchedule(parentType, parentId, initialTasks = []) {
  const [tasks, setTasks]           = useState(initialTasks);
  const [previewTasks, setPreview]  = useState(null);   // null = no active preview
  const [affectedIds, setAffected]  = useState(new Set());
  const [isScheduling, setScheduling] = useState(false);
  const [error, setError]           = useState(null);

  const previewTimer = useRef(null);

  // Keep tasks in sync when the parent passes new data (e.g., after refetch)
  const syncTasks = useCallback((newTasks) => {
    setTasks(newTasks);
  }, []);

  /**
   * Trigger a full CPM re-run for the current scope.
   * Updates the tasks state with the server's authoritative result.
   */
  const runSchedule = useCallback(async () => {
    if (!parentType || !parentId) return;
    setScheduling(true);
    setError(null);
    try {
      const res = await client.post('/schedule/run', { parent_type: parentType, parent_id: parentId });
      setTasks(res.data.tasks);
    } catch (e) {
      setError(e.response?.data?.message || 'Scheduling failed.');
    } finally {
      setScheduling(false);
    }
  }, [parentType, parentId]);

  /**
   * Preview what a date change would cascade to (debounced 300ms, no save).
   */
  const previewMove = useCallback((taskId, newStart, newDue) => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await client.get('/schedule/preview', {
          params: {
            parent_type: parentType,
            parent_id:   parentId,
            task_id:     taskId,
            start_date:  newStart,
            due_date:    newDue,
          },
        });
        const affected = res.data.affected_tasks || [];
        // Build a merged task array: replace affected tasks with preview versions
        const previewMap = Object.fromEntries(affected.map(t => [t.id, t]));
        const merged = tasks.map(t => previewMap[t.id]
          ? { ...t, ...previewMap[t.id] }
          : t
        );
        setPreview(merged);
        setAffected(new Set(affected.map(t => t.id)));
      } catch {
        // Preview errors are non-critical — silently ignore
      }
    }, 300);
  }, [parentType, parentId, tasks]);

  /**
   * Save a task date change and trigger a full CPM re-run.
   */
  const commitMove = useCallback(async (taskId, newStart, newDue) => {
    clearPreview();
    setScheduling(true);
    setError(null);
    try {
      await client.put(`/tasks/${taskId}`, {
        start_date: newStart,
        due_date:   newDue,
      });
      // Re-run full schedule for the scope
      const res = await client.post('/schedule/run', { parent_type: parentType, parent_id: parentId });
      setTasks(res.data.tasks);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save dates.');
    } finally {
      setScheduling(false);
    }
  }, [parentType, parentId]);

  const clearPreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setPreview(null);
    setAffected(new Set());
  }, []);

  return {
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
  };
}
