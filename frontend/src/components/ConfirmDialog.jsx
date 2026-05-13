export default function ConfirmDialog({ message, onConfirm, onCancel, loading = false, error = null }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <p style={styles.message}>{message}</p>
        {error && <p style={styles.error}>{error}</p>}
        <div style={styles.actions}>
          <button onClick={onCancel} style={styles.cancelBtn} disabled={loading}>Cancel</button>
          <button onClick={onConfirm} style={{ ...styles.confirmBtn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  dialog:     { background: '#fff', padding: '2rem', borderRadius: '12px', maxWidth: '400px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  message:    { marginBottom: '1rem', fontSize: '1rem', color: '#374151' },
  error:      { marginBottom: '1rem', fontSize: '0.875rem', color: '#991b1b', background: '#fee2e2', padding: '0.5rem 0.75rem', borderRadius: '6px' },
  actions:    { display: 'flex', gap: '1rem', justifyContent: 'flex-end' },
  cancelBtn:  { padding: '0.5rem 1rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  confirmBtn: { padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
};
