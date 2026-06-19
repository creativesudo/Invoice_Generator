const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const { registerCompanyRoutes } = require('./routes/company');
const { registerClientRoutes } = require('./routes/clients');
const { registerInvoiceRoutes } = require('./routes/invoices');
const { registerPaymentAccountRoutes } = require('./routes/paymentAccounts');

const app = express();
const PORT = 3001;

const db = initDb();

app.use(cors());
app.use(express.json());

registerCompanyRoutes(app, db);
registerClientRoutes(app, db);
registerPaymentAccountRoutes(app, db);
registerInvoiceRoutes(app, db);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Invoice Generator API running at http://127.0.0.1:${PORT}`);
});

module.exports = { app, db };
