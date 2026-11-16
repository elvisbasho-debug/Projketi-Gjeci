'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const csv = require('../csv');
const { requireRole } = require('../auth');
const { isSet } = require('../crypto');
const { schemaFor } = require('../service-schema');
const { htmlToPdf, buildDeclarationDoc, buildStatsDoc, recordsToPdfBuffers, zipBuffers } = require('../pdf');
const { serviceLimit, serviceUsed, subjectInOrg, canAddSubjects } = require('../org');

const router = express.Router();

/*
  Të gjitha thirrjet këtu kalojnë pas requireOrg (server.js): req.orgId është studioja aktive
  dhe çdo pyetje filtrohet me subjects.org_id = req.orgId.
*/

/* ---------------- Ndihmës ---------------- */
const companyInfo = req => ({ name: req.org.name, nipt: req.org.nipt, address: req.org.address });
const parseData = r => ({ ...r, data: r.data ? JSON.parse(r.data) : {} });
function getService(id, orgId) {
  const s = db.prepare(`SELECT s.*, q.expires_at, q.renews_at FROM services s LEFT JOIN service_quotas q ON q.service_id = s.id WHERE s.id = ?`).get(id);
  if (!s) return null;
  const lim = serviceLimit(orgId, s.id);
  return { ...s, max_limit: lim.max_limit, active: lim.active, used: serviceUsed(orgId, s.id) };
}
// Middleware: ngarkon shërbimin te req.svc ose kthen 404
function loadService(req, res, next) {
  const s = getService(req.params.id, req.orgId);
  if (!s) return res.status(404).json({ error: 'Shërbimi nuk u gjet' });
  req.svc = s; next();
}
function recordsForService(id, orgId) {
  return db.prepare(`
    SELECT r.id AS record_id, r.status, r.result, r.data, r.updated_at, r.period_from, r.period_to,
           sub.id AS subject_id, sub.name AS subject_name, sub.nipt, sub.status AS subject_status
    FROM service_records r JOIN subjects sub ON sub.id = r.subject_id
    WHERE r.service_id = ? AND sub.org_id = ? ORDER BY sub.name
  `).all(id, orgId).map(parseData);
}
const ORG_SUBJECTS = 'SELECT id FROM subjects WHERE org_id = ?';
// Shton subjekte (vetëm të kësaj studioje) te shërbimi brenda kuotës. Kthen { added, skipped, full }
function addSubjectsToService(svc, subjectIds, orgId) {
  const existing = new Set(db.prepare(`SELECT subject_id FROM service_records WHERE service_id=? AND subject_id IN (${ORG_SUBJECTS})`).all(svc.id, orgId).map(r => r.subject_id));
  let room = (svc.max_limit || 0) - existing.size;
  let added = 0, skipped = 0, full = 0;
  const ins = db.prepare("INSERT INTO service_records (service_id, subject_id, status) VALUES (?,?,'ne_pritje')");
  db.transaction(() => {
    for (const sid of subjectIds) {
      if (!subjectInOrg(sid, orgId)) { skipped++; continue; }
      if (existing.has(sid)) { skipped++; continue; }
      if (room <= 0) { full++; continue; }
      ins.run(svc.id, sid); existing.add(sid); room--; added++;
    }
  })();
  return { added, skipped, full };
}
const ACTIVE_EXEC = "('ne_radhe','ne_ekzekutim','duke_riprovuar')";
const sendFile = (res, type, name, body) => {
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(body);
};
const safeName = s => String(s || 'subjekt').replace(/[^\w\-]+/g, '_');
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

/* ---------------- Lista dhe faqja e shërbimit ---------------- */
router.get('/', requireRole('viewer'), (req, res) => {
  const ids = db.prepare('SELECT id FROM services ORDER BY sort_order').all();
  res.json(ids.map(r => getService(r.id, req.orgId)));
});

