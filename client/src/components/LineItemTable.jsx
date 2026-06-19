import MoneyAmount from './MoneyAmount';

function calcAmount(quantity, unitPrice) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

const emptyItem = () => ({
  heading: '',
  description: '',
  quantity: 1,
  unit_price: 0,
});

export default function LineItemTable({ items, onChange, currencyText = '$', onFieldBlur }) {
  function updateItem(index, field, rawValue) {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const value = field === 'heading' || field === 'description'
        ? rawValue
        : Number(rawValue) || 0;
      return { ...item, [field]: value };
    });
    onChange(updated);
  }

  function addItem() {
    onChange([...items, emptyItem()]);
    onFieldBlur?.();
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index));
    onFieldBlur?.();
  }

  const receivable = items.reduce(
    (sum, item) => sum + calcAmount(item.quantity, item.unit_price),
    0
  );

  return (
    <div className="line-items">
      <table>
        <thead>
          <tr>
            <th>Heading</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>
                <input
                  type="text"
                  value={item.heading}
                  onChange={(e) => updateItem(index, 'heading', e.target.value)}
                  onBlur={onFieldBlur}
                  placeholder="e.g. Web Development"
                />
              </td>
              <td>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  onBlur={onFieldBlur}
                  placeholder="Item details"
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  onBlur={onFieldBlur}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                  onBlur={onFieldBlur}
                />
              </td>
              <td className="amount-cell">
                <MoneyAmount
                  amount={calcAmount(item.quantity, item.unit_price)}
                  currencyText={currencyText}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  title="Remove item"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="line-items-footer">
        <button type="button" className="btn-secondary" onClick={addItem}>
          + Add Line Item
        </button>
        <div className="receivable-total">
          <span>Receivable:</span>{' '}
          <MoneyAmount amount={receivable} currencyText={currencyText} />
        </div>
      </div>
    </div>
  );
}

export function calculateReceivable(items) {
  return items.reduce(
    (sum, item) => sum + calcAmount(item.quantity, item.unit_price),
    0
  );
}
