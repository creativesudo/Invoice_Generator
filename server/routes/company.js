const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { UPLOADS_DIR, normalizeCurrencyText } = require('../db');
const { validateCurrencyText } = require('../db/currencies');

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `logo${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, and WebP images are allowed'));
    }
  },
});

function registerCompanyRoutes(app, db) {
  app.get('/api/company', (_req, res) => {
    const company = db.prepare('SELECT * FROM company_profile WHERE id = 1').get();
    res.json(company);
  });

  app.put('/api/company', (req, res) => {
    const { company_name, phone, email, website, address, currency_text } = req.body;

    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const currencyError = validateCurrencyText(currency_text);
    if (currencyError) {
      return res.status(400).json({ error: currencyError });
    }

    db.prepare(`
      UPDATE company_profile
      SET company_name = ?, phone = ?, email = ?, website = ?, address = ?,
          currency_text = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(
      company_name.trim(),
      phone || null,
      email || null,
      website || null,
      address || null,
      normalizeCurrencyText(currency_text)
    );

    const company = db.prepare('SELECT * FROM company_profile WHERE id = 1').get();
    res.json(company);
  });

  app.post('/api/company/logo', upload.single('logo'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Logo file is required' });
    }

    const logoPath = req.file.path;
    db.prepare(`
      UPDATE company_profile SET logo_path = ?, updated_at = datetime('now') WHERE id = 1
    `).run(logoPath);

    const company = db.prepare('SELECT * FROM company_profile WHERE id = 1').get();
    res.json(company);
  });

  app.get('/api/company/logo', (_req, res) => {
    const company = db.prepare('SELECT logo_path FROM company_profile WHERE id = 1').get();
    if (!company?.logo_path || !fs.existsSync(company.logo_path)) {
      return res.status(404).json({ error: 'Logo not found' });
    }
    res.sendFile(path.resolve(company.logo_path));
  });
}

module.exports = { registerCompanyRoutes };
