import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getInvoices, getInvoice, getInvoicePdfUrl, deleteInvoice, addInvoicePayment } from '../api/client';
import MoneyAmount from '../components/MoneyAmount';
import PaymentHistory, { emptyPaymentEntry } from '../components/PaymentHistory';

function formatDate(dateStr) {
  const date = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function InvoiceHistory() {
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [newPayment, setNewPayment] = useState(emptyPaymentEntry());
  const [recordingPayment, setRecordingPayment] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    try {
      const data = await getInvoices();
      setInvoices(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function viewDetails(id) {
    try {
      const invoice = await getInvoice(id);
      setSelected(invoice);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(inv) {
    const confirmed = window.confirm(
      `Delete invoice ${inv.invoice_number} for ${inv.client_company_name}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(inv.id);
    setError('');

    try {
      await deleteInvoice(inv.id);
      setInvoices((prev) => prev.filter((item) => item.id !== inv.id));
      if (selected?.id === inv.id) {
        setSelected(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRecordPayment() {
    if (!selected) return;

    const amount = Number(newPayment.amount);
    if (!amount || amount <= 0) {
      setError('Enter a payment amount greater than zero');
      return;
    }

    setRecordingPayment(true);
    setError('');

    try {
      const updated = await addInvoicePayment(selected.id, {
        amount,
        payment_date: newPayment.payment_date,
        notes: newPayment.notes || null,
      });

      setSelected(updated);
      setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? {
        ...inv,
        received: updated.received,
        due: updated.due,
      } : inv)));
      setNewPayment(emptyPaymentEntry());
      window.open(getInvoicePdfUrl(updated.id, Date.now()), '_blank');
    } catch (err) {
      setError(err.message);
    } finally {
      setRecordingPayment(false);
    }
  }

  if (loading) return <p className="loading">Loading...</p>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Invoice History</h1>
        <Link to="/invoices/new" className="btn-primary">+ New Invoice</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {invoices.length === 0 ? (
        <div className="empty-state card">
          <p>No invoices yet.</p>
          <Link to="/invoices/new" className="btn-primary">Create your first invoice</Link>
        </div>
      ) : (
        <div className="history-layout">
          <div className="card">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Receivable</th>
                  <th>Received</th>
                  <th>Due</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className={selected?.id === inv.id ? 'selected' : ''}>
                    <td>{formatDate(inv.invoice_date)}</td>
                    <td>{inv.invoice_number}</td>
                    <td>{inv.client_company_name}</td>
                    <td><MoneyAmount amount={inv.receivable} currencyText={inv.currency_text} /></td>
                    <td><MoneyAmount amount={inv.received} currencyText={inv.currency_text} /></td>
                    <td><MoneyAmount amount={inv.due} currencyText={inv.currency_text} /></td>
                    <td className="actions-cell">
                      <button type="button" className="btn-link" onClick={() => viewDetails(inv.id)}>
                        Details
                      </button>
                      <Link to={`/invoices/${inv.id}/edit`} className="btn-link">
                        Edit
                      </Link>
                      <a
                        href={getInvoicePdfUrl(inv.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-link"
                      >
                        PDF
                      </a>
                      <button
                        type="button"
                        className="btn-link btn-danger"
                        onClick={() => handleDelete(inv)}
                        disabled={deletingId === inv.id}
                      >
                        {deletingId === inv.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="card detail-panel">
              <h2>Invoice {selected.invoice_number}</h2>
              <p><strong>Date:</strong> {formatDate(selected.invoice_date)}</p>
              <p><strong>Currency:</strong> {selected.currency_text}</p>
              <p><strong>Client:</strong> {selected.client_company_name}</p>
              {selected.client_address && <p>{selected.client_address}</p>}
              {selected.notes && <p><strong>Notes:</strong> {selected.notes}</p>}
              {selected.payment_label && (
                <div className="payment-detail">
                  <p><strong>Payment A/C:</strong> {selected.payment_label}</p>
                  {selected.payment_bank_name && <p>Bank: {selected.payment_bank_name}</p>}
                  {selected.payment_account_name && <p>Account Name: {selected.payment_account_name}</p>}
                  {selected.payment_account_number && <p>A/C No: {selected.payment_account_number}</p>}
                  {selected.payment_branch && <p>Branch: {selected.payment_branch}</p>}
                  {selected.payment_notes && <p>{selected.payment_notes}</p>}
                </div>
              )}

              <table className="review-table">
                <thead>
                  <tr>
                    <th>Heading</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.line_items?.map((item) => (
                    <tr key={item.id}>
                      <td>{item.heading}</td>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td><MoneyAmount amount={item.unit_price} currencyText={selected.currency_text} /></td>
                      <td><MoneyAmount amount={item.amount} currencyText={selected.currency_text} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <PaymentHistory
                payments={selected.payments || []}
                currencyText={selected.currency_text}
                receivable={selected.receivable}
                showForm
                newPayment={newPayment}
                onNewPaymentChange={setNewPayment}
                onAddPayment={handleRecordPayment}
                adding={recordingPayment}
                addButtonLabel="Record Payment & Regenerate PDF"
              />

              <div className="detail-actions action-group action-group-stretch">
                <Link to={`/invoices/${selected.id}/edit`} className="btn-secondary">
                  Edit Invoice
                </Link>
                <a
                  href={getInvoicePdfUrl(selected.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  Download PDF
                </a>
                <button
                  type="button"
                  className="btn-secondary btn-danger-outline"
                  onClick={() => handleDelete(selected)}
                  disabled={deletingId === selected.id}
                >
                  {deletingId === selected.id ? 'Deleting...' : 'Delete Invoice'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
