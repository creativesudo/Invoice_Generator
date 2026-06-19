const path = require('path');
const fs = require('fs');
const {
  INVOICES_DIR,
  calculateLineItemAmount,
  calculateReceivable,
  calculateDue,
  normalizeCurrencyText,
} = require('../db');
const { generateInvoicePdf } = require('../services/pdf');
const { normalizePaymentFields } = require('../db/payment');
const {
  getPayments,
  getReceivedTotal,
  syncInvoiceTotals,
  insertPayment,
  insertPayments,
  deletePayment,
} = require('../db/invoicePayments');
const { generateNextInvoiceNumber, resolveInvoiceNumber } = require('../db/invoiceNumber');
const { upsertClientRecord } = require('./clients');
const { resolveInvoiceCurrency, validateCurrencyText } = require('../db/currencies');

const PAYMENT_COLUMNS = `
  payment_account_id = ?,
  payment_label = ?,
  payment_bank_name = ?,
  payment_account_name = ?,
  payment_account_number = ?,
  payment_branch = ?,
  payment_notes = ?
`;

function paymentValues(invoiceData) {
  return [
    invoiceData.payment_account_id,
    invoiceData.payment_label,
    invoiceData.payment_bank_name,
    invoiceData.payment_account_name,
    invoiceData.payment_account_number,
    invoiceData.payment_branch,
    invoiceData.payment_notes,
  ];
}

function validateInvoiceInput(body) {
  const { invoice_date, client, line_items } = body;

  if (!invoice_date) {
    return 'Invoice date is required';
  }

  if (!client?.company_name?.trim()) {
    return 'Client company name is required';
  }

  if (!Array.isArray(line_items) || line_items.length === 0) {
    return 'At least one line item is required';
  }

  return null;
}

function validateAutosaveInput() {
  return null;
}

function normalizeAutosaveClient(client) {
  return {
    company_name: client?.company_name || '',
    phone: client?.phone || '',
    email: client?.email || '',
    website: client?.website || '',
    address: client?.address || '',
  };
}

function normalizeAutosaveLineItems(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return [emptyLineItem()];
  }

  return lineItems;
}

function emptyLineItem() {
  return { heading: '', description: '', quantity: 1, unit_price: 0 };
}

function processLineItems(lineItems) {
  return lineItems.map((item, index) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    const amount = calculateLineItemAmount(quantity, unitPrice);
    return {
      heading: (item.heading || '').trim(),
      description: (item.description || '').trim(),
      quantity,
      unit_price: unitPrice,
      amount,
      sort_order: index,
    };
  });
}

function buildInvoiceData({
  invoice_number,
  invoice_date,
  client,
  processedItems,
  receivedTotal,
  notes,
  currencyText,
  paymentAccount,
}) {
  const receivable = calculateReceivable(processedItems);
  const receivedAmount = Number(receivedTotal) || 0;
  const due = calculateDue(receivable, receivedAmount);

  return {
    invoice_number: invoice_number.trim(),
    invoice_date,
    client_company_name: client.company_name.trim(),
    client_phone: client.phone || null,
    client_email: client.email || null,
    client_website: client.website || null,
    client_address: client.address || null,
    receivable,
    received: receivedAmount,
    due,
    notes: notes || null,
    currency_text: currencyText,
    ...normalizePaymentFields(paymentAccount),
  };
}

function createPdfPath(invoiceNumber) {
  const safeNumber = invoiceNumber.trim().replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(INVOICES_DIR, `INV-${safeNumber}.pdf`);
}

