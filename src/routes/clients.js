'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { requireRole } = require('../auth');

const router = express.Router();

router.get('/', requireRole('viewer'), (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(`SELECT * FROM clients WHERE name LIKE ? OR nipt LIKE ? OR email LIKE ? ORDER BY name`).all(like, like, like);
  } else {
    rows = db.prepare('SELECT * FROM clients ORDER BY name').all();
  }
  res.json(rows);
});

router.get('/:id', requireRole('viewer'), (req, res) => {
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Klienti nuk u gjet' });
  res.json(row);
});

router.post('/', requireRole('accountant'), (req, res) => {
  const { name, nipt, email, phone, address, city, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Emri është i detyrueshëm' });
  const info = db.prepare(`
    INSERT INTO clients (name, nipt, email, phone, address, city, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, nipt || null, email || null, phone || null, address || null, city || null, notes || null, req.user.id);
  audit.log(req.user, 'krijoi_klient', 'clients', info.lastInsertRowid, { name });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRole('accountant'), (req, res) => {
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Klienti nuk u gjet' });
  const { name, nipt, email, phone, address, city, notes } = req.body || {};
  db.prepare(`
    UPDATE clients SET name=?, nipt=?, email=?, phone=?, address=?, city=?, notes=? WHERE id=?
  `).run(name || row.name, nipt, email, phone, address, city, notes, row.id);
  audit.log(req.user, 'ndryshoi_klient', 'clients', row.id, { name: name || row.name });
  res.json({ ok: true });
});

router.delete('/:id', requireRole('accountant'), (req, res) => {
  const used = db.prepare('SELECT COUNT(*) c FROM invoices WHERE client_id = ?').get(req.params.id).c;
  if (used > 0) return res.status(400).json({ error: 'Klienti ka fatura — nuk fshihet dot' });
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  audit.log(req.user, 'fshiu_klient', 'clients', Number(req.params.id), null);
  res.json({ ok: true });
});

module.exports = router;
