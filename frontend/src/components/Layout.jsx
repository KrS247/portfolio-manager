import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { clearPermissionsCache } from '../hooks/usePermissions';
import client from '../api/client';
import UserManual from './UserManual';

const NAV_ITEMS = [
  { slug: 'dashboard',          label: 'Dashboard',    path: '/' },
  { slug: 'portfolios',         label: 'Portfolios',   path: '/portfolios' },
  { slug: 'programs',           label: 'Programs',     path: '/programs' },
  { slug: 'projects',           label: 'Projects',     path: '/projects' },
  { slug: 'tasks',              label: 'Tasks',        path: '/tasks' },
  { slug: 'reports',            label: 'Reports',      path: '/reports' },
  { slug: 'capacity',           label: 'Capacity',     path: '/capacity' },
  { slug: 'tasks',              label: 'Risk Management', path: '/risk-management' },
];

const ADMIN_ITEMS = [
  { slug: 'admin.users',        label: 'Users',        path: '/admin/users' },
  { slug: 'admin.roles',        label: 'Roles',        path: '/admin/roles' },
  { slug: 'admin.permissions',  label: 'Permissions',  path: '/admin/permissions' },
  { slug: 'admin.dashboard',    label: 'Dashboard',    path: '/admin/dashboard' },
  { slug: 'admin.teams',        label: 'Teams',        path: '/admin/teams' },
  { slug: 'admin.company',      label: 'Company Setup',    path: '/admin/company-setup' },
  { slug: 'admin.company',      label: 'Working Calendar', path: '/admin/working-calendar' },
  { slug: 'admin.companies',    label: 'Companies',        path: '/admin/companies' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { canView } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl]         = useState(null);
  const [showManual, setShowManual]   = useState(false);

  const fetchBranding = () => {
    client.get('/company-settings')
      .then(res => {
        setCompanyName(res.data.company_name || '');
        setLogoUrl(res.data.logo_url || null);
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

  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const visibleNav = NAV_ITEMS.filter(item => canView(item.slug));
  const visibleAdmin = ADMIN_ITEMS.filter(item => canView(item.slug));

  // Auto-expand admin section when on an admin route; otherwise collapsed by default
  const isOnAdminRoute = location.pathname.startsWith('/admin');
  const [adminOpen, setAdminOpen] = useState(isOnAdminRoute);

  return (
    <div style={styles.shell}>
      <aside className="app-sidebar" style={styles.sidebar}>
        <div style={styles.logo}>
          <div style={styles.brandRow}>
            {logoUrl && (
              <img src={logoUrl} alt="Company logo" style={styles.logoImg} />
            )}
            <span>Portfolio<br /><span style={styles.logoAccent}>Manager</span></span>
          </div>
          {companyName && (
            <div style={styles.companyName}>{companyName}</div>
          )}
        </div>

        <nav style={styles.nav}>
          {visibleNav.map(item => (
            <Link key={item.path} to={item.path} style={{ ...styles.navItem, ...(isActive(item.path) ? styles.navActive : {}) }}>
              {item.label}
            </Link>
          ))}

          {visibleAdmin.length > 0 && (
            <>
              <button
                onClick={() => setAdminOpen(o => !o)}
                style={styles.navSectionBtn}
              >
                <span>Administration</span>
                <span style={{ ...styles.chevron, transform: adminOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
              </button>
              {adminOpen && visibleAdmin.map(item => (
                <Link key={item.path} to={item.path} style={{ ...styles.navItem, ...(isActive(item.path) ? styles.navActive : {}) }}>
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div style={styles.userArea}>
          <div style={styles.userName}>{user?.username}</div>
          <div style={styles.userRole}>{user?.role_name}</div>
          <button onClick={handleLogout} style={styles.logoutBtn}>Sign Out</button>
        </div>
      </aside>

      <main style={styles.main}>{children}</main>

      {/* ── Help button (fixed bottom-right) ── */}
      <button
        className="no-print"
        onClick={() => setShowManual(true)}
        style={styles.helpBtn}
        title="Open User Manual"
      >
        ? Help
      </button>

      {/* ── User Manual panel ── */}
      {showManual && <UserManual onClose={() => setShowManual(false)} />}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  shell:       { display: 'flex', minHeight: '100vh' },
  sidebar:     { width: '220px', background: '#0A2B14', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' },
  logo:        { padding: '1.25rem 1.25rem 1rem', fontSize: '1.1rem', fontWeight: 800, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  brandRow:    { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  logoImg:     { width: '36px', height: '36px', objectFit: 'contain', flexShrink: 0, borderRadius: '4px' },
  logoAccent:  { color: '#00FFBC' },
  companyName: { marginTop: '0.5rem', fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.7)', textAlign: 'center', wordBreak: 'break-word' },
  nav:         { flex: 1, padding: '0.75rem 0' },
  navItem:     { display: 'block', padding: '0.6rem 1.25rem', color: '#D3DFD4', textDecoration: 'none', fontSize: '0.9rem', borderRadius: '0', transition: 'background 0.15s' },
  navActive:   { background: 'rgba(0,255,188,0.15)', color: '#00FFBC', fontWeight: 600 },
  navSectionBtn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '1rem 1.25rem 0.3rem', fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' },
  chevron:     { fontSize: '0.85rem', transition: 'transform 0.2s ease', color: 'rgba(255,255,255,0.4)', flexShrink: 0 },
  userArea:    { padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' },
  userName:    { color: '#fff', fontWeight: 600, fontSize: '0.9rem' },
  userRole:    { color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', textTransform: 'capitalize', marginBottom: '0.75rem' },
  logoutBtn:   { width: '100%', padding: '0.4rem', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' },
  main:        { flex: 1, padding: '2rem', overflowY: 'auto' },
  helpBtn: {
    position: 'fixed', bottom: '1.5rem', right: '1.5rem',
    padding: '0.5rem 1rem',
    background: '#016D2D',
    color: '#fff',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    zIndex: 1500,
  },
};
