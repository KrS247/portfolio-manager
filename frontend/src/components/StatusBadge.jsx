const STATUS_COLORS = {
  active:      { bg: '#d1fae5', color: '#065f46' },
  on_hold:     { bg: '#fef3c7', color: '#92400e' },
  closed:      { bg: '#fee2e2', color: '#991b1b' },
  open:        { bg: '#dbeafe', color: '#1e40af' },
  in_progress: { bg: '#ede9fe', color: '#5b21b6' },
  completed:   { bg: '#d1fae5', color: '#065f46' },
  cancelled:   { bg: '#f3f4f6', color: '#6b7280' },
};

export default function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || { bg: '#f3f4f6', color: '#374151' };
  const label = status ? status.replace('_', ' ') : '';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      textTransform: 'capitalize',
      background: colors.bg,
      color: colors.color,
    }}>
      {label}
    </span>
  );
}
