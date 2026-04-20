export default function PriorityBadge({ priority }) {
  const p = parseInt(priority, 10);
  let bg, color;
  if (p <= 3)      { bg = '#d1fae5'; color = '#065f46'; }  // low
  else if (p <= 6) { bg = '#fef3c7'; color = '#92400e'; }  // medium
  else if (p <= 8) { bg = '#fed7aa'; color = '#9a3412'; }  // high
  else             { bg = '#fee2e2'; color = '#991b1b'; }  // critical

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      fontSize: '0.8rem',
      fontWeight: 700,
      background: bg,
      color,
    }}>
      {p}
    </span>
  );
}
