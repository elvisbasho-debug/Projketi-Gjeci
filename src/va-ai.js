'use strict';

/*
  Pyet VA me Claude (opsional).
  - Aktivizohet kur serveri ka ANTHROPIC_API_KEY (ose kredenciale të tjera të SDK-së).
  - Claude merr si kontekst VETËM të dhënat e kësaj platforme (pa fjalëkalime) dhe përgjigjet shqip.
  - Nëse nuk ka kredenciale ose thirrja dështon → kthen null dhe përdoren rregullat lokale.
*/

const db = require('./db');
const { schemaFor } = require('./service-schema');

let client = null;
function getClient() {
  if (client !== null) return client || null;
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) { client = false; return null; }
  try {
    const mod = require('@anthropic-ai/sdk');
    const Anthropic = mod.default || mod.Anthropic || mod;
    client = new Anthropic();
  } catch (e) { client = false; }
  return client || null;
}

const MODEL = process.env.VA_MODEL || 'claude-opus-5-5';

const SYSTEM = `Je "VA", asistenti i platformës Finbot për studio kontabiliteti në Shqipëri.
Përgjigju gjithmonë në shqip, shkurt dhe qartë: 2–8 rreshta, me pika kur ka listë.
Bazohu VETËM te të dhënat JSON që të jepen në mesazh. Nëse diçka nuk është aty, thuaje hapur dhe mos shpik shifra.
Shumat janë në Lek. Vlerë negative te "tvsh_mujore" do të thotë kredi ose TVSH për t'u rimbursuar.
Kur ka dështime, shpjego shkurt shkakun e mundshëm dhe hapin tjetër (p.sh. kontrollo fjalëkalimin te Cilësimet e subjektit).
Mos jep këshilla investimi. Për vendime tatimore thuaj që duhen verifikuar te portali zyrtar.`;

// Konteksti: përmbledhje e platformës + (opsionale) detajet e një subjekti
function buildContext(subjectId) {
  const ctx = {};
  ctx.permbledhje = {
    subjekte: db.prepare('SELECT COUNT(*) c FROM subjects').get().c,
    ekzekutime: Object.fromEntries(db.prepare('SELECT status, COUNT(*) c FROM executions GROUP BY status').all().map(r => [r.status, r.c])),
  };
  ctx.kuotat = db.prepare('SELECT s.name AS sherbimi, q.used AS perdorur, q.max_limit AS limiti, q.renews_at AS rinovohet FROM services s JOIN service_quotas q ON q.service_id=s.id ORDER BY s.sort_order').all();
  ctx.deshtimet_e_fundit = db.prepare(`SELECT sub.name AS subjekti, sv.name AS sherbimi, e.result AS arsyeja, e.finished_at AS kur
    FROM executions e JOIN subjects sub ON sub.id=e.subject_id JOIN services sv ON sv.id=e.service_id
    WHERE e.status='deshtoi' ORDER BY e.id DESC LIMIT 10`).all();
  if (subjectId) {
    const s = db.prepare('SELECT id, name, nipt, status FROM subjects WHERE id=?').get(subjectId);
    if (s) {
      const recs = db.prepare(`SELECT sv.id AS sid, sv.code, sv.name AS sherbimi, r.status, r.result AS rezultati, r.data, r.updated_at AS perditesuar
        FROM service_records r JOIN services sv ON sv.id=r.service_id WHERE r.subject_id=? ORDER BY sv.sort_order`).all(s.id);
      ctx.subjekti = {
        emri: s.name, nipt: s.nipt, statusi: s.status,
        sherbimet: recs.map(r => ({ sherbimi: r.sherbimi, statusi: r.status, rezultati: r.rezultati, perditesuar: r.perditesuar, vlerat: r.data ? JSON.parse(r.data) : {} })),
        historiku: Object.fromEntries(recs.filter(r => schemaFor(r.code).columns.some(c => c.type === 'money')).map(r => [r.sherbimi,
          db.prepare('SELECT period, data FROM record_history WHERE service_id=? AND subject_id=? ORDER BY period DESC, id DESC LIMIT 36').all(r.sid, s.id)
            .map(h => ({ periudha: h.period, ...(h.data ? JSON.parse(h.data) : {}) }))])),
      };
    }
  }
  return ctx;
}

// Kthen { answer, model } ose null (pa AI / gabim)
async function askClaude(question, history, subjectId) {
  const c = getClient();
  if (!c) return null;
  const context = JSON.stringify(buildContext(subjectId));
  const messages = [];
  for (const m of history) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    if (messages.length && messages[messages.length - 1].role === role) continue; // ruaj alternimin
    if (!messages.length && role !== 'user') continue;
    messages.push({ role, content: m.body });
  }
  if (messages.length && messages[messages.length - 1].role === 'user') messages.pop();
  messages.push({ role: 'user', content: `Të dhënat e platformës (JSON):\n${context}\n\nPyetja: ${question}` });
  try {
    const res = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',                 // nëse modeli refuzon, API provon automatikisht një model rezervë
      output_config: { effort: 'low' },     // përgjigje bisede: të shpejta dhe të lira
      system: SYSTEM,
      messages,
    });
    if (res.stop_reason === 'refusal') return { answer: 'Nuk mund të përgjigjem për këtë pyetje.', model: res.model };
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return text ? { answer: text, model: res.model } : null;
  } catch (e) {
    console.error('Pyet VA (Claude):', e.status || '', e.message);
    return null;
  }
}

module.exports = { askClaude, aiEnabled: () => !!getClient() };
