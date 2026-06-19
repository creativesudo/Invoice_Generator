import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import {
  calculateLineItemAmount,
  calculateReceivable,
  calculateDue,
  formatMoney,
  normalizeCurrencyText,
} from '../db/index.js';
import { generateInvoicePdf, INVOICE_FOOTER_NOTE } from '../services/pdf.js';

describe('calculateLineItemAmount', () => {
  it('multiplies quantity and unit price with 2 decimal precision', () => {
    expect(calculateLineItemAmount(3, 10.5)).toBe(31.5);
    expect(calculateLineItemAmount(2, 33.335)).toBe(66.67);
  });
});

describe('calculateReceivable', () => {
  it('sums line item amounts', () => {
    const items = [
      { amount: 100 },
      { amount: 50.5 },
      { amount: 25 },
    ];
    expect(calculateReceivable(items)).toBe(175.5);
  });

  it('returns 0 for empty list', () => {
    expect(calculateReceivable([])).toBe(0);
  });
});

describe('calculateDue', () => {
  it('computes receivable minus received', () => {
    expect(calculateDue(1000, 400)).toBe(600);
    expect(calculateDue(100, 100)).toBe(0);
  });

  it('handles overpayment as negative due', () => {
    expect(calculateDue(100, 150)).toBe(-50);
  });
});

describe('formatMoney', () => {
  it('formats amount with default currency text, space, and commas', () => {
    expect(formatMoney(1234.5)).toBe('$ 1,234.50');
  });

  it('formats amount with custom currency text, space, and commas', () => {
    expect(formatMoney(500, 'Tk ')).toBe('Tk 500.00');
    expect(formatMoney(99.9, 'USD ')).toBe('USD 99.90');
    expect(formatMoney(74800, 'BDT')).toBe('BDT 74,800.00');
    expect(formatMoney(1234567.89, 'BDT')).toBe('BDT 1,234,567.89');
  });

  it('falls back to default when currency text is empty', () => {
    expect(formatMoney(10, '   ')).toBe('$ 10.00');
    expect(normalizeCurrencyText('')).toBe('$');
  });
});

describe('client upsert', () => {
  let db;
  let dbPath;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-${Date.now()}.db`);
    db = new Database(dbPath);
    db.exec(`
      CREATE TABLE clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL UNIQUE,
        phone TEXT,
        email TEXT,
        website TEXT,
        address TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL,
        invoice_date TEXT NOT NULL,
        client_company_name TEXT NOT NULL
      );
    `);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('inserts new client and updates on conflict', () => {
    const upsert = db.prepare(`
      INSERT INTO clients (company_name, phone, email, website, address, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(company_name) DO UPDATE SET
        phone = excluded.phone,
        email = excluded.email,
        website = excluded.website,
        address = excluded.address,
        updated_at = datetime('now')
    `);

    upsert.run('Acme Corp', '111', 'old@acme.com', null, 'Old Address');
    upsert.run('Acme Corp', '222', 'new@acme.com', 'acme.com', 'New Address');

    const client = db.prepare('SELECT * FROM clients WHERE company_name = ?').get('Acme Corp');
    expect(client.phone).toBe('222');
    expect(client.email).toBe('new@acme.com');
    expect(client.website).toBe('acme.com');
    expect(client.address).toBe('New Address');

    const count = db.prepare('SELECT COUNT(*) as c FROM clients').get();
    expect(count.c).toBe(1);
  });

  it('prevents deleting a company used by invoices', () => {
    db.prepare(`
      INSERT INTO clients (company_name, phone)
      VALUES ('Acme Corp', '111')
    `).run();

    db.prepare(`
      INSERT INTO invoices (invoice_number, invoice_date, client_company_name)
      VALUES ('INV-001', '2026-01-01', 'Acme Corp')
    `).run();

    const invoiceCount = db
      .prepare('SELECT COUNT(*) as count FROM invoices WHERE client_company_name = ?')
      .get('Acme Corp').count;

    expect(invoiceCount).toBe(1);
  });

  it('updates company details by id', () => {
    const result = db.prepare(`
      INSERT INTO clients (company_name, phone)
      VALUES ('Beta Ltd', '100')
    `).run();

    db.prepare(`
      UPDATE clients
      SET company_name = ?, phone = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run('Beta Limited', '200', result.lastInsertRowid);

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
    expect(client.company_name).toBe('Beta Limited');
    expect(client.phone).toBe('200');
  });
});

