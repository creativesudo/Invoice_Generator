const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'invoices.db');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const INVOICES_DIR = path.join(DATA_DIR, 'invoices');
const DEFAULT_CURRENCY_TEXT = '$';

function ensureDirs() {
  for (const dir of [DATA_DIR, UPLOADS_DIR, INVOICES_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function initDb() {
  ensureDirs();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  runMigrations(db);
  const { migrateLegacyReceivedPayments } = require('./invoicePayments');
  migrateLegacyReceivedPayments(db);

  return db;
}

function runMigrations(db) {
  const companyCols = db.prepare('PRAGMA table_info(company_profile)').all();
  if (!companyCols.some((col) => col.name === 'currency_text')) {
    db.exec(`ALTER TABLE company_profile ADD COLUMN currency_text TEXT NOT NULL DEFAULT '${DEFAULT_CURRENCY_TEXT}'`);
  }

  const invoiceCols = db.prepare('PRAGMA table_info(invoices)').all();
  if (!invoiceCols.some((col) => col.name === 'currency_text')) {
    db.exec(`ALTER TABLE invoices ADD COLUMN currency_text TEXT NOT NULL DEFAULT '${DEFAULT_CURRENCY_TEXT}'`);
  }

  if (!invoiceCols.some((col) => col.name === 'is_draft')) {
    db.exec('ALTER TABLE invoices ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0');
  }

  const paymentColumns = [
    ['payment_account_id', 'INTEGER'],
    ['payment_label', 'TEXT'],
    ['payment_bank_name', 'TEXT'],
    ['payment_account_name', 'TEXT'],
    ['payment_account_number', 'TEXT'],
    ['payment_branch', 'TEXT'],
    ['payment_notes', 'TEXT'],
  ];

  const refreshedInvoiceCols = db.prepare('PRAGMA table_info(invoices)').all();
  for (const [name, type] of paymentColumns) {
    if (!refreshedInvoiceCols.some((col) => col.name === name)) {
      db.exec(`ALTER TABLE invoices ADD COLUMN ${name} ${type}`);
    }
  }
}

function normalizeCurrencyText(currencyText) {
  if (currencyText == null || !String(currencyText).trim()) {
    return DEFAULT_CURRENCY_TEXT;
  }
  return String(currencyText);
}

function formatAmount(amount) {
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) {
    return '0.00';
  }
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoney(amount, currencyText = DEFAULT_CURRENCY_TEXT) {
  const symbol = normalizeCurrencyText(currencyText).trim();
  return `${symbol} ${formatAmount(amount)}`;
}

function calculateLineItemAmount(quantity, unitPrice) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

function calculateReceivable(lineItems) {
  return lineItems.reduce((sum, item) => sum + item.amount, 0);
}

function calculateDue(receivable, received) {
  return Math.round((receivable - received) * 100) / 100;
}

module.exports = {
  DATA_DIR,
  DB_PATH,
  UPLOADS_DIR,
  INVOICES_DIR,
  ensureDirs,
  initDb,
  runMigrations,
  DEFAULT_CURRENCY_TEXT,
  normalizeCurrencyText,
  formatAmount,
  formatMoney,
  calculateLineItemAmount,
  calculateReceivable,
  calculateDue,
};
