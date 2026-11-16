'use strict';

const express = require('express');
const db = require('../db');
const { requireRole } = require('../auth');
const { askClaude, aiEnabled } = require('../va-ai');
const { serviceUsed, serviceLimit, subjectInOrg } = require('../org');
const ORG = 'subject_id IN (SELECT id FROM subjects WHERE org_id = ?)';

const router = express.Router();

/*
  Pyet VA: asistent që përmbledh të dhënat e platformës.
  - Me ANTHROPIC_API_KEY në server → përgjigjet i jep Claude (src/va-ai.js).
  - Pa çelës ose kur thirrja dështon → rregulla lokale (më poshtë).
  - Biseda mund të jetë për të gjithë studion ose për një subjekt të zgjedhur.
*/

const num = n => (Number(n) || 0).toLocaleString('sq-AL');

function subjectAnswer(t, s) {
  const recs = db.prepare(`SELECT sv.name, sv.code, r.status, r.result, r.data FROM service_records r JOIN services sv ON sv.id=r.service_id
    WHERE r.subject_id=? ORDER BY sv.sort_order`).all(s.id);
  if (!recs.length) return `${s.name} nuk është regjistruar ende në asnjë shërbim.`;
  if (/dësht|deshtu|gabim|problem/.test(t)) {
    const f = recs.filter(r => r.status === 'deshtoi');
    return f.length ? `Shërbimet e dështuara për ${s.name}:\n` + f.map(r => `• ${r.name}: ${r.result || 'gabim'}`).join('\n') : `Asnjë shërbim i dështuar për ${s.name}. 👍`;
  }
  if (/tvsh|deklar/.test(t)) {
    const r = recs.find(x => x.code === 'tvsh_deklarim');
    if (!r) return `${s.name} nuk është te shërbimi i TVSH-së.`;
    const d = JSON.parse(r.data || '{}');
    return `TVSH për ${s.name}:\n• TVSH mujore: ${num(d.tvsh_mujore)} Lek\n• Kredi: ${num(d.kredi)} Lek\n• Totali: ${num(d.totali)} Lek\n• Deklarimi: ${d.status_deklarim || '—'}`;
  }
  return `${s.name} (${s.nipt || 'pa NIPT'}) është në ${recs.length} shërbime:\n` + recs.map(r => `• ${r.name}: ${r.result || r.status}`).join('\n');
}

