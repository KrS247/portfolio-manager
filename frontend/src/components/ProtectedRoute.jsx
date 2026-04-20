import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

export default function ProtectedRoute({ children, pageSlug }) {
  const { isAuthenticated } = useAuth();
  const { canView, loading } = usePermissions();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (loading) return <div style={styles.loading}>Loading...</div>;
  if (pageSlug && !canView(pageSlug)) {
    return (
      <div style={styles.denied}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return children;
}

const styles = {
  loading: { padding: '2rem', textAlign: 'center', color: '#666' },
  denied: { padding: '3rem', textAlign: 'center' },
};
