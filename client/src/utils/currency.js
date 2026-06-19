const DEFAULT_CURRENCY_TEXT = '$';

export function normalizeCurrencyText(currencyText) {
  if (currencyText == null || !String(currencyText).trim()) {
    return DEFAULT_CURRENCY_TEXT;
  }
  return String(currencyText);
}

export function formatAmount(amount) {
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) {
    return '0.00';
  }
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMoney(amount, currencyText = DEFAULT_CURRENCY_TEXT) {
  const symbol = normalizeCurrencyText(currencyText).trim();
  return `${symbol} ${formatAmount(amount)}`;
}