router.get('/:id', requireRole('viewer'), loadService, (req, res) => {
  const s = req.svc;
  const records = recordsForService(s.id, req.orgId);
  const active = db.prepare(`SELECT COUNT(*) c FROM executions WHERE service_id=? AND status IN ${ACTIVE_EXEC} AND subject_id IN (${ORG_SUBJECTS})`).get(s.id, req.orgId).c;
  // subjektet me ekzekutim aktiv (për të treguar "në ekzekutim" te rreshti)
  const running = db.prepare(`SELECT DISTINCT subject_id FROM executions WHERE service_id=? AND status IN ${ACTIVE_EXEC} AND subject_id IN (${ORG_SUBJECTS})`).all(s.id, req.orgId).map(r => r.subject_id);
  res.json({ ...s, ...schemaFor(s.code), records, active_executions: active, running_subjects: running });
});

/* ---------------- Subjektet e shërbimit ---------------- */
router.post('/:id/subjects', requireRole('accountant'), loadService, (req, res) => {
  const ids = (req.body.subject_ids || [req.body.subject_id]).map(Number).filter(Boolean);
  const valid = ids.filter(id => subjectInOrg(id, req.orgId));
  if (!valid.length) return res.status(400).json({ error: 'Subjekt i pavlefshëm' });
  const r = addSubjectsToService(req.svc, valid, req.orgId);
  if (!r.added && r.full) return res.status(400).json({ error: `Kuota e shërbimit (${req.svc.max_limit}) është plot` });
  audit.log(req.user, 'shtoi_subjekt_ne_sherbim', 'services', req.svc.id, r);
  res.json({ ok: true, ...r });
});

router.delete('/:id/subjects/:subjectId', requireRole('accountant'), loadService, (req, res) => {
  if (!subjectInOrg(Number(req.params.subjectId), req.orgId)) return res.status(404).json({ error: 'Subjekti nuk u gjet' });
  db.prepare('DELETE FROM service_records WHERE service_id=? AND subject_id=?').run(req.svc.id, req.params.subjectId);
  audit.log(req.user, 'hoqi_subjekt_nga_sherbimi', 'services', req.svc.id, { subject_id: req.params.subjectId });
  res.json({ ok: true });
});

// Fshi TË GJITHA subjektet nga shërbimi (subjektet vetë mbeten te "Subjektet")
router.delete('/:id/subjects', requireRole('accountant'), loadService, (req, res) => {
  const n = db.prepare(`DELETE FROM service_records WHERE service_id=? AND subject_id IN (${ORG_SUBJECTS})`).run(req.svc.id, req.orgId).changes;
  db.prepare(`UPDATE executions SET status='anuluar', finished_at=datetime('now') WHERE service_id=? AND status IN ${ACTIVE_EXEC} AND subject_id IN (${ORG_SUBJECTS})`).run(req.svc.id, req.orgId);
  audit.log(req.user, 'fshiu_te_gjitha_subjektet_e_sherbimit', 'services', req.svc.id, { n });
  res.json({ ok: true, removed: n });
});

/* ---------------- Ekzekutimi / ndalimi ---------------- */
router.post('/:id/run', requireRole('accountant'), loadService, (req, res) => {
  const s = req.svc;
  const { action, all } = req.body || {};
  const schema = schemaFor(s.code);
  if (action && !schema.actions.find(a => a.key === action)) return res.status(400).json({ error: 'Veprim i panjohur për këtë shërbim' });

  const asked = Array.isArray(req.body.subject_ids) && req.body.subject_ids.length > 0;
  let subjectIds = (req.body.subject_ids || []).map(Number).filter(id => subjectInOrg(id, req.orgId));
  if (asked && !subjectIds.length) return res.status(400).json({ error: 'Subjekt i pavlefshëm' });
  if (all) {
    // EKZEKUTIM MASIV: të gjitha subjektet aktive të studios (shtohen te shërbimi brenda kuotës)
    const ids = db.prepare("SELECT id FROM subjects WHERE status='active' AND org_id=?").all(req.orgId).map(r => r.id);
    addSubjectsToService(s, ids, req.orgId);
    subjectIds = db.prepare(`SELECT subject_id FROM service_records WHERE service_id=? AND subject_id IN (${ORG_SUBJECTS})`).all(s.id, req.orgId).map(r => r.subject_id);
  } else if (!subjectIds.length) {
    // të gjitha subjektet aktive të studios të regjistruara te ky shërbim
    subjectIds = db.prepare(`SELECT r.subject_id FROM service_records r JOIN subjects sub ON sub.id=r.subject_id
      WHERE r.service_id=? AND sub.status='active' AND sub.org_id=?`).all(s.id, req.orgId).map(r => r.subject_id);
  }
  // mos fut dy herë në radhë të njëjtin subjekt për të njëjtin veprim
  const busy = new Set(db.prepare(`SELECT subject_id FROM executions WHERE service_id=? AND IFNULL(action,'')=? AND status IN ${ACTIVE_EXEC}`)
    .all(s.id, action || '').map(r => r.subject_id));
  subjectIds = subjectIds.filter(id => !busy.has(id));
  if (!subjectIds.length) return res.status(400).json({ error: busy.size ? 'Subjektet janë tashmë në radhë' : 'Nuk ka subjekte për të ekzekutuar' });

  const ins = db.prepare("INSERT INTO executions (service_id, subject_id, status, run_by, action) VALUES (?,?,'ne_radhe',?,?)");
  const upRec = db.prepare(`INSERT INTO service_records (service_id, subject_id, status) VALUES (?,?,'ne_pritje')
    ON CONFLICT(service_id, subject_id) DO NOTHING`);
  db.transaction(() => { for (const sid of subjectIds) { ins.run(s.id, sid, req.user.email, action || null); upRec.run(s.id, sid); } })();
  audit.log(req.user, 'ekzekutoi_sherbim', 'services', s.id, { subjekte: subjectIds.length, veprimi: action || null });
  res.json({ ok: true, queued: subjectIds.length });
});

