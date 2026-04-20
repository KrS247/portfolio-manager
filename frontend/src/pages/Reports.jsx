import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import PortfolioStatusReport from '../components/reports/PortfolioStatusReport';
import ProgramReport from '../components/reports/ProgramReport';
import ProjectReport from '../components/reports/ProjectReport';
import EVMReport from '../components/reports/EVMReport';
import ScheduleVarianceReport from '../components/reports/ScheduleVarianceReport';
import ResourceReport from '../components/reports/ResourceReport';
import RiskRegisterReport from '../components/reports/RiskRegisterReport';
import OverBudgetReport from '../components/reports/OverBudgetReport';
import TaskStatusReport from '../components/reports/TaskStatusReport';

const REPORT_TYPES = [
  { id: 'portfolio-status',  label: 'Portfolio Status',     scope: 'portfolio', icon: '📊', desc: 'Executive summary of a portfolio' },
  { id: 'program',           label: 'Program Report',       scope: 'program',   icon: '📋', desc: 'Program health, projects & tasks' },
  { id: 'project',           label: 'Project Report',       scope: 'project',   icon: '🗂️', desc: 'Project detail, tasks & EVM' },
  { id: 'evm',               label: 'EVM Performance',      scope: 'any',       icon: '📈', desc: 'Earned value metrics & S-curve' },
  { id: 'schedule-variance', label: 'Schedule Variance',    scope: 'any',       icon: '📅', desc: 'Baseline vs actuals comparison' },
  { id: 'resource',          label: 'Resource Utilisation', scope: 'any',       icon: '👥', desc: 'Per-user hours & cost breakdown' },
  { id: 'risk-register',     label: 'Risk Register',        scope: 'any',       icon: '⚠️', desc: 'Risks ranked by severity' },
  { id: 'over-budget',       label: 'Over-Budget',          scope: 'any',       icon: '💰', desc: 'Tasks exceeding budget' },
  { id: 'task-status',       label: 'Task Status',          scope: 'any',       icon: '✅', desc: 'Full task list with status' },
];

