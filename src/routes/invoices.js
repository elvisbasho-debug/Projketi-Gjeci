'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { requireRole } = require('../auth');

const router = express.Router();

// Llogarit totalet e një fature nga artikujt e saj.
function computeTotals(items) {
  let subtotal = 0, vat = 0;
  for (const it of items) {
    const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    subtotal += line;
    vat += line * ((Number(it.vat_rate) || 0) / 100);
  }
  return {
    subtotal: round2(subtotal),
    vat: round2(vat),
    total: round2(subtotal + vat),
  };
}
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// Gjeneron numrin pasues të faturës, p.sh. FAT-2026-0001
function nextNumber() {
  const year = new Date().getFullYear();
  const prefix = `FAT-${year}-`;
  const last = db.prepare(
    "SELECT number FROM invoices WHERE number LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`${prefix}%`);
  let n = 1;
  if (last) {
    const m = last.number.match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return prefix + String(n).padStart(4, '0');
}

// Shëno automatikisht fatura të vonuara
function markOverdue() {
  db.prepare(`
    UPDATE invoices SET status='overdue'
    WHERE status='sent' AND due_date IS NOT NULL AND due_date < date('now')
  `).run();
}

// LISTO fatura me totale + emër klienti
router.get('/', requireRole('viewer'), (req, res) => {
  markOverdue();
  const status = req.query.status;
  let sql = `
    SELECT inv.*, c.name AS client_name,
      (SELECT COALESCE(SUM(quantity*unit_price),0) FROM invoice_items WHERE invoice_id=inv.id) AS subtotal,
      (SELECT COALESCE(SUM(quantity*unit_price*vat_rate/100),0) FROM invoice_items WHERE invoice_id=inv.id) AS vat
    FROM invoices inv JOIN clients c ON c.id = inv.client_id
  `;
  const args = [];
  if (status) { sql += ' WHERE inv.status = ?'; args.push(status); }
  sql += ' ORDER BY inv.id DESC';
  const rows = db.prepare(sql).all(...args).map(r => ({
    ...r, subtotal: round2(r.subtotal), vat: round2(r.vat), total: round2(r.subtotal + r.vat),
  }));
  res.json(rows);
});

// NJË faturë me artikujt
router.get('/:id', requireRole('viewer'), (req, res) => {
  const inv = db.prepare(`
    SELECT inv.*, c.name AS client_name, c.nipt AS client_nipt, c.address AS client_address, c.city AS client_city, c.email AS client_email
    FROM invoices inv JOIN clients c ON c.id = inv.client_id WHERE inv.id = ?
  `).get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Fatura nuk u gjet' });
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id);
  res.json({ ...inv, items, totals: computeTotals(items) });
});

// KRIJO faturë
router.post('/', requireRole('accountant'), (req, res) => {
  const { client_id, issue_date, due_date, status, notes, items } = req.body || {};
  if (!client_id) return res.status(400).json({ error: 'Zgjidhni klientin' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Shtoni të paktën një artikull' });

  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(client_id);
  if (!client) return res.status(400).json({ error: 'Klient i pavlefshëm' });

  const number = nextNumber();
  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO invoices (number, client_id, issue_date, due_date, status, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      number, client_id,
      issue_date || new Date().toISOString().slice(0, 10),
      due_date || null,
      status || 'draft',
      notes || null,
      req.user.id
    );
    const invId = info.lastInsertRowid;
    const ins = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, vat_rate)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const it of items) {
      ins.run(invId, it.description || '', Number(it.quantity) || 0, Number(it.unit_price) || 0, Number(it.vat_rate) ?? 20);
    }
    return invId;
  });
  const id = tx();
  audit.log(req.user, 'krijoi_fature', 'invoices', id, { number });
  res.status(201).json({ id, number });
});

// NDRYSHO faturë (dhe artikujt)
router.put('/:id', requireRole('accountant'), (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Fatura nuk u gjet' });
  const { client_id, issue_date, due_date, status, notes, items } = req.body || {};

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE invoices SET client_id=?, issue_date=?, due_date=?, status=?, notes=? WHERE id=?
    `).run(
      client_id || inv.client_id,
      issue_date || inv.issue_date,
      due_date || inv.due_date,
      status || inv.status,
      notes ?? inv.notes,
      inv.id
    );
    if (Array.isArray(items)) {
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(inv.id);
      const ins = db.prepare(`INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, vat_rate) VALUES (?, ?, ?, ?, ?)`);
      for (const it of items) {
        ins.run(inv.id, it.description || '', Number(it.quantity) || 0, Number(it.unit_price) || 0, Number(it.vat_rate) ?? 20);
      }
    }
  });
  tx();
  audit.log(req.user, 'ndryshoi_fature', 'invoices', inv.id, { number: inv.number });
  res.json({ ok: true });
});

// Ndrysho vetëm statusin (p.sh. shëno si e paguar)
router.post('/:id/status', requireRole('accountant'), (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Fatura nuk u gjet' });
  const allowed = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
  const status = allowed.includes(req.body.status) ? req.body.status : inv.status;
  db.prepare('UPDATE invoices SET status=? WHERE id=?').run(status, inv.id);
  audit.log(req.user, 'ndryshoi_status_fature', 'invoices', inv.id, { number: inv.number, status });
  res.json({ ok: true, status });
});

router.delete('/:id', requireRole('accountant'), (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Fatura nuk u gjet' });
  db.prepare('DELETE FROM invoices WHERE id = ?').run(inv.id);
  audit.log(req.user, 'fshiu_fature', 'invoices', inv.id, { number: inv.number });
  res.json({ ok: true });
});

module.exports = router;