// NDALO: anulon gjithçka në radhë/ekzekutim për këtë shërbim
router.post('/:id/stop', requireRole('accountant'), loadService, (req, res) => {
  const rows = db.prepare(`SELECT id FROM executions WHERE service_id=? AND status IN ${ACTIVE_EXEC} AND subject_id IN (${ORG_SUBJECTS})`).all(req.svc.id, req.orgId);
  const up = db.prepare("UPDATE executions SET status='anuluar', finished_at=datetime('now') WHERE id=?");
  const lg = db.prepare("INSERT INTO execution_logs (execution_id, level, message) VALUES (?, 'warn', 'Ekzekutimi u ndalua nga përdoruesi.')");
  db.transaction(() => rows.forEach(r => { up.run(r.id); lg.run(r.id); }))();
  audit.log(req.user, 'ndaloi_sherbimin', 'services', req.svc.id, { n: rows.length });
  res.json({ ok: true, stopped: rows.length });
});

/* ---------------- Datat masive ---------------- */
router.post('/:id/bulk-dates', requireRole('accountant'), loadService, (req, res) => {
  const { from, to } = req.body || {};
  if (!isDate(from) || !isDate(to)) return res.status(400).json({ error: 'Vendosni datën e fillimit dhe të mbarimit' });
  if (from > to) return res.status(400).json({ error: 'Data e fillimit duhet të jetë para datës së mbarimit' });
  const n = db.prepare(`UPDATE service_records SET period_from=?, period_to=? WHERE service_id=? AND subject_id IN (${ORG_SUBJECTS})`).run(from, to, req.svc.id, req.orgId).changes;
  audit.log(req.user, 'vendosi_datat_masive', 'services', req.svc.id, { from, to, n });
  res.json({ ok: true, updated: n });
});

/* ---------------- Importi ---------------- */
router.get('/:id/import-template', requireRole('viewer'), loadService, (req, res) => {
  sendFile(res, 'text/csv; charset=utf-8', `template-${req.svc.code}.csv`,
    csv.build(['Emri', 'NIPT', 'PerdoruesEAlbania', 'Statusi'], [['Shembull SH.P.K.', 'K12345678A', 'K12345678A', 'Aktiv']]));
});

