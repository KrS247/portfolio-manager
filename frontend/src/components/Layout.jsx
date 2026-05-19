import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { clearPermissionsCache } from '../hooks/usePermissions';
import client from '../api/client';
import UserManual from './UserManual';
import WelcomeModal from './WelcomeModal';
import OnboardingWizard from './OnboardingWizard';
import AiChat from './AiChat';

// Nav icons
import ExpandMoreIcon         from '@mui/icons-material/ExpandMore';
import DashboardIcon          from '@mui/icons-material/Dashboard';
import AccountTreeIcon        from '@mui/icons-material/AccountTree';
import LayersIcon             from '@mui/icons-material/Layers';
import FolderOpenIcon         from '@mui/icons-material/FolderOpen';
import AssignmentIcon         from '@mui/icons-material/Assignment';
import BarChartIcon           from '@mui/icons-material/BarChart';
import GroupsIcon             from '@mui/icons-material/Groups';
import WarningAmberIcon       from '@mui/icons-material/WarningAmber';
import CalendarMonthIcon      from '@mui/icons-material/CalendarMonth';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ManageAccountsIcon     from '@mui/icons-material/ManageAccounts';
import BadgeIcon              from '@mui/icons-material/Badge';
import SecurityIcon           from '@mui/icons-material/Security';
import SpeedIcon              from '@mui/icons-material/Speed';
import GroupIcon              from '@mui/icons-material/Group';
import BusinessIcon           from '@mui/icons-material/Business';
import EditCalendarIcon       from '@mui/icons-material/EditCalendar';
import ApartmentIcon          from '@mui/icons-material/Apartment';
import ViewColumnIcon         from '@mui/icons-material/ViewColumn';
import ViewKanbanIcon         from '@mui/icons-material/ViewKanban';
import DirectionsRunIcon      from '@mui/icons-material/DirectionsRun';
import LogoutIcon             from '@mui/icons-material/Logout';

const COLLAPSED_W = 52;   // icon-only width in px
const EXPANDED_W  = 220;  // full sidebar width in px

const NAV_ITEMS = [
  { slug: 'dashboard',  label: 'Dashboard',      path: '/',               Icon: DashboardIcon },
  { slug: 'portfolios', label: 'Portfolios',      path: '/portfolios',     Icon: AccountTreeIcon },
  { slug: 'programs',   label: 'Programs',        path: '/programs',       Icon: LayersIcon },
  { slug: 'projects',   label: 'Projects',        path: '/projects',       Icon: FolderOpenIcon },
  { slug: 'tasks',      label: 'Tasks',           path: '/tasks',          Icon: AssignmentIcon },
  { slug: 'reports',    label: 'Reports',         path: '/reports',        Icon: BarChartIcon },
  { slug: 'capacity',   label: 'Capacity',        path: '/capacity',       Icon: GroupsIcon },
  { slug: 'risks',      label: 'Risk Management', path: '/risk-management',Icon: WarningAmberIcon },
  { slug: 'calendar',   label: 'My Calendar',     path: '/calendar',       Icon: CalendarMonthIcon },
];

const ADMIN_ITEMS = [
  { slug: 'admin.users',       label: 'Users',            path: '/admin/users',            Icon: ManageAccountsIcon },
  { slug: 'admin.roles',       label: 'Roles',            path: '/admin/roles',            Icon: BadgeIcon },
  { slug: 'admin.permissions', label: 'Permissions',      path: '/admin/permissions',      Icon: SecurityIcon },
  { slug: 'admin.dashboard',   label: 'Dashboard',        path: '/admin/dashboard',        Icon: SpeedIcon },
  { slug: 'admin.teams',       label: 'Teams',            path: '/admin/teams',            Icon: GroupIcon },
  { slug: 'admin.company',     label: 'Company Setup',    path: '/admin/company-setup',    Icon: BusinessIcon },
  { slug: 'admin.company',     label: 'Working Calendar', path: '/admin/working-calendar', Icon: EditCalendarIcon },
  { slug: 'admin.companies',   label: 'Companies',        path: '/admin/companies',        Icon: ApartmentIcon },
];

