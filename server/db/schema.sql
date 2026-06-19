CREATE TABLE IF NOT EXISTS company_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  logo_path TEXT,
  currency_text TEXT NOT NULL DEFAULT '$',
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO company_profile (id, company_name) VALUES (1, '');

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  client_company_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  client_website TEXT,
  client_address TEXT,
  receivable REAL NOT NULL DEFAULT 0,
  received REAL NOT NULL DEFAULT 0,
  due REAL NOT NULL DEFAULT 0,
  notes TEXT,
  pdf_path TEXT,
  currency_text TEXT NOT NULL DEFAULT '$',
  is_draft INTEGER NOT NULL DEFAULT 0,
  payment_account_id INTEGER,
  payment_label TEXT,
  payment_bank_name TEXT,
  payment_account_name TEXT,
  payment_account_number TEXT,
  payment_branch TEXT,
  payment_notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  heading TEXT NOT NULL DEFAULT '',
  description TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clients_company_name ON clients(company_name);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

CREATE TABLE IF NOT EXISTS payment_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL UNIQUE,
  bank_name TEXT,
  account_name TEXT,
  account_number TEXT,
  branch TEXT,
  notes TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_label ON payment_accounts(label);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
