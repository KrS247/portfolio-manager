/**
 * ProgressBar — reusable completion percentage bar.
 *
 * Props:
 *   value       {number}  0-100 completion percentage
 *   size        {string}  'sm' | 'md' (default) | 'lg'
 *   showLabel   {boolean} show "Progress / N%" header (default true)
 *   label       {string}  left-side label text (default "Progress")
 */
export default function ProgressBar({ value, size = 'md', showLabel = true, label = 'Progress' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  const color = pct >= 75 ? '#16a34a' : pct >= 40 ? '#d97706' : '#016D2D';
  const height = size === 'sm' ? '5px' : size === 'lg' ? '10px' : '7px';

  return (
    <div style={{ width: '100%' }}>
      {showLabel && (
        <div style={styles.labelRow}>
          <span style={styles.labelLeft}>{label}</span>
          <span style={{ ...styles.labelRight, color }}>{pct}%</span>
        </div>
      )}
      <div style={{ background: '#e5e7eb', borderRadius: '99px', height, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`,
          minWidth: pct > 0 ? '6px' : 0,
          height: '100%',
          background: color,
          borderRadius: '99px',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

const styles = {
  labelRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  labelLeft:  { fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' },
  labelRight: { fontSize: '0.75rem', fontWeight: 700 },
};
