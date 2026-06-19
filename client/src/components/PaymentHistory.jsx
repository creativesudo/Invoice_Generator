import MoneyAmount from './MoneyAmount';

function formatDate(dateStr) {
  const date = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const emptyPaymentEntry = () => ({
  amount: '',
  payment_date: new Date().toISOString().slice(0, 10),
  notes: '',
});

export function calculatePaymentTotals(receivable, payments) {
  const received = (payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const due = Math.round((receivable - received) * 100) / 100;
  return { received, due };
}

export default function PaymentHistory({
  payments,
  currencyText,
  receivable,
  showForm = false,
  newPayment,
  onNewPaymentChange,
  onAddPayment,
  onDeletePayment,
  adding = false,
  allowDelete = false,
  addButtonLabel = 'Add Payment',
}) {
  const totals = calculatePaymentTotals(receivable, payments);

  return (
    <div className="payment-history">
      <h3>Payment History</h3>

      {payments.length === 0 ? (
        <p className="empty-inline">No payments recorded yet.</p>
      ) : (
        <table className="review-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Notes</th>
              {allowDelete && <th></th>}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id || `${payment.payment_date}-${payment.amount}-${payment.notes}`}>
                <td>{formatDate(payment.payment_date)}</td>
                <td><MoneyAmount amount={payment.amount} currencyText={currencyText} /></td>
                <td>{payment.notes || '—'}</td>
                {allowDelete && payment.id && (
                  <td>
                    <button
                      type="button"
                      className="btn-link btn-danger"
                      onClick={() => onDeletePayment?.(payment)}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="totals-summary">
        <div className="total-row">
          <span>Receivable</span>
          <MoneyAmount amount={receivable} currencyText={currencyText} />
        </div>
        <div className="total-row">
          <span>Total Received</span>
          <MoneyAmount amount={totals.received} currencyText={currencyText} />
        </div>
        <div className="total-row due">
          <span>Amount Due</span>
          <MoneyAmount amount={totals.due} currencyText={currencyText} />
        </div>
      </div>

      {showForm && (
        <div className="payment-form form-grid">
          <label>
            Payment Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={newPayment.amount}
              onChange={(e) => onNewPaymentChange({ ...newPayment, amount: e.target.value })}
            />
          </label>
          <label>
            Payment Date
            <input
              type="date"
              value={newPayment.payment_date}
              onChange={(e) => onNewPaymentChange({ ...newPayment, payment_date: e.target.value })}
            />
          </label>
          <label className="full-width">
            Notes
            <input
              type="text"
              value={newPayment.notes}
              onChange={(e) => onNewPaymentChange({ ...newPayment, notes: e.target.value })}
              placeholder="e.g. Upfront payment, 2nd installment"
            />
          </label>
          <div className="action-group action-group-stretch full-width">
            <button
              type="button"
              className="btn-secondary"
              onClick={onAddPayment}
              disabled={adding}
            >
              {adding ? 'Saving...' : addButtonLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
