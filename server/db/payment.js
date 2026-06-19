function normalizePaymentFields(paymentAccount) {
  if (!paymentAccount) {
    return {
      payment_account_id: null,
      payment_label: null,
      payment_bank_name: null,
      payment_account_name: null,
      payment_account_number: null,
      payment_branch: null,
      payment_notes: null,
    };
  }

  const hasContent = [
    paymentAccount.label,
    paymentAccount.bank_name,
    paymentAccount.account_name,
    paymentAccount.account_number,
    paymentAccount.branch,
    paymentAccount.notes,
  ].some((value) => String(value || '').trim());

  if (!hasContent && !paymentAccount.id) {
    return {
      payment_account_id: null,
      payment_label: null,
      payment_bank_name: null,
      payment_account_name: null,
      payment_account_number: null,
      payment_branch: null,
      payment_notes: null,
    };
  }

  return {
    payment_account_id: paymentAccount.id || null,
    payment_label: paymentAccount.label?.trim() || null,
    payment_bank_name: paymentAccount.bank_name?.trim() || null,
    payment_account_name: paymentAccount.account_name?.trim() || null,
    payment_account_number: paymentAccount.account_number?.trim() || null,
    payment_branch: paymentAccount.branch?.trim() || null,
    payment_notes: paymentAccount.notes?.trim() || null,
  };
}

function paymentAccountFromInvoice(invoice) {
  if (!invoice) return null;

  const hasContent = [
    invoice.payment_label,
    invoice.payment_bank_name,
    invoice.payment_account_name,
    invoice.payment_account_number,
    invoice.payment_branch,
    invoice.payment_notes,
  ].some((value) => String(value || '').trim());

  if (!hasContent && !invoice.payment_account_id) {
    return null;
  }

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

module.exports = {
  normalizePaymentFields,
  paymentAccountFromInvoice,
};
