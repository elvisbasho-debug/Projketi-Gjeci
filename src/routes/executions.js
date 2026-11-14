'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { requireRole } = require('../auth');

const router = express.Router();

// Statistika për panelin e automatizimit
router.get('/stats', requireRole('viewer'), (req, res) => {
  const byStatus = {};
  db.prepare('SELECT status, COUNT(*) c FROM executions GROUP BY status').all().forEach(r => byStatus[r.status] = r.c);
  const med = db.prepare(`
    SELECT AVG(wait_ms) w, AVG(process_ms) p FROM executions WHERE status='kryer'
  `).get();
  res.json({
    ne_radhe: byStatus['ne_radhe'] || 0,
    ne_ekzekutim: (byStatus['ne_ekzekutim'] || 0) + (byStatus['duke_riprovuar'] || 0),
    kryer: byStatus['kryer'] || 0,
    deshtoi: byStatus['deshtoi'] || 0,
    anuluar: byStatus['anuluar'] || 0,
    mesatare_pritje_ms: Math.round(med.w || 0),
    mesatare_procesim_ms: Math.round(med.p || 0),
  });
});

// Radha e ekzekutimeve (grupuar sipas subjekt×shërbim, më të fundit)
router.get('/', requireRole('viewer'), (req, res) => {
  const status = req.query.status;
  const serviceId = req.query.service_id;
  let sql = `
    SELECT e.*, sv.name AS service_name, sv.code AS service_code,
           sub.name AS subject_name, sub.nipt
    FROM executions e
    JOIN services sv ON sv.id = e.service_id
    JOIN subjects sub ON sub.id = e.subject_id
  `;
  const where = [], args = [];
  if (status) { where.push('e.status = ?'); args.push(status); }
  if (serviceId) { where.push('e.service_id = ?'); args.push(serviceId); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY e.id DESC LIMIT 200';
  res.json(db.prepare(sql).all(...args));
});

// Log-et e një ekzekutimi
router.get('/:id/logs', requireRole('viewer'), (req, res) => {
  const ex = db.prepare(`
    SELECT e.*, sv.name AS service_name, sub.name AS subject_name
    FROM executions e JOIN services sv ON sv.id=e.service_id JOIN subjects sub ON sub.id=e.subject_id
    WHERE e.id=?
  `).get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Ekzekutimi nuk u gjet' });
  const logs = db.prepare('SELECT * FROM execution_logs WHERE execution_id=? ORDER BY id').all(ex.id);
  res.json({ ...ex, logs });
});

// Ndalo një ekzekutim në pritje/ekzekutim
router.post('/:id/stop', requireRole('accountant'), (req, res) => {
  const ex = db.prepare('SELECT * FROM executions WHERE id=?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Ekzekutimi nuk u gjet' });
  if (['kryer', 'deshtoi', 'anuluar'].includes(ex.status)) return res.status(400).json({ error: 'Ekzekutimi ka përfunduar tashmë' });
  db.prepare("UPDATE executions SET status='anuluar', finished_at=datetime('now') WHERE id=?").run(ex.id);
  db.prepare('INSERT INTO execution_logs (execution_id, level, message) VALUES (?,?,?)').run(ex.id, 'warn', 'Ekzekutimi u ndalua nga përdoruesi.');
  audit.log(req.user, 'ndaloi_ekzekutim', 'executions', ex.id, null);
  res.json({ ok: true });
});

// Ndalo të gjitha në pritje
router.post('/stop-all', requireRole('accountant'), (req, res) => {
  const n = db.prepare("UPDATE executions SET status='anuluar', finished_at=datetime('now') WHERE status IN ('ne_radhe','duke_riprovuar')").run().changes;
  audit.log(req.user, 'ndaloi_te_gjitha', 'executions', null, { n });
  res.json({ ok: true, stopped: n });
});

module.exports = router;
