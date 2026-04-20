import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import client from '../api/client';

export default function ResetPassword() {
  const [searchParams]          = useSearchParams();
  const navigate                = useNavigate();
  const token                   = searchParams.get('token') || '';
  const [form, setForm]         = useState({ password: '', confirm: '' });
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      await client.post('/auth/reset-password', { token, password: form.password });
      setSuccess(true);
      // Redirect to login after 2.5 s
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Invalid Link</h1>
          <p style={styles.subtitle}>This password reset link is missing a token. Please request a new one.</p>
          <div style={styles.footer}>
            <Link to="/forgot-password" style={styles.link}>Request a new reset link</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Reset Password</h1>

        {success ? (
          <>
            <div style={styles.successBox}>
              Password updated successfully! Redirecting you to sign in…
            </div>
            <div style={styles.footer}>
              <Link to="/login" style={styles.link}>Sign In now</Link>
            </div>
          </>
        ) : (
          <>
            <p style={styles.subtitle}>Choose a new password for your account.</p>
            {error && <div style={styles.error}>{error}</div>}
            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>New Password</label>
              <input
                style={styles.input}
                type="password"
                value={form.password}
                required
                autoFocus
                minLength={8}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min. 8 characters"
              />
              <label style={styles.label}>Confirm Password</label>
              <input
                style={styles.input}
                type="password"
                value={form.confirm}
                required
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repeat new password"
              />
              <button type="submit" style={styles.btn} disabled={loading}>
                {loading ? 'Updating...' : 'Set New Password'}
              </button>
            </form>
            <div style={styles.footer}>
              <Link to="/login" style={styles.link}>← Back to Sign In</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page:       { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' },
  card:       { background: '#fff', padding: '2.5rem', borderRadius: '16px', width: '380px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  title:      { fontSize: '1.5rem', fontWeight: 800, color: '#1d1d1d', marginBottom: '0.25rem' },
  subtitle:   { color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.95rem', marginTop: '0.25rem' },
  form:       { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:      { fontSize: '0.85rem', fontWeight: 600, color: '#374151' },
  input:      { padding: '0.6rem 0.85rem', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' },
  btn:        { padding: '0.7rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.25rem' },
  error:      { background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.9rem' },
  successBox: { background: '#d1fae5', color: '#065f46', padding: '1rem', borderRadius: '8px', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '1.25rem' },
  footer:     { marginTop: '1.25rem', textAlign: 'center' },
  link:       { color: '#016D2D', fontSize: '0.88rem', textDecoration: 'none', fontWeight: 600 },
};
