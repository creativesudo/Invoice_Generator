import { useState, useEffect } from 'react';
import {
  getPaymentAccounts,
  createPaymentAccount,
  updatePaymentAccount,
  deletePaymentAccount,
} from '../api/client';
import { emptyPaymentAccount } from '../components/PaymentAccountSelect';

export default function PaymentAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(emptyPaymentAccount());
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    setLoading(true);
    try {
      const data = await getPaymentAccounts();
      setAccounts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(emptyPaymentAccount());
    setEditingId(null);
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleEdit(account) {
    setEditingId(account.id);
    setForm({
      id: account.id,
      label: account.label || '',
      bank_name: account.bank_name || '',
      account_name: account.account_name || '',
      account_number: account.account_number || '',
      branch: account.branch || '',
      notes: account.notes || '',
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
        await updatePaymentAccount(editingId, form);
        setMessage('Payment account updated');
      } else {
        await createPaymentAccount(form);
        setMessage('Payment account created');
      }

      resetForm();
      await loadAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(account) {
    const confirmed = window.confirm(`Delete payment account "${account.label}"?`);
    if (!confirmed) return;

    setError('');
    setMessage('');

    try {
      await deletePaymentAccount(account.id);
      if (editingId === account.id) {
        resetForm();
      }
      setMessage('Payment account deleted');
      await loadAccounts();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="loading">Loading...</p>;

  return (
    <div className="page">
      <h1>Payment A/C</h1>
      <p className="subtitle">Save bank accounts and reuse them on invoices.</p>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <form onSubmit={handleSubmit} className="card">
        <h2>{editingId ? 'Edit Payment Account' : 'Add Payment Account'}</h2>
        <div className="form-grid">
          <label>
            Label *
            <input
              type="text"
              name="label"
              value={form.label}
              onChange={handleChange}
              placeholder="e.g. DBBL Savings"
              required
            />
          </label>
          <label>
            Bank Name
            <input type="text" name="bank_name" value={form.bank_name} onChange={handleChange} />
          </label>
          <label>
            Account Name
            <input type="text" name="account_name" value={form.account_name} onChange={handleChange} />
          </label>
          <label>
            Account Number
            <input type="text" name="account_number" value={form.account_number} onChange={handleChange} />
          </label>
          <label>
            Branch / Routing
            <input type="text" name="branch" value={form.branch} onChange={handleChange} />
          </label>
          <label className="full-width">
            Notes
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} />
          </label>
        </div>

        <div className="form-actions">
          {editingId && (
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update Account' : 'Add Account'}
          </button>
        </div>
      </form>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2>Saved Accounts</h2>
        {accounts.length === 0 ? (
          <p className="empty-inline">No payment accounts yet.</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Bank</th>
                <th>Account Name</th>
                <th>A/C No</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.label}</td>
                  <td>{account.bank_name || '—'}</td>
                  <td>{account.account_name || '—'}</td>
                  <td>{account.account_number || '—'}</td>
                  <td className="actions-cell">
                    <button type="button" className="btn-link" onClick={() => handleEdit(account)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-link btn-danger"
                      onClick={() => handleDelete(account)}
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
