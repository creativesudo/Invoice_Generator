import { CURRENCY_OPTIONS, isKnownCurrency } from '../utils/currencies';

export default function CurrencySelect({ value, onChange, onBlur, label = 'Currency' }) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required
      >
        {!isKnownCurrency(value) && value ? (
          <option value={value}>{value} (saved)</option>
        ) : null}
        {CURRENCY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
