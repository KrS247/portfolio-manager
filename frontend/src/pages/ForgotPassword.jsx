import { useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await client.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      // Server always returns 200 for this endpoint; only show error on network failure
      setError(err.response?.data?.error?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Forgot Password</h1>

        {sent ? (
          <>
            <div style={styles.successBox}>
              <p style={{ margin: 0 }}>
                If that email address is registered, a reset link has been sent. Check your inbox (and spam folder).
              </p>
            </div>
            <div style={styles.footer}>
              <Link to="/login" style={styles.link}>← Back to Sign In</Link>
            </div>
          </>
        ) : (
          <>
            <p style={styles.subtitle}>Enter your account email and we'll send you a reset link.</p>
            {error && <div style={styles.error}>{error}</div>}
            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>Email address</label>
              <input
                style={styles.input}
                type="email"
                value={email}
                required
                autoFocus
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <button type="submit" style={styles.btn} disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
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
