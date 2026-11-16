'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { requireRole, hashPassword } = require('../auth');
const { encrypt, isSet } = require('../crypto');

const router = express.Router();

// Kurrë mos ktheji fjalëkalimet në tekst — vetëm nëse janë vendosur apo jo.
function shape(s) {
  return {
    id: s.id, name: s.name, nipt: s.nipt, ealbania_user: s.ealbania_user,
    status: s.status, notes: s.notes, created_at: s.created_at,
    has_ealbania_pass: isSet(s.ealbania_pass), has_selfcare_pass: isSet(s.selfcare_pass),
  };
}

router.get('/', requireRole('viewer'), (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare('SELECT * FROM subjects WHERE name LIKE ? OR nipt LIKE ? ORDER BY name').all(like, like);
  } else {
    rows = db.prepare('SELECT * FROM subjects ORDER BY name').all();
  }
  res.json(rows.map(shape));
});

// EKSPORT CSV (pa fjalëkalime — vetëm të dhënat bazë)
router.get('/export', requireRole('viewer'), (req, res) => {
  const rows = db.prepare('SELECT name, nipt, ealbania_user, status FROM subjects ORDER BY name').all();
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const header = 'Emri,NIPT,PerdoruesEAlbania,Statusi';
  const body = rows.map(r => [r.name, r.nipt, r.ealbania_user, r.status].map(esc).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="subjektet.csv"');
  res.send('﻿' + header + '\n' + body);
});

// IMPORT CSV — kolonat: Emri, NIPT, PerdoruesEAlbania, Statusi
router.post('/import', requireRole('accountant'), (req, res) => {
  const text = (req.body && req.body.csv) || '';
  if (!text.trim()) return res.status(400).json({ error: 'CSV bosh' });
  // Parser i thjeshtë CSV (mbështet thonjëza dhe presje brenda tyre)
  const parseLine = line => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
    }
    out.push(cur); return out;
  };
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  let start = 0;
  if (lines[0] && /emri/i.test(lines[0])) start = 1; // kapërce header-in
  const ins = db.prepare('INSERT INTO subjects (name, nipt, ealbania_user, status, created_by) VALUES (?,?,?,?,?)');
  let created = 0, skipped = 0;
  const tx = db.transaction(() => {
    for (let i = start; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      const name = (cols[0] || '').trim();
      if (!name) { skipped++; continue; }
      const nipt = (cols[1] || '').trim() || null;
      const euser = (cols[2] || '').trim() || null;
      const status = /joaktiv|inactive/i.test(cols[3] || '') ? 'inactive' : 'active';
      ins.run(name, nipt, euser, status, req.user.id);
      created++;
    }
  });
  tx();
  audit.log(req.user, 'importoi_subjekte', 'subjects', null, { created, skipped });
  res.json({ ok: true, created, skipped });
});

router.get('/:id', requireRole('viewer'), (req, res) => {
  const s = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Subjekti nuk u gjet' });
  // rekordet për këtë subjekt
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
  const info = db.prepare(`
    INSERT INTO subjects (name, nipt, ealbania_user, ealbania_pass, selfcare_pass, status, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, nipt || null, ealbania_user || null,
    ealbania_pass ? encrypt(ealbania_pass) : null,
    selfcare_pass ? encrypt(selfcare_pass) : null,
    status || 'active', notes || null, req.user.id
  );
  audit.log(req.user, 'krijoi_subjekt', 'subjects', info.lastInsertRowid, { name });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRole('accountant'), (req, res) => {
  const s = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
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
router.get('/:id/clients', requireRole('accountant'), (req, res) => {
  res.json(db.prepare("SELECT id, name, email, status, last_login, created_at FROM users WHERE role='client' AND subject_id=? ORDER BY id").all(req.params.id));
});

router.post('/:id/clients', requireRole('accountant'), (req, res) => {
  const s = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Subjekti nuk u gjet' });
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Plotësoni emrin, email-in dhe fjalëkalimin' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Email i pavlefshëm' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Fjalëkalimi duhet të ketë të paktën 8 karaktere' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Ky email është i zënë' });
  const info = db.prepare("INSERT INTO users (name, email, password_hash, role, created_by, subject_id) VALUES (?,?,?,'client',?,?)")
    .run(name, email, hashPassword(password), req.user.id, s.id);
  audit.log(req.user, 'krijoi_llogari_klienti', 'subjects', s.id, { email });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.post('/:id/clients/:uid/status', requireRole('accountant'), (req, res) => {
  const u = db.prepare("SELECT id FROM users WHERE id=? AND role='client' AND subject_id=?").get(req.params.uid, req.params.id);
  if (!u) return res.status(404).json({ error: 'Llogaria nuk u gjet' });
  const status = req.body && req.body.status === 'suspended' ? 'suspended' : 'active';
  db.prepare('UPDATE users SET status=? WHERE id=?').run(status, u.id);
  audit.log(req.user, 'ndryshoi_llogari_klienti', 'subjects', Number(req.params.id), { status });
  res.json({ ok: true, status });
});

router.delete('/:id/clients/:uid', requireRole('accountant'), (req, res) => {
  const n = db.prepare("DELETE FROM users WHERE id=? AND role='client' AND subject_id=?").run(req.params.uid, req.params.id).changes;
  if (!n) return res.status(404).json({ error: 'Llogaria nuk u gjet' });
  audit.log(req.user, 'fshiu_llogari_klienti', 'subjects', Number(req.params.id), null);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('accountant'), (req, res) => {
  const s = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Subjekti nuk u gjet' });
  db.prepare("DELETE FROM users WHERE role='client' AND subject_id = ?").run(s.id); // llogaritë e portalit
  db.prepare('DELETE FROM subjects WHERE id = ?').run(s.id);
  audit.log(req.user, 'fshiu_subjekt', 'subjects', s.id, { name: s.name });
  res.json({ ok: true });
});

module.exports = router;
