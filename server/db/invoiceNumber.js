function generateNextInvoiceNumber(db, year = new Date().getFullYear()) {
  const prefix = `INV-${year}-`;
  const rows = db
    .prepare(`
      SELECT invoice_number FROM invoices
      WHERE invoice_number LIKE ?
    `)
    .all(`${prefix}%`);

  let maxSequence = 0;
  const pattern = new RegExp(`^INV-${year}-(\\d+)$`);

  for (const row of rows) {
    const match = row.invoice_number.match(pattern);
    if (match) {
      maxSequence = Math.max(maxSequence, parseInt(match[1], 10));
    }
  }

  const nextSequence = maxSequence + 1;
  return `${prefix}${String(nextSequence).padStart(3, '0')}`;
}

function resolveInvoiceNumber(db, { existing, provided }) {
  if (existing?.invoice_number?.trim()) {
    return existing.invoice_number.trim();
  }

  if (provided?.trim()) {
    return provided.trim();
  }

  return generateNextInvoiceNumber(db);
}

module.exports = {
  generateNextInvoiceNumber,
  resolveInvoiceNumber,
};