const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  .app-sidebar { display: none !important; }
  body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .report-shell { padding: 0 !important; }
  .report-page { box-shadow: none !important; margin: 0 !important; max-width: none !important; border-radius: 0 !important; }
  @page { size: A4; margin: 1.5cm; }
}
`;

export default function Reports() {
  const [reportType, setReportType] = useState('portfolio-status');
  const [scopeType, setScopeType]   = useState('portfolio');
  const [scopeId, setScopeId]       = useState('');
  const [generated, setGenerated]   = useState(false);
  const [key, setKey]               = useState(0); // force remount on regenerate

  const { data: portfolios } = useApi('/portfolios');
  const { data: programs }   = useApi('/programs');
  const { data: projects }   = useApi('/projects');

  const rt = REPORT_TYPES.find(r => r.id === reportType);

  const handleReportTypeChange = (id) => {
    const r = REPORT_TYPES.find(x => x.id === id);
    setReportType(id);
    setGenerated(false);
    setScopeId('');
    if (r.scope === 'portfolio') setScopeType('portfolio');
    else if (r.scope === 'program') setScopeType('program');
    else if (r.scope === 'project') setScopeType('project');
  };

  const handleGenerate = () => {
    if (!scopeId) return;
    setGenerated(false);
    setTimeout(() => { setGenerated(true); setKey(k => k + 1); }, 30);
  };

  const getScopeOptions = () => {
    const st = rt?.scope === 'any' ? scopeType : rt?.scope;
    if (st === 'portfolio') return (portfolios || []).map(p => ({ id: p.id, name: p.name }));
    if (st === 'program')   return (programs   || []).map(p => ({ id: p.id, name: p.name }));
    if (st === 'project')   return (projects   || []).map(p => ({ id: p.id, name: p.name }));
    return [];
  };

  const renderReport = () => {
    if (!generated || !scopeId) return null;
    const id   = parseInt(scopeId);
    const type = rt?.scope === 'any' ? scopeType : rt?.scope;
    const props = { key, parentType: type, parentId: id };
    switch (reportType) {
      case 'portfolio-status':  return <PortfolioStatusReport {...props} />;
      case 'program':           return <ProgramReport {...props} />;
      case 'project':           return <ProjectReport {...props} />;
      case 'evm':               return <EVMReport {...props} />;
      case 'schedule-variance': return <ScheduleVarianceReport {...props} />;
      case 'resource':          return <ResourceReport {...props} />;
      case 'risk-register':     return <RiskRegisterReport {...props} />;
      case 'over-budget':       return <OverBudgetReport {...props} />;
      case 'task-status':       return <TaskStatusReport {...props} />;
      default:                  return null;
    }
  };

  const scopeOptions  = getScopeOptions();
  const scopeLabel    = rt?.scope === 'portfolio' ? 'Portfolio' : rt?.scope === 'program' ? 'Program' : rt?.scope === 'project' ? 'Project' : scopeType.charAt(0).toUpperCase() + scopeType.slice(1);

  return (
    <div className="report-shell" style={s.shell}>
      <style>{PRINT_CSS}</style>

      {/* ── Controls (hidden on print) ── */}
      <div className="no-print" style={s.controls}>
        <div style={s.header}>
          <h1 style={s.title}>📊 Reports</h1>
          {generated && scopeId && (
            <button onClick={() => window.print()} style={s.printBtn}>🖨 Print / Export PDF</button>
          )}
        </div>

        {/* Report type grid */}
        <div style={s.typeGrid}>
          {REPORT_TYPES.map(r => (
            <button
              key={r.id}
              onClick={() => handleReportTypeChange(r.id)}
              style={{ ...s.typeCard, ...(reportType === r.id ? s.typeActive : {}) }}
              title={r.desc}
            >
              <span style={s.typeIcon}>{r.icon}</span>
              <span style={s.typeLabel}>{r.label}</span>
            </button>
          ))}
        </div>

        {/* Scope selectors */}
        <div style={s.scopeRow}>
          {rt?.scope === 'any' && (
            <div style={s.field}>
              <label style={s.label}>Scope Type</label>
              <select value={scopeType} onChange={e => { setScopeType(e.target.value); setScopeId(''); setGenerated(false); }} style={s.select}>
                <option value="portfolio">Portfolio</option>
                <option value="program">Program</option>
                <option value="project">Project</option>
              </select>
            </div>
          )}

          <div style={s.field}>
            <label style={s.label}>{scopeLabel}</label>
            <select value={scopeId} onChange={e => { setScopeId(e.target.value); setGenerated(false); }} style={s.select}>
              <option value="">— Select —</option>
              {scopeOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!scopeId}
            style={{ ...s.genBtn, ...(!scopeId ? s.genDisabled : {}) }}
          >
            ▶ Generate Report
          </button>
        </div>
      </div>

      {/* ── Report output ── */}
      {generated && scopeId
        ? <div style={s.output}>{renderReport()}</div>
        : (
          <div className="no-print" style={s.placeholder}>
            <div style={{ fontSize: '3rem', opacity: 0.3 }}>📄</div>
            <div style={{ fontSize: '1rem', fontWeight: 500, color: '#9ca3af' }}>
              Select a report type and scope, then click Generate Report
            </div>
          </div>
        )
      }
    </div>
  );
}

const s = {
  shell:      { minHeight: '80vh' },
  controls:   { background: '#fff', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' },
  title:      { margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0A2B14' },
  printBtn:   { padding: '0.5rem 1.25rem', background: '#0A2B14', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' },
  typeGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.65rem', marginBottom: '1.25rem' },
  typeCard:   { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem 0.5rem', border: '2px solid #e5e7eb', borderRadius: '10px', background: '#f9fafb', cursor: 'pointer', gap: '0.3rem', transition: 'all 0.15s' },
  typeActive: { border: '2px solid #00FFBC', background: 'rgba(0,255,188,0.08)', boxShadow: '0 0 0 3px rgba(0,255,188,0.2)' },
  typeIcon:   { fontSize: '1.4rem' },
  typeLabel:  { fontSize: '0.75rem', fontWeight: 600, color: '#374151', textAlign: 'center', lineHeight: 1.2 },
  scopeRow:   { display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' },
  field:      { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  label:      { fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' },
  select:     { padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', minWidth: '200px', background: '#fff' },
  genBtn:     { padding: '0.55rem 1.5rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', alignSelf: 'flex-end' },
  genDisabled:{ opacity: 0.5, cursor: 'not-allowed' },
  output:     {},
  placeholder:{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '4rem', background: '#f9fafb', borderRadius: '12px', border: '2px dashed #e5e7eb' },
};
