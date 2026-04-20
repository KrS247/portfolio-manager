/**
 * WorkingCalendarAdmin
 *
 * Admin page at /admin/working-calendar for configuring:
 *  - Company-wide default work days (Mon–Sun toggles) and default hours/day
 *  - Public holidays (add / delete)
 *
 * Route: accessible only to users with authorize:admin.company,edit
 */
import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_WORK_DAYS = [1,2,3,4,5];   // Mon-Fri

const TIMEZONES = [
  { group: 'UTC',              zones: ['UTC'] },
  { group: 'Africa',           zones: ['Africa/Cairo','Africa/Johannesburg','Africa/Lagos','Africa/Nairobi'] },
  { group: 'America',          zones: ['America/Anchorage','America/Bogota','America/Buenos_Aires','America/Chicago','America/Denver','America/Los_Angeles','America/Mexico_City','America/New_York','America/Phoenix','America/Sao_Paulo','America/Toronto','America/Vancouver'] },
  { group: 'Asia',             zones: ['Asia/Bangkok','Asia/Colombo','Asia/Dubai','Asia/Hong_Kong','Asia/Jakarta','Asia/Karachi','Asia/Kolkata','Asia/Kuala_Lumpur','Asia/Manila','Asia/Riyadh','Asia/Seoul','Asia/Shanghai','Asia/Singapore','Asia/Taipei','Asia/Tehran','Asia/Tokyo'] },
  { group: 'Atlantic',         zones: ['Atlantic/Azores','Atlantic/Cape_Verde'] },
  { group: 'Australia',        zones: ['Australia/Adelaide','Australia/Brisbane','Australia/Darwin','Australia/Melbourne','Australia/Perth','Australia/Sydney'] },
  { group: 'Europe',           zones: ['Europe/Amsterdam','Europe/Athens','Europe/Berlin','Europe/Brussels','Europe/Dublin','Europe/Helsinki','Europe/Istanbul','Europe/Lisbon','Europe/London','Europe/Madrid','Europe/Moscow','Europe/Oslo','Europe/Paris','Europe/Rome','Europe/Stockholm','Europe/Warsaw','Europe/Zurich'] },
  { group: 'Pacific',          zones: ['Pacific/Auckland','Pacific/Fiji','Pacific/Honolulu','Pacific/Noumea'] },
];

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 16, height: 16,
      border: '2px solid #86efac', borderTopColor: '#016D2D',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  );
}

