'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { requireRole } = require('../auth');

const router = express.Router();

router.get('/', requireRole('viewer'), (req, res) => {
  const rows = db.prepare('SELECT * FROM expenses ORDER BY date DESC, id DESC').all().map(r => ({
    ...r,
    vat_amount: Math.round((r.amount * r.vat_rate / 100 + Number.EPSILON) * 100) / 100,
    total: Math.round((r.amount * (1 + r.vat_rate / 100) + Number.EPSILON) * 100) / 100,
  }));
  res.json(rows);
});

router.post('/', requireRole('accountant'), (req, res) => {
  const { date, category, supplier, description, amount, vat_rate } = req.body || {};
  if (!amount) return res.status(400).json({ error: 'Vlera është e detyrueshme' });
  const info = db.prepare(`
    INSERT INTO expenses (date, category, supplier, description, amount, vat_rate, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    date || new Date().toISOString().slice(0, 10),
    category || null, supplier || null, description || null,
    Number(amount) || 0, Number(vat_rate) ?? 20, req.user.id
  );
  audit.log(req.user, 'krijoi_shpenzim', 'expenses', info.lastInsertRowid, { amount });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRole('accountant'), (req, res) => {
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Shpenzimi nuk u gjet' });
  const { date, category, supplier, description, amount, vat_rate } = req.body || {};
  db.prepare(`
    UPDATE expenses SET date=?, category=?, supplier=?, description=?, amount=?, vat_rate=? WHERE id=?
  `).run(date || row.date, category, supplier, description, Number(amount) || 0, Number(vat_rate) ?? 20, row.id);
  audit.log(req.user, 'ndryshoi_shpenzim', 'expenses', row.id, null);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('accountant'), (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  audit.log(req.user, 'fshiu_shpenzim', 'expenses', Number(req.params.id), null);
  res.json({ ok: true });
});

module.exports = router;
