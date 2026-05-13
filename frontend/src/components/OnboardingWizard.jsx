import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import EditIcon from '@mui/icons-material/Edit';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AddIcon from '@mui/icons-material/Add';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';

const BRAND_GREEN = '#016D2D';
const HEADER_DARK = '#0A2B14';
const ACCENT      = '#00FFBC';

/* ── Step indicator ─────────────────────────────────────────────── */
function StepDots({ step }) {
  return (
    <div style={dotStyles.row}>
      {[1, 2, 3].map(n => (
        <span
          key={n}
          style={{
            ...dotStyles.dot,
            background: n === step ? BRAND_GREEN : n < step ? '#86efac' : '#e5e7eb',
            transform: n === step ? 'scale(1.25)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}

const dotStyles = {
  row: { display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginBottom: '1.75rem' },
  dot: { width: 10, height: 10, borderRadius: '50%', transition: 'all 0.2s' },
};

/* ── Empty invite row ───────────────────────────────────────────── */
const emptyRow = () => ({ username: '', email: '', role: 'member', password: '' });

/* ── Main wizard ────────────────────────────────────────────────── */
export default function OnboardingWizard({ onComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1
  const [companyName, setCompanyName] = useState('');
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error,   setStep1Error]   = useState('');

  // Step 2
  const [inviteRows, setInviteRows] = useState([emptyRow()]);
  const [inviteResults, setInviteResults] = useState([]); // {status: 'ok'|'error', msg}
  const [step2Loading, setStep2Loading]   = useState(false);
  const [step2Submitted, setStep2Submitted] = useState(false);

  // Step 3
  const [sampleLoading,    setSampleLoading]    = useState(false);
  const [sampleError,      setSampleError]      = useState('');
  const [sampleDataLoaded, setSampleDataLoaded] = useState(false);
  const [deleteLoading,    setDeleteLoading]    = useState(false);
  const [deleteError,      setDeleteError]      = useState('');

  /* ── Skip wizard ────────────────────────────────────────────────── */
  const skipAll = async () => {
    try { await client.post('/onboarding/complete'); } catch (_) { /* best effort */ }
    onComplete();
  };

  /* ── Step 1 submit ─────────────────────────────────────────────── */
  const handleStep1 = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setStep1Loading(true);
    setStep1Error('');
    try {
      await client.post('/onboarding/workspace', { company_name: companyName.trim() });
      setStep(2);
    } catch (err) {
      setStep1Error(err.response?.data?.error?.message || 'Failed to save workspace name. Please try again.');
    } finally {
      setStep1Loading(false);
    }
  };

  /* ── Step 2 invite row helpers ─────────────────────────────────── */
  const updateRow = (idx, field, val) =>
    setInviteRows(rows => rows.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  const addRow = () => {
    if (inviteRows.length < 3) setInviteRows(r => [...r, emptyRow()]);
  };

  const removeRow = (idx) =>
    setInviteRows(rows => rows.filter((_, i) => i !== idx));

  /* ── Step 2 send invites ───────────────────────────────────────── */
  const handleInvites = async () => {
    const filledRows = inviteRows.filter(r => r.username.trim() || r.email.trim());
    if (filledRows.length === 0) { setStep(3); return; }

    setStep2Loading(true);
    const results = [];
    for (const row of filledRows) {
      try {
        await client.post('/onboarding/invite', {
          username: row.username.trim(),
          email:    row.email.trim(),
          role:     row.role,
          password: row.password.trim(),
        });
        results.push({ status: 'ok', msg: `${row.username || row.email} invited` });
      } catch (err) {
        results.push({ status: 'error', msg: err.response?.data?.error?.message || `Failed to invite ${row.username || row.email}` });
      }
    }
    setInviteResults(results);
    setStep2Submitted(true);
    setStep2Loading(false);
  };

  /* ── Step 3 option A — scratch ─────────────────────────────────── */
  const handleScratch = async () => {
    try { await client.post('/onboarding/complete'); } catch (_) {}
    onComplete();
    navigate('/portfolios');
  };

  /* ── Step 3 option B — sample data ────────────────────────────── */
  const handleSampleData = async () => {
    setSampleLoading(true);
    setSampleError('');
    try {
      await client.post('/onboarding/sample-data');
      setSampleDataLoaded(true);
      try { await client.post('/onboarding/complete'); } catch (_) {}
      onComplete();
      navigate('/portfolios');
    } catch (err) {
      setSampleError(err.response?.data?.error || err.response?.data?.error?.message || 'Failed to load sample data. Please try again.');
      setSampleLoading(false);
    }
  };

  /* ── Delete sample data ────────────────────────────────────────── */
  const handleDeleteData = async () => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await client.delete('/onboarding/sample-data');
      setSampleDataLoaded(false);
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Failed to delete sample data. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ── Check sample-data status when step 3 opens ────────────────── */
  useEffect(() => {
    if (step !== 3) return;
    client.get('/onboarding/sample-data')
      .then(res => setSampleDataLoaded(res.data.loaded === true))
      .catch(() => {}); // ignore — button defaults to "Load"
  }, [step]);

  /* ── Shared card ────────────────────────────────────────────────── */
  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* Dark header */}
        <div style={s.header}>
          <div style={s.headerBrand}>
            <span style={s.headerTitle}>Portfolio</span>
            <span style={s.headerAccent}> Manager</span>
          </div>
          <div style={s.headerSub}>
            {step === 1 && 'Step 1 of 3 — Workspace'}
            {step === 2 && 'Step 2 of 3 — Team'}
            {step === 3 && 'Step 3 of 3 — Get Started'}
          </div>
        </div>

        {/* Body */}
        <div style={s.body}>
          <StepDots step={step} />

          {step === 1 && (
            <Step1
              companyName={companyName}
              setCompanyName={setCompanyName}
              onSubmit={handleStep1}
              loading={step1Loading}
              error={step1Error}
            />
          )}

          {step === 2 && (
            <Step2
              inviteRows={inviteRows}
              inviteResults={inviteResults}
              submitted={step2Submitted}
              loading={step2Loading}
              onUpdate={updateRow}
              onAdd={addRow}
              onRemove={removeRow}
              onSend={handleInvites}
              onSkip={() => setStep(3)}
              onContinue={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <Step3
              onScratch={handleScratch}
              onSampleData={handleSampleData}
              sampleLoading={sampleLoading}
              sampleError={sampleError}
              sampleDataLoaded={sampleDataLoaded}
              onDeleteData={handleDeleteData}
              deleteLoading={deleteLoading}
              deleteError={deleteError}
            />
          )}

          {/* Skip link */}
          <div style={s.skipRow}>
            <button onClick={skipAll} style={s.skipBtn}>Skip setup</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Step 1 ──────────────────────────────────────────────────────── */
function Step1({ companyName, setCompanyName, onSubmit, loading, error }) {
  return (
    <form onSubmit={onSubmit}>
      <h2 style={s.stepHeading}>Name Your Workspace</h2>
      <p style={s.stepSub}>This appears in the sidebar and on reports.</p>

      {error && <div style={s.errorBox}>{error}</div>}

      <label style={s.label}>Company Name</label>
      <input
        style={s.input}
        value={companyName}
        onChange={e => setCompanyName(e.target.value)}
        placeholder="e.g. Acme Corp"
        maxLength={255}
        required
        autoFocus
      />

      <button
        type="submit"
        style={{ ...s.primaryBtn, opacity: loading ? 0.7 : 1 }}
        disabled={loading || !companyName.trim()}
      >
        {loading ? 'Saving…' : 'Continue →'}
      </button>
    </form>
  );
}

/* ── Step 2 ──────────────────────────────────────────────────────── */
function Step2({ inviteRows, inviteResults, submitted, loading, onUpdate, onAdd, onRemove, onSend, onSkip, onContinue }) {
  return (
    <div>
      <h2 style={s.stepHeading}>Invite Your Team</h2>
      <p style={s.stepSub}>Add team members now or skip — you can always add more in Admin → Users.</p>

      {!submitted ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
            {inviteRows.map((row, idx) => (
              <InviteRow
                key={idx}
                row={row}
                idx={idx}
                showRemove={inviteRows.length > 1}
                onChange={onUpdate}
                onRemove={onRemove}
              />
            ))}
          </div>

          {inviteRows.length < 3 && (
            <button type="button" onClick={onAdd} style={s.ghostBtn}>
              <AddIcon style={{ fontSize: 15, verticalAlign: 'middle', marginRight: 4 }} />Add another
            </button>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', alignItems: 'center' }}>
            <button
              onClick={onSend}
              style={{ ...s.primaryBtn, opacity: loading ? 0.7 : 1 }}
              disabled={loading}
            >
              {loading ? 'Sending…' : 'Send Invites'}
            </button>
            <button onClick={onSkip} style={s.textBtn}>Skip for now</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {inviteResults.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: r.status === 'ok' ? '#166534' : '#991b1b' }}>
                {r.status === 'ok'
                  ? <CheckCircleIcon style={{ fontSize: 17, color: '#16a34a' }} />
                  : <ErrorIcon style={{ fontSize: 17, color: '#dc2626' }} />}
                {r.msg}
              </div>
            ))}
          </div>
          <button onClick={onContinue} style={s.primaryBtn}>Continue →</button>
        </>
      )}
    </div>
  );
}

function InviteRow({ row, idx, showRemove, onChange, onRemove }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 0.9fr 1fr auto', gap: '0.45rem', alignItems: 'center' }}>
      <input
        style={s.inputSm}
        placeholder="Username"
        value={row.username}
        onChange={e => onChange(idx, 'username', e.target.value)}
      />
      <input
        style={s.inputSm}
        placeholder="Email"
        type="email"
        value={row.email}
        onChange={e => onChange(idx, 'email', e.target.value)}
      />
      <select
        style={s.inputSm}
        value={row.role}
        onChange={e => onChange(idx, 'role', e.target.value)}
      >
        <option value="member">Member</option>
        <option value="project_manager">Project Manager</option>
        <option value="admin">Admin</option>
      </select>
      <input
        style={s.inputSm}
        placeholder="Temp password"
        type="password"
        value={row.password}
        onChange={e => onChange(idx, 'password', e.target.value)}
      />
      {showRemove ? (
        <button type="button" onClick={() => onRemove(idx)} style={s.removeBtn} title="Remove row">
          <RemoveCircleIcon style={{ fontSize: 18, color: '#9ca3af' }} />
        </button>
      ) : (
        <span style={{ width: 24 }} />
      )}
    </div>
  );
}

/* ── Step 3 ──────────────────────────────────────────────────────── */
function Step3({ onScratch, onSampleData, sampleLoading, sampleError,
                 sampleDataLoaded, onDeleteData, deleteLoading, deleteError }) {
  return (
    <div>
      <h2 style={s.stepHeading}>Create Your First Portfolio</h2>
      <p style={s.stepSub}>How would you like to get started?</p>

      {sampleError  && <div style={s.errorBox}>{sampleError}</div>}
      {deleteError  && <div style={s.errorBox}>{deleteError}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.25rem' }}>
        {/* Option A */}
        <div style={s.optionCard}>
          <div style={s.optionIcon}>
            <EditIcon style={{ fontSize: 28, color: BRAND_GREEN }} />
          </div>
          <div style={s.optionTitle}>I'll set it up myself</div>
          <div style={s.optionDesc}>Go to the Portfolios page and create your own structure.</div>
          <button onClick={onScratch} style={{ ...s.primaryBtn, marginTop: 'auto', width: '100%' }}>
            Open Portfolios
          </button>
        </div>

        {/* Option B */}
        <div style={s.optionCard}>
          <div style={s.optionIcon}>
            <AutoAwesomeIcon style={{ fontSize: 28, color: sampleDataLoaded ? '#dc2626' : '#7c3aed' }} />
          </div>
          <div style={s.optionTitle}>
            {sampleDataLoaded ? 'Sample data loaded' : 'Show me sample data'}
          </div>
          <div style={s.optionDesc}>
            {sampleDataLoaded
              ? 'A demo portfolio has been loaded. You can delete it here and start fresh.'
              : 'Pre-fill with a demo portfolio, programs, projects and tasks so you can explore right away.'}
          </div>

          {sampleDataLoaded ? (
            <button
              onClick={onDeleteData}
              style={{ ...s.deleteBtn, marginTop: 'auto', width: '100%', opacity: deleteLoading ? 0.7 : 1 }}
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Spinner /> Deleting…
                </span>
              ) : 'Delete Sample Data'}
            </button>
          ) : (
            <button
              onClick={onSampleData}
              style={{ ...s.sampleBtn, marginTop: 'auto', width: '100%', opacity: sampleLoading ? 0.7 : 1 }}
              disabled={sampleLoading}
            >
              {sampleLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Spinner /> Loading…
                </span>
              ) : 'Load Sample Data'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid rgba(255,255,255,0.35)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'onboard-spin 0.65s linear infinite',
    }} />
  );
}

/* ── Styles ──────────────────────────────────────────────────────── */
const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 3000,
    backdropFilter: 'blur(2px)',
  },
  modal: {
    width: 560,
    maxWidth: '96vw',
    maxHeight: '94vh',
    overflowY: 'auto',
    borderRadius: 16,
    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
    display: 'flex', flexDirection: 'column',
    background: '#fff',
  },
  header: {
    background: HEADER_DARK,
    borderRadius: '16px 16px 0 0',
    padding: '1.5rem 2rem 1.25rem',
  },
  headerBrand: { fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '0.2rem' },
  headerTitle: { color: '#fff' },
  headerAccent: { color: ACCENT },
  headerSub: { fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' },
  body: { padding: '2rem 2rem 1.5rem', display: 'flex', flexDirection: 'column' },

  stepHeading: { fontSize: '1.35rem', fontWeight: 800, color: '#1d1d1d', marginBottom: '0.35rem', marginTop: 0 },
  stepSub:     { color: '#6b7280', fontSize: '0.92rem', marginBottom: '1.25rem', lineHeight: 1.5 },

  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '0.6rem 0.85rem',
    border: '1.5px solid #d1d5db', borderRadius: 8,
    fontSize: '1rem', outline: 'none',
    marginBottom: '1.25rem',
    transition: 'border-color 0.15s',
  },
  inputSm: {
    padding: '0.4rem 0.55rem',
    border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: '0.82rem', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },

  primaryBtn: {
    display: 'block',
    padding: '0.65rem 1.5rem',
    background: BRAND_GREEN, color: '#fff',
    border: 'none', borderRadius: 8,
    fontWeight: 700, fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  sampleBtn: {
    display: 'block',
    padding: '0.65rem 1.5rem',
    background: '#7c3aed', color: '#fff',
    border: 'none', borderRadius: 8,
    fontWeight: 700, fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  deleteBtn: {
    display: 'block',
    padding: '0.65rem 1.5rem',
    background: '#dc2626', color: '#fff',
    border: 'none', borderRadius: 8,
    fontWeight: 700, fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  ghostBtn: {
    background: 'none', border: '1.5px dashed #d1d5db',
    borderRadius: 8, padding: '0.45rem 1rem',
    fontSize: '0.85rem', color: '#6b7280',
    cursor: 'pointer', fontWeight: 600,
  },
  textBtn: {
    background: 'none', border: 'none',
    color: '#6b7280', fontSize: '0.9rem',
    cursor: 'pointer', textDecoration: 'underline',
    fontWeight: 500,
  },
  removeBtn: {
    background: 'none', border: 'none',
    padding: 2, cursor: 'pointer',
    display: 'flex', alignItems: 'center',
  },
  errorBox: {
    background: '#fee2e2', color: '#991b1b',
    padding: '0.6rem 0.85rem', borderRadius: 8,
    fontSize: '0.88rem', marginBottom: '1rem',
  },

  optionCard: {
    border: '1.5px solid #e5e7eb', borderRadius: 12,
    padding: '1.25rem', display: 'flex', flexDirection: 'column',
    gap: '0.6rem', background: '#fafafa',
    transition: 'border-color 0.15s',
  },
  optionIcon:  { fontSize: '1.75rem', lineHeight: 1 },
  optionTitle: { fontWeight: 700, fontSize: '1rem', color: '#1d1d1d' },
  optionDesc:  { fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.5, flex: 1 },

  skipRow: { display: 'flex', justifyContent: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' },
  skipBtn: {
    background: 'none', border: 'none',
    color: '#9ca3af', fontSize: '0.85rem',
    cursor: 'pointer', textDecoration: 'underline',
  },
};

/* Keyframe injected once via a <style> tag */
const spinStyle = document.createElement('style');
spinStyle.textContent = `@keyframes onboard-spin { to { transform: rotate(360deg); } }`;
if (!document.head.querySelector('[data-onboard-spin]')) {
  spinStyle.setAttribute('data-onboard-spin', '1');
  document.head.appendChild(spinStyle);
}
