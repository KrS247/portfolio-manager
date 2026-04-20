import { useState, useEffect, useRef } from 'react';
import client from '../../api/client';

export default function CompanySetupAdmin() {
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl]         = useState(null);
  const [logoFile, setLogoFile]       = useState(null);
  const [preview, setPreview]         = useState(null);
  const [saving, setSaving]           = useState(false);
  const [loading, setLoading]         = useState(true);
  const [success, setSuccess]         = useState('');
  const [error, setError]             = useState('');
  const fileRef = useRef();

  useEffect(() => {
    client.get('/company-settings')
      .then(res => {
        setCompanyName(res.data.company_name || '');
        setLogoUrl(res.data.logo_url || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/gif', 'image/png'].includes(file.type)) {
      setError('Only JPEG, PNG and GIF files are allowed.');
      e.target.value = '';
      return;
    }
    if (file.size > 1024 * 1024) {
      setError('File size must not exceed 1MB.');
      e.target.value = '';
      return;
    }

    setError('');
    setLogoFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('company_name', companyName);
    if (logoFile) formData.append('logo', logoFile);

    try {
      const res = await client.post('/company-settings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setLogoUrl(res.data.logo_url);
      setLogoFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      setSuccess('Company settings saved successfully.');
      // Notify Layout to refresh branding
      window.dispatchEvent(new Event('company-settings-updated'));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading...</div>;

  const displayLogo = preview || logoUrl;

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.heading}>Company Setup</h1>
      </div>

      <div style={styles.card}>
        {error   && <div style={styles.errorBanner}>{error}</div>}
        {success && <div style={styles.successBanner}>{success}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Company Name */}
          <div style={styles.field}>
            <label style={styles.label}>Company Name</label>
            <input
              style={styles.input}
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Corporation"
              maxLength={255}
            />
          </div>

          {/* Logo Upload */}
          <div style={styles.field}>
            <label style={styles.label}>Company Logo</label>
            <div style={styles.uploadNote}>Accepted formats: JPEG, PNG, GIF · Max file size: 1MB</div>

            {displayLogo && (
              <div style={styles.previewWrap}>
                <img src={displayLogo} alt="Company logo" style={styles.previewImg} />
                <button
                  type="button"
                  style={styles.removeBtn}
                  onClick={() => {
                    setLogoFile(null);
                    setPreview(null);
                    if (fileRef.current) fileRef.current.value = '';
                    if (!logoFile) setLogoUrl(null);
                  }}
                >
                  Remove
                </button>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif"
              onChange={handleFileChange}
              style={styles.fileInput}
            />
          </div>

          <div style={styles.actions}>
            <button type="submit" style={styles.saveBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  pageHeader:    { marginBottom: '1.5rem' },
  heading:       { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1d', margin: 0 },
  card:          { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '2rem', maxWidth: '560px' },
  form:          { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  field:         { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label:         { fontSize: '0.9rem', fontWeight: 600, color: '#374151' },
  input:         { padding: '0.55rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', outline: 'none' },
  uploadNote:    { fontSize: '0.8rem', color: '#9ca3af' },
  fileInput:     { fontSize: '0.9rem', color: '#374151' },
  previewWrap:   { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' },
  previewImg:    { maxHeight: '80px', maxWidth: '200px', objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px', background: '#f9fafb' },
  removeBtn:     { padding: '3px 10px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  actions:       { display: 'flex', justifyContent: 'flex-end' },
  saveBtn:       { padding: '0.55rem 1.5rem', background: '#016D2D', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' },
  errorBanner:   { background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem' },
  successBanner: { background: '#d1fae5', color: '#065f46', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem' },
};
