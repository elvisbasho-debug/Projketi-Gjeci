'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const csv = require('../csv');
const { requireRole, hashPassword } = require('../auth');
const { encrypt, isSet } = require('../crypto');
const { canAddSubjects, planInfo } = require('../org');

const router = express.Router();
// Të gjitha thirrjet kalojnë pas requireOrg → req.orgId. Bizneset e studiove të tjera nuk shihen kurrë.

// Kurrë mos ktheji fjalëkalimet në tekst — vetëm nëse janë vendosur apo jo.
function shape(s) {
  return {
    id: s.id, name: s.name, nipt: s.nipt, ealbania_user: s.ealbania_user,
    status: s.status, notes: s.notes, created_at: s.created_at,
    has_ealbania_pass: isSet(s.ealbania_pass), has_selfcare_pass: isSet(s.selfcare_pass),
  };
}
const own = (id, orgId) => db.prepare('SELECT * FROM subjects WHERE id = ? AND org_id = ?').get(id, orgId);

router.get('/', requireRole('viewer'), (req, res) => {
  const q = (req.query.q || '').trim();
  const rows = q
    ? db.prepare('SELECT * FROM subjects WHERE org_id=? AND (name LIKE ? OR nipt LIKE ?) ORDER BY name').all(req.orgId, `%${q}%`, `%${q}%`)
    : db.prepare('SELECT * FROM subjects WHERE org_id=? ORDER BY name').all(req.orgId);
  res.json(rows.map(shape));
});

// Përdorimi i planit (sa biznese janë regjistruar nga kufiri)
router.get('/plan', requireRole('viewer'), (req, res) => res.json(planInfo(req.orgId)));

// EKSPORT CSV (pa fjalëkalime — vetëm të dhënat bazë)
router.get('/export', requireRole('viewer'), (req, res) => {
  const rows = db.prepare('SELECT name, nipt, ealbania_user, status FROM subjects WHERE org_id=? ORDER BY name').all(req.orgId);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="subjektet.csv"');
  res.send(csv.build(['Emri', 'NIPT', 'PerdoruesEAlbania', 'Statusi'], rows.map(r => [r.name, r.nipt, r.ealbania_user, r.status])));
});

// IMPORT CSV — kolonat: Emri, NIPT, PerdoruesEAlbania, Statusi (brenda kufirit të planit)
router.post('/import', requireRole('accountant'), (req, res) => {
  const rows = csv.parse(req.body && req.body.csv);
  if (!rows.length) return res.status(400).json({ error: 'CSV bosh' });
  const start = /emri|name/i.test(rows[0][0] || '') ? 1 : 0;
  const ins = db.prepare('INSERT INTO subjects (name, nipt, ealbania_user, status, created_by, org_id) VALUES (?,?,?,?,?,?)');
  let created = 0, skipped = 0, overPlan = 0;
  db.transaction(() => {
    for (const cols of rows.slice(start)) {
      const name = (cols[0] || '').trim();
      if (!name) { skipped++; continue; }
      if (!canAddSubjects(req.orgId, 1).ok) { overPlan++; continue; }
      const status = /joaktiv|inactive/i.test(cols[3] || '') ? 'inactive' : 'active';
      ins.run(name, (cols[1] || '').trim() || null, (cols[2] || '').trim() || null, status, req.user.id, req.orgId);
      created++;
    }
  })();
  audit.log(req.user, 'importoi_subjekte', 'subjects', null, { created, skipped, overPlan });
  res.json({ ok: true, created, skipped, over_plan: overPlan });
});

router.get('/:id', requireRole('viewer'), (req, res) => {
  const s = own(req.params.id, req.orgId);
  if (!s) return res.status(404).json({ error: 'Subjekti nuk u gjet' });
  const records = db.prepare(`
    SELECT r.*, sv.name AS service_name, sv.code AS service_code
    FROM service_records r JOIN services sv ON sv.id = r.service_id
    WHERE r.subject_id = ? ORDER BY sv.sort_order
  `).all(s.id);
  res.json({ ...shape(s), records });
});