// Sub-group: Agile Projects
const AGILE_ITEMS = [
  { slug: 'admin.agile-phases',      label: 'Agile Phases',      path: '/admin/agile-phases',      Icon: ViewColumnIcon },
  { slug: 'admin.sprint-management', label: 'Sprint Management', path: '/admin/sprint-management', Icon: DirectionsRunIcon },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { canView } = usePermissions();
  const location  = useLocation();
  const navigate  = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [logoKey,     setLogoKey]     = useState(Date.now());
  const [logoError,   setLogoError]   = useState(false);
  const [showManual,  setShowManual]  = useState(false);

  // Sidebar collapsed/expanded (hover-driven)
  const [expanded, setExpanded] = useState(false);

  // Welcome modal
  const [showWelcome, setShowWelcome] = useState(() => {
    if (!user?.id) return false;
    return !localStorage.getItem(`pm_welcome_dismissed_${user.id}`);
  });

  // Wizard from welcome page
  const [showWizardFromWelcome, setShowWizardFromWelcome] = useState(false);
  const handleLaunchWizardFromWelcome = () => {
    setShowWelcome(false);
    setShowWizardFromWelcome(true);
  };

  const fetchBranding = () => {
    client.get('/company-settings')
      .then(res => {
        setCompanyName(res.data.company_name || '');
        setLogoKey(Date.now());
        setLogoError(false);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchBranding();
    window.addEventListener('company-settings-updated', fetchBranding);
    return () => window.removeEventListener('company-settings-updated', fetchBranding);
  }, []);

  const handleLogout = () => {
    clearPermissionsCache();
    logout();
    navigate('/login');
  };

  const isActive = (path) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const visibleNav   = NAV_ITEMS.filter(item => canView(item.slug));
  const visibleAdmin = ADMIN_ITEMS.filter(item => canView(item.slug));
  const visibleAgile = AGILE_ITEMS.filter(item => canView(item.slug));

  const isOnAdminRoute = location.pathname.startsWith('/admin');
  const isOnAgileRoute = location.pathname.startsWith('/admin/agile');
  const [adminOpen, setAdminOpen] = useState(isOnAdminRoute);
  const [agileOpen, setAgileOpen] = useState(isOnAgileRoute);

  // Label / text opacity — fades in slightly after the sidebar starts expanding
  const labelVisible = expanded;

  return (
    <div style={styles.shell}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className="app-sidebar"
        style={{
          ...styles.sidebar,
          width: expanded ? EXPANDED_W : COLLAPSED_W,
        }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* Logo */}
        <div style={styles.logoArea}>
          <div style={styles.brandRow}>
            {!logoError ? (
              <img
                src={`${client.defaults.baseURL}/logo?v=${logoKey}`}
                alt="Company logo"
                style={styles.logoImg}
                onError={() => setLogoError(true)}
              />
            ) : (
              /* Fallback monogram shown when no logo is uploaded */
              <div style={styles.logoMonogram}>PM</div>
            )}
            <div style={{ ...styles.brandText, opacity: labelVisible ? 1 : 0 }}>
              <span style={{ color: '#fff' }}>Portfolio</span>
              <span style={{ color: '#00FFBC' }}>Manager</span>
            </div>
          </div>
          {companyName && (
            <div style={{ ...styles.companyName, opacity: labelVisible ? 1 : 0 }}>
              {companyName}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={styles.nav}>
          {visibleNav.map(item => (
            <Link
              key={item.path}
              to={item.path}
              title={!expanded ? item.label : undefined}
              style={{
                ...styles.navItem,
                ...(isActive(item.path) ? styles.navActive : {}),
                justifyContent: expanded ? 'flex-start' : 'center',
              }}
            >
              <item.Icon style={styles.navIcon} />
              <span style={{ ...styles.navLabel, opacity: labelVisible ? 1 : 0 }}>
                {item.label}
              </span>
            </Link>
          ))}

          {/* Administration section */}
          {visibleAdmin.length > 0 && (
            <>
              <button
                onClick={() => setAdminOpen(o => !o)}
                title={!expanded ? 'Administration' : undefined}
                style={{
                  ...styles.adminSectionBtn,
                  justifyContent: expanded ? 'flex-start' : 'center',
                }}
              >
                <AdminPanelSettingsIcon style={{ ...styles.navIcon, color: 'rgba(255,255,255,0.45)' }} />
                <span style={{ ...styles.adminLabel, opacity: labelVisible ? 1 : 0, flex: 1 }}>
                  Administration
                </span>
                <ExpandMoreIcon
                  style={{
                    ...styles.chevron,
                    opacity: labelVisible ? 1 : 0,
                    transform: adminOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>

              {adminOpen && (
                <>
                  {visibleAdmin.map(item => (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={!expanded ? item.label : undefined}
                      style={{
                        ...styles.navItem,
                        ...(isActive(item.path) ? styles.navActive : {}),
                        justifyContent: expanded ? 'flex-start' : 'center',
                        paddingLeft: expanded ? '1.6rem' : undefined,
                      }}
                    >
                      <item.Icon style={{ ...styles.navIcon, fontSize: 18 }} />
                      <span style={{ ...styles.navLabel, opacity: labelVisible ? 1 : 0 }}>
                        {item.label}
                      </span>
                    </Link>
                  ))}

                  {/* Agile Projects sub-group */}
                  {visibleAgile.length > 0 && (
                    <>
                      <button
                        onClick={() => setAgileOpen(o => !o)}
                        title={!expanded ? 'Agile Projects' : undefined}
                        style={{
                          ...styles.navItem,
                          justifyContent: expanded ? 'flex-start' : 'center',
                          paddingLeft: expanded ? '1.6rem' : undefined,
                          background: isOnAgileRoute ? 'rgba(0,255,188,0.08)' : 'none',
                          border: 'none',
                          cursor: 'pointer',
                          width: '100%',
                          color: '#D3DFD4',
                        }}
                      >
                        <ViewKanbanIcon style={{ ...styles.navIcon, fontSize: 18, flexShrink: 0 }} />
                        <span style={{ ...styles.navLabel, opacity: labelVisible ? 1 : 0, flex: 1 }}>
                          Agile Projects
                        </span>
                        <ExpandMoreIcon
                          style={{
                            fontSize: 15,
                            color: 'rgba(255,255,255,0.4)',
                            flexShrink: 0,
                            opacity: labelVisible ? 1 : 0,
                            transition: 'transform 0.2s ease, opacity 0.15s ease',
                            transform: agileOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        />
                      </button>

                      {agileOpen && visibleAgile.map(item => (
                        <Link
                          key={item.path}
                          to={item.path}
                          title={!expanded ? item.label : undefined}
                          style={{
                            ...styles.navItem,
                            ...(isActive(item.path) ? styles.navActive : {}),
                            justifyContent: expanded ? 'flex-start' : 'center',
                            paddingLeft: expanded ? '2.6rem' : undefined,
                          }}
                        >
                          <item.Icon style={{ ...styles.navIcon, fontSize: 16 }} />
                          <span style={{ ...styles.navLabel, opacity: labelVisible ? 1 : 0, fontSize: '0.82rem' }}>
                            {item.label}
                          </span>
                        </Link>
                      ))}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </nav>

        {/* User area */}
        <div style={{ ...styles.userArea, alignItems: expanded ? 'flex-start' : 'center' }}>
          {expanded ? (
            <>
              <div style={styles.userName}>{user?.username}</div>
              <div style={styles.userRole}>{user?.role_name}</div>
              <button onClick={handleLogout} style={styles.logoutBtn}>Sign Out</button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              title="Sign Out"
              style={styles.logoutIconBtn}
            >
              <LogoutIcon style={{ fontSize: 18 }} />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main style={styles.main}>{children}</main>

      {/* ── Help button ── */}
      <button
        className="no-print"
        onClick={() => setShowManual(true)}
        style={styles.helpBtn}
        title="Open User Manual"
      >
        ? Help
      </button>

      {showManual && <UserManual onClose={() => setShowManual(false)} />}

      {showWelcome && (
        <WelcomeModal
          user={user}
          onClose={() => setShowWelcome(false)}
          onLaunchWizard={handleLaunchWizardFromWelcome}
        />
      )}

      {showWizardFromWelcome && (
        <OnboardingWizard
          onComplete={() => setShowWizardFromWelcome(false)}
        />
      )}

      <AiChat />

      <style>{`
        .app-sidebar { transition: width 0.22s ease; }

        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes slideUpIn {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  shell: { display: 'flex', minHeight: '100vh' },

  sidebar: {
    background: '#0A2B14',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflow: 'hidden',          // clips labels while narrow
    zIndex: 200,
  },

  /* ── Logo area ── */
  logoArea: {
    padding: '1.1rem 0.75rem 0.9rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: '0.55rem' },
  logoImg: {
    width: 32, height: 32,
    objectFit: 'contain',
    flexShrink: 0,
    borderRadius: 4,
  },
  logoMonogram: {
    width: 32, height: 32,
    borderRadius: 6,
    background: '#016D2D',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    fontSize: 11, fontWeight: 800, color: '#00FFBC',
    letterSpacing: '0.03em',
  },
  brandText: {
    display: 'flex', flexDirection: 'column',
    fontSize: '0.95rem', fontWeight: 800, lineHeight: 1.2,
    whiteSpace: 'nowrap',
    transition: 'opacity 0.15s ease',
  },
  companyName: {
    marginTop: '0.4rem',
    fontSize: '0.72rem', fontWeight: 500,
    color: 'rgba(255,255,255,0.6)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'opacity 0.15s ease',
  },

  /* ── Nav ── */
  nav: { flex: 1, padding: '0.6rem 0', overflowY: 'auto', overflowX: 'hidden' },

  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.55rem 0 0.55rem 14px',
    color: '#D3DFD4',
    textDecoration: 'none',
    fontSize: '0.88rem',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s',
    borderRadius: 0,
  },
  navActive: { background: 'rgba(0,255,188,0.15)', color: '#ffffff', fontWeight: 700 },

  navIcon:  { fontSize: 20, flexShrink: 0 },
  navLabel: { transition: 'opacity 0.15s ease', overflow: 'hidden' },

  adminSectionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    width: '100%',
    padding: '0.7rem 0 0.7rem 14px',
    fontSize: '0.7rem', fontWeight: 700,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    background: 'none', border: 'none', cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  adminLabel: { transition: 'opacity 0.15s ease', overflow: 'hidden' },
  chevron: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.4)',
    flexShrink: 0,
    transition: 'transform 0.2s ease, opacity 0.15s ease',
  },

  /* ── User area ── */
  userArea: {
    padding: '0.85rem 0.75rem',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  userName:     { color: '#fff', fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap' },
  userRole:     { color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'capitalize', marginBottom: '0.65rem', whiteSpace: 'nowrap' },
  logoutBtn:    { width: '100%', padding: '0.4rem', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', whiteSpace: 'nowrap' },
  logoutIconBtn: {
    width: 32, height: 32,
    background: 'rgba(255,255,255,0.1)',
    border: 'none', borderRadius: 6,
    color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  /* ── Main ── */
  main:    { flex: 1, padding: '2rem', overflowY: 'auto', minWidth: 0 },

  /* ── Help button ── */
  helpBtn: {
    position: 'fixed', bottom: '1.5rem', right: '1.5rem',
    padding: '0.5rem 1rem',
    background: '#016D2D', color: '#fff',
    border: 'none', borderRadius: '20px',
    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    zIndex: 1500,
  },
};
