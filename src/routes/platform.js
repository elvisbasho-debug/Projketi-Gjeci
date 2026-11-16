'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { hashPassword, requireRole } = require('../auth');
const { getOrg, planInfo } = require('../org');

const router = express.Router();

/*
  PLATFORMA (vetëm owner + adminët)
  ---------------------------------
  - Studiot: krijim, plan, kufi biznesesh, tarifë shtesë, pezullim, "hyr në studio".
  - Planet: çmimet dhe kufijtë.
  - Adminët e platformës: kanë të njëjtat të drejta si owner-i, PËRVEÇ se:
      • nuk e shohin owner-in (as në lista, as në numra, as në regjistër)
      • nuk mund ta pezullojnë, ndryshojnë apo fshijnë owner-in
    Owner-i mund të pezullojë/fshijë çdo admin.
*/
router.use(requireRole('admin'));

/* ---------- Planet ---------- */
router.get('/plans', (req, res) => res.json(db.prepare('SELECT * FROM plans ORDER BY sort_order').all()));

router.put('/plans/:code', (req, res) => {
  const p = db.prepare('SELECT * FROM plans WHERE code=?').get(req.params.code);
  if (!p) return res.status(404).json({ error: 'Plani nuk u gjet' });
  const b = req.body || {};
  const n = (v, d) => (v === '' || v == null || isNaN(Number(v)) ? d : Number(v));
  db.prepare('UPDATE plans SET name=?, max_subjects=?, price_month=?, price_extra=?, ai_credits=? WHERE code=?')
    .run(b.name || p.name, Math.max(1, n(b.max_subjects, p.max_subjects)), Math.max(0, n(b.price_month, p.price_month)),
      Math.max(0, n(b.price_extra, p.price_extra)), Math.max(0, n(b.ai_credits, p.ai_credits)), p.code);
  audit.log(req.user, 'ndryshoi_planin', 'plans', null, { code: p.code });
  res.json({ ok: true });
});

/* ---------- Studiot ---------- */
const orgView = o => ({
  id: o.id, name: o.name, nipt: o.nipt, email: o.email, phone: o.phone, status: o.status, plan_code: o.plan_code,
  max_subjects: o.max_subjects, allow_overage: !!o.allow_overage, trial_ends: o.trial_ends, created_at: o.created_at,
  users: db.prepare("SELECT COUNT(*) c FROM users WHERE org_id=? AND role != 'client'").get(o.id).c,
  plan: planInfo(o),
});

router.get('/orgs', (req, res) => {
  const rows = db.prepare('SELECT id FROM orgs ORDER BY name').all().map(r => orgView(getOrg(r.id)));
  const totals = rows.reduce((t, o) => ({ subjects: t.subjects + o.plan.used, mrr: t.mrr + (o.status === 'active' ? o.plan.monthly_total : 0) }), { subjects: 0, mrr: 0 });
  res.json({ orgs: rows, totals: { orgs: rows.length, subjects: totals.subjects, mrr: Math.round(totals.mrr * 100) / 100 } });
});

function validPlan(code) { return !!db.prepare('SELECT 1 FROM plans WHERE code=?').get(code); }