// Importo CSV: gjen subjektin sipas NIPT-it (ose emrit); nëse s'ekziston e krijon; pastaj e shton te shërbimi
router.post('/:id/import', requireRole('accountant'), loadService, (req, res) => {
  const rows = csv.parse(req.body && req.body.csv);
  if (!rows.length) return res.status(400).json({ error: 'CSV bosh' });
  const start = /emri|name/i.test(rows[0][0] || '') ? 1 : 0;
  const byNipt = db.prepare('SELECT id FROM subjects WHERE nipt=? AND org_id=?');
  const byName = db.prepare('SELECT id FROM subjects WHERE name=? AND org_id=?');
  const ins = db.prepare('INSERT INTO subjects (name, nipt, ealbania_user, status, created_by, org_id) VALUES (?,?,?,?,?,?)');
  const ids = []; let created = 0, invalid = 0, overPlan = 0;
  db.transaction(() => {
    for (const cols of rows.slice(start)) {
      const name = cols[0], nipt = cols[1] || null;
      if (!name && !nipt) { invalid++; continue; }
      let found = (nipt && byNipt.get(nipt, req.orgId)) || (name && byName.get(name, req.orgId));
      if (!found) {
        if (!name) { invalid++; continue; }
        if (!canAddSubjects(req.orgId, 1).ok) { overPlan++; continue; } // kufiri i planit
        const st = /joaktiv|inactive/i.test(cols[3] || '') ? 'inactive' : 'active';
        found = { id: ins.run(name, nipt, cols[2] || nipt, st, req.user.id, req.orgId).lastInsertRowid }; created++;
      }
      ids.push(Number(found.id));
    }
  })();
  const r = addSubjectsToService(req.svc, ids, req.orgId);
  audit.log(req.user, 'importoi_te_sherbimi', 'services', req.svc.id, { created, ...r, invalid, overPlan });
  res.json({ ok: true, created, invalid, over_plan: overPlan, ...r });
});

// Importo nga një shërbim tjetër: kopjon subjektet e tij
router.post('/:id/import-from', requireRole('accountant'), loadService, (req, res) => {
  const src = Number(req.body && req.body.source_service_id);
  if (!src || src === req.svc.id || !getService(src, req.orgId)) return res.status(400).json({ error: 'Zgjidhni një shërbim tjetër' });
  const ids = db.prepare(`SELECT subject_id FROM service_records WHERE service_id=? AND subject_id IN (${ORG_SUBJECTS})`).all(src, req.orgId).map(r => r.subject_id);
  if (!ids.length) return res.status(400).json({ error: 'Shërbimi burim nuk ka subjekte' });
  const r = addSubjectsToService(req.svc, ids, req.orgId);
  audit.log(req.user, 'importoi_nga_sherbimi', 'services', req.svc.id, { src, ...r });
  res.json({ ok: true, ...r });
});

/* ---------------- Eksportet ---------------- */
router.get('/:id/export', requireRole('viewer'), loadService, (req, res) => {
  const cols = schemaFor(req.svc.code).columns;
  const recs = recordsForService(req.svc.id, req.orgId);
  const header = ['Subjekti', 'NIPT', 'Statusi i subjektit', 'Statusi', 'Rezultati', ...cols.map(c => c.label), 'Periudha nga', 'Periudha deri', 'Përditësuar'];
  const rows = recs.map(r => [r.subject_name, r.nipt, r.subject_status === 'active' ? 'Aktiv' : 'Joaktiv', r.status, r.result,
    ...cols.map(c => r.data[c.key]), r.period_from, r.period_to, r.updated_at]);
  sendFile(res, 'text/csv; charset=utf-8', `${req.svc.code}.csv`, csv.build(header, rows));
});

router.get('/:id/pdf', requireRole('viewer'), loadService, async (req, res) => {
  const recs = recordsForService(req.svc.id, req.orgId);
  if (!recs.length) return res.status(400).json({ error: 'Nuk ka rekorde për PDF' });
  try { sendFile(res, 'application/pdf', `${req.svc.code}-deklaratat.pdf`, await htmlToPdf(buildDeclarationDoc(companyInfo(req), req.svc, recs))); }
  catch (e) { res.status(500).json({ error: 'Gabim gjatë gjenerimit të PDF: ' + e.message }); }
});

router.get('/:id/zip', requireRole('viewer'), loadService, async (req, res) => {
  const recs = recordsForService(req.svc.id, req.orgId);
  if (!recs.length) return res.status(400).json({ error: 'Nuk ka rekorde për ZIP' });
  try { sendFile(res, 'application/zip', `${req.svc.code}-deklaratat.zip`, await zipBuffers(await recordsToPdfBuffers(companyInfo(req), req.svc, recs))); }
  catch (e) { res.status(500).json({ error: 'Gabim gjatë gjenerimit të ZIP: ' + e.message }); }
});

