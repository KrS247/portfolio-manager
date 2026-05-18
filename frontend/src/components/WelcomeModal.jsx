import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FolderSpecialIcon   from '@mui/icons-material/FolderSpecial';
import AccountTreeIcon     from '@mui/icons-material/AccountTree';
import AssignmentIcon      from '@mui/icons-material/Assignment';
import TaskAltIcon         from '@mui/icons-material/TaskAlt';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import BarChartIcon        from '@mui/icons-material/BarChart';
import CalendarTodayIcon   from '@mui/icons-material/CalendarToday';
import WarningAmberIcon    from '@mui/icons-material/WarningAmber';
import GroupIcon           from '@mui/icons-material/Group';
import TrendingUpIcon      from '@mui/icons-material/TrendingUp';
import TimelineIcon        from '@mui/icons-material/Timeline';
import EventNoteIcon       from '@mui/icons-material/EventNote';
import ArrowForwardIcon    from '@mui/icons-material/ArrowForward';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import AutoAwesomeIcon      from '@mui/icons-material/AutoAwesome';

// ─── Data hierarchy definition ────────────────────────────────────────────────
const HIERARCHY = [
  {
    icon: FolderSpecialIcon,
    color: '#7c3aed',
    bg:    '#ede9fe',
    label: 'Portfolio',
    desc:  'The top level. Groups related programs together — e.g. "Digital Transformation 2026". Start here.',
    path:  '/portfolios',
    step:  1,
  },
  {
    icon: AccountTreeIcon,
    color: '#2563eb',
    bg:    '#dbeafe',
    label: 'Program',
    desc:  'A collection of related projects within a portfolio — e.g. "Customer Experience Uplift".',
    path:  '/programs',
    step:  2,
  },
  {
    icon: AssignmentIcon,
    color: '#016D2D',
    bg:    '#d1fae5',
    label: 'Project',
    desc:  'Delivers a specific outcome within a program — e.g. "Website Redesign". Has its own Gantt and EVM.',
    path:  '/projects',
    step:  3,
  },
  {
    icon: TaskAltIcon,
    color: '#d97706',
    bg:    '#fef3c7',
    label: 'Task',
    desc:  'The unit of work inside a project. Assign owners, set dates, track % complete and risks.',
    path:  '/tasks',
    step:  4,
  },
  {
    icon: SubdirectoryArrowRightIcon,
    color: '#6b7280',
    bg:    '#f3f4f6',
    label: 'Subtask',
    desc:  'An optional breakdown of a task into smaller steps. Inherits the parent task\'s date constraints.',
    path:  '/tasks',
    step:  5,
  },
];

