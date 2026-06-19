export const CURRENCY_OPTIONS = [
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

export function isKnownCurrency(value) {
  return CURRENCY_OPTIONS.some((option) => option.value === value);
}
