const { calculateDue } = require('./index');

function getPayments(db, invoiceId) {
  return db
    .prepare(`
      SELECT * FROM invoice_payments
      WHERE invoice_id = ?
      ORDER BY payment_date ASC, created_at ASC, id ASC
    `)
    .all(invoiceId);
}

function getReceivedTotal(db, invoiceId) {
  const row = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM invoice_payments WHERE invoice_id = ?')
    .get(invoiceId);
  return row.total;
}

function syncInvoiceTotals(db, invoiceId) {
  const invoice = db.prepare('SELECT receivable FROM invoices WHERE id = ?').get(invoiceId);
  if (!invoice) return null;

  const received = getReceivedTotal(db, invoiceId);
  const due = calculateDue(invoice.receivable, received);

  db.prepare('UPDATE invoices SET received = ?, due = ? WHERE id = ?').run(received, due, invoiceId);

  return { received, due };
}

function insertPayment(db, invoiceId, { amount, payment_date, notes }) {
  const result = db.prepare(`
    INSERT INTO invoice_payments (invoice_id, amount, payment_date, notes)
    VALUES (?, ?, ?, ?)
  `).run(
    invoiceId,
    Number(amount),
    payment_date,
    notes?.trim() || null
  );

  syncInvoiceTotals(db, invoiceId);

  return db
    .prepare('SELECT * FROM invoice_payments WHERE id = ?')
    .get(result.lastInsertRowid);
}

function insertPayments(db, invoiceId, payments) {
  if (!Array.isArray(payments)) return [];

  const saved = [];
  for (const payment of payments) {
    const amount = Number(payment.amount) || 0;
    if (amount <= 0) continue;

    saved.push(insertPayment(db, invoiceId, {
      amount,
      payment_date: payment.payment_date || new Date().toISOString().slice(0, 10),
      notes: payment.notes,
    }));
  }

  return saved;
}

function deletePayment(db, invoiceId, paymentId) {
  const payment = db
    .prepare('SELECT * FROM invoice_payments WHERE id = ? AND invoice_id = ?')
    .get(paymentId, invoiceId);

  if (!payment) return null;

  db.prepare('DELETE FROM invoice_payments WHERE id = ?').run(paymentId);
  syncInvoiceTotals(db, invoiceId);
  return payment;
}

function migrateLegacyReceivedPayments(db) {
  const tableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'invoice_payments'")
    .get();

  if (!tableExists) return;

  const invoices = db
    .prepare('SELECT id, received, created_at FROM invoices WHERE received > 0')
    .all();

  for (const invoice of invoices) {
    const count = db
      .prepare('SELECT COUNT(*) AS c FROM invoice_payments WHERE invoice_id = ?')
      .get(invoice.id);

    if (count.c === 0) {
      db.prepare(`
        INSERT INTO invoice_payments (invoice_id, amount, payment_date, notes)
        VALUES (?, ?, ?, ?)
      `).run(
        invoice.id,
        invoice.received,
        (invoice.created_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        'Migrated previous payment'
      );
    }
  }
}

module.exports = {
  getPayments,
  getReceivedTotal,
  syncInvoiceTotals,
  insertPayment,
  insertPayments,
  deletePayment,
  migrateLegacyReceivedPayments,
};
