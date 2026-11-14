'use strict';

const express = require('express');
const db = require('../db');
const { requireRole } = require('../auth');

const router = express.Router();

router.get('/', requireRole('viewer'), (req, res) => {
  res.json(db.prepare('SELECT * FROM tickets ORDER BY updated_at DESC').all());
});

router.get('/:id', requireRole('viewer'), (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Bileta nuk u gjet' });
  const messages = db.prepare('SELECT * FROM ticket_messages WHERE ticket_id=? ORDER BY id').all(t.id);
  res.json({ ...t, messages });
});

router.post('/', requireRole('viewer'), (req, res) => {
  const { subject, body } = req.body || {};
  if (!subject) return res.status(400).json({ error: 'Titulli është i detyrueshëm' });
  const info = db.prepare('INSERT INTO tickets (subject, created_by, creator_name) VALUES (?,?,?)').run(subject, req.user.id, req.user.name);
  if (body) db.prepare('INSERT INTO ticket_messages (ticket_id, author, body) VALUES (?,?,?)').run(info.lastInsertRowid, req.user.name, body);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.post('/:id/messages', requireRole('viewer'), (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Bileta nuk u gjet' });
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'Mesazhi është bosh' });
  db.prepare('INSERT INTO ticket_messages (ticket_id, author, body) VALUES (?,?,?)').run(t.id, req.user.name, body);
  db.prepare("UPDATE tickets SET updated_at=datetime('now') WHERE id=?").run(t.id);
  res.json({ ok: true });
});

router.post('/:id/status', requireRole('accountant'), (req, res) => {
  const allowed = ['hapur', 'ne_proces', 'mbyllur'];
  const status = allowed.includes(req.body.status) ? req.body.status : 'hapur';
  db.prepare("UPDATE tickets SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
  res.json({ ok: true, status });
});

module.exports = router;
