const { normalizeCurrencyText } = require('./index');

const CURRENCY_OPTIONS = [
  { value: '$', label: 'USD ($)' },
  { value: 'BDT', label: 'BDT' },
  { value: 'Tk ', label: 'Tk' },
  { value: 'USD ', label: 'USD' },
  { value: '€', label: 'EUR (€)' },
  { value: '£', label: 'GBP (£)' },
  { value: '¥', label: 'JPY/CNY (¥)' },
  { value: '₹', label: 'INR (₹)' },
  { value: 'AUD ', label: 'AUD' },
  { value: 'CAD ', label: 'CAD' },
  { value: 'SGD ', label: 'SGD' },
  { value: 'AED ', label: 'AED' },
];

const ALLOWED_CURRENCIES = new Set(CURRENCY_OPTIONS.map((option) => option.value));

function isValidCurrency(currencyText) {
  return ALLOWED_CURRENCIES.has(normalizeCurrencyText(currencyText));
}

function validateCurrencyText(currencyText) {
  if (!currencyText || !String(currencyText).trim()) {
    return 'Currency is required';
  }
  if (!isValidCurrency(currencyText)) {
    return 'Select a currency from the available list';
  }
  return null;
}

function resolveInvoiceCurrency(body, existing, company) {
  if (body?.currency_text != null && String(body.currency_text).trim()) {
    return normalizeCurrencyText(body.currency_text);
  }
  if (existing?.currency_text) {
    return normalizeCurrencyText(existing.currency_text);
  }
  return normalizeCurrencyText(company?.currency_text);
}

module.exports = {
  CURRENCY_OPTIONS,
  ALLOWED_CURRENCIES,
  isValidCurrency,
  validateCurrencyText,
  resolveInvoiceCurrency,
};
