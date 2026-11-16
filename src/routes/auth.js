'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { verifyPassword, signToken, requireAuth, hashPassword } = require('../auth');
const { isPlatform, orgIdOf, getOrg, planInfo } = require('../org');

const router = express.Router();

// HYRJE
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email dhe fjalëkalim të detyrueshëm' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email ose fjalëkalim i gabuar' });
  }
  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'Llogaria juaj është pezulluar. Kontaktoni administratorin.' });
  }
  if (user.org_id && !['owner', 'admin'].includes(user.role)) {
    const org = db.prepare('SELECT status FROM orgs WHERE id=?').get(user.org_id);
    if (!org || org.status !== 'active') return res.status(403).json({ error: 'Studioja juaj është e pezulluar. Kontaktoni administratorin e platformës.' });
  }

  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
  audit.log(user, 'hyri', 'auth', user.id, null);

  const token = signToken(user);
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// DALJE
router.post('/logout', requireAuth, (req, res) => {
  audit.log(req.user, 'doli', 'auth', req.user.id, null);
  res.clearCookie('token');
  res.json({ ok: true });
});

// Kush jam unë
router.get('/me', requireAuth, (req, res) => {
  const platform = isPlatform(req.user);
  const orgId = orgIdOf(req.user);
  const o = orgId ? getOrg(orgId) : null;
  res.json({
    user: req.user, platform,
    org: o ? { id: o.id, name: o.name, status: o.status, plan: planInfo(o) } : null,
  });
});

// Ndrysho fjalëkalimin tim
router.post('/change-password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  if (!current || !next) return res.status(400).json({ error: 'Plotësoni të dyja fushat' });
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(current, row.password_hash)) {
    return res.status(400).json({ error: 'Fjalëkalimi aktual është i gabuar' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), req.user.id);
  audit.log(req.user, 'ndryshoi_fjalekalimin', 'auth', req.user.id, null);
  res.json({ ok: true });
});

module.exports = router;