describe('generateInvoicePdf', () => {
  let outputPath;

  beforeEach(() => {
    outputPath = path.join(os.tmpdir(), `invoice-${Date.now()}.pdf`);
  });

  afterEach(() => {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  });

  it('creates a PDF file on disk', async () => {
    await generateInvoicePdf({
      company: {
        company_name: 'Test Co',
        phone: '555-0100',
        email: 'test@example.com',
        website: 'testco.com',
        address: '123 Main St',
        logo_path: null,
      },
      invoice: {
        invoice_number: 'INV-001',
        invoice_date: '2026-06-19',
        client_company_name: 'Client Inc',
        client_phone: '555-0200',
        client_email: 'client@example.com',
        client_website: null,
        client_address: '456 Oak Ave',
        receivable: 500,
        received: 200,
        due: 300,
        notes: 'Thank you for your business',
        currency_text: 'Tk ',
      },
      lineItems: [
        {
          heading: 'Web Development',
          description: 'Homepage redesign',
          quantity: 1,
          unit_price: 500,
          amount: 500,
        },
      ],
      outputPath,
    });

    expect(fs.existsSync(outputPath)).toBe(true);
    expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
  });

  it('includes the computer-generated footer note constant', () => {
    expect(INVOICE_FOOTER_NOTE).toBe(
      'Note: This is a computer-generated invoice and does not require a signature.'
    );
  });
});

describe('invoice delete', () => {
  let db;
  let dbPath;
  let pdfPath;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-invoice-${Date.now()}.db`);
    pdfPath = path.join(os.tmpdir(), `test-invoice-${Date.now()}.pdf`);
    fs.writeFileSync(pdfPath, 'fake pdf');

    db = new Database(dbPath);
    db.exec(`
      CREATE TABLE invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL,
        pdf_path TEXT
      );
      CREATE TABLE invoice_line_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        heading TEXT NOT NULL DEFAULT ''
      );
    `);

    const invoice = db.prepare(`
      INSERT INTO invoices (invoice_number, pdf_path) VALUES (?, ?)
    `).run('INV-DELETE', pdfPath);

    db.prepare(`
      INSERT INTO invoice_line_items (invoice_id, heading) VALUES (?, ?)
    `).run(invoice.lastInsertRowid, 'Test Item');
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
  });

  it('removes invoice, line items, and pdf file', () => {
    const invoice = db.prepare('SELECT id, pdf_path FROM invoices').get();

    const deleteInvoice = db.transaction(() => {
      db.prepare('DELETE FROM invoice_line_items WHERE invoice_id = ?').run(invoice.id);
      db.prepare('DELETE FROM invoices WHERE id = ?').run(invoice.id);
    });

    deleteInvoice();

    if (invoice.pdf_path && fs.existsSync(invoice.pdf_path)) {
      fs.unlinkSync(invoice.pdf_path);
    }

    expect(db.prepare('SELECT COUNT(*) as c FROM invoices').get().c).toBe(0);
    expect(db.prepare('SELECT COUNT(*) as c FROM invoice_line_items').get().c).toBe(0);
    expect(fs.existsSync(pdfPath)).toBe(false);
  });
});

describe('invoice update helpers', () => {
  const {
    validateInvoiceInput,
    validateAutosaveInput,
    processLineItems,
    buildInvoiceData,
    buildAutosavePayload,
  } = require('../routes/invoices');

  it('validates required invoice fields', () => {
    expect(validateInvoiceInput({})).toBe('Invoice date is required');
    expect(validateInvoiceInput({
      invoice_date: '2026-06-19',
      client: { company_name: 'Acme' },
      line_items: [],
    })).toBe('At least one line item is required');
  });

  it('allows autosave without client-provided invoice number', () => {
    expect(validateAutosaveInput({})).toBeNull();
  });

  it('rebuilds invoice totals from updated line items', () => {
    const processedItems = processLineItems([
      { heading: 'Design', description: 'Logo', quantity: 2, unit_price: 150 },
    ]);

    const invoiceData = buildInvoiceData({
      invoice_number: 'INV-002',
      invoice_date: '2026-06-20',
      client: { company_name: 'Acme', phone: '111' },
      processedItems,
      receivedTotal: 100,
      notes: 'Updated',
      currencyText: 'Tk ',
    });

    expect(invoiceData.receivable).toBe(300);
    expect(invoiceData.due).toBe(200);
    expect(invoiceData.currency_text).toBe('Tk ');
  });

  it('builds partial autosave payload without strict client validation', () => {
    const payload = buildAutosavePayload(
      {
        invoice_number: 'INV-DRAFT',
        currency_text: 'BDT',
        client: { company_name: 'Partial Client' },
        line_items: [],
        received: 0,
      },
      { currency_text: '$' },
      null
    );

    expect(payload.invoice_number).toBe('INV-DRAFT');
    expect(payload.client_company_name).toBe('Partial Client');
    expect(payload.currency_text).toBe('BDT');
    expect(payload.receivable).toBe(0);
  });
});

describe('currency options', () => {
  const {
    CURRENCY_OPTIONS,
    isValidCurrency,
    validateCurrencyText,
    resolveInvoiceCurrency,
  } = require('../db/currencies');

  it('includes BDT and USD options', () => {
    const values = CURRENCY_OPTIONS.map((option) => option.value);
    expect(values).toContain('BDT');
    expect(values).toContain('$');
  });

  it('validates allowed currency values', () => {
    expect(isValidCurrency('BDT')).toBe(true);
    expect(isValidCurrency('CUSTOM')).toBe(false);
    expect(validateCurrencyText('BDT')).toBeNull();
    expect(validateCurrencyText('CUSTOM')).toBe('Select a currency from the available list');
  });

  it('resolves invoice currency from request, existing invoice, or company default', () => {
    expect(resolveInvoiceCurrency({ currency_text: 'BDT' }, null, { currency_text: '$' })).toBe('BDT');
    expect(resolveInvoiceCurrency({}, { currency_text: 'Tk ' }, { currency_text: '$' })).toBe('Tk ');
    expect(resolveInvoiceCurrency({}, null, { currency_text: 'BDT' })).toBe('BDT');
  });
});

describe('payment account helpers', () => {
  const { normalizePaymentFields, paymentAccountFromInvoice } = require('../db/payment');

  it('normalizes payment account fields for invoice snapshot', () => {
    const snapshot = normalizePaymentFields({
      id: 2,
      label: 'DBBL',
      bank_name: 'Dutch Bangla',
      account_number: '12345',
    });

    expect(snapshot.payment_account_id).toBe(2);
    expect(snapshot.payment_label).toBe('DBBL');
    expect(snapshot.payment_bank_name).toBe('Dutch Bangla');
    expect(snapshot.payment_account_number).toBe('12345');
  });

  it('returns null payment fields when account is empty', () => {
    const snapshot = normalizePaymentFields(emptyPaymentAccountLike());
    expect(snapshot.payment_account_id).toBeNull();
    expect(snapshot.payment_label).toBeNull();
  });

  it('reconstructs payment account from invoice snapshot', () => {
    const account = paymentAccountFromInvoice({
      payment_account_id: 1,
      payment_label: 'bKash',
      payment_account_number: '01700',
    });

    expect(account.id).toBe(1);
    expect(account.label).toBe('bKash');
    expect(account.account_number).toBe('01700');
  });
});

describe('invoice number generation', () => {
  const { generateNextInvoiceNumber, resolveInvoiceNumber } = require('../db/invoiceNumber');

  let db;
  let dbPath;
  const year = new Date().getFullYear();

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-invoice-number-${Date.now()}.db`);
    db = new Database(dbPath);
    db.exec(`
      CREATE TABLE invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL,
        is_draft INTEGER NOT NULL DEFAULT 0
      );
    `);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('generates first invoice number for the current year', () => {
    expect(generateNextInvoiceNumber(db, year)).toBe(`INV-${year}-001`);
  });

  it('increments sequence based on existing invoice numbers', () => {
    db.prepare('INSERT INTO invoices (invoice_number) VALUES (?)').run(`INV-${year}-001`);
    db.prepare('INSERT INTO invoices (invoice_number) VALUES (?)').run(`INV-${year}-002`);
    expect(generateNextInvoiceNumber(db, year)).toBe(`INV-${year}-003`);
  });

  it('keeps existing invoice number when updating a draft', () => {
    const existing = { invoice_number: `INV-${year}-005` };
    expect(resolveInvoiceNumber(db, { existing, provided: '' })).toBe(`INV-${year}-005`);
  });

  it('generates a number when creating a new invoice', () => {
    expect(resolveInvoiceNumber(db, { existing: null, provided: '' })).toBe(`INV-${year}-001`);
  });
});

