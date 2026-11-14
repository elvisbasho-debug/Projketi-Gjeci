'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { requireRole } = require('../auth');
const { htmlToPdf, buildDeclarationDoc, recordsToPdfBuffers, zipBuffers } = require('../pdf');

const router = express.Router();

function companyInfo() {
  const row = db.prepare("SELECT value FROM settings WHERE key='company'").get();
  return row ? JSON.parse(row.value) : {};
}
function recordsForService(id) {
  return db.prepare(`
    SELECT r.status, r.result, r.data, r.updated_at, sub.name AS subject_name, sub.nipt
    FROM service_records r JOIN subjects sub ON sub.id = r.subject_id
    WHERE r.service_id = ? ORDER BY sub.name
  `).all(id).map(r => ({ ...r, data: r.data ? JSON.parse(r.data) : {} }));
}

// Lista e shërbimeve me kuotat
router.get('/', requireRole('viewer'), (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, q.max_limit, q.used, q.active, q.expires_at, q.renews_at
    FROM services s LEFT JOIN service_quotas q ON q.service_id = s.id
    ORDER BY s.sort_order
  `).all();
  res.json(rows);
});

// Një shërbim + subjektet/rekordet e tij
router.get('/:id', requireRole('viewer'), (req, res) => {
  const s = db.prepare(`
    SELECT s.*, q.max_limit, q.used, q.active, q.expires_at, q.renews_at
    FROM services s LEFT JOIN service_quotas q ON q.service_id = s.id WHERE s.id = ?
  `).get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Shërbimi nuk u gjet' });

  const records = db.prepare(`
    SELECT r.id AS record_id, r.status, r.result, r.data, r.updated_at,
           sub.id AS subject_id, sub.name AS subject_name, sub.nipt, sub.status AS subject_status
    FROM service_records r JOIN subjects sub ON sub.id = r.subject_id
    WHERE r.service_id = ? ORDER BY sub.name
  `).all(s.id).map(r => ({ ...r, data: r.data ? JSON.parse(r.data) : {} }));

  // ekzekutimet aktive për këtë shërbim
  const active = db.prepare("SELECT COUNT(*) c FROM executions WHERE service_id=? AND status IN ('ne_radhe','ne_ekzekutim','duke_riprovuar')").get(s.id).c;
  res.json({ ...s, records, active_executions: active });
});

// Shto një subjekt te shërbimi (krijon rekord në pritje)
router.post('/:id/subjects', requireRole('accountant'), (req, res) => {
  const s = db.prepare('SELECT * FROM services WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Shërbimi nuk u gjet' });
  const { subject_id } = req.body || {};
  const sub = db.prepare('SELECT * FROM subjects WHERE id=?').get(subject_id);
  if (!sub) return res.status(400).json({ error: 'Subjekt i pavlefshëm' });
  try {
    db.prepare("INSERT INTO service_records (service_id, subject_id, status) VALUES (?,?,'ne_pritje')").run(s.id, subject_id);
    db.prepare('UPDATE service_quotas SET used = used + 1 WHERE service_id=?').run(s.id);
  } catch (e) { /* ekziston */ }
  audit.log(req.user, 'shtoi_subjekt_ne_sherbim', 'services', s.id, { subject: sub.name });
  res.json({ ok: true });
});

// Hiq subjekt nga shërbimi
router.delete('/:id/subjects/:subjectId', requireRole('accountant'), (req, res) => {
  db.prepare('DELETE FROM service_records WHERE service_id=? AND subject_id=?').run(req.params.id, req.params.subjectId);
  res.json({ ok: true });
});

// EKZEKUTO robotin për disa (ose të gjitha) subjektet → fut në radhë
router.post('/:id/run', requireRole('accountant'), (req, res) => {
  const s = db.prepare('SELECT * FROM services WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Shërbimi nuk u gjet' });

  let subjectIds = (req.body && req.body.subject_ids) || [];
  if (req.body && req.body.all) {
    // EKZEKUTIM MASIV: të gjitha subjektet (edhe të paregjistruarat te shërbimi)
    subjectIds = db.prepare("SELECT id FROM subjects WHERE status='active'").all().map(r => r.id);
  } else if (!subjectIds.length) {
    // të gjitha subjektet e regjistruara te ky shërbim
    subjectIds = db.prepare('SELECT subject_id FROM service_records WHERE service_id=?').all(s.id).map(r => r.subject_id);
  }
  if (!subjectIds.length) return res.status(400).json({ error: 'Nuk ka subjekte për të ekzekutuar' });

  const ins = db.prepare("INSERT INTO executions (service_id, subject_id, status, run_by) VALUES (?,?,'ne_radhe',?)");
  const tx = db.transaction(() => {
    for (const sid of subjectIds) {
      ins.run(s.id, sid, req.user.email);
      db.prepare(`
        INSERT INTO service_records (service_id, subject_id, status) VALUES (?,?,'ne_pritje')
        ON CONFLICT(service_id, subject_id) DO UPDATE SET status='ne_pritje'
      `).run(s.id, sid);
    }
  });
  tx();
  audit.log(req.user, 'ekzekutoi_sherbim', 'services', s.id, { subjekte: subjectIds.length });
  res.json({ ok: true, queued: subjectIds.length });
});

// EKSPORT CSV i rekordeve të një shërbimi
router.get('/:id/export', requireRole('viewer'), (req, res) => {
  const s = db.prepare('SELECT * FROM services WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Shërbimi nuk u gjet' });
  const recs = recordsForService(s.id);
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const header = 'Subjekti,NIPT,Statusi,TVSH mujore,Totali,Kredi,Perditesuar';
  const body = recs.map(r => [r.subject_name, r.nipt, r.status, r.data.tvsh_mujore, r.data.totali, r.data.kredi, r.updated_at].map(esc).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${s.code}.csv"`);
  res.send('﻿' + header + '\n' + body);
});