/* ================= PAMJA E REKORDIT (subjekt × shërbim) ================= */
function loadRecord(req, res, next) {
  const r = db.prepare(`
    SELECT r.id AS record_id, r.status, r.result, r.data, r.updated_at, r.period_from, r.period_to,
           sub.id AS subject_id, sub.name AS subject_name, sub.nipt, sub.status AS subject_status,
           sub.ealbania_user, sub.ealbania_pass, sub.selfcare_pass
    FROM service_records r JOIN subjects sub ON sub.id = r.subject_id
    WHERE r.service_id=? AND r.subject_id=? AND sub.org_id=?
  `).get(req.svc.id, req.params.subjectId, req.orgId);
  if (!r) return res.status(404).json({ error: 'Rekordi nuk u gjet' });
  r.has_ealbania_pass = isSet(r.ealbania_pass); r.has_selfcare_pass = isSet(r.selfcare_pass);
  delete r.ealbania_pass; delete r.selfcare_pass;
  req.rec = parseData(r); next();
}
const REC = '/:id/records/:subjectId';

router.get(REC, requireRole('viewer'), loadService, loadRecord, (req, res) => {
  const s = req.svc;
  const executions = db.prepare(`SELECT id, status, action, result, wait_ms, process_ms, run_by, created_at, finished_at
    FROM executions WHERE service_id=? AND subject_id=? ORDER BY id DESC LIMIT 10`).all(s.id, req.rec.subject_id);
  const active = executions.filter(e => ['ne_radhe', 'ne_ekzekutim', 'duke_riprovuar'].includes(e.status)).length;
  res.json({ service: { id: s.id, code: s.code, name: s.name, description: s.description, ...schemaFor(s.code) }, record: req.rec, executions, active });
});

// Periudha e një rekordi të vetëm
router.patch(REC, requireRole('accountant'), loadService, loadRecord, (req, res) => {
  const { period_from, period_to } = req.body || {};
  if ((period_from && !isDate(period_from)) || (period_to && !isDate(period_to))) return res.status(400).json({ error: 'Data e pavlefshme' });
  if (period_from && period_to && period_from > period_to) return res.status(400).json({ error: 'Data e fillimit duhet të jetë para datës së mbarimit' });
  db.prepare('UPDATE service_records SET period_from=?, period_to=? WHERE id=?').run(period_from || null, period_to || null, req.rec.record_id);
  res.json({ ok: true });
});

function historyRows(serviceId, subjectId, from, to) {
  const args = [serviceId, subjectId]; let where = '';
  if (from) { where += ' AND period >= ?'; args.push(from.slice(0, 7)); }
  if (to) { where += ' AND period <= ?'; args.push(to.slice(0, 7)); }
  return db.prepare(`SELECT * FROM record_history WHERE service_id=? AND subject_id=?${where} ORDER BY period DESC, id DESC`).all(...args).map(parseData);
}

router.get(REC + '/history', requireRole('viewer'), loadService, loadRecord, (req, res) => {
  res.json(historyRows(req.svc.id, req.rec.subject_id, req.query.from, req.query.to).slice(0, 500));
});

router.get(REC + '/history.csv', requireRole('viewer'), loadService, loadRecord, (req, res) => {
  const cols = schemaFor(req.svc.code).columns;
  const rows = historyRows(req.svc.id, req.rec.subject_id, req.query.from, req.query.to)
    .map(h => [h.created_at, h.period, h.action || '', h.status, h.result, ...cols.map(c => h.data[c.key])]);
  sendFile(res, 'text/csv; charset=utf-8', `historiku-${safeName(req.rec.subject_name)}.csv`,
    csv.build(['Data', 'Periudha', 'Veprimi', 'Statusi', 'Rezultati', ...cols.map(c => c.label)], rows));
});

