'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { hashPassword, requireRole, ROLE_LEVEL } = require('../auth');

const router = express.Router();

/*
  LOGJIKA E OWNER-IT TË FSHEHTË
  --------------------------------
  - Roli "owner" është i padukshëm për këdo që NUK është owner.
    Admin-i (dhe rolet më poshtë) nuk e shohin owner-in në listën e
    përdoruesve, nuk e numërojnë dot, dhe nuk mund ta prekin.
  - Vetëm owner-i mund të krijojë/pezullojë/fshijë një admin ("abuzim besimi").
  - Admin-i mund të menaxhojë vetëm role <= admin, dhe asnjëherë një owner.
*/

// A mund ta shohë kërkuesi këtë rol?
function canSee(requester, targetRole) {
  if (requester.role === 'owner') return true;
  return targetRole !== 'owner'; // të tjerët nuk e shohin kurrë owner-in
}

// A mund ta menaxhojë (krijojë/ndryshojë/fshijë) kërkuesi një përdorues me këtë rol?
function canManageRole(requester, targetRole) {
  if (requester.role === 'owner') return true;
  if (requester.role === 'admin') {
    // Admin menaxhon vetëm role nën vete; owner-i as nuk ekziston për të.
    return ROLE_LEVEL[targetRole] < ROLE_LEVEL['admin'] || targetRole === 'admin';
  }
  return false;
}

// LISTO përdoruesit (fshihen owner-ët nëse kërkuesi s'është owner)
router.get('/', requireRole('admin'), (req, res) => {
  let rows;
  if (req.user.role === 'owner') {
    rows = db.prepare(`SELECT id, name, email, role, status, created_at, last_login FROM users ORDER BY id`).all();
  } else {
    // Owner-ët nuk përfshihen KURRË — as në listë, as në numër.
    rows = db.prepare(`SELECT id, name, email, role, status, created_at, last_login FROM users WHERE role != 'owner' ORDER BY id`).all();
  }
  res.json(rows);
});

// KRIJO përdorues të ri
router.post('/', requireRole('admin'), (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Plotësoni emrin, email-in, fjalëkalimin dhe rolin' });
  }
  if (!ROLE_LEVEL[role]) return res.status(400).json({ error: 'Rol i pavlefshëm' });

  // Vetëm owner-i mund të krijojë një owner tjetër.
  if (role === 'owner' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Nuk keni të drejta të mjaftueshme' });
  }
  if (!canManageRole(req.user, role)) {
    return res.status(403).json({ error: 'Nuk mund të krijoni përdorues me këtë rol' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Ky email është i zënë' });

  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, email, hashPassword(password), role, req.user.id);

  audit.log(req.user, 'krijoi_perdorues', 'users', info.lastInsertRowid, { email, role });
  res.status(201).json({ id: info.lastInsertRowid });
});

// Ndihmës: merr përdoruesin target dhe kontrollo dukshmërinë/të drejtat
function loadTarget(req, res) {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) { res.status(404).json({ error: 'Përdoruesi nuk ekziston' }); return null; }
  // Nëse kërkuesi s'duhet ta shohë këtë përdorues (owner i fshehtë), bëj sikur s'ekziston.
  if (!canSee(req.user, target.role)) {
    audit.log(req.user, 'tentoi_akses_owner', 'users', target.id, 'u refuzua (owner i fshehtë)');
    res.status(404).json({ error: 'Përdoruesi nuk ekziston' });
    return null;
  }
  return target;
}

// NDRYSHO përdorues (emër/email/rol/fjalëkalim)
router.put('/:id', requireRole('admin'), (req, res) => {
  const target = loadTarget(req, res);
  if (!target) return;

  if (!canManageRole(req.user, target.role)) {
    return res.status(403).json({ error: 'Nuk mund ta ndryshoni këtë përdorues' });
  }

  const { name, email, password, role } = req.body || {};
  const newRole = role || target.role;

  // Promovim në owner → vetëm owner-i.
  if (newRole === 'owner' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Nuk keni të drejta të mjaftueshme' });
  }
  if (newRole !== target.role && !canManageRole(req.user, newRole)) {
    return res.status(403).json({ error: 'Nuk mund të caktoni këtë rol' });
  }

  db.prepare(`
    UPDATE users SET name = ?, email = ?, role = ?,
      password_hash = CASE WHEN ? <> '' THEN ? ELSE password_hash END
    WHERE id = ?
  `).run(
    name || target.name,
    email || target.email,
    newRole,
    password || '',
    password ? hashPassword(password) : '',
    target.id
  );

  audit.log(req.user, 'ndryshoi_perdorues', 'users', target.id, { role: newRole });
  res.json({ ok: true });
});

// PEZULLO / RIAKTIVIZO (p.sh. owner-i pezullon admin-in në rast abuzimi)
router.post('/:id/status', requireRole('admin'), (req, res) => {
  const target = loadTarget(req, res);
  if (!target) return;
  if (!canManageRole(req.user, target.role)) {
    return res.status(403).json({ error: 'Nuk mund ta ndryshoni këtë përdorues' });
  }
  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'Nuk mund të pezulloni veten' });
  }
  const status = req.body && req.body.status === 'suspended' ? 'suspended' : 'active';
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, target.id);
  audit.log(req.user, status === 'suspended' ? 'pezulloi_perdorues' : 'riaktivizoi_perdorues', 'users', target.id, { email: target.email });
  res.json({ ok: true, status });
});

// FSHI përdorues (owner-i mund të nxjerrë jashtë admin-in)
router.delete('/:id', requireRole('admin'), (req, res) => {
  const target = loadTarget(req, res);
  if (!target) return;
  if (!canManageRole(req.user, target.role)) {
    return res.status(403).json({ error: 'Nuk mund ta fshini këtë përdorues' });
  }
  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'Nuk mund të fshini veten' });
  }
  // Mos lejo fshirjen e owner-it të fundit.
  if (target.role === 'owner') {
    const owners = db.prepare("SELECT COUNT(*) c FROM users WHERE role='owner'").get().c;
    if (owners <= 1) return res.status(400).json({ error: 'Nuk mund të fshihet owner-i i fundit' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  audit.log(req.user, 'fshiu_perdorues', 'users', target.id, { email: target.email, role: target.role });
  res.json({ ok: true });
});

module.exports = router;
