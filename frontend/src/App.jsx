import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import OnboardingWizard from './components/OnboardingWizard';
import client from './api/client';

import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Portfolios from './pages/Portfolios';
import PortfolioDetail from './pages/PortfolioDetail';
import Programs from './pages/Programs';
import ProgramDetail from './pages/ProgramDetail';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Tasks from './pages/Tasks';
import UsersAdmin from './pages/admin/UsersAdmin';
import RolesAdmin from './pages/admin/RolesAdmin';
import PermissionsAdmin from './pages/admin/PermissionsAdmin';
import DashboardAdmin from './pages/admin/DashboardAdmin';
import TeamsAdmin from './pages/admin/TeamsAdmin';
import CompanySetupAdmin from './pages/admin/CompanySetupAdmin';
import WorkingCalendarAdmin from './pages/admin/WorkingCalendarAdmin';
import CompaniesAdmin from './pages/admin/CompaniesAdmin';
import AgilePhasesAdmin from './pages/admin/AgilePhasesAdmin';
import SprintManagementAdmin from './pages/admin/SprintManagementAdmin';
import Reports from './pages/Reports';
import Capacity from './pages/Capacity';
import RiskManagement from './pages/RiskManagement';
import Calendar from './pages/Calendar';

function AppRoutes() {
  const { user, updateUser, isAuthenticated } = useAuth();
  // showWizard starts as null (undecided) to avoid a flash of the wizard
  // while the API check is in flight. We only render it once we have a
  // confirmed answer from the server, preventing stale localStorage from
  // permanently blocking the app for existing users.
  const [showWizard, setShowWizard] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.is_admin) {
      setShowWizard(false);
      return;
    }
    // Always verify with the server — localStorage value may be stale
    client.get('/onboarding/status')
      .then(res => {
        const needs = res.data.needs_onboarding === true;
        setShowWizard(needs);
        // Sync the stored user object so subsequent renders are consistent
        if (!needs) updateUser({ onboarding_completed: true });
      })
      .catch(() => setShowWizard(false)); // on error, never block the app
  }, [isAuthenticated, user?.is_admin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOnboardingComplete = () => {
    setShowWizard(false);
    updateUser({ onboarding_completed: true });
  };

  return (
    <>
      {showWizard === true && (
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      )}
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/" element={
        <ProtectedRoute pageSlug="dashboard">
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/portfolios" element={
        <ProtectedRoute pageSlug="portfolios">
          <Layout><Portfolios /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/portfolios/:id" element={
        <ProtectedRoute pageSlug="portfolios">
          <Layout><PortfolioDetail /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/programs" element={
        <ProtectedRoute pageSlug="programs">
          <Layout><Programs /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/programs/:id" element={
        <ProtectedRoute pageSlug="programs">
          <Layout><ProgramDetail /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/projects" element={
        <ProtectedRoute pageSlug="projects">
          <Layout><Projects /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/projects/:id" element={
        <ProtectedRoute pageSlug="projects">
          <Layout><ProjectDetail /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/tasks" element={
        <ProtectedRoute pageSlug="tasks">
          <Layout><Tasks /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/users" element={
        <ProtectedRoute pageSlug="admin.users">
          <Layout><UsersAdmin /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/roles" element={
        <ProtectedRoute pageSlug="admin.roles">
          <Layout><RolesAdmin /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/permissions" element={
        <ProtectedRoute pageSlug="admin.permissions">
          <Layout><PermissionsAdmin /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/dashboard" element={
        <ProtectedRoute pageSlug="admin.dashboard">
          <Layout><DashboardAdmin /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/teams" element={
        <ProtectedRoute pageSlug="admin.teams">
          <Layout><TeamsAdmin /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/company-setup" element={
        <ProtectedRoute pageSlug="admin.company">
          <Layout><CompanySetupAdmin /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/working-calendar" element={
        <ProtectedRoute pageSlug="admin.company">
          <Layout><WorkingCalendarAdmin /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/companies" element={
        <ProtectedRoute pageSlug="admin.companies">
          <Layout><CompaniesAdmin /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/agile-phases" element={
        <ProtectedRoute pageSlug="admin.agile-phases">
          <Layout><AgilePhasesAdmin /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/sprint-management" element={
        <ProtectedRoute pageSlug="admin.sprint-management">
          <Layout><SprintManagementAdmin /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/reports" element={
        <ProtectedRoute pageSlug="reports">
          <Layout><Reports /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/capacity" element={
        <ProtectedRoute pageSlug="capacity">
          <Layout><Capacity /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/risk-management" element={
        <ProtectedRoute pageSlug="risks">
          <Layout><RiskManagement /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/calendar" element={
        <ProtectedRoute pageSlug="calendar">
          <Layout><Calendar /></Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
