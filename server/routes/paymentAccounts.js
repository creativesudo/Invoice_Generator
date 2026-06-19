function registerPaymentAccountRoutes(app, db) {
  app.get('/api/payment-accounts', (_req, res) => {
    const accounts = db
      .prepare('SELECT * FROM payment_accounts ORDER BY label ASC')
      .all();
    res.json(accounts);
  });

  app.get('/api/payment-accounts/:id', (req, res) => {
    const account = db
      .prepare('SELECT * FROM payment_accounts WHERE id = ?')
      .get(req.params.id);

    if (!account) {
      return res.status(404).json({ error: 'Payment account not found' });
    }

    res.json(account);
  });

  app.post('/api/payment-accounts', (req, res) => {
    const { label, bank_name, account_name, account_number, branch, notes } = req.body;

    if (!label?.trim()) {
      return res.status(400).json({ error: 'Label is required' });
    }

    try {
      const result = db.prepare(`
        INSERT INTO payment_accounts (
          label, bank_name, account_name, account_number, branch, notes, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        label.trim(),
        bank_name?.trim() || null,
        account_name?.trim() || null,
        account_number?.trim() || null,
        branch?.trim() || null,
        notes?.trim() || null
      );

      const account = db
        .prepare('SELECT * FROM payment_accounts WHERE id = ?')
        .get(result.lastInsertRowid);

      res.status(201).json(account);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return res.status(400).json({ error: 'A payment account with this label already exists' });
      }
      throw err;
    }
  });

  app.put('/api/payment-accounts/:id', (req, res) => {
    const existing = db
      .prepare('SELECT * FROM payment_accounts WHERE id = ?')
      .get(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Payment account not found' });
    }

    const { label, bank_name, account_name, account_number, branch, notes } = req.body;

    if (!label?.trim()) {
      return res.status(400).json({ error: 'Label is required' });
    }

    try {
      db.prepare(`
        UPDATE payment_accounts
        SET label = ?, bank_name = ?, account_name = ?, account_number = ?,
            branch = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        label.trim(),
        bank_name?.trim() || null,
        account_name?.trim() || null,
        account_number?.trim() || null,
        branch?.trim() || null,
        notes?.trim() || null,
        existing.id
      );

      const account = db
        .prepare('SELECT * FROM payment_accounts WHERE id = ?')
        .get(existing.id);

      res.json(account);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return res.status(400).json({ error: 'A payment account with this label already exists' });
      }
      throw err;
    }
  });

  app.delete('/api/payment-accounts/:id', (req, res) => {
    const existing = db
      .prepare('SELECT id FROM payment_accounts WHERE id = ?')
      .get(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Payment account not found' });
    }

    db.prepare('DELETE FROM payment_accounts WHERE id = ?').run(existing.id);
    res.status(204).send();
  });
}

module.exports = { registerPaymentAccountRoutes };