function saveLineItems(db, invoiceId, processedItems) {
  const insertLineItem = db.prepare(`
    INSERT INTO invoice_line_items (
      invoice_id, heading, description, quantity, unit_price, amount, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of processedItems) {
    insertLineItem.run(
      invoiceId,
      item.heading,
      item.description,
      item.quantity,
      item.unit_price,
      item.amount,
      item.sort_order
    );
  }
}

function getInvoiceWithDetails(db, invoiceId) {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  const lineItems = db
    .prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order ASC')
    .all(invoiceId);
  const payments = getPayments(db, invoiceId);

  return { ...invoice, line_items: lineItems, payments };
}

async function regenerateInvoicePdf(db, invoiceId, company) {
  const invoice = getInvoiceWithDetails(db, invoiceId);
  const pdfPath = createPdfPath(invoice.invoice_number);
  const oldPdfPath = invoice.pdf_path;

  await generateInvoicePdf({
    company,
    invoice,
    lineItems: invoice.line_items,
    payments: invoice.payments,
    outputPath: pdfPath,
  });

  db.prepare('UPDATE invoices SET pdf_path = ? WHERE id = ?').run(pdfPath, invoiceId);

  if (oldPdfPath && oldPdfPath !== pdfPath && fs.existsSync(oldPdfPath)) {
    fs.unlinkSync(oldPdfPath);
  }

  return getInvoiceWithDetails(db, invoiceId);
}

function persistInvoiceRecord(db, {
  invoiceId,
  invoiceData,
  processedItems,
  isDraft,
  pdfPath = null,
}) {
  const saveRecord = db.transaction(() => {
    if (invoiceId) {
      db.prepare(`
        UPDATE invoices SET
          invoice_number = ?,
          invoice_date = ?,
          client_company_name = ?,
          client_phone = ?,
          client_email = ?,
          client_website = ?,
          client_address = ?,
          receivable = ?,
          received = ?,
          due = ?,
          notes = ?,
          currency_text = ?,
          ${PAYMENT_COLUMNS},
          is_draft = ?,
          pdf_path = CASE WHEN ? IS NULL THEN pdf_path ELSE ? END
        WHERE id = ?
      `).run(
        invoiceData.invoice_number,
        invoiceData.invoice_date,
        invoiceData.client_company_name,
        invoiceData.client_phone,
        invoiceData.client_email,
        invoiceData.client_website,
        invoiceData.client_address,
        invoiceData.receivable,
        invoiceData.received,
        invoiceData.due,
        invoiceData.notes,
        invoiceData.currency_text,
        ...paymentValues(invoiceData),
        isDraft ? 1 : 0,
        pdfPath,
        pdfPath,
        invoiceId
      );

      db.prepare('DELETE FROM invoice_line_items WHERE invoice_id = ?').run(invoiceId);
      saveLineItems(db, invoiceId, processedItems);
      return invoiceId;
    }

    const result = db.prepare(`
      INSERT INTO invoices (
        invoice_number, invoice_date,
        client_company_name, client_phone, client_email, client_website, client_address,
        receivable, received, due, notes, pdf_path, currency_text, is_draft,
        payment_account_id, payment_label, payment_bank_name, payment_account_name,
        payment_account_number, payment_branch, payment_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoiceData.invoice_number,
      invoiceData.invoice_date,
      invoiceData.client_company_name,
      invoiceData.client_phone,
      invoiceData.client_email,
      invoiceData.client_website,
      invoiceData.client_address,
      invoiceData.receivable,
      invoiceData.received,
      invoiceData.due,
      invoiceData.notes,
      pdfPath,
      invoiceData.currency_text,
      isDraft ? 1 : 0,
      ...paymentValues(invoiceData)
    );

    const newInvoiceId = result.lastInsertRowid;
    saveLineItems(db, newInvoiceId, processedItems);
    return newInvoiceId;
  });

  return saveRecord();
}

function buildAutosavePayload(body, company, existing, receivedTotal = 0) {
  const client = normalizeAutosaveClient(body.client);
  const lineItems = normalizeAutosaveLineItems(body.line_items);
  const processedItems = processLineItems(lineItems);
  const currencyText = resolveInvoiceCurrency(body, existing, company);
  const invoiceDate = body.invoice_date || new Date().toISOString().slice(0, 10);

  return buildInvoiceData({
    invoice_number: body.invoice_number,
    invoice_date: invoiceDate,
    client,
    processedItems,
    receivedTotal,
    notes: body.notes,
    currencyText,
    paymentAccount: body.payment_account,
  });
}

function normalizeIncomingPayments(payments) {
  if (!Array.isArray(payments)) return [];
  return payments
    .map((payment) => ({
      amount: Number(payment.amount) || 0,
      payment_date: payment.payment_date || new Date().toISOString().slice(0, 10),
      notes: payment.notes || null,
    }))
    .filter((payment) => payment.amount > 0);
}

