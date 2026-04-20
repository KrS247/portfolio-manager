import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

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
import Reports from './pages/Reports';
import Capacity from './pages/Capacity';
import RiskManagement from './pages/RiskManagement';

function AppRoutes() {
  return (
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
        <ProtectedRoute pageSlug="tasks">
          <Layout><RiskManagement /></Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
