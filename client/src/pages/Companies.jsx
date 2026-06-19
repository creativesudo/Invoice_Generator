import { useState, useEffect } from 'react';
import {
  getClients,
  createClient,
  updateClient,
  deleteClient,
} from '../api/client';

const emptyCompany = () => ({
  company_name: '',
  phone: '',
  email: '',
  website: '',
  address: '',
});

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(emptyCompany());
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    setLoading(true);
    try {
      const data = await getClients();
      setCompanies(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(emptyCompany());
    setEditingId(null);
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleEdit(company) {
    setEditingId(company.id);
    setForm({
      company_name: company.company_name || '',
      phone: company.phone || '',
      email: company.email || '',
      website: company.website || '',
      address: company.address || '',
    });
    setError('');
    setMessage('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (editingId) {
        await updateClient(editingId, form);
        setMessage('Company updated');
      } else {
        await createClient(form);
        setMessage('Company added');
      }

      resetForm();
      await loadCompanies();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(company) {
    const confirmed = window.confirm(`Delete company "${company.company_name}"?`);
    if (!confirmed) return;

    setError('');
    setMessage('');

    try {
      await deleteClient(company.id);
      if (editingId === company.id) {
        resetForm();
      }
      setMessage('Company deleted');
      await loadCompanies();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="loading">Loading...</p>;

  return (
    <div className="page">
      <h1>Companies</h1>
      <p className="subtitle">Manage client companies and reuse them when creating invoices.</p>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <form onSubmit={handleSubmit} className="card">
        <h2>{editingId ? 'Edit Company' : 'Add Company'}</h2>
        <div className="form-grid">
          <label className="full-width">
            Company Name *
            <input
              type="text"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              placeholder="e.g. Marine Marvels BD"
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
          <label className="full-width">
            Address
            <textarea name="address" value={form.address} onChange={handleChange} rows={2} />
          </label>
        </div>

        <div className="form-actions">
          {editingId && (
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update Company' : 'Add Company'}
          </button>
        </div>
      </form>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2>Saved Companies</h2>
        {companies.length === 0 ? (
          <p className="empty-inline">No companies yet.</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Website</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>{company.company_name}</td>
                  <td>{company.phone || '—'}</td>
                  <td>{company.email || '—'}</td>
                  <td>{company.website || '—'}</td>
                  <td className="actions-cell">
                    <button type="button" className="btn-link" onClick={() => handleEdit(company)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-link btn-danger"
                      onClick={() => handleDelete(company)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
