'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      email        TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'viewer',   -- owner | admin | accountant | viewer
      status       TEXT NOT NULL DEFAULT 'active',   -- active | suspended
      created_by   INTEGER,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      last_login   TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      nipt       TEXT,                 -- NIPT / numër tatimor
      email      TEXT,
      phone      TEXT,
      address    TEXT,
      city       TEXT,
      notes      TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      description TEXT,
      unit       TEXT DEFAULT 'copë',
      unit_price REAL NOT NULL DEFAULT 0,
      vat_rate   REAL NOT NULL DEFAULT 20,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      number     TEXT NOT NULL UNIQUE,
      client_id  INTEGER NOT NULL REFERENCES clients(id),
      issue_date TEXT NOT NULL,
      due_date   TEXT,
      status     TEXT NOT NULL DEFAULT 'draft', -- draft | sent | paid | overdue | cancelled
      notes      TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity    REAL NOT NULL DEFAULT 1,
      unit_price  REAL NOT NULL DEFAULT 0,
      vat_rate    REAL NOT NULL DEFAULT 20
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT NOT NULL,
      category    TEXT,
      supplier    TEXT,
      description TEXT,
      amount      REAL NOT NULL DEFAULT 0,  -- pa TVSH
      vat_rate    REAL NOT NULL DEFAULT 20,
      created_by  INTEGER,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      user_name   TEXT,
      user_role   TEXT,
      action      TEXT NOT NULL,
      entity      TEXT,
      entity_id   INTEGER,
      details     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Default company settings
  const hasCompany = db.prepare("SELECT value FROM settings WHERE key='company'").get();
  if (!hasCompany) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('company', ?)").run(
      JSON.stringify({
        name: 'Biznesi Im SH.P.K.',
        nipt: 'L00000000X',
        address: 'Rr. Myslym Shyri, Tiranë',
        phone: '+355 69 000 0000',
        email: 'info@biznesi.al',
        currency: 'Lek',
        default_vat: 20,
        iban: 'AL00000000000000000000000000'
      })
    );
  }
}

migrate();

module.exports = db;
