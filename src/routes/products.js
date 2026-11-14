'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { requireRole } = require('../auth');

const router = express.Router();

router.get('/', requireRole('viewer'), (req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY name').all());
});

router.post('/', requireRole('accountant'), (req, res) => {
  const { name, description, unit, unit_price, vat_rate } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Emri është i detyrueshëm' });
  const info = db.prepare(`
    INSERT INTO products (name, description, unit, unit_price, vat_rate, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, description || null, unit || 'copë', Number(unit_price) || 0, Number(vat_rate) ?? 20, req.user.id);
  audit.log(req.user, 'krijoi_produkt', 'products', info.lastInsertRowid, { name });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRole('accountant'), (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Produkti nuk u gjet' });
  const { name, description, unit, unit_price, vat_rate } = req.body || {};
  db.prepare(`
    UPDATE products SET name=?, description=?, unit=?, unit_price=?, vat_rate=? WHERE id=?
  `).run(name || row.name, description, unit || row.unit, Number(unit_price) || 0, Number(vat_rate) || 0, row.id);
  audit.log(req.user, 'ndryshoi_produkt', 'products', row.id, null);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('accountant'), (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  audit.log(req.user, 'fshiu_produkt', 'products', Number(req.params.id), null);
  res.json({ ok: true });
});

module.exports = router;
