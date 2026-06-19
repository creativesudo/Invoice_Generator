function trimOrNull(value) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function upsertClientRecord(db, client) {
  db.prepare(`
    INSERT INTO clients (company_name, phone, email, website, address, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(company_name) DO UPDATE SET
      phone = excluded.phone,
      email = excluded.email,
      website = excluded.website,
      address = excluded.address,
      updated_at = datetime('now')
  `).run(
    client.company_name.trim(),
    trimOrNull(client.phone),
    trimOrNull(client.email),
    trimOrNull(client.website),
    trimOrNull(client.address)
  );
}

function registerClientRoutes(app, db) {
  app.get('/api/clients', (_req, res) => {
    const clients = db
      .prepare('SELECT * FROM clients ORDER BY company_name ASC')
      .all();
    res.json(clients);
  });

  app.get('/api/clients/search', (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json([]);
    }

    const clients = db
      .prepare(`
        SELECT * FROM clients
        WHERE company_name LIKE ?
        ORDER BY company_name ASC
        LIMIT 10
      `)
      .all(`%${q}%`);

    res.json(clients);
  });

  app.post('/api/clients/upsert', (req, res) => {
    const { company_name, phone, email, website, address } = req.body;

    if (!company_name?.trim()) {
      return res.status(400).json({ error: 'Client company name is required' });
    }

    upsertClientRecord(db, { company_name, phone, email, website, address });

    const client = db
      .prepare('SELECT * FROM clients WHERE company_name = ?')
      .get(company_name.trim());

    res.json(client);
  });

  app.post('/api/clients', (req, res) => {
    const { company_name, phone, email, website, address } = req.body;

    if (!company_name?.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    try {
      const result = db.prepare(`
        INSERT INTO clients (company_name, phone, email, website, address, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(
        company_name.trim(),
        trimOrNull(phone),
        trimOrNull(email),
        trimOrNull(website),
        trimOrNull(address)
      );

      const client = db
        .prepare('SELECT * FROM clients WHERE id = ?')
        .get(result.lastInsertRowid);

      res.status(201).json(client);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return res.status(400).json({ error: 'A company with this name already exists' });
      }
      throw err;
    }
  });

  app.get('/api/clients/:id', (req, res) => {
    const client = db
      .prepare('SELECT * FROM clients WHERE id = ?')
      .get(req.params.id);

    if (!client) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(client);
  });

  app.put('/api/clients/:id', (req, res) => {
    const existing = db
      .prepare('SELECT * FROM clients WHERE id = ?')
      .get(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const { company_name, phone, email, website, address } = req.body;

    if (!company_name?.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    try {
      db.prepare(`
        UPDATE clients
        SET company_name = ?, phone = ?, email = ?, website = ?, address = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        company_name.trim(),
        trimOrNull(phone),
        trimOrNull(email),
        trimOrNull(website),
        trimOrNull(address),
        existing.id
      );

      const client = db
        .prepare('SELECT * FROM clients WHERE id = ?')
        .get(existing.id);

      res.json(client);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return res.status(400).json({ error: 'A company with this name already exists' });
      }
      throw err;
    }
  });

  app.delete('/api/clients/:id', (req, res) => {
    const existing = db
      .prepare('SELECT * FROM clients WHERE id = ?')
      .get(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const invoiceCount = db
      .prepare('SELECT COUNT(*) as count FROM invoices WHERE client_company_name = ?')
      .get(existing.company_name).count;

    if (invoiceCount > 0) {
      return res.status(400).json({
        error: `Cannot delete: ${invoiceCount} invoice(s) use this company`,
      });
    }

    db.prepare('DELETE FROM clients WHERE id = ?').run(existing.id);
    res.status(204).send();
  });
}

module.exports = { registerClientRoutes, upsertClientRecord };
