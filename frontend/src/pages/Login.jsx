import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Portfolio Manager</h1>
        <p style={styles.subtitle}>Sign in to continue</p>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Username</label>
          <input style={styles.input} type="text" value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required autoFocus />
          <label style={styles.label}>Password</label>
          <input style={styles.input} type="password" value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div style={styles.footer}>
          <Link to="/forgot-password" style={styles.forgotLink}>Forgot password?</Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page:     { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F7F5' },
  card:     { background: '#fff', padding: '2.5rem', borderRadius: '16px', width: '380px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  title:    { fontSize: '1.5rem', fontWeight: 800, color: '#014E20', marginBottom: '0.25rem' },
  subtitle: { color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.95rem' },
  form:     { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:    { fontSize: '0.85rem', fontWeight: 600, color: '#374151' },
  input:    { padding: '0.6rem 0.85rem', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' },
  btn:      { padding: '0.7rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem' },
  error:      { background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' },
  footer:     { marginTop: '1.25rem', textAlign: 'center' },
  forgotLink: { color: '#016D2D', fontSize: '0.88rem', textDecoration: 'none', fontWeight: 600 },
};
