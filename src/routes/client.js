'use strict';

/*
  PORTALI I KLIENTIT
  ------------------
  Biznesi (subjekti) që studio ka regjistruar hyn me llogarinë e vet (roli 'client').
  Sheh vetëm një gjë: TVSH-në e vet në kohë reale. Shtyp butonin → kërkesa futet
  me përparësi në radhën e robotëve (shërbimi i TVSH-së, veprimi "info") → roboti
  merr të dhënat nga portali → rezultati i shfaqet klientit.
  Klienti nuk ka akses në asnjë API tjetër të studios.
*/

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { getOrg, serviceLimit, serviceUsed } = require('../org');

const router = express.Router();
const DAILY_LIMIT = 20;
const ACTIVE = "('ne_radhe','ne_ekzekutim','duke_riprovuar')";

router.use((req, res, next) => {
  if (req.user.role !== 'client' || !req.user.subject_id) return res.status(403).json({ error: 'Vetëm për llogaritë e klientëve' });
  const sub = db.prepare('SELECT id, name, nipt, status, org_id FROM subjects WHERE id=?').get(req.user.subject_id);
  if (!sub) return res.status(403).json({ error: 'Biznesi juaj nuk gjendet. Kontaktoni kontabilistin.' });
  const org = getOrg(sub.org_id);
  if (!org || org.status !== 'active') return res.status(403).json({ error: 'Shërbimi nuk është aktiv. Kontaktoni kontabilistin.' });
  req.subject = sub;
  const svc = db.prepare("SELECT id, name FROM services WHERE code='tvsh_deklarim'").get();
  req.tvsh = { ...svc, max_limit: serviceLimit(sub.org_id, svc.id).max_limit, used: serviceUsed(sub.org_id, svc.id) };
  next();
});

const shapeReq = r => r && ({
  id: r.id, status: r.status, result: r.result, created_at: r.created_at, finished_at: r.finished_at,
  data: r.data ? JSON.parse(r.data) : null,
});

// Pamja e klientit: biznesi, rezultati i fundit dhe kërkesat e fundit
router.get('/overview', (req, res) => {
  const rec = db.prepare('SELECT data, status, result, updated_at FROM service_records WHERE service_id=? AND subject_id=?').get(req.tvsh.id, req.subject.id);
  const requests = db.prepare('SELECT * FROM client_requests WHERE subject_id=? ORDER BY id DESC LIMIT 8').all(req.subject.id).map(shapeReq);
  res.json({
    subject: { name: req.subject.name, nipt: req.subject.nipt },
    latest: rec ? { data: rec.data ? JSON.parse(rec.data) : {}, status: rec.status, result: rec.result, updated_at: rec.updated_at } : null,
    requests,
  });
});

// Kërko TVSH-në tani
router.post('/tvsh', (req, res) => {
  const sub = req.subject;
  if (sub.status !== 'active') return res.status(400).json({ error: 'Biznesi juaj është joaktiv. Kontaktoni kontabilistin.' });
  // Nëse ka një kërkesë në proces, ktheje atë (mos fut dy herë)
  const open = db.prepare(`SELECT * FROM client_requests WHERE subject_id=? AND status IN ${ACTIVE} ORDER BY id DESC`).get(sub.id);
  if (open) return res.json({ ok: true, request: shapeReq(open), already: true });
  const today = db.prepare("SELECT COUNT(*) c FROM client_requests WHERE subject_id=? AND created_at >= date('now')").get(sub.id).c;
  if (today >= DAILY_LIMIT) return res.status(429).json({ error: `Keni arritur kufirin prej ${DAILY_LIMIT} kërkesash në ditë.` });

  // Biznesi duhet të jetë te shërbimi i TVSH-së (shtohet automatikisht brenda kuotës)
  const inService = db.prepare('SELECT 1 FROM service_records WHERE service_id=? AND subject_id=?').get(req.tvsh.id, sub.id);
  if (!inService) {
    if (req.tvsh.used >= (req.tvsh.max_limit || 0)) return res.status(400).json({ error: 'Shërbimi nuk është aktiv për biznesin tuaj. Kontaktoni kontabilistin.' });
    db.prepare("INSERT INTO service_records (service_id, subject_id, status) VALUES (?,?,'ne_pritje')").run(req.tvsh.id, sub.id);
  }

  const ex = db.prepare("INSERT INTO executions (service_id, subject_id, status, run_by, action) VALUES (?,?,'ne_radhe',?,'info')")
    .run(req.tvsh.id, sub.id, 'klient:' + req.user.email);
  const r = db.prepare("INSERT INTO client_requests (subject_id, user_id, kind, execution_id, status) VALUES (?,?,'tvsh',?,'ne_radhe')")
    .run(sub.id, req.user.id, ex.lastInsertRowid);
  db.prepare("INSERT INTO notifications (title, body, level, org_id) VALUES (?,?,'info',?)")
    .run('Kërkesë TVSH nga klienti', `${sub.name} kërkoi TVSH-në në kohë reale.`, sub.org_id);
  audit.log(req.user, 'klienti_kerkoi_tvsh', 'subjects', sub.id, null);
  res.json({ ok: true, request: shapeReq(db.prepare('SELECT * FROM client_requests WHERE id=?').get(r.lastInsertRowid)) });
});

// Gjendja e një kërkese (vetëm e biznesit të vet)
router.get('/requests/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM client_requests WHERE id=? AND subject_id=?').get(req.params.id, req.subject.id);
  if (!r) return res.status(404).json({ error: 'Kërkesa nuk u gjet' });
  const ex = r.execution_id ? db.prepare('SELECT status FROM executions WHERE id=?').get(r.execution_id) : null;
  res.json({ ...shapeReq(r), stage: ex ? ex.status : r.status });
});

module.exports = router;
