import { useState, useRef } from 'react';

export default function InfoTooltip({ children, width = 280 }) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);

  const show = () => {
    clearTimeout(hideTimer.current);
    setVisible(true);
  };

  const hide = () => {
    // Small delay so mouse can travel from icon to card without flicker
    hideTimer.current = setTimeout(() => setVisible(false), 80);
  };

  return (
    <span style={styles.wrapper}>
      <span
        style={styles.icon}
        onMouseEnter={show}
        onMouseLeave={hide}
        aria-label="More information"
      >
        ⓘ
      </span>

      {visible && (
        <span
          style={{ ...styles.card, width }}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          {children}
        </span>
      )}
    </span>
  );
}

const styles = {
  wrapper: {
    position: 'relative',
    display: 'inline-block',
    verticalAlign: 'middle',
    lineHeight: 1,
  },
  icon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    fontSize: '0.85rem',
    color: '#9ca3af',
    cursor: 'default',
    userSelect: 'none',
    flexShrink: 0,
  },
  card: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    zIndex: 4000,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '0.75rem 1rem',
    boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
    fontSize: '0.85rem',
    lineHeight: 1.55,
    color: '#374151',
    pointerEvents: 'auto',
    whiteSpace: 'normal',
  },
};
