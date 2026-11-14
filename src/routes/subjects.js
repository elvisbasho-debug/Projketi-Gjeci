'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { requireRole } = require('../auth');
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

router.delete('/:id', requireRole('accountant'), (req, res) => {
  const s = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Subjekti nuk u gjet' });
  db.prepare('DELETE FROM subjects WHERE id = ?').run(s.id);
  audit.log(req.user, 'fshiu_subjekt', 'subjects', s.id, { name: s.name });
  res.json({ ok: true });
});

module.exports = router;
