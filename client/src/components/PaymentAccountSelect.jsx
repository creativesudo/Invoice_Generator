import { useState, useEffect } from 'react';
import { getPaymentAccounts } from '../api/client';

export const emptyPaymentAccount = () => ({
  id: null,
  label: '',
  bank_name: '',
  account_name: '',
  account_number: '',
  branch: '',
  notes: '',
});

export function paymentAccountFromInvoice(invoice) {
  if (!invoice) return emptyPaymentAccount();

  return {
    id: invoice.payment_account_id || null,
    label: invoice.payment_label || '',
    bank_name: invoice.payment_bank_name || '',
    account_name: invoice.payment_account_name || '',
    account_number: invoice.payment_account_number || '',
    branch: invoice.payment_branch || '',
    notes: invoice.payment_notes || '',
  };
}

export default function PaymentAccountSelect({ value, onChange, onFieldBlur }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaymentAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  function handleSelect(accountId) {
    if (!accountId) {
      onChange(emptyPaymentAccount());
      onFieldBlur?.();
      return;
    }

    const account = accounts.find((item) => String(item.id) === accountId);
    if (account) {
      onChange({
        id: account.id,
        label: account.label || '',
        bank_name: account.bank_name || '',
        account_name: account.account_name || '',
        account_number: account.account_number || '',
        branch: account.branch || '',
        notes: account.notes || '',
      });
      onFieldBlur?.();
    }
  }

  function updateField(field, fieldValue) {
    onChange({ ...value, [field]: fieldValue });
  }

  return (
    <div className="payment-account-select form-grid full-width-grid">
      <label className="full-width">
        Saved Payment A/C
        <select
          value={value.id || ''}
          onChange={(e) => handleSelect(e.target.value)}
          onBlur={onFieldBlur}
          disabled={loading}
        >
          <option value="">Select a saved payment account (optional)</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
              {account.account_number ? ` — ${account.account_number}` : ''}
            </option>
          ))}
        </select>
      </label>

      <label>
        Label
        <input
          type="text"
          value={value.label}
          onChange={(e) => updateField('label', e.target.value)}
          onBlur={onFieldBlur}
          placeholder="e.g. DBBL Savings"
        />
      </label>
      <label>
        Bank Name
        <input
          type="text"
          value={value.bank_name}
          onChange={(e) => updateField('bank_name', e.target.value)}
          onBlur={onFieldBlur}
        />
      </label>
      <label>
        Account Name
        <input
          type="text"
          value={value.account_name}
          onChange={(e) => updateField('account_name', e.target.value)}
          onBlur={onFieldBlur}
        />
      </label>
      <label>
        Account Number
        <input
          type="text"
          value={value.account_number}
          onChange={(e) => updateField('account_number', e.target.value)}
          onBlur={onFieldBlur}
        />
      </label>
      <label>
        Branch / Routing
        <input
          type="text"
          value={value.branch}
          onChange={(e) => updateField('branch', e.target.value)}
          onBlur={onFieldBlur}
        />
      </label>
      <label className="full-width">
        Additional Notes
        <textarea
          value={value.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          onBlur={onFieldBlur}
          rows={2}
        />
      </label>
    </div>
  );
}