router.post('/', requireRole('accountant'), (req, res) => {
  const { name, nipt, ealbania_user, ealbania_pass, selfcare_pass, status, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Emri i subjektit është i detyrueshëm' });
  const can = canAddSubjects(req.orgId, 1);
  if (!can.ok) return res.status(402).json({ error: can.error, code: 'PLAN_LIMIT' });
  const info = db.prepare(`
    INSERT INTO subjects (name, nipt, ealbania_user, ealbania_pass, selfcare_pass, status, notes, created_by, org_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, nipt || null, ealbania_user || null,
    ealbania_pass ? encrypt(ealbania_pass) : null,
    selfcare_pass ? encrypt(selfcare_pass) : null,
    status || 'active', notes || null, req.user.id, req.orgId
  );
  audit.log(req.user, 'krijoi_subjekt', 'subjects', info.lastInsertRowid, { name });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRole('accountant'), (req, res) => {
  const s = own(req.params.id, req.orgId);
  if (!s) return res.status(404).json({ error: 'Subjekti nuk u gjet' });
  const { name, nipt, ealbania_user, ealbania_pass, selfcare_pass, status, notes } = req.body || {};
  db.prepare(`
    UPDATE subjects SET name=?, nipt=?, ealbania_user=?, status=?, notes=?,
      ealbania_pass = CASE WHEN ? = 1 THEN ? ELSE ealbania_pass END,
      selfcare_pass = CASE WHEN ? = 1 THEN ? ELSE selfcare_pass END
    WHERE id=?
  `).run(
    name || s.name, nipt, ealbania_user, status || s.status, notes,
    ealbania_pass ? 1 : 0, ealbania_pass ? encrypt(ealbania_pass) : null,
    selfcare_pass ? 1 : 0, selfcare_pass ? encrypt(selfcare_pass) : null,
    s.id
  );
  audit.log(req.user, 'ndryshoi_subjekt', 'subjects', s.id, { name: name || s.name });
  res.json({ ok: true });
});

/* ---- Llogaritë e portalit të klientit për këtë subjekt ---- */
function ownOr404(req, res) {
  const s = own(req.params.id, req.orgId);
  if (!s) res.status(404).json({ error: 'Subjekti nuk u gjet' });
  return s;
}
router.get('/:id/clients', requireRole('accountant'), (req, res) => {
  const s = ownOr404(req, res); if (!s) return;
  res.json(db.prepare("SELECT id, name, email, status, last_login, created_at FROM users WHERE role='client' AND subject_id=? ORDER BY id").all(s.id));
});

router.post('/:id/clients', requireRole('accountant'), (req, res) => {
  const s = ownOr404(req, res); if (!s) return;
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Plotësoni emrin, email-in dhe fjalëkalimin' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Email i pavlefshëm' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Fjalëkalimi duhet të ketë të paktën 8 karaktere' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Ky email është i zënë' });
  const info = db.prepare("INSERT INTO users (name, email, password_hash, role, created_by, subject_id, org_id) VALUES (?,?,?,'client',?,?,?)")
    .run(name, email, hashPassword(password), req.user.id, s.id, req.orgId);
  audit.log(req.user, 'krijoi_llogari_klienti', 'subjects', s.id, { email });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.post('/:id/clients/:uid/status', requireRole('accountant'), (req, res) => {
  const s = ownOr404(req, res); if (!s) return;
  const u = db.prepare("SELECT id FROM users WHERE id=? AND role='client' AND subject_id=?").get(req.params.uid, s.id);
  if (!u) return res.status(404).json({ error: 'Llogaria nuk u gjet' });
  const status = req.body && req.body.status === 'suspended' ? 'suspended' : 'active';
  db.prepare('UPDATE users SET status=? WHERE id=?').run(status, u.id);
  audit.log(req.user, 'ndryshoi_llogari_klienti', 'subjects', s.id, { status });
  res.json({ ok: true, status });
});

router.delete('/:id/clients/:uid', requireRole('accountant'), (req, res) => {
  const s = ownOr404(req, res); if (!s) return;
  const n = db.prepare("DELETE FROM users WHERE id=? AND role='client' AND subject_id=?").run(req.params.uid, s.id).changes;
  if (!n) return res.status(404).json({ error: 'Llogaria nuk u gjet' });
  audit.log(req.user, 'fshiu_llogari_klienti', 'subjects', s.id, null);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('accountant'), (req, res) => {
  const s = ownOr404(req, res); if (!s) return;
  db.prepare("DELETE FROM users WHERE role='client' AND subject_id = ?").run(s.id); // llogaritë e portalit
  db.prepare('DELETE FROM subjects WHERE id = ?').run(s.id);
  audit.log(req.user, 'fshiu_subjekt', 'subjects', s.id, { name: s.name });
  res.json({ ok: true });
});

module.exports = router;
