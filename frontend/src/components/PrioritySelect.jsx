// Shared priority constants, tag, and select dropdown used across all entity forms.

export const PRIORITY_LABELS = {
  1:  { label: 'P1 – Lowest',  color: '#6b7280', bg: '#f3f4f6' },
  2:  { label: 'P2',           color: '#6b7280', bg: '#f3f4f6' },
  3:  { label: 'P3',           color: '#0891b2', bg: '#e0f2fe' },
  4:  { label: 'P4',           color: '#0891b2', bg: '#e0f2fe' },
  5:  { label: 'P5 – Medium',  color: '#059669', bg: '#d1fae5' },
  6:  { label: 'P6',           color: '#059669', bg: '#d1fae5' },
  7:  { label: 'P7',           color: '#d97706', bg: '#fef3c7' },
  8:  { label: 'P8',           color: '#d97706', bg: '#fef3c7' },
  9:  { label: 'P9',           color: '#dc2626', bg: '#fee2e2' },
  10: { label: 'P10 – Highest',color: '#991b1b', bg: '#fee2e2' },
};

const OPTION_LABELS = [
  [1,  'Lowest'],
  [2,  'Low'],
  [3,  'Low'],
  [4,  'Low'],
  [5,  'Medium'],
  [6,  'Medium'],
  [7,  'High'],
  [8,  'High'],
  [9,  'Critical'],
  [10, 'Highest'],
];

/** Coloured badge shown on cards and detail headers. */
export function PriorityTag({ priority }) {
  const p = PRIORITY_LABELS[priority] || PRIORITY_LABELS[5];
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: p.color, background: p.bg, padding: '2px 8px', borderRadius: '4px' }}>
      {p.label}
    </span>
  );
}

/**
 * Dropdown (select) for choosing priority 1–10.
 * Props:
 *   value    – current integer value (1–10)
 *   onChange – called with the new integer value
 *   style    – optional extra inline styles for the <select>
 */
export default function PrioritySelect({ value, onChange, style = {} }) {
  const meta = PRIORITY_LABELS[value] || PRIORITY_LABELS[5];
  return (
    <select
      value={value}
      onChange={e => onChange(parseInt(e.target.value, 10))}
      style={{
        padding: '0.5rem 0.75rem',
        border: '1.5px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '0.95rem',
        width: '100%',
        outline: 'none',
        boxSizing: 'border-box',
        fontWeight: 600,
        color: meta.color,
        ...style,
      }}
    >
      {OPTION_LABELS.map(([n, lbl]) => (
        <option key={n} value={n}>{n} – {lbl}</option>
      ))}
    </select>
  );
}
