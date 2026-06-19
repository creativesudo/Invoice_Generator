import { formatAmount, normalizeCurrencyText } from '../utils/currency';

export default function MoneyAmount({ amount, currencyText = '$' }) {
  const symbol = normalizeCurrencyText(currencyText).trim();

  return (
    <span className="money-amount">
      {symbol} <strong>{formatAmount(amount)}</strong>
    </span>
  );
}