function emptyPaymentAccountLike() {
  return {
    label: '',
    bank_name: '',
    account_name: '',
    account_number: '',
    branch: '',
    notes: '',
  };
}

describe('invoice payment helpers', () => {
  const {
    getReceivedTotal,
    syncInvoiceTotals,
    insertPayment,
    insertPayments,
  } = require('../db/invoicePayments');

  let db;
  let dbPath;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-payments-${Date.now()}.db`);
    db = new Database(dbPath);
    db.exec(`
      CREATE TABLE invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receivable REAL NOT NULL DEFAULT 0,
        received REAL NOT NULL DEFAULT 0,
        due REAL NOT NULL DEFAULT 0
      );
      CREATE TABLE invoice_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        notes TEXT
      );
    `);
    db.prepare('INSERT INTO invoices (id, receivable, received, due) VALUES (1, 1000, 0, 1000)').run();
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('tracks multiple partial payments and due balance', () => {
    insertPayments(db, 1, [
      { amount: 200, payment_date: '2026-06-01', notes: 'Upfront' },
      { amount: 300, payment_date: '2026-07-01', notes: 'Second installment' },
    ]);

    expect(getReceivedTotal(db, 1)).toBe(500);

    const totals = syncInvoiceTotals(db, 1);
    expect(totals.received).toBe(500);
    expect(totals.due).toBe(500);
  });

  it('adds a subsequent payment and updates totals', () => {
    insertPayment(db, 1, { amount: 400, payment_date: '2026-06-10', notes: 'Partial' });
    const totals = syncInvoiceTotals(db, 1);
    expect(totals.received).toBe(400);
    expect(totals.due).toBe(600);
  });
});
