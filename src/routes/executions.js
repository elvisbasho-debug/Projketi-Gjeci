'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { requireRole } = require('../auth');

const router = express.Router();
// Pas requireOrg: vetëm ekzekutimet e bizneseve të studios aktive (req.orgId).
const ORG = 'subject_id IN (SELECT id FROM subjects WHERE org_id = ?)';

// Statistika për panelin e automatizimit
router.get('/stats', requireRole('viewer'), (req, res) => {
  const byStatus = {};
  db.prepare(`SELECT status, COUNT(*) c FROM executions WHERE ${ORG} GROUP BY status`).all(req.orgId).forEach(r => byStatus[r.status] = r.c);
  // Mediana e vërtetë (jo mesatarja) e 500 ekzekutimeve të fundit të kryera
  const rows = db.prepare(`SELECT wait_ms, process_ms FROM executions WHERE status='kryer' AND ${ORG} ORDER BY id DESC LIMIT 500`).all(req.orgId);
  const median = arr => { const a = arr.filter(v => v != null).sort((x, y) => x - y); if (!a.length) return 0; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const med = { w: median(rows.map(r => r.wait_ms)), p: median(rows.map(r => r.process_ms)) };
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

// Radha e ekzekutimeve
router.get('/', requireRole('viewer'), (req, res) => {
  let sql = `
    SELECT e.*, sv.name AS service_name, sv.code AS service_code,
           sub.name AS subject_name, sub.nipt
    FROM executions e
    JOIN services sv ON sv.id = e.service_id
    JOIN subjects sub ON sub.id = e.subject_id
  `;
  const where = ['sub.org_id = ?'], args = [req.orgId];
  if (req.query.status) { where.push('e.status = ?'); args.push(req.query.status); }
  if (req.query.service_id) { where.push('e.service_id = ?'); args.push(req.query.service_id); }
  if (req.query.q) {
    const like = '%' + req.query.q + '%';
    where.push('(sub.name LIKE ? OR sub.nipt LIKE ? OR sv.name LIKE ? OR e.run_by LIKE ? OR e.result LIKE ?)');
    args.push(like, like, like, like, like);
  }
  sql += ' WHERE ' + where.join(' AND ') + ' ORDER BY e.id DESC LIMIT 200';
  res.json(db.prepare(sql).all(...args));
});

const ownExec = (id, orgId) => db.prepare(`SELECT * FROM executions WHERE id=? AND ${ORG}`).get(id, orgId);

// Log-et e një ekzekutimi
router.get('/:id/logs', requireRole('viewer'), (req, res) => {
  const ex = db.prepare(`
    SELECT e.*, sv.name AS service_name, sub.name AS subject_name
    FROM executions e JOIN services sv ON sv.id=e.service_id JOIN subjects sub ON sub.id=e.subject_id
    WHERE e.id=? AND sub.org_id=?
  `).get(req.params.id, req.orgId);
  if (!ex) return res.status(404).json({ error: 'Ekzekutimi nuk u gjet' });
  const logs = db.prepare('SELECT * FROM execution_logs WHERE execution_id=? ORDER BY id').all(ex.id);
  res.json({ ...ex, logs });
});

// Ndalo një ekzekutim në pritje/ekzekutim
router.post('/:id/stop', requireRole('accountant'), (req, res) => {
  const ex = ownExec(req.params.id, req.orgId);
  if (!ex) return res.status(404).json({ error: 'Ekzekutimi nuk u gjet' });
  if (['kryer', 'deshtoi', 'anuluar'].includes(ex.status)) return res.status(400).json({ error: 'Ekzekutimi ka përfunduar tashmë' });
  db.prepare("UPDATE executions SET status='anuluar', finished_at=datetime('now') WHERE id=?").run(ex.id);
  db.prepare('INSERT INTO execution_logs (execution_id, level, message) VALUES (?,?,?)').run(ex.id, 'warn', 'Ekzekutimi u ndalua nga përdoruesi.');
  audit.log(req.user, 'ndaloi_ekzekutim', 'executions', ex.id, null);
  res.json({ ok: true });
});

// Ndalo të gjitha në pritje (të studios)
router.post('/stop-all', requireRole('accountant'), (req, res) => {
  const n = db.prepare(`UPDATE executions SET status='anuluar', finished_at=datetime('now') WHERE status IN ('ne_radhe','duke_riprovuar') AND ${ORG}`).run(req.orgId).changes;
  audit.log(req.user, 'ndaloi_te_gjitha', 'executions', null, { n });
  res.json({ ok: true, stopped: n });
});

module.exports = router;