export default function WorkingCalendarAdmin() {
  // ── Company calendar state ────────────────────────────────────────────────
  const [calSettings, setCalSettings] = useState({
    work_days:      DEFAULT_WORK_DAYS,
    hours_per_day:  8,
    timezone:       'UTC',
  });
  const [calLoading, setCalLoading] = useState(true);
  const [calSaving,  setCalSaving]  = useState(false);
  const [calMsg,     setCalMsg]     = useState('');

  // ── Holidays state ────────────────────────────────────────────────────────
  const [holidays,  setHolidays]  = useState([]);
  const [hlLoading, setHlLoading] = useState(true);
  const [hlSaving,  setHlSaving]  = useState(false);
  const [hlMsg,     setHlMsg]     = useState('');
  const [newHl, setNewHl] = useState({ date: '', name: '', recurring: false });

  // ── Load calendar settings ────────────────────────────────────────────────
  const loadCalendar = useCallback(() => {
    setCalLoading(true);
    client.get('/working-calendar')
      .then(({ data }) => {
        setCalSettings({
          work_days:      data.work_days     || DEFAULT_WORK_DAYS,
          hours_per_day:  data.hours_per_day ?? 8,
          timezone:       data.timezone      || 'UTC',
        });
      })
      .catch(() => {})
      .finally(() => setCalLoading(false));
  }, []);

  const loadHolidays = useCallback(() => {
    setHlLoading(true);
    client.get('/working-calendar/holidays')
      .then(({ data }) => setHolidays(data || []))
      .catch(() => {})
      .finally(() => setHlLoading(false));
  }, []);

  useEffect(() => {
    loadCalendar();
    loadHolidays();
  }, [loadCalendar, loadHolidays]);

  // ── Toggle work day ───────────────────────────────────────────────────────
  const toggleDay = (dayNum) => {
    setCalSettings(s => {
      const wd = s.work_days.includes(dayNum)
        ? s.work_days.filter(d => d !== dayNum)
        : [...s.work_days, dayNum].sort();
      return { ...s, work_days: wd };
    });
  };

  // ── Save calendar settings ────────────────────────────────────────────────
  const saveCalendar = async () => {
    setCalSaving(true);
    setCalMsg('');
    try {
      await client.put('/working-calendar', calSettings);
      setCalMsg('✓ Saved');
    } catch {
      setCalMsg('✗ Save failed');
    } finally {
      setCalSaving(false);
      setTimeout(() => setCalMsg(''), 3000);
    }
  };

  // ── Add holiday ───────────────────────────────────────────────────────────
  const addHoliday = async () => {
    if (!newHl.date || !newHl.name.trim()) return;
    setHlSaving(true);
    setHlMsg('');
    try {
      await client.post('/working-calendar/holidays', {
        date:      newHl.date,        // backend accepts 'date' alias
        name:      newHl.name.trim(),
        recurring: newHl.recurring ? 1 : 0,
      });
      setNewHl({ date: '', name: '', recurring: false });
      await loadHolidays();
      setHlMsg('✓ Holiday added');
    } catch {
      setHlMsg('✗ Failed to add holiday');
    } finally {
      setHlSaving(false);
      setTimeout(() => setHlMsg(''), 3000);
    }
  };

  // ── Delete holiday ────────────────────────────────────────────────────────
  const deleteHoliday = async (id) => {
    if (!window.confirm('Delete this holiday?')) return;
    try {
      await client.delete(`/working-calendar/holidays/${id}`);
      setHolidays(h => h.filter(x => x.id !== id));
    } catch {
      alert('Failed to delete holiday.');
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <h2 style={styles.pageTitle}>Working Calendar</h2>
      <p style={styles.pageSubtitle}>
        Configure company-wide working days and public holidays. These settings feed into the scheduling engine's CPM calculations.
      </p>

      {/* ── Company Work Days ────────────────────────────────────────────── */}
      <section style={styles.card}>
        <h3 style={styles.sectionTitle}>Company Work Days</h3>

        {calLoading ? (
          <div style={styles.loading}><Spinner /> Loading settings…</div>
        ) : (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={styles.label}>Working Days</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {DAY_NAMES.map((name, i) => {
                  const dayNum = i + 1;
                  const active = calSettings.work_days.includes(dayNum);
                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => toggleDay(dayNum)}
                      style={{
                        padding: '0.45rem 0.9rem',
                        borderRadius: '8px',
                        border: `2px solid ${active ? '#016D2D' : '#e5e7eb'}`,
                        background: active ? '#016D2D' : '#f9fafb',
                        color: active ? '#fff' : '#6b7280',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.15s',
                      }}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <p style={styles.hint}>Click to toggle. Selected days are treated as working days.</p>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div style={{ flex: '0 0 160px' }}>
                <label style={styles.label}>Hours Per Day</label>
                <input
                  type="number" min="1" max="24" step="0.5"
                  style={styles.input}
                  value={calSettings.hours_per_day}
                  onChange={e => setCalSettings(s => ({ ...s, hours_per_day: parseFloat(e.target.value) || 8 }))}
                />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={styles.label}>Timezone</label>
                <select
                  style={styles.input}
                  value={calSettings.timezone}
                  onChange={e => setCalSettings(s => ({ ...s, timezone: e.target.value }))}
                >
                  {TIMEZONES.map(({ group, zones }) => (
                    <optgroup key={group} label={group}>
                      {zones.map(tz => (
                        <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                type="button"
                onClick={saveCalendar}
                disabled={calSaving}
                style={styles.saveBtn}
              >
                {calSaving ? <><Spinner /> Saving…</> : 'Save Calendar Settings'}
              </button>
              {calMsg && (
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: calMsg.startsWith('✓') ? '#016D2D' : '#dc2626' }}>
                  {calMsg}
                </span>
              )}
            </div>
          </>
        )}
      </section>

      {/* ── Public Holidays ─────────────────────────────────────────────── */}
      <section style={styles.card}>
        <h3 style={styles.sectionTitle}>Public Holidays</h3>

        {/* Add holiday form */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div>
            <label style={styles.label}>Date</label>
            <input
              type="date"
              style={styles.input}
              value={newHl.date}
              onChange={e => setNewHl(h => ({ ...h, date: e.target.value }))}
            />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={styles.label}>Name</label>
            <input
              type="text"
              style={styles.input}
              value={newHl.name}
              onChange={e => setNewHl(h => ({ ...h, name: e.target.value }))}
              placeholder="e.g. Christmas Day"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingBottom: '0.5rem' }}>
            <input
              type="checkbox"
              id="hlRecurring"
              checked={newHl.recurring}
              onChange={e => setNewHl(h => ({ ...h, recurring: e.target.checked }))}
              style={{ accentColor: '#016D2D', width: 16, height: 16 }}
            />
            <label htmlFor="hlRecurring" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
              Recurring (annual)
            </label>
          </div>
          <button
            type="button"
            onClick={addHoliday}
            disabled={hlSaving || !newHl.date || !newHl.name.trim()}
            style={{ ...styles.saveBtn, opacity: (newHl.date && newHl.name.trim()) ? 1 : 0.45 }}
          >
            {hlSaving ? <Spinner /> : '+ Add Holiday'}
          </button>
        </div>

        {hlMsg && (
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: hlMsg.startsWith('✓') ? '#016D2D' : '#dc2626', marginBottom: '0.75rem' }}>
            {hlMsg}
          </div>
        )}

        {/* Holiday list */}
        {hlLoading ? (
          <div style={styles.loading}><Spinner /> Loading holidays…</div>
        ) : holidays.length === 0 ? (
          <div style={styles.empty}>No public holidays configured yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {holidays
              .slice()
              .sort((a, b) => (a.holiday_date || a.date || '').localeCompare(b.holiday_date || b.date || ''))
              .map(h => (
                <div key={h.id} style={styles.holidayRow}>
                  <span style={styles.holidayDate}>{h.holiday_date || h.date}</span>
                  <span style={styles.holidayName}>{h.name}</span>
                  {h.recurring && (
                    <span style={styles.recurringBadge}>Annual</span>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteHoliday(h.id)}
                    style={styles.deleteBtn}
                    title="Delete holiday"
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}

const styles = {
  pageTitle:    { fontSize: '1.5rem', fontWeight: 800, color: '#1d1d1d', marginBottom: '0.25rem' },
  pageSubtitle: { color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' },

  card: {
    background: '#fff',
    border: '1.5px solid #e5e7eb',
    borderRadius: '10px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
  },
  sectionTitle: { fontSize: '1rem', fontWeight: 700, color: '#374151', marginBottom: '1rem', marginTop: 0 },

  label:   { fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' },
  input:   { padding: '0.45rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '0.92rem', width: '100%', boxSizing: 'border-box', outline: 'none' },
  hint:    { fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.4rem', marginBottom: 0 },

  saveBtn: {
    padding: '0.5rem 1.25rem',
    background: '#016D2D', color: '#fff',
    border: 'none', borderRadius: '7px',
    cursor: 'pointer', fontWeight: 700,
    fontSize: '0.9rem',
    display: 'flex', alignItems: 'center', gap: '0.4rem',
  },

  loading: { display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.88rem', padding: '1rem 0' },
  empty:   { color: '#9ca3af', fontSize: '0.88rem', fontStyle: 'italic', padding: '0.5rem 0' },

  holidayRow:    { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.85rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px' },
  holidayDate:   { fontWeight: 700, fontSize: '0.85rem', color: '#374151', minWidth: '90px' },
  holidayName:   { flex: 1, fontSize: '0.9rem', color: '#1d1d1d' },
  recurringBadge:{ fontSize: '0.72rem', fontWeight: 700, color: '#016D2D', background: '#d1fae5', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '10px' },
  deleteBtn:     { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.85rem', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 },
};
