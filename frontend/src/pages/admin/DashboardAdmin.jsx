import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../../hooks/useApi';

// ── localStorage keys ────────────────────────────────────────────────────────
export const LS_KEY         = 'pm_dashboard_program_order';
export const PROJECT_LS_KEY = 'pm_dashboard_project_order';

// ── Shared helpers (imported by Dashboard.jsx) ───────────────────────────────

/** Apply the admin-configured program order to a programs array. */
export function applyStoredOrder(programs) {
  if (!programs || programs.length === 0) return programs || [];
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (!saved || !Array.isArray(saved)) return programs;
    const idToProgram = Object.fromEntries(programs.map(p => [p.id, p]));
    const ordered = saved.filter(id => idToProgram[id]).map(id => idToProgram[id]);
    const existingIds = new Set(ordered.map(p => p.id));
    const newOnes = programs.filter(p => !existingIds.has(p.id));
    return [...ordered, ...newOnes];
  } catch { return programs; }
}

/** Apply the admin-configured project order for a specific program. */
export function applyStoredProjectOrder(projects, programId) {
  if (!projects || projects.length === 0) return projects || [];
  try {
    const saved = JSON.parse(localStorage.getItem(PROJECT_LS_KEY) || 'null');
    if (!saved || !saved[programId]) return projects;
    const savedIds = saved[programId];
    const idToProject = Object.fromEntries(projects.map(p => [p.id, p]));
    const ordered = savedIds.filter(id => idToProject[id]).map(id => idToProject[id]);
    const existingIds = new Set(ordered.map(p => p.id));
    const newOnes = projects.filter(p => !existingIds.has(p.id));
    return [...ordered, ...newOnes];
  } catch { return projects; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function statusStyle(status) {
  if (status === 'active')  return { background: '#dcfce7', color: '#166534' };
  if (status === 'on_hold') return { background: '#fef9c3', color: '#854d0e' };
  return                           { background: '#f3f4f6', color: '#6b7280' };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DashboardAdmin() {
  const { data: programs, loading: prLoad } = useApi('/programs');
  const { data: projects, loading: pjLoad } = useApi('/projects');

  // ── Program order ──────────────────────────────────────────────────────────
  const [orderedPrograms, setOrderedPrograms] = useState([]);

  useEffect(() => {
    if (!programs || programs.length === 0) return;
    setOrderedPrograms(applyStoredOrder(programs));
  }, [programs]);

  const moveProgram = (idx, dir) => {
    setOrderedPrograms(prev => {
      const list = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= list.length) return prev;
      [list[idx], list[target]] = [list[target], list[idx]];
      localStorage.setItem(LS_KEY, JSON.stringify(list.map(p => p.id)));
      flashSaved();
      return list;
    });
  };

  // ── Project order (per program) ────────────────────────────────────────────
  const projectsByProgram = useMemo(() => {
    if (!projects) return {};
    return projects.reduce((acc, pj) => {
      const key = pj.program_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(pj);
      return acc;
    }, {});
  }, [projects]);

  const [orderedProjects, setOrderedProjects] = useState({});

  useEffect(() => {
    if (!projects || projects.length === 0) return;
    setOrderedProjects(() => {
      const result = {};
      Object.entries(projectsByProgram).forEach(([progId, projs]) => {
        result[progId] = applyStoredProjectOrder(projs, Number(progId));
      });
      return result;
    });
  }, [projectsByProgram]);

  const moveProject = (progId, idx, dir) => {
    setOrderedProjects(prev => {
      const list = [...(prev[progId] || [])];
      const target = idx + dir;
      if (target < 0 || target >= list.length) return prev;
      [list[idx], list[target]] = [list[target], list[idx]];
      // Persist: merge updated program's order into saved object
      const saved = (() => {
        try { return JSON.parse(localStorage.getItem(PROJECT_LS_KEY) || '{}'); }
        catch { return {}; }
      })();
      saved[progId] = list.map(p => p.id);
      localStorage.setItem(PROJECT_LS_KEY, JSON.stringify(saved));
      flashSaved();
      return { ...prev, [progId]: list };
    });
  };

  // ── Saved indicator ────────────────────────────────────────────────────────
  const [saved, setSaved] = useState(false);
  let savedTimer = null;
  const flashSaved = () => {
    setSaved(true);
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => setSaved(false), 2000);
  };

  const resetAll = () => {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(PROJECT_LS_KEY);
    if (programs) setOrderedPrograms(programs);
    if (projects) {
      const reset = {};
      Object.entries(projectsByProgram).forEach(([k, v]) => { reset[k] = v; });
      setOrderedProjects(reset);
    }
    flashSaved();
  };

  const loading = prLoad || pjLoad;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.heading}>Dashboard Administration</h1>
          <p style={styles.sub}>
            Configure the display order of programs and their projects in the Schedule View.
            Changes are saved automatically.
          </p>
        </div>
        <div style={styles.headerRight}>
          {saved && <span style={styles.savedBadge}>✓ Saved</span>}
          <button onClick={resetAll} style={styles.resetBtn} disabled={loading}>
            Reset All to Default
          </button>
        </div>
      </div>

      {/* ── Program Order ──────────────────────────────────────────────────── */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>
            📅 Program Order — Schedule View
            {!prLoad && programs && (
              <span style={styles.countBadge}>{programs.length} programs</span>
            )}
          </h2>
          <p style={styles.cardHint}>
            Set the order programs appear in the Dashboard Schedule View.
          </p>
        </div>

        {prLoad && <div style={styles.loading}>Loading programs…</div>}

        {!prLoad && orderedPrograms.length === 0 && (
          <div style={styles.empty}>No programs found.</div>
        )}

        {!prLoad && orderedPrograms.length > 0 && (
          <div style={styles.list}>
            {orderedPrograms.map((prog, idx) => (
              <div key={prog.id} style={styles.row}>
                <div style={styles.position}>{idx + 1}</div>
                <span style={{ ...styles.dot, background: prog.status === 'active' ? '#0891b2' : prog.status === 'on_hold' ? '#f59e0b' : '#9ca3af' }} />
                <div style={styles.info}>
                  <div style={styles.name}>{prog.name}</div>
                  <div style={styles.meta}>{prog.portfolio_name}</div>
                </div>
                <span style={{ ...styles.statusPill, ...statusStyle(prog.status) }}>
                  {prog.status.replace('_', ' ')}
                </span>
                <div style={styles.btns}>
                  <button style={{ ...styles.btn, opacity: idx === 0 ? 0.3 : 1 }} disabled={idx === 0} onClick={() => moveProgram(idx, -1)} title="Move up">▲</button>
                  <button style={{ ...styles.btn, opacity: idx === orderedPrograms.length - 1 ? 0.3 : 1 }} disabled={idx === orderedPrograms.length - 1} onClick={() => moveProgram(idx, 1)} title="Move down">▼</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Project Order (per program) ─────────────────────────────────────── */}
      <div style={{ ...styles.card, marginTop: '1.5rem' }}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>
            📁 Project Order — per Program
            {!pjLoad && projects && (
              <span style={{ ...styles.countBadge, background: '#d1fae5', color: '#016D2D' }}>{projects.length} projects</span>
            )}
          </h2>
          <p style={styles.cardHint}>
            Set the order projects appear within each program's Gantt chart on the Dashboard.
          </p>
        </div>

        {loading && <div style={styles.loading}>Loading…</div>}

        {!loading && orderedPrograms.length === 0 && (
          <div style={styles.empty}>No programs found.</div>
        )}

        {!loading && orderedPrograms.map((prog, pIdx) => {
          const progProjects = orderedProjects[prog.id] || projectsByProgram[prog.id] || [];
          return (
            <div key={prog.id} style={{ ...styles.programBlock, borderTop: pIdx === 0 ? 'none' : '1px solid #f3f4f6' }}>
              {/* Program label */}
              <div style={styles.programLabel}>
                <span style={{ ...styles.dot, background: prog.status === 'active' ? '#0891b2' : prog.status === 'on_hold' ? '#f59e0b' : '#9ca3af', width: 9, height: 9 }} />
                <span style={styles.programLabelName}>{prog.name}</span>
                <span style={styles.programLabelMeta}>{prog.portfolio_name}</span>
                <span style={{ ...styles.statusPill, ...statusStyle(prog.status), fontSize: '0.65rem' }}>
                  {prog.status.replace('_', ' ')}
                </span>
              </div>

              {progProjects.length === 0 ? (
                <div style={{ ...styles.empty, paddingTop: '0.25rem', paddingLeft: '1.1rem' }}>No projects.</div>
              ) : (
                <div style={styles.subList}>
                  {progProjects.map((proj, jIdx) => (
                    <div key={proj.id} style={styles.subRow}>
                      <div style={{ ...styles.position, background: '#d1fae5', color: '#016D2D', fontSize: '0.65rem' }}>{jIdx + 1}</div>
                      <span style={{ ...styles.dot, background: proj.status === 'active' ? '#016D2D' : proj.status === 'on_hold' ? '#f59e0b' : '#9ca3af' }} />
                      <div style={styles.info}>
                        <div style={styles.name}>{proj.name}</div>
                      </div>
                      <span style={{ ...styles.statusPill, ...statusStyle(proj.status) }}>
                        {proj.status.replace('_', ' ')}
                      </span>
                      <div style={styles.btns}>
                        <button style={{ ...styles.btn, opacity: jIdx === 0 ? 0.3 : 1 }} disabled={jIdx === 0} onClick={() => moveProject(prog.id, jIdx, -1)} title="Move up">▲</button>
                        <button style={{ ...styles.btn, opacity: jIdx === progProjects.length - 1 ? 0.3 : 1 }} disabled={jIdx === progProjects.length - 1} onClick={() => moveProject(prog.id, jIdx, 1)} title="Move down">▼</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  header:           { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' },
  heading:          { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d', marginBottom: '0.25rem' },
  sub:              { color: '#6b7280', fontSize: '0.9rem', maxWidth: '560px' },
  headerRight:      { display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 },
  savedBadge:       { fontSize: '0.82rem', fontWeight: 700, color: '#059669', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '999px', padding: '4px 12px' },
  resetBtn:         { padding: '0.45rem 1rem', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#374151' },
  card:             { background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardHeader:       { marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #f3f4f6' },
  cardTitle:        { fontSize: '1.05rem', fontWeight: 700, color: '#1d1d1d', display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' },
  cardHint:         { fontSize: '0.82rem', color: '#9ca3af', margin: 0 },
  countBadge:       { fontSize: '0.72rem', fontWeight: 700, background: '#e0f2fe', color: '#0284c7', borderRadius: '999px', padding: '2px 9px' },
  loading:          { color: '#9ca3af', fontSize: '0.9rem', padding: '1rem 0' },
  empty:            { color: '#6b7280', fontSize: '0.9rem', padding: '0.5rem 0' },
  list:             { display: 'flex', flexDirection: 'column', gap: '6px' },
  row:              { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #f0f0f0' },
  position:         { flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280' },
  dot:              { flexShrink: 0, width: 10, height: 10, borderRadius: '50%' },
  info:             { flex: 1, minWidth: 0 },
  name:             { fontWeight: 700, color: '#111827', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meta:             { fontSize: '0.75rem', color: '#9ca3af', marginTop: '1px' },
  statusPill:       { flexShrink: 0, fontSize: '0.68rem', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', textTransform: 'capitalize', whiteSpace: 'nowrap' },
  btns:             { display: 'flex', gap: '4px', flexShrink: 0 },
  btn:              { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '5px', width: '28px', height: '26px', cursor: 'pointer', fontSize: '0.65rem', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  programBlock:     { paddingTop: '1rem', paddingBottom: '0.75rem' },
  programLabel:     { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' },
  programLabelName: { fontWeight: 700, color: '#1d1d1d', fontSize: '0.88rem' },
  programLabelMeta: { fontSize: '0.75rem', color: '#9ca3af' },
  subList:          { display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '1.1rem' },
  subRow:           { display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.5rem 0.75rem', background: '#f0f7f3', borderRadius: '7px', border: '1px solid #d1fae5' },
};