// Statistika: vlera kryesore sipas muajve për 3 vitet e fundit (vlera e fundit e çdo muaji)
function statsFor(svc, subjectId) {
  const sch = schemaFor(svc.code), cols = sch.columns;
  const metric = cols.find(c => c.key === sch.metric) || cols.find(c => c.type === 'money') || cols.find(c => c.type === 'num') || null;
  const y = new Date().getFullYear();
  const years = [y - 2, y - 1, y];
  const months = Array.from({ length: 12 }, () => years.map(() => null));
  const hist = db.prepare(`SELECT period, data, id FROM record_history WHERE service_id=? AND subject_id=? AND period >= ? ORDER BY id`)
    .all(svc.id, subjectId, `${y - 2}-01`);
  const counts = Array.from({ length: 12 }, () => years.map(() => 0));
  for (const h of hist) {
    const yi = years.indexOf(Number(h.period.slice(0, 4))); const mi = Number(h.period.slice(5, 7)) - 1;
    if (yi < 0 || mi < 0 || mi > 11) continue;
    counts[mi][yi]++;
    if (metric) { const d = h.data ? JSON.parse(h.data) : {}; if (typeof d[metric.key] === 'number') months[mi][yi] = d[metric.key]; }
  }
  const values = metric ? months : counts;
  const totals = years.map((_, yi) => values.reduce((s, m) => s + (m[yi] || 0), 0));
  return { metric: metric ? metric.label : 'Ekzekutime', type: metric ? metric.type : 'num', years, months: values, totals };
}

router.get(REC + '/stats', requireRole('viewer'), loadService, loadRecord, (req, res) => {
  res.json(statsFor(req.svc, req.rec.subject_id));
});

router.get(REC + '/stats.pdf', requireRole('viewer'), loadService, loadRecord, async (req, res) => {
  try {
    const pdf = await htmlToPdf(buildStatsDoc(companyInfo(req), req.svc, req.rec, statsFor(req.svc, req.rec.subject_id)));
    sendFile(res, 'application/pdf', `statistika-${safeName(req.rec.subject_name)}.pdf`, pdf);
  } catch (e) { res.status(500).json({ error: 'Gabim gjatë gjenerimit të PDF: ' + e.message }); }
});

// Regjistri: log-et e të gjitha ekzekutimeve të këtij rekordi
router.get(REC + '/logs', requireRole('viewer'), loadService, loadRecord, (req, res) => {
  const args = [req.svc.id, req.rec.subject_id]; let where = '';
  if (req.query.level) { where += ' AND l.level = ?'; args.push(req.query.level); }
  if (req.query.q) { where += ' AND l.message LIKE ?'; args.push('%' + req.query.q + '%'); }
  res.json(db.prepare(`
    SELECT l.id, l.level, l.message, l.created_at, e.id AS execution_id, e.action
    FROM execution_logs l JOIN executions e ON e.id = l.execution_id
    WHERE e.service_id=? AND e.subject_id=?${where}
    ORDER BY l.id DESC LIMIT 300`).all(...args));
});

// PDF i rekordit (gjendja aktuale)
router.get(REC + '/pdf', requireRole('viewer'), loadService, loadRecord, async (req, res) => {
  try { sendFile(res, 'application/pdf', `deklarate-${safeName(req.rec.subject_name)}.pdf`, await htmlToPdf(buildDeclarationDoc(companyInfo(req), req.svc, [req.rec]))); }
  catch (e) { res.status(500).json({ error: 'Gabim gjatë gjenerimit të PDF: ' + e.message }); }
});

// ZIP me një PDF për çdo muaj të periudhës (nga historiku)
router.get(REC + '/zip', requireRole('viewer'), loadService, loadRecord, async (req, res) => {
  const from = req.query.from || req.rec.period_from, to = req.query.to || req.rec.period_to;
  const latest = new Map();
  for (const h of historyRows(req.svc.id, req.rec.subject_id, from, to)) if (!latest.has(h.period)) latest.set(h.period, h);
  if (!latest.size) return res.status(400).json({ error: 'Nuk ka të dhëna për këtë periudhë' });
  const recs = [...latest.values()].map(h => ({ ...req.rec, status: h.status, result: h.result, data: h.data,
    period_from: h.period + '-01', period_to: h.period, subject_name: `${req.rec.subject_name} ${h.period}` }));
  try { sendFile(res, 'application/zip', `deklaratat-${safeName(req.rec.subject_name)}.zip`, await zipBuffers(await recordsToPdfBuffers(companyInfo(req), req.svc, recs))); }
  catch (e) { res.status(500).json({ error: 'Gabim gjatë gjenerimit të ZIP: ' + e.message }); }
});

module.exports = router;
