const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { formatAmount, normalizeCurrencyText } = require('../db');

const INVOICE_FOOTER_NOTE =
  'Note: This is a computer-generated invoice and does not require a signature.';

function formatCurrency(amount, currencyText = '$') {
  const symbol = normalizeCurrencyText(currencyText).trim();
  return `${symbol} ${formatAmount(amount)}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function addCompanyBlock(doc, company, startY) {
  let y = startY;

  if (company.logo_path && fs.existsSync(company.logo_path)) {
    try {
      doc.image(company.logo_path, 50, y, { width: 80, height: 80, fit: [80, 80] });
    } catch {
      // skip invalid logo
    }
  }

  const textX = company.logo_path ? 150 : 50;
  doc.fontSize(16).font('Helvetica-Bold').text(company.company_name, textX, y);
  y += 22;

  doc.fontSize(10).font('Helvetica');
  const contactParts = [];
  if (company.phone) contactParts.push(company.phone);
  if (company.email) contactParts.push(company.email);
  if (contactParts.length) {
    doc.text(contactParts.join(' | '), textX, y);
    y += 14;
  }
  if (company.website) {
    doc.text(company.website, textX, y);
    y += 14;
  }
  if (company.address) {
    doc.text(company.address, textX, y, { width: 250 });
    y += doc.heightOfString(company.address, { width: 250 }) + 4;
  }

  return Math.max(y, startY + 90);
}

function drawMoneyText(doc, text, x, y, width, { align = 'left', fontSize = 9, resetFontSize = 9 } = {}) {
  doc.font('Helvetica-Bold').fontSize(fontSize).text(text, x, y, { width, align });
  doc.font('Helvetica').fontSize(resetFontSize);
}

function drawTotalRow(doc, y, label, amount, currencyText, { fontSize = 10 } = {}) {
  const pageRight = 545;
  const amountWidth = 115;
  const amountX = pageRight - amountWidth;
  const labelWidth = 105;
  const labelX = amountX - labelWidth;

  doc.font('Helvetica').fontSize(fontSize);
  doc.text(label, labelX, y, { width: labelWidth, align: 'right' });
  drawMoneyText(
    doc,
    formatCurrency(amount, currencyText),
    amountX,
    y,
    amountWidth,
    { align: 'right', fontSize, resetFontSize: fontSize }
  );

  return y + (fontSize >= 11 ? 20 : 16);
}

function addPaymentBlock(doc, invoice, startY) {
  const lines = [];
  if (invoice.payment_bank_name) lines.push(`Bank: ${invoice.payment_bank_name}`);
  if (invoice.payment_account_name) lines.push(`Account Name: ${invoice.payment_account_name}`);
  if (invoice.payment_account_number) lines.push(`A/C No: ${invoice.payment_account_number}`);
  if (invoice.payment_branch) lines.push(`Branch: ${invoice.payment_branch}`);
  if (invoice.payment_notes) lines.push(invoice.payment_notes);

  if (!lines.length) return startY;

  let y = startY + 12;
  doc.font('Helvetica').fontSize(9);
  for (const line of lines) {
    doc.text(line, 50, y, { width: 495 });
    y += doc.heightOfString(line, { width: 495 }) + 4;
  }

  return y;
}

function addInvoiceFooter(doc) {
  doc.font('Helvetica').fontSize(8).fillColor('#666666');
  doc.text(INVOICE_FOOTER_NOTE, 50, doc.page.height - 60, {
    width: doc.page.width - 100,
    align: 'center',
  });
  doc.fillColor('#000000');
}

function generateInvoicePdf({ company, invoice, lineItems, payments = [], outputPath }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(outputPath);
    const currencyText = invoice.currency_text || company.currency_text || '$';

    doc.pipe(stream);

    let y = addCompanyBlock(doc, company, 50);

    doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', 400, 50, { align: 'right', width: 145 });
    doc.fontSize(10).font('Helvetica');
    doc.text(`Invoice #: ${invoice.invoice_number}`, 400, 80, { align: 'right', width: 145 });
    doc.text(`Date: ${formatDate(invoice.invoice_date)}`, 400, 95, { align: 'right', width: 145 });

    y = Math.max(y + 20, 150);

    doc.fontSize(11).font('Helvetica-Bold').text('Bill To:', 50, y);
    y += 16;
    doc.font('Helvetica').fontSize(10);
    doc.text(invoice.client_company_name, 50, y);
    y += 14;

    const clientContact = [];
    if (invoice.client_phone) clientContact.push(invoice.client_phone);
    if (invoice.client_email) clientContact.push(invoice.client_email);
    if (clientContact.length) {
      doc.text(clientContact.join(' | '), 50, y);
      y += 14;
    }
    if (invoice.client_website) {
      doc.text(invoice.client_website, 50, y);
      y += 14;
    }
    if (invoice.client_address) {
      doc.text(invoice.client_address, 50, y, { width: 250 });
      y += doc.heightOfString(invoice.client_address, { width: 250 }) + 4;
    }

    y += 20;

    const tableTop = y;
    const colX = { heading: 50, description: 145, qty: 325, rate: 365, amount: 445 };
    const colW = { heading: 90, description: 175, qty: 35, rate: 75, amount: 100 };

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Heading', colX.heading, tableTop, { width: colW.heading });
    doc.text('Description', colX.description, tableTop, { width: colW.description });
    doc.text('Qty', colX.qty, tableTop, { width: colW.qty, align: 'right' });
    doc.text('Rate', colX.rate, tableTop, { width: colW.rate, align: 'right' });
    doc.text('Amount', colX.amount, tableTop, { width: colW.amount, align: 'right' });

    y = tableTop + 18;
    doc.moveTo(50, y).lineTo(545, y).stroke('#cccccc');
    y += 8;

    doc.font('Helvetica').fontSize(9);
    for (const item of lineItems) {
      if (y > 680) {
        doc.addPage();
        y = 50;
      }

      doc.text(item.heading || '', colX.heading, y, { width: colW.heading });
      doc.text(item.description || '', colX.description, y, { width: colW.description });
      doc.text(String(item.quantity), colX.qty, y, { width: colW.qty, align: 'right' });
      drawMoneyText(
        doc,
        formatCurrency(item.unit_price, currencyText),
        colX.rate,
        y,
        colW.rate,
        { align: 'right', resetFontSize: 9 }
      );
      drawMoneyText(
        doc,
        formatCurrency(item.amount, currencyText),
        colX.amount,
        y,
        colW.amount,
        { align: 'right', resetFontSize: 9 }
      );

      const rowHeight = Math.max(
        doc.heightOfString(item.heading || '', { width: colW.heading }),
        doc.heightOfString(item.description || '', { width: colW.description }),
        14
      );
      y += rowHeight + 6;
    }

    y += 10;
    doc.moveTo(320, y).lineTo(545, y).stroke('#cccccc');
    y += 12;

    y = drawTotalRow(doc, y, 'Receivable:', invoice.receivable, currencyText);

    if (payments.length > 0) {
      y += 8;
      doc.font('Helvetica-Bold').fontSize(9).text('Payment History', 50, y);
      const paymentHeadingBottom = y + 12;
      doc.moveTo(50, paymentHeadingBottom).lineTo(545, paymentHeadingBottom).stroke('#cccccc');
      y = paymentHeadingBottom + 8;

      const payColX = { date: 50, amount: 170, notes: 260 };
      const payColW = { date: 110, amount: 85, notes: 285 };

      doc.font('Helvetica-Bold').fontSize(8);
      doc.text('Date', payColX.date, y, { width: payColW.date });
      doc.text('Amount', payColX.amount, y, { width: payColW.amount, align: 'right' });
      doc.text('Notes', payColX.notes, y, { width: payColW.notes });
      y += 12;
      doc.moveTo(50, y).lineTo(545, y).stroke('#cccccc');
      y += 6;

      doc.font('Helvetica').fontSize(8);
      for (const payment of payments) {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        doc.text(formatDate(payment.payment_date), payColX.date, y, { width: payColW.date });
        drawMoneyText(
          doc,
          formatCurrency(payment.amount, currencyText),
          payColX.amount,
          y,
          payColW.amount,
          { align: 'right', fontSize: 8, resetFontSize: 8 }
        );
        doc.text(payment.notes || '', payColX.notes, y, { width: payColW.notes });

        const rowHeight = Math.max(
          doc.heightOfString(payment.notes || '', { width: payColW.notes }),
          12
        );
        y += rowHeight + 4;
      }

      y += 6;
      doc.moveTo(320, y).lineTo(545, y).stroke('#cccccc');
      y += 12;
    }

    y = drawTotalRow(doc, y, 'Total Received:', invoice.received, currencyText);
    y = drawTotalRow(doc, y, 'Amount Due:', invoice.due, currencyText, { fontSize: 11 });
    y += 8;

    if (invoice.notes) {
      doc.font('Helvetica-Bold').fontSize(10).text('Notes:', 50, y);
      y += 14;
      doc.font('Helvetica').text(invoice.notes, 50, y, { width: 495 });
      y += doc.heightOfString(invoice.notes, { width: 495 }) + 8;
    }

    y = addPaymentBlock(doc, invoice, y);

    addInvoiceFooter(doc);

    doc.end();

    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
    doc.on('error', reject);
  });
}

module.exports = { generateInvoicePdf, formatCurrency, formatDate, INVOICE_FOOTER_NOTE };