function buildAnswer(q, subjectId, orgId) {
  const t = (q || '').toLowerCase();
  if (subjectId) {
    const s = db.prepare('SELECT * FROM subjects WHERE id=? AND org_id=?').get(subjectId, orgId);
    if (s) return subjectAnswer(t, s);
  }
  const subjects = db.prepare('SELECT COUNT(*) c FROM subjects WHERE org_id=?').get(orgId).c;
  const services = db.prepare('SELECT COUNT(*) c FROM services').get().c;
  const execs = {};
  db.prepare(`SELECT status, COUNT(*) c FROM executions WHERE ${ORG} GROUP BY status`).all(orgId).forEach(r => execs[r.status] = r.c);

  if (/dësht|deshtu|gabim|problem/.test(t)) {
    const fails = db.prepare(`
      SELECT sub.name, sv.name AS svc, e.result FROM executions e
      JOIN subjects sub ON sub.id=e.subject_id JOIN services sv ON sv.id=e.service_id
      WHERE e.status='deshtoi' AND sub.org_id=? ORDER BY e.id DESC LIMIT 8
    `).all(orgId);
    if (!fails.length) return 'Nuk ka ekzekutime të dështuara për momentin. 👍';
    return 'Ekzekutimet e fundit të dështuara:\n' + fails.map(f => `• ${f.name} — ${f.svc}: ${f.result || 'gabim'}`).join('\n');
  }
  if (/mbledh|fatura|xhiro/.test(t)) {
    return `Shërbimet e mbledhjes janë aktive. Subjekte gjithsej: ${subjects}. Ekzekutime të kryera: ${execs['kryer'] || 0}, në radhë: ${execs['ne_radhe'] || 0}.`;
  }
  if (/tvsh|deklar/.test(t)) {
    const rec = db.prepare(`
      SELECT sub.name, r.data FROM service_records r
      JOIN subjects sub ON sub.id=r.subject_id JOIN services sv ON sv.id=r.service_id
      WHERE sv.code='tvsh_deklarim' AND r.data IS NOT NULL AND sub.org_id=? LIMIT 8
    `).all(orgId);
    let txt = 'Përmbledhje TVSH (nga rekordet e fundit):\n';
    rec.forEach(x => { const d = JSON.parse(x.data || '{}'); txt += `• ${x.name}: TVSH mujore ${num(d.tvsh_mujore)}\n`; });
    return rec.length ? txt : 'Ende nuk ka rekorde TVSH. Ekzekuto shërbimin "Deklarimi i TVSH-së".';
  }
  if (/përdorim|perdorim|kuot|planifik/.test(t)) {
    const q2 = db.prepare('SELECT id, name FROM services').all().map(s => ({ name: s.name, used: serviceUsed(orgId, s.id), max_limit: serviceLimit(orgId, s.id).max_limit })).sort((a, b) => b.used - a.used).slice(0, 5);
    return 'Përdorimi i kuotave (top 5):\n' + q2.map(x => `• ${x.name}: ${x.used}/${x.max_limit}`).join('\n');
  }
  return `Gjendja aktuale: ${subjects} subjekte, ${services} shërbime. ` +
    `Ekzekutime — kryer: ${execs['kryer'] || 0}, në radhë: ${execs['ne_radhe'] || 0}, dështuar: ${execs['deshtoi'] || 0}. ` +
    `Pyet p.sh. për "dështimet", "TVSH", "përdorimi i kuotave" ose "mbledhjet".`;
}

const sid = v => (v ? Number(v) || null : null);
const thread = (userId, subjectId) => db.prepare('SELECT * FROM va_messages WHERE user_id=? AND IFNULL(subject_id,0)=? ORDER BY id DESC LIMIT 50')
  .all(userId, subjectId || 0).reverse();

router.get('/messages', requireRole('viewer'), (req, res) => {
  res.json({ messages: thread(req.user.id, sid(req.query.subject_id)), credits: req.org.va_credits ?? 0, ai: aiEnabled() });
});

// Bisedë e re: fshin bisedën e këtij përdoruesi (për këtë subjekt ose të përgjithshmen)
router.delete('/messages', requireRole('viewer'), (req, res) => {
  db.prepare('DELETE FROM va_messages WHERE user_id=? AND IFNULL(subject_id,0)=?').run(req.user.id, sid(req.query.subject_id) || 0);
  res.json({ ok: true });
});

router.post('/ask', requireRole('viewer'), async (req, res) => {
  const { question } = req.body || {};
  let subjectId = sid(req.body && req.body.subject_id);
  if (subjectId && !subjectInOrg(subjectId, req.orgId)) subjectId = null;
  if (!question || !String(question).trim()) return res.status(400).json({ error: 'Shkruaj një pyetje' });
  const history = thread(req.user.id, subjectId).slice(-10);
  db.prepare("INSERT INTO va_messages (user_id, role, body, subject_id) VALUES (?, 'user', ?, ?)").run(req.user.id, question, subjectId);
  const ai = await askClaude(question, history, subjectId, req.orgId);
  const answer = ai ? ai.answer : buildAnswer(question, subjectId, req.orgId);
  db.prepare("INSERT INTO va_messages (user_id, role, body, subject_id) VALUES (?, 'assistant', ?, ?)").run(req.user.id, answer, subjectId);
  res.json({ answer, source: ai ? 'ai' : 'rules' });
});

module.exports = router;