// PDF i të gjitha deklaratave të një shërbimi (shumë faqe)
router.get('/:id/pdf', requireRole('viewer'), async (req, res) => {
  const s = db.prepare('SELECT * FROM services WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Shërbimi nuk u gjet' });
  const recs = recordsForService(s.id);
  if (!recs.length) return res.status(400).json({ error: 'Nuk ka rekorde për PDF' });
  try {
    const pdf = await htmlToPdf(buildDeclarationDoc(companyInfo(), s, recs));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${s.code}-deklaratat.pdf"`);
    res.send(pdf);
  } catch (e) { res.status(500).json({ error: 'Gabim gjatë gjenerimit të PDF: ' + e.message }); }
});

// ZIP me një PDF për çdo subjekt të shërbimit
router.get('/:id/zip', requireRole('viewer'), async (req, res) => {
  const s = db.prepare('SELECT * FROM services WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Shërbimi nuk u gjet' });
  const recs = recordsForService(s.id);
  if (!recs.length) return res.status(400).json({ error: 'Nuk ka rekorde për ZIP' });
  try {
    const files = await recordsToPdfBuffers(companyInfo(), s, recs);
    const zip = await zipBuffers(files);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${s.code}-deklaratat.zip"`);
    res.send(zip);
  } catch (e) { res.status(500).json({ error: 'Gabim gjatë gjenerimit të ZIP: ' + e.message }); }
});

// PDF i një deklarate të vetme (subjekt × shërbim)
router.get('/:id/records/:subjectId/pdf', requireRole('viewer'), async (req, res) => {
  const s = db.prepare('SELECT * FROM services WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Shërbimi nuk u gjet' });
  const r = db.prepare(`
    SELECT r.status, r.result, r.data, r.updated_at, sub.name AS subject_name, sub.nipt
    FROM service_records r JOIN subjects sub ON sub.id=r.subject_id
    WHERE r.service_id=? AND r.subject_id=?
  `).get(s.id, req.params.subjectId);
  if (!r) return res.status(404).json({ error: 'Rekordi nuk u gjet' });
  r.data = r.data ? JSON.parse(r.data) : {};
  try {
    const pdf = await htmlToPdf(buildDeclarationDoc(companyInfo(), s, [r]));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="deklarate-${(r.subject_name||'').replace(/\s+/g,'_')}.pdf"`);
    res.send(pdf);
  } catch (e) { res.status(500).json({ error: 'Gabim gjatë gjenerimit të PDF: ' + e.message }); }
});

module.exports = router;
