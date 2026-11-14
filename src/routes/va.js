'use strict';

const express = require('express');
const db = require('../db');
const { requireRole } = require('../auth');

const router = express.Router();

/*
  Pyet VA — asistent që përmbledh të dhënat e platformës.
  Tani punon me rregulla (pa model AI të jashtëm). Për AI real, lidh këtu një
  model (p.sh. Claude API) dhe kalo kontekstin e të dhënave + pyetjen.
*/

function buildAnswer(q) {
  const t = (q || '').toLowerCase();
  const num = (n) => (Number(n) || 0).toLocaleString('sq-AL');

  // Përmbledhje gjendjeje
  const subjects = db.prepare('SELECT COUNT(*) c FROM subjects').get().c;
  const services = db.prepare('SELECT COUNT(*) c FROM services').get().c;
  const execs = {};
  db.prepare('SELECT status, COUNT(*) c FROM executions GROUP BY status').all().forEach(r => execs[r.status] = r.c);

  if (/dësht|deshtu|gabim|problem/.test(t)) {
    const fails = db.prepare(`
      SELECT sub.name, sv.name AS svc, e.result FROM executions e
      JOIN subjects sub ON sub.id=e.subject_id JOIN services sv ON sv.id=e.service_id
      WHERE e.status='deshtoi' ORDER BY e.id DESC LIMIT 8
    `).all();
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
      WHERE sv.code='tvsh_deklarim' AND r.data IS NOT NULL LIMIT 5
    `).all();
    let txt = 'Përmbledhje TVSH (nga rekordet e fundit):\n';
    rec.forEach(x => { const d = JSON.parse(x.data || '{}'); txt += `• ${x.name}: TVSH mujore ${num(d.tvsh_mujore)}\n`; });
    return rec.length ? txt : 'Ende nuk ka rekorde TVSH. Ekzekuto shërbimin "Deklarimi i TVSH-së".';
  }

  if (/përdorim|perdorim|kuot|planifik/.test(t)) {
    const q = db.prepare('SELECT s.name, q.used, q.max_limit FROM services s JOIN service_quotas q ON q.service_id=s.id ORDER BY q.used DESC LIMIT 5').all();
    return 'Përdorimi i kuotave (top 5):\n' + q.map(x => `• ${x.name}: ${x.used}/${x.max_limit}`).join('\n');
  }

  // Përgjigje e përgjithshme
  return `Gjendja aktuale: ${subjects} subjekte, ${services} shërbime. ` +
    `Ekzekutime — kryer: ${execs['kryer'] || 0}, në radhë: ${execs['ne_radhe'] || 0}, dështuar: ${execs['deshtoi'] || 0}. ` +
    `Pyet p.sh. për "dështimet", "TVSH", "përdorimi i kuotave" ose "mbledhjet".`;
}

router.get('/messages', requireRole('viewer'), (req, res) => {
  const rows = db.prepare('SELECT * FROM va_messages WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id).reverse();
  const company = JSON.parse(db.prepare("SELECT value FROM settings WHERE key='company'").get().value);
  res.json({ messages: rows, credits: company.va_credits ?? 10 });
});

router.post('/ask', requireRole('viewer'), (req, res) => {
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Shkruaj një pyetje' });
  db.prepare("INSERT INTO va_messages (user_id, role, body) VALUES (?, 'user', ?)").run(req.user.id, question);
  const answer = buildAnswer(question);
  db.prepare("INSERT INTO va_messages (user_id, role, body) VALUES (?, 'assistant', ?)").run(req.user.id, answer);
  res.json({ answer });
});

module.exports = router;