// Krijo studio + administratorin e saj të parë
router.post('/orgs', (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'Emri i studios është i detyrueshëm' });
  if (!validPlan(b.plan_code)) return res.status(400).json({ error: 'Zgjidhni një plan' });
  if (!b.admin_name || !b.admin_email || !b.admin_password) return res.status(400).json({ error: 'Plotësoni administratorin e studios (emri, email, fjalëkalimi)' });
  if (String(b.admin_password).length < 8) return res.status(400).json({ error: 'Fjalëkalimi duhet të ketë të paktën 8 karaktere' });
  if (db.prepare('SELECT id FROM users WHERE email=?').get(b.admin_email)) return res.status(409).json({ error: 'Email-i i administratorit është i zënë' });
  const credits = db.prepare('SELECT ai_credits FROM plans WHERE code=?').get(b.plan_code).ai_credits;
  const id = db.transaction(() => {
    const o = db.prepare(`INSERT INTO orgs (name, nipt, email, phone, address, plan_code, max_subjects, allow_overage, trial_ends, va_credits, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(String(b.name).trim(), b.nipt || null, b.email || null, b.phone || null, b.address || null, b.plan_code,
      b.max_subjects ? Number(b.max_subjects) : null, b.allow_overage ? 1 : 0, b.trial_ends || null, credits, req.user.id).lastInsertRowid;
    db.prepare("INSERT INTO users (name, email, password_hash, role, created_by, org_id) VALUES (?,?,?,'studio_admin',?,?)")
      .run(b.admin_name, b.admin_email, hashPassword(b.admin_password), req.user.id, o);
    return o;
  })();
  audit.log(req.user, 'krijoi_studio', 'orgs', id, { name: b.name, plan: b.plan_code });
  res.status(201).json({ id });
});

router.put('/orgs/:id', (req, res) => {
  const o = getOrg(req.params.id);
  if (!o) return res.status(404).json({ error: 'Studioja nuk u gjet' });
  const b = req.body || {};
  if (b.plan_code && !validPlan(b.plan_code)) return res.status(400).json({ error: 'Plan i pavlefshëm' });
  const status = b.status === 'suspended' ? 'suspended' : b.status === 'active' ? 'active' : o.status;
  db.prepare(`UPDATE orgs SET name=?, nipt=?, email=?, phone=?, plan_code=?, max_subjects=?, allow_overage=?, status=?, trial_ends=? WHERE id=?`)
    .run(b.name || o.name, b.nipt ?? o.nipt, b.email ?? o.email, b.phone ?? o.phone, b.plan_code || o.plan_code,
      b.max_subjects === '' || b.max_subjects === null ? null : (b.max_subjects != null ? Number(b.max_subjects) : o.max_subjects),
      b.allow_overage != null ? (b.allow_overage ? 1 : 0) : o.allow_overage, status, b.trial_ends ?? o.trial_ends, o.id);
  audit.log(req.user, 'ndryshoi_studion', 'orgs', o.id, { plan: b.plan_code, status });
  res.json({ ok: true });
});

// Hyr në një studio (owner/admin sheh dhe punon si brenda saj); null = dil
router.post('/active-org', (req, res) => {
  const id = req.body && req.body.org_id ? Number(req.body.org_id) : null;
  if (id && !getOrg(id)) return res.status(404).json({ error: 'Studioja nuk u gjet' });
  db.prepare('UPDATE users SET active_org_id=? WHERE id=?').run(id, req.user.id);
  res.json({ ok: true, org_id: id });
});

/* ---------- Adminët e platformës (owner i fshehtë) ---------- */
router.get('/admins', (req, res) => {
  const hide = req.user.role === 'owner' ? '' : "AND role != 'owner'";
  res.json(db.prepare(`SELECT id, name, email, role, status, created_at, last_login FROM users WHERE role IN ('owner','admin') ${hide} ORDER BY id`).all());
});

router.post('/admins', (req, res) => {
  const { name, email, password, role } = req.body || {};
  const r = role || 'admin';
  if (!name || !email || !password) return res.status(400).json({ error: 'Plotësoni emrin, email-in dhe fjalëkalimin' });
  if (!['admin', 'owner'].includes(r)) return res.status(400).json({ error: 'Rol i pavlefshëm' });
  if (r === 'owner' && req.user.role !== 'owner') return res.status(403).json({ error: 'Nuk keni të drejta të mjaftueshme' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Fjalëkalimi duhet të ketë të paktën 8 karaktere' });
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).json({ error: 'Ky email është i zënë' });
  const info = db.prepare('INSERT INTO users (name, email, password_hash, role, created_by) VALUES (?,?,?,?,?)').run(name, email, hashPassword(password), r, req.user.id);
  audit.log(req.user, 'krijoi_admin', 'users', info.lastInsertRowid, { email, role: r });
  res.status(201).json({ id: info.lastInsertRowid });
});

// Ngarkon një admin/owner duke respektuar owner-in e fshehtë
function loadAdmin(req, res) {
  const t = db.prepare("SELECT * FROM users WHERE id=? AND role IN ('owner','admin')").get(req.params.id);
  if (!t || (t.role === 'owner' && req.user.role !== 'owner')) {
    if (t) audit.log(req.user, 'tentoi_akses_owner', 'users', t.id, 'u refuzua (owner i fshehtë)');
    res.status(404).json({ error: 'Përdoruesi nuk ekziston' }); return null;
  }
  if (t.id === req.user.id) { res.status(400).json({ error: 'Nuk mund ta bëni këtë veprim mbi veten' }); return null; }
  return t;
}

router.post('/admins/:id/status', (req, res) => {
  const t = loadAdmin(req, res); if (!t) return;
  const status = req.body && req.body.status === 'suspended' ? 'suspended' : 'active';
  db.prepare('UPDATE users SET status=? WHERE id=?').run(status, t.id);
  audit.log(req.user, status === 'suspended' ? 'pezulloi_admin' : 'riaktivizoi_admin', 'users', t.id, { email: t.email });
  res.json({ ok: true, status });
});

router.delete('/admins/:id', (req, res) => {
  const t = loadAdmin(req, res); if (!t) return;
  if (t.role === 'owner' && db.prepare("SELECT COUNT(*) c FROM users WHERE role='owner'").get().c <= 1) return res.status(400).json({ error: 'Nuk mund të fshihet owner-i i fundit' });
  db.prepare('DELETE FROM users WHERE id=?').run(t.id);
  audit.log(req.user, 'fshiu_admin', 'users', t.id, { email: t.email });
  res.json({ ok: true });
});

module.exports = router;
