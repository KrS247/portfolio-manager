/**
 * AdminHub — unified administration page.
 * All admin sections live here as tabs; the active tab is tracked via ?tab=<key>
 * so deep-links and browser back/forward work correctly.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';

// Icons (tab bar only — no MUI dependency needed)
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import BadgeIcon          from '@mui/icons-material/Badge';
import SecurityIcon       from '@mui/icons-material/Security';
import SpeedIcon          from '@mui/icons-material/Speed';
import GroupIcon          from '@mui/icons-material/Group';
import BusinessIcon       from '@mui/icons-material/Business';
import EditCalendarIcon   from '@mui/icons-material/EditCalendar';
import ApartmentIcon      from '@mui/icons-material/Apartment';
import ViewColumnIcon     from '@mui/icons-material/ViewColumn';
import DirectionsRunIcon  from '@mui/icons-material/DirectionsRun';
import ApiIcon            from '@mui/icons-material/Api';

// Admin sub-pages (rendered inline as tab content)
import UsersAdmin          from './UsersAdmin';
import RolesAdmin          from './RolesAdmin';
import PermissionsAdmin    from './PermissionsAdmin';
import DashboardAdmin      from './DashboardAdmin';
import TeamsAdmin          from './TeamsAdmin';
import CompanySetupAdmin   from './CompanySetupAdmin';
import WorkingCalendarAdmin from './WorkingCalendarAdmin';
import CompaniesAdmin      from './CompaniesAdmin';
import AgilePhasesAdmin    from './AgilePhasesAdmin';
import SprintManagementAdmin from './SprintManagementAdmin';
import McpIntegrationAdmin from './McpIntegrationAdmin';

// Tab definitions — order here = order in the tab bar
const TABS = [
  { key: 'users',       slug: 'admin.users',             label: 'Users',            Icon: ManageAccountsIcon,  Component: UsersAdmin },
  { key: 'roles',       slug: 'admin.roles',             label: 'Roles',            Icon: BadgeIcon,           Component: RolesAdmin },
  { key: 'permissions', slug: 'admin.permissions',       label: 'Permissions',      Icon: SecurityIcon,        Component: PermissionsAdmin },
  { key: 'dashboard',   slug: 'admin.dashboard',         label: 'Dashboard',        Icon: SpeedIcon,           Component: DashboardAdmin },
  { key: 'teams',       slug: 'admin.teams',             label: 'Teams',            Icon: GroupIcon,           Component: TeamsAdmin },
  { key: 'company',     slug: 'admin.company',           label: 'Company Setup',    Icon: BusinessIcon,        Component: CompanySetupAdmin },
  { key: 'calendar',    slug: 'admin.company',           label: 'Working Calendar', Icon: EditCalendarIcon,    Component: WorkingCalendarAdmin },
  { key: 'companies',   slug: 'admin.companies',         label: 'Companies',        Icon: ApartmentIcon,       Component: CompaniesAdmin },
  { key: 'agile',       slug: 'admin.agile-phases',      label: 'Agile Phases',     Icon: ViewColumnIcon,      Component: AgilePhasesAdmin },
  { key: 'sprints',     slug: 'admin.sprint-management', label: 'Sprint Management',Icon: DirectionsRunIcon,   Component: SprintManagementAdmin },
  { key: 'mcp',         slug: 'admin.mcp-integration',   label: 'MCP Integration',  Icon: ApiIcon,             Component: McpIntegrationAdmin },
];

export default function AdminHub() {
  const { canView } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  // Only expose tabs the signed-in user is allowed to see
  const visibleTabs = TABS.filter(t => canView(t.slug));

  const tabParam  = searchParams.get('tab');
  const activeTab = visibleTabs.find(t => t.key === tabParam) ?? visibleTabs[0];

  // Write the initial tab into the URL so the browser history entry is complete
  useEffect(() => {
    if (visibleTabs.length > 0 && !tabParam) {
      setSearchParams({ tab: visibleTabs[0].key }, { replace: true });
    }
  }, [visibleTabs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectTab = (key) => setSearchParams({ tab: key }, { replace: true });

  if (visibleTabs.length === 0) {
    return (
      <div style={styles.empty}>
        You don&apos;t have access to any administration sections.
      </div>
    );
  }

  const ActiveComponent = activeTab?.Component;

  return (
    <div style={styles.wrapper}>
      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div style={styles.tabBar}>
        {visibleTabs.map(tab => {
          const active = tab.key === activeTab?.key;
          return (
            <button
              key={tab.key}
              onClick={() => selectTab(tab.key)}
              style={{ ...styles.tab, ...(active ? styles.tabActive : {}) }}
              title={tab.label}
            >
              <tab.Icon style={styles.tabIcon} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <div style={styles.content}>
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}

const styles = {
  // Flush the tab bar to the edges of the Layout's main content area
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    margin: '-2rem -2rem 0',
    minHeight: 0,
  },

  tabBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 0,
    padding: '0 1.5rem',
    borderBottom: '2px solid #e5e7eb',
    background: '#f9fafb',
    overflowX: 'auto',
  },

  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.65rem 1rem',
    fontSize: '0.82rem',
    fontWeight: 500,
    color: '#6b7280',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: '-2px',        // overlap the bar's bottom border
    borderRadius: '4px 4px 0 0',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'color 0.15s, background 0.15s',
  },

  tabActive: {
    color: '#016D2D',
    fontWeight: 700,
    borderBottomColor: '#016D2D',
    background: '#fff',
  },

  tabIcon: {
    fontSize: 15,
    flexShrink: 0,
  },

  // Restore the 2rem padding below the tab bar for the component content
  content: {
    padding: '2rem',
    flex: 1,
    minHeight: 0,
  },

  empty: {
    padding: '3rem',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '0.9rem',
  },
};
