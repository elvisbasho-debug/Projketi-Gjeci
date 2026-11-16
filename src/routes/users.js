'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { hashPassword, requireRole } = require('../auth');

const router = express.Router();

/*
  PËRDORUESIT E STUDIOS (pas requireOrg)
  -------------------------------------
  Administratori i studios (dhe owner/adminët e platformës kur janë brenda studios)
  menaxhojnë përdoruesit e studios: studio_admin, accountant, viewer.
  Owner-i dhe adminët e platformës menaxhohen te /api/platform/admins.
  Llogaritë e portalit (client) menaxhohen te faqja e subjektit.
*/
const STUDIO_ROLES = ['studio_admin', 'accountant', 'viewer'];
const target = (req) => db.prepare(`SELECT * FROM users WHERE id=? AND org_id=? AND role IN ('studio_admin','accountant','viewer')`).get(req.params.id, req.orgId);

router.get('/', requireRole('studio_admin'), (req, res) => {
  res.json(db.prepare(`SELECT id, name, email, role, status, created_at, last_login FROM users
    WHERE org_id=? AND role IN ('studio_admin','accountant','viewer') ORDER BY id`).all(req.orgId));
});

router.post('/', requireRole('studio_admin'), (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Plotësoni emrin, email-in, fjalëkalimin dhe rolin' });
  if (!STUDIO_ROLES.includes(role)) return res.status(400).json({ error: 'Rol i pavlefshëm për studion' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Fjalëkalimi duhet të ketë të paktën 8 karaktere' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Ky email është i zënë' });
  const info = db.prepare('INSERT INTO users (name, email, password_hash, role, created_by, org_id) VALUES (?,?,?,?,?,?)')
    .run(name, email, hashPassword(password), role, req.user.id, req.orgId);
  audit.log(req.user, 'krijoi_perdorues', 'users', info.lastInsertRowid, { email, role });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRole('studio_admin'), (req, res) => {
  const t = target(req);
  if (!t) return res.status(404).json({ error: 'Përdoruesi nuk ekziston' });
  const { name, email, password, role } = req.body || {};
  const newRole = role || t.role;
  if (!STUDIO_ROLES.includes(newRole)) return res.status(400).json({ error: 'Rol i pavlefshëm për studion' });
  if (email && email !== t.email && db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).json({ error: 'Ky email është i zënë' });
  db.prepare(`UPDATE users SET name=?, email=?, role=?, password_hash = CASE WHEN ? <> '' THEN ? ELSE password_hash END WHERE id=?`)
    .run(name || t.name, email || t.email, newRole, password || '', password ? hashPassword(password) : '', t.id);
  audit.log(req.user, 'ndryshoi_perdorues', 'users', t.id, { role: newRole });
  res.json({ ok: true });
});

router.post('/:id/status', requireRole('studio_admin'), (req, res) => {
  const t = target(req);
  if (!t) return res.status(404).json({ error: 'Përdoruesi nuk ekziston' });
  if (t.id === req.user.id) return res.status(400).json({ error: 'Nuk mund të pezulloni veten' });
  const status = req.body && req.body.status === 'suspended' ? 'suspended' : 'active';
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, t.id);
  audit.log(req.user, status === 'suspended' ? 'pezulloi_perdorues' : 'riaktivizoi_perdorues', 'users', t.id, { email: t.email });
  res.json({ ok: true, status });
});

router.delete('/:id', requireRole('studio_admin'), (req, res) => {
  const t = target(req);
  if (!t) return res.status(404).json({ error: 'Përdoruesi nuk ekziston' });
  if (t.id === req.user.id) return res.status(400).json({ error: 'Nuk mund të fshini veten' });
  db.prepare('DELETE FROM users WHERE id = ?').run(t.id);
  audit.log(req.user, 'fshiu_perdorues', 'users', t.id, { email: t.email, role: t.role });
  res.json({ ok: true });
});

module.exports = router;