// ─── Feature highlights ───────────────────────────────────────────────────────
const FEATURES = [
  { icon: TimelineIcon,       color: '#016D2D', label: 'Gantt Charts',          desc: 'Monthly timelines at every level — portfolio, program and project.' },
  { icon: TrendingUpIcon,     color: '#2563eb', label: 'Earned Value (EVM)',     desc: 'CPI, SPI, VAC and S-curves to track budget and schedule health.' },
  { icon: WarningAmberIcon,   color: '#dc2626', label: 'Risk Management',        desc: 'Probability × impact scoring with mitigation plans per task.' },
  { icon: GroupIcon,          color: '#7c3aed', label: 'Resource & Capacity',    desc: 'Assign hours to team members and visualise capacity across the portfolio.' },
  { icon: BarChartIcon,       color: '#d97706', label: 'Reports',                desc: 'Portfolio status, EVM performance, resource utilisation and risk register.' },
  { icon: EventNoteIcon,      color: '#0891b2', label: 'My Calendar',            desc: 'Day / week / month view of every task assigned to you.' },
  { icon: CalendarTodayIcon,  color: '#059669', label: 'Schedule Engine',        desc: 'CPM-based auto-scheduler with constraints, lag and critical-path detection.' },
  { icon: PlaylistAddCheckIcon,   color: '#374151', label: 'Dependencies & Baselines', desc: 'Link tasks with lag, snapshot baselines and compare against actuals.' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function WelcomeModal({ user, onClose, onLaunchWizard = null }) {
  const [dontShow, setDontShow] = useState(false);
  const navigate = useNavigate();

  const dismiss = (navPath) => {
    if (dontShow) {
      localStorage.setItem(`pm_welcome_dismissed_${user?.id}`, 'true');
    }
    onClose();
    if (navPath) navigate(navPath);
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={S.header}>
          <div style={S.headerBadge}>WELCOME</div>
          <h2 style={S.headerTitle}>
            Welcome{user?.username ? `, ${user.username}` : ''}!
          </h2>
          <p style={S.headerSub}>
            You're using <strong>Portfolio Manager</strong> — a full-stack project portfolio management tool.
            Here's a quick overview to help you get started.
          </p>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div style={S.body}>

          {/* ── Setup Wizard shortcut ───────────────────────────────────────── */}
          {onLaunchWizard && (
            <div style={S.wizardBanner}>
              <AutoAwesomeIcon style={{ fontSize: 26, color: '#7c3aed', flexShrink: 0 }} />
              <div style={S.wizardBannerText}>
                <div style={S.wizardBannerTitle}>New here? Try the Setup Wizard</div>
                <div style={S.wizardBannerDesc}>
                  The Setup Wizard configures your workspace name, invites your team, and loads a
                  complete sample portfolio — programs, projects, tasks and risks — so you can
                  explore every feature right away.
                </div>
              </div>
              <button
                style={S.wizardBtn}
                onClick={() => { dismiss(null); onLaunchWizard(); }}
              >
                Launch Wizard <ArrowForwardIcon style={{ fontSize: 15, verticalAlign: 'middle', marginLeft: 3 }} />
              </button>
            </div>
          )}

          {/* Features */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Key features</div>
            <div style={S.featureGrid}>
              {FEATURES.map(f => {
                const Icon = f.icon;
                return (
                  <div key={f.label} style={S.featureCard}>
                    <Icon style={{ fontSize: 22, color: f.color, flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ ...S.featureLabel, color: f.color }}>{f.label}</div>
                      <div style={S.featureDesc}>{f.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Structure */}
          <div style={S.section}>
            <div style={S.sectionTitle}>How the data is structured</div>
            <p style={S.sectionHint}>
              Everything in the system follows a hierarchy. <strong>Always start by creating a Portfolio</strong>,
              then work your way down. Each level must exist before you can create the next.
            </p>

            <div style={S.hierarchyList}>
              {HIERARCHY.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} style={S.hierarchyRow}>
                    {/* Indent line */}
                    <div style={{ width: i * 18, flexShrink: 0 }} />

                    {/* Arrow connector (except first) */}
                    {i > 0 && (
                      <div style={S.connector}>
                        <ArrowForwardIcon style={{ fontSize: 14, color: '#d1d5db' }} />
                      </div>
                    )}

                    {/* Card */}
                    <div style={{ ...S.hierarchyCard, borderLeft: `4px solid ${item.color}`, background: item.bg }}>
                      <div style={{ ...S.hierarchyStep, background: item.color }}>{item.step}</div>
                      <Icon style={{ fontSize: 20, color: item.color, flexShrink: 0 }} />
                      <div style={S.hierarchyText}>
                        <span style={{ ...S.hierarchyLabel, color: item.color }}>{item.label}</span>
                        <span style={S.hierarchyDesc}>{item.desc}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick tip */}
          <div style={S.tip}>
            <strong>💡 Quick tip:</strong> Use the <strong>? Help</strong> button at the bottom-right of any
            page to open the full User Manual at any time.
          </div>

        </div>{/* end body */}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={S.footer}>
          <label style={S.checkLabel}>
            <input
              type="checkbox"
              checked={dontShow}
              onChange={e => setDontShow(e.target.checked)}
              style={{ accentColor: '#016D2D', width: 15, height: 15, cursor: 'pointer' }}
            />
            <span>Don't show this again</span>
          </label>

          <div style={S.footerBtns}>
            <button onClick={() => dismiss(null)} style={S.closeBtn}>Close</button>
            <button onClick={() => dismiss('/portfolios')} style={S.startBtn}>
              Create my first Portfolio <ArrowForwardIcon style={{ fontSize: 16, verticalAlign: 'middle', marginLeft: 4 }} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  overlay:       { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' },
  modal:         { background: '#fff', borderRadius: '14px', width: '700px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden' },

  // Header
  header:        { background: '#0A2B14', padding: '2rem 2rem 1.75rem', flexShrink: 0 },
  headerBadge:   { display: 'inline-block', background: '#00FFBC', color: '#0A2B14', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', padding: '0.2rem 0.65rem', borderRadius: '4px', marginBottom: '0.6rem' },
  headerTitle:   { margin: '0 0 0.5rem', fontSize: '1.65rem', fontWeight: 800, color: '#fff' },
  headerSub:     { margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 },

  // Scrollable body
  body:          { flex: 1, overflowY: 'auto', padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' },

  // Sections
  section:       { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  sectionTitle:  { fontSize: '0.8rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.4rem' },
  sectionHint:   { margin: 0, fontSize: '0.87rem', color: '#4b5563', lineHeight: 1.55 },

  // Hierarchy
  hierarchyList: { display: 'flex', flexDirection: 'column', gap: '0.45rem' },
  hierarchyRow:  { display: 'flex', alignItems: 'center', gap: '6px' },
  connector:     { display: 'flex', alignItems: 'center', flexShrink: 0 },
  hierarchyCard: { display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.55rem 0.85rem', borderRadius: '8px', flex: 1 },
  hierarchyStep: { fontSize: '0.65rem', fontWeight: 800, color: '#fff', width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  hierarchyText: { display: 'flex', flexDirection: 'column', gap: '1px', flex: 1 },
  hierarchyLabel:{ fontSize: '0.88rem', fontWeight: 700 },
  hierarchyDesc: { fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.4 },

  // Features
  featureGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' },
  featureCard:   { display: 'flex', gap: '0.65rem', padding: '0.65rem 0.85rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #f0f0f0', alignItems: 'flex-start' },
  featureLabel:  { fontSize: '0.85rem', fontWeight: 700, marginBottom: '2px' },
  featureDesc:   { fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.4 },

  // Wizard banner
  wizardBanner:      { display: 'flex', alignItems: 'flex-start', gap: '0.85rem', background: '#faf5ff', border: '1.5px solid #ddd6fe', borderRadius: '10px', padding: '1rem 1.1rem' },
  wizardBannerText:  { flex: 1, minWidth: 0 },
  wizardBannerTitle: { fontWeight: 700, fontSize: '0.9rem', color: '#5b21b6', marginBottom: '0.3rem' },
  wizardBannerDesc:  { fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.5 },
  wizardBtn:         { flexShrink: 0, padding: '0.45rem 1rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' },

  // Tip
  tip:           { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#166534', lineHeight: 1.5 },

  // Footer
  footer:        { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', borderTop: '1.5px solid #e5e7eb', background: '#f9fafb', flexShrink: 0, gap: '1rem', flexWrap: 'wrap' },
  checkLabel:    { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#374151', cursor: 'pointer', userSelect: 'none' },
  footerBtns:    { display: 'flex', gap: '0.65rem', alignItems: 'center' },
  closeBtn:      { padding: '0.5rem 1.1rem', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', color: '#374151' },
  startBtn:      { padding: '0.5rem 1.25rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center' },
};