function registerInvoiceRoutes(app, db) {
  app.get('/api/invoices', (_req, res) => {
    const invoices = db
      .prepare(`
        SELECT id, invoice_number, invoice_date, client_company_name,
               receivable, received, due, currency_text, pdf_path, created_at
        FROM invoices
        WHERE is_draft = 0
        ORDER BY created_at DESC
      `)
      .all();
    res.json(invoices);
  });

  app.get('/api/invoices/next-number', (_req, res) => {
    res.json({ invoice_number: generateNextInvoiceNumber(db) });
  });

  app.get('/api/invoices/:id', (req, res) => {
    const invoice = db
      .prepare('SELECT * FROM invoices WHERE id = ?')
      .get(req.params.id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const lineItems = db
      .prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order ASC')
      .all(invoice.id);

    res.json({ ...invoice, line_items: lineItems, payments: getPayments(db, invoice.id) });
  });

  app.post('/api/invoices/:id/payments', async (req, res) => {
    try {
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      if (invoice.is_draft) {
        return res.status(400).json({ error: 'Finalize the invoice before recording payments' });
      }

      const amount = Number(req.body.amount);
      const paymentDate = req.body.payment_date || new Date().toISOString().slice(0, 10);
      const notes = req.body.notes || null;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Payment amount must be greater than zero' });
      }

      if (!paymentDate) {
        return res.status(400).json({ error: 'Payment date is required' });
      }

      insertPayment(db, invoice.id, {
        amount,
        payment_date: paymentDate,
        notes,
      });

      const company = db.prepare('SELECT * FROM company_profile WHERE id = 1').get();
      const updated = await regenerateInvoicePdf(db, invoice.id, company);

      res.status(201).json(updated);
    } catch (err) {
      console.error('Failed to record payment:', err);
      res.status(500).json({ error: err.message || 'Failed to record payment' });
    }
  });

  app.delete('/api/invoices/:id/payments/:paymentId', async (req, res) => {
    try {
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const removed = deletePayment(db, invoice.id, req.params.paymentId);
      if (!removed) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      if (!invoice.is_draft) {
        const company = db.prepare('SELECT * FROM company_profile WHERE id = 1').get();
        const updated = await regenerateInvoicePdf(db, invoice.id, company);
        return res.json(updated);
      }

      res.json(getInvoiceWithDetails(db, invoice.id));
    } catch (err) {
      console.error('Failed to delete payment:', err);
      res.status(500).json({ error: err.message || 'Failed to delete payment' });
    }
  });

  app.get('/api/invoices/:id/pdf', (req, res) => {
    const invoice = db
      .prepare('SELECT pdf_path FROM invoices WHERE id = ?')
      .get(req.params.id);

    if (!invoice?.pdf_path || !fs.existsSync(invoice.pdf_path)) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.resolve(invoice.pdf_path));
  });

  app.delete('/api/invoices/:id', (req, res) => {
    const invoice = db
      .prepare('SELECT id, pdf_path FROM invoices WHERE id = ?')
      .get(req.params.id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const deleteInvoice = db.transaction(() => {
      db.prepare('DELETE FROM invoice_payments WHERE invoice_id = ?').run(invoice.id);
      db.prepare('DELETE FROM invoice_line_items WHERE invoice_id = ?').run(invoice.id);
      db.prepare('DELETE FROM invoices WHERE id = ?').run(invoice.id);
    });

    deleteInvoice();

    if (invoice.pdf_path && fs.existsSync(invoice.pdf_path)) {
      fs.unlinkSync(invoice.pdf_path);
    }

    res.status(204).send();
  });

  app.post('/api/invoices/autosave', (req, res) => {
    try {
      const validationError = validateAutosaveInput(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const company = db.prepare('SELECT * FROM company_profile WHERE id = 1').get();
      const { id, client } = req.body;
      const existing = id
        ? db.prepare('SELECT * FROM invoices WHERE id = ?').get(id)
        : null;

      if (id && !existing) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const invoiceNumber = resolveInvoiceNumber(db, {
        existing,
        provided: req.body.invoice_number,
      });

      const invoiceData = buildAutosavePayload(
        { ...req.body, invoice_number: invoiceNumber },
        company,
        existing,
        existing ? getReceivedTotal(db, existing.id) : 0
      );

      const currencyError = validateCurrencyText(invoiceData.currency_text);
      if (currencyError) {
        return res.status(400).json({ error: currencyError });
      }

      if (client?.company_name?.trim()) {
        upsertClientRecord(db, client);
      }

      const invoiceId = persistInvoiceRecord(db, {
        invoiceId: existing?.id,
        invoiceData,
        processedItems: processLineItems(normalizeAutosaveLineItems(req.body.line_items)),
        isDraft: existing ? existing.is_draft === 1 : true,
        pdfPath: null,
      });

      res.json(getInvoiceWithDetails(db, invoiceId));
    } catch (err) {
      console.error('Failed to autosave invoice:', err);
      res.status(500).json({ error: err.message || 'Failed to autosave invoice' });
    }
  });

  app.put('/api/invoices/:id', async (req, res) => {
    try {
      const existing = db
        .prepare('SELECT * FROM invoices WHERE id = ?')
        .get(req.params.id);

      if (!existing) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const company = db.prepare('SELECT * FROM company_profile WHERE id = 1').get();
      if (!company?.company_name?.trim()) {
        return res.status(400).json({ error: 'Company profile is incomplete. Set your company name in Settings.' });
      }

      const validationError = validateInvoiceInput(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const { invoice_date, client, line_items, notes, payment_account } = req.body;
      const processedItems = processLineItems(line_items);
      const currencyText = resolveInvoiceCurrency(req.body, existing, company);
      const currencyError = validateCurrencyText(currencyText);
      if (currencyError) {
        return res.status(400).json({ error: currencyError });
      }

      const receivedTotal = getReceivedTotal(db, existing.id);
      const invoiceData = buildInvoiceData({
        invoice_number: existing.invoice_number,
        invoice_date,
        client,
        processedItems,
        receivedTotal,
        notes,
        currencyText,
        paymentAccount: payment_account,
      });

      upsertClientRecord(db, client);

      const targetPdfPath = createPdfPath(invoiceData.invoice_number);
      const oldPdfPath = existing.pdf_path;

      const updateInvoice = db.transaction(() => {
        db.prepare(`
          UPDATE invoices SET
            invoice_number = ?,
            invoice_date = ?,
            client_company_name = ?,
            client_phone = ?,
            client_email = ?,
            client_website = ?,
            client_address = ?,
            receivable = ?,
            received = ?,
            due = ?,
            notes = ?,
            pdf_path = ?,
            currency_text = ?,
            ${PAYMENT_COLUMNS},
            is_draft = 0
          WHERE id = ?
        `).run(
          invoiceData.invoice_number,
          invoiceData.invoice_date,
          invoiceData.client_company_name,
          invoiceData.client_phone,
          invoiceData.client_email,
          invoiceData.client_website,
          invoiceData.client_address,
          invoiceData.receivable,
          invoiceData.received,
          invoiceData.due,
          invoiceData.notes,
          targetPdfPath,
          invoiceData.currency_text,
          ...paymentValues(invoiceData),
          existing.id
        );

        db.prepare('DELETE FROM invoice_line_items WHERE invoice_id = ?').run(existing.id);
        saveLineItems(db, existing.id, processedItems);
      });

      updateInvoice();

      const savedInvoice = getInvoiceWithDetails(db, existing.id);

      await generateInvoicePdf({
        company,
        invoice: savedInvoice,
        lineItems: savedInvoice.line_items,
        payments: savedInvoice.payments,
        outputPath: targetPdfPath,
      });

      if (oldPdfPath && oldPdfPath !== targetPdfPath && fs.existsSync(oldPdfPath)) {
        fs.unlinkSync(oldPdfPath);
      }

      res.json(getInvoiceWithDetails(db, existing.id));
    } catch (err) {
      console.error('Failed to update invoice:', err);
      res.status(500).json({ error: err.message || 'Failed to update invoice' });
    }
  });

  app.post('/api/invoices', async (req, res) => {
    try {
      const company = db.prepare('SELECT * FROM company_profile WHERE id = 1').get();
      if (!company?.company_name?.trim()) {
        return res.status(400).json({ error: 'Company profile is incomplete. Set your company name in Settings.' });
      }

      const validationError = validateInvoiceInput(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const {
        id: draftId,
        invoice_date,
        client,
        line_items,
        notes,
        payment_account,
        payments,
      } = req.body;

      const draft = draftId
        ? db.prepare('SELECT * FROM invoices WHERE id = ? AND is_draft = 1').get(draftId)
        : null;

      const invoiceNumber = resolveInvoiceNumber(db, {
        existing: draft,
        provided: req.body.invoice_number,
      });

      const processedItems = processLineItems(line_items);
      const currencyText = resolveInvoiceCurrency(req.body, draft, company);
      const currencyError = validateCurrencyText(currencyText);
      if (currencyError) {
        return res.status(400).json({ error: currencyError });
      }

      const initialPayments = normalizeIncomingPayments(payments);
      const invoiceData = buildInvoiceData({
        invoice_number: invoiceNumber,
        invoice_date,
        client,
        processedItems,
        receivedTotal: initialPayments.reduce((sum, payment) => sum + payment.amount, 0),
        notes,
        currencyText,
        paymentAccount: payment_account,
      });

      upsertClientRecord(db, client);

      const pdfPath = createPdfPath(invoiceData.invoice_number);
      let invoiceId;

      if (draftId) {
        const draftRecord = draft || db.prepare('SELECT * FROM invoices WHERE id = ? AND is_draft = 1').get(draftId);
        if (!draftRecord) {
          return res.status(404).json({ error: 'Draft invoice not found' });
        }

        const oldPdfPath = draftRecord.pdf_path;
        invoiceId = persistInvoiceRecord(db, {
          invoiceId: draftRecord.id,
          invoiceData,
          processedItems,
          isDraft: false,
          pdfPath,
        });

        if (oldPdfPath && oldPdfPath !== pdfPath && fs.existsSync(oldPdfPath)) {
          fs.unlinkSync(oldPdfPath);
        }
      } else {
        const insertInvoice = db.prepare(`
          INSERT INTO invoices (
            invoice_number, invoice_date,
            client_company_name, client_phone, client_email, client_website, client_address,
            receivable, received, due, notes, pdf_path, currency_text, is_draft,
            payment_account_id, payment_label, payment_bank_name, payment_account_name,
            payment_account_number, payment_branch, payment_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
        `);

        const createInvoice = db.transaction(() => {
          const result = insertInvoice.run(
            invoiceData.invoice_number,
            invoiceData.invoice_date,
            invoiceData.client_company_name,
            invoiceData.client_phone,
            invoiceData.client_email,
            invoiceData.client_website,
            invoiceData.client_address,
            invoiceData.receivable,
            invoiceData.received,
            invoiceData.due,
            invoiceData.notes,
            pdfPath,
            invoiceData.currency_text,
            ...paymentValues(invoiceData)
          );

          const newInvoiceId = result.lastInsertRowid;
          saveLineItems(db, newInvoiceId, processedItems);
          return newInvoiceId;
        });

        invoiceId = createInvoice();
      }

      insertPayments(db, invoiceId, initialPayments);
      syncInvoiceTotals(db, invoiceId);

      const finalizedInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
      const savedPayments = getPayments(db, invoiceId);
      const invoiceForPdf = { ...finalizedInvoice, ...invoiceData, received: finalizedInvoice.received, due: finalizedInvoice.due };

      await generateInvoicePdf({
        company,
        invoice: invoiceForPdf,
        lineItems: processedItems,
        payments: savedPayments,
        outputPath: pdfPath,
      });

      res.status(201).json(getInvoiceWithDetails(db, invoiceId));
    } catch (err) {
      console.error('Failed to create invoice:', err);
      res.status(500).json({ error: err.message || 'Failed to create invoice' });
    }
  });
}

module.exports = {
  registerInvoiceRoutes,
  validateInvoiceInput,
  validateAutosaveInput,
  processLineItems,
  buildInvoiceData,
  buildAutosavePayload,
};
