'use strict';

const express = require('express');
const db = require('../db');
const { requireRole } = require('../auth');
const { isPlatform, orgIdOf } = require('../org');

const router = express.Router();
/*
  Biletat e mbështetjes: studioja i hap drejt platformës.
  - Përdoruesit e studios shohin vetëm biletat e studios së vet.
  - Owner/adminët e platformës shohin të gjitha (me emrin e studios) dhe u përgjigjen.
*/
const scope = req => isPlatform(req.user) ? { where: '1=1', args: [] } : { where: 't.org_id = ?', args: [orgIdOf(req.user)] };
const find = (req, id) => { const s = scope(req); return db.prepare(`SELECT t.* FROM tickets t WHERE t.id=? AND ${s.where}`).get(id, ...s.args); };

router.get('/', requireRole('viewer'), (req, res) => {
  const s = scope(req);
  res.json(db.prepare(`SELECT t.*, o.name AS org_name FROM tickets t LEFT JOIN orgs o ON o.id=t.org_id WHERE ${s.where} ORDER BY t.updated_at DESC`).all(...s.args));
});

router.get('/:id', requireRole('viewer'), (req, res) => {
  const t = find(req, req.params.id);
  if (!t) return res.status(404).json({ error: 'Bileta nuk u gjet' });
  const messages = db.prepare('SELECT * FROM ticket_messages WHERE ticket_id=? ORDER BY id').all(t.id);
  res.json({ ...t, messages });
});

router.post('/', requireRole('viewer'), (req, res) => {
  const { subject, body } = req.body || {};
  if (!subject) return res.status(400).json({ error: 'Titulli është i detyrueshëm' });
  const orgId = orgIdOf(req.user);
  if (!orgId) return res.status(400).json({ error: 'Zgjidhni një studio' });
  const info = db.prepare('INSERT INTO tickets (subject, created_by, creator_name, org_id) VALUES (?,?,?,?)').run(subject, req.user.id, req.user.name, orgId);
  if (body) db.prepare('INSERT INTO ticket_messages (ticket_id, author, body) VALUES (?,?,?)').run(info.lastInsertRowid, req.user.name, body);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.post('/:id/messages', requireRole('viewer'), (req, res) => {
  const t = find(req, req.params.id);
  if (!t) return res.status(404).json({ error: 'Bileta nuk u gjet' });
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'Mesazhi është bosh' });
  const author = isPlatform(req.user) ? 'Mbështetja Finbot' : req.user.name;
  db.prepare('INSERT INTO ticket_messages (ticket_id, author, body) VALUES (?,?,?)').run(t.id, author, body);
  db.prepare("UPDATE tickets SET updated_at=datetime('now') WHERE id=?").run(t.id);
  res.json({ ok: true });
});

router.post('/:id/status', requireRole('accountant'), (req, res) => {
  const t = find(req, req.params.id);
  if (!t) return res.status(404).json({ error: 'Bileta nuk u gjet' });
  const allowed = ['hapur', 'ne_proces', 'mbyllur'];
  const status = allowed.includes(req.body.status) ? req.body.status : 'hapur';
  db.prepare("UPDATE tickets SET status=?, updated_at=datetime('now') WHERE id=?").run(status, t.id);
  res.json({ ok: true, status });
});

module.exports = router;
