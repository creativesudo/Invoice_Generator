import { useState, useEffect } from 'react';
import { getCompany, updateCompany, uploadLogo, getLogoUrl } from '../api/client';
import CurrencySelect from '../components/CurrencySelect';

export default function Settings() {
  const [form, setForm] = useState({
    company_name: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    currency_text: '$',
  });
  const [logoPreview, setLogoPreview] = useState(null);
  const [hasLogo, setHasLogo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadCompany();
  }, []);

  async function loadCompany() {
    try {
      const company = await getCompany();
      setForm({
        company_name: company.company_name || '',
        phone: company.phone || '',
        email: company.email || '',
        website: company.website || '',
        address: company.address || '',
        currency_text: company.currency_text || '$',
      });
      if (company.logo_path) {
        setHasLogo(true);
        setLogoPreview(`${getLogoUrl()}?t=${Date.now()}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setError('');
    try {
      await uploadLogo(file);
      setHasLogo(true);
      setLogoPreview(URL.createObjectURL(file));
      setMessage('Logo uploaded successfully');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await updateCompany(form);
      setMessage('Company profile saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="loading">Loading...</p>;

  return (
    <div className="page">
      <h1>Company Settings</h1>
      <p className="subtitle">Your business info appears on every invoice.</p>

      {!form.company_name && (
        <div className="alert alert-warning">
          Please set your company name before creating invoices.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <form onSubmit={handleSubmit} className="card">
        <div className="logo-section">
          <div className="logo-preview">
            {logoPreview ? (
              <img src={logoPreview} alt="Company logo" />
            ) : (
              <div className="logo-placeholder">No logo</div>
            )}
          </div>
          <label className="btn-secondary file-input">
            {hasLogo ? 'Change Logo' : 'Upload Logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} hidden />
          </label>
        </div>

        <div className="form-grid">
          <label>
            Company Name *
            <input
              type="text"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Phone
            <input type="text" name="phone" value={form.phone} onChange={handleChange} />
          </label>
          <label>
            Email
            <input type="email" name="email" value={form.email} onChange={handleChange} />
          </label>
          <label>
            Website
            <input type="text" name="website" value={form.website} onChange={handleChange} />
          </label>
          <CurrencySelect
            value={form.currency_text}
            onChange={(value) => setForm({ ...form, currency_text: value })}
            label="Default Currency"
          />
          <label className="full-width">
            Address
            <textarea name="address" value={form.address} onChange={handleChange} rows={3} />
          </label>
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
