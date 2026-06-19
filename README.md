# Invoice Generator

A simple local-only invoice generator for personal use. No login required.

## Features

- Save your company profile and logo
- Store client info for future prepopulation
- Guided invoice wizard with line items (each with its own heading)
- Receivable, Received, and Amount Due on invoices
- Generate and save PDF invoices
- SQLite database for all data

## Setup

```bash
npm install
cd client && npm install
cd ../server && npm install
cd ..
npm run dev
```

Open http://localhost:5173 in your browser.

## Usage

1. **Settings** — Configure your company name, contact info, address, and logo
2. **New Invoice** — Follow the guided wizard to create an invoice
3. **History** — View past invoices and download PDFs

Data is stored locally in the `data/` folder (SQLite DB, logos, PDFs).

## Tech Stack

- React + Vite (frontend)
- Express + SQLite (backend)
- pdfkit (PDF generation)
