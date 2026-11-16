'use strict';

/*
  STUDIOT (organizatat) DHE PLANET
  --------------------------------
  - Përdoruesit e studios (studio_admin, accountant, viewer, client) kanë users.org_id.
  - Owner-i dhe adminët e platformës nuk i përkasin asnjë studioje; zgjedhin se cilën
    studio po shohin (users.active_org_id) nga faqja "Studiot".
  - Çdo e dhënë e studios (subjektet → rekordet, ekzekutimet, historiku) filtrohet me org_id.
  - Plani vendos sa biznese (subjekte) mund të regjistrojë studioja; mbi kufirin lejohet
    vetëm kur plani ka tarifë shtesë (price_extra > 0) ose studioja ka allow_overage.
*/

const db = require('./db');

const PLATFORM_ROLES = ['owner', 'admin'];
const isPlatform = user => !!user && PLATFORM_ROLES.includes(user.role);
const orgIdOf = user => (user ? (isPlatform(user) ? user.active_org_id : user.org_id) : null) || null;

function getOrg(id) {
  return db.prepare(`SELECT o.*, p.name AS plan_name, p.max_subjects AS plan_max, p.price_month, p.price_extra, p.ai_credits
    FROM orgs o LEFT JOIN plans p ON p.code = o.plan_code WHERE o.id = ?`).get(id);
}

// Përdorimi dhe kostoja e planit për një studio
function planInfo(orgOrId) {
  const o = typeof orgOrId === 'object' ? orgOrId : getOrg(orgOrId);
  if (!o) return null;
  const limit = o.max_subjects || o.plan_max || 0;
  const used = db.prepare('SELECT COUNT(*) c FROM subjects WHERE org_id=?').get(o.id).c;
  const overage = !!(o.allow_overage || o.price_extra > 0);
  const extra = Math.max(0, used - limit);
  const extraPrice = o.price_extra || 0;
  return {
    plan_code: o.plan_code, plan_name: o.plan_name, limit, used, overage, extra,
    price_month: o.price_month || 0, price_extra: extraPrice,
    monthly_total: Math.round(((o.price_month || 0) + extra * extraPrice) * 100) / 100,
  };
}

// A mund të shtohen n biznese të reja? Kthen { ok, error }
function canAddSubjects(orgId, n = 1) {
  const o = getOrg(orgId);
  if (!o) return { ok: false, error: 'Studioja nuk u gjet' };
  if (o.status !== 'active') return { ok: false, error: 'Studioja është e pezulluar. Kontaktoni administratorin e platformës.' };
  const p = planInfo(o);
  if (p.overage || p.used + n <= p.limit) return { ok: true, plan: p };
  return { ok: false, error: `Plani "${p.plan_name}" lejon ${p.limit} biznese (keni ${p.used}). Për më shumë, kaloni në një plan më të madh.` };
}

// Kufiri mujor i një shërbimi për studion: kuota e veçantë ose kufiri i bizneseve
function serviceLimit(orgId, serviceId) {
  const q = db.prepare('SELECT max_limit, active FROM org_quotas WHERE org_id=? AND service_id=?').get(orgId, serviceId);
  const p = planInfo(orgId);
  const base = p ? (p.overage ? Math.max(p.limit, p.used) : p.limit) : 0;
  return { max_limit: q && q.max_limit != null ? q.max_limit : base, active: q ? q.active : 1 };
}
function serviceUsed(orgId, serviceId) {
  return db.prepare('SELECT COUNT(*) c FROM service_records r JOIN subjects s ON s.id=r.subject_id WHERE r.service_id=? AND s.org_id=?').get(serviceId, orgId).c;
}

// Middleware: kërkon një studio aktive për kërkesën → req.orgId, req.org
function requireOrg(req, res, next) {
  const id = orgIdOf(req.user);
  if (!id) return res.status(409).json({ error: 'Zgjidhni një studio te faqja "Studiot".', code: 'NO_ORG' });
  const o = getOrg(id);
  if (!o) return res.status(409).json({ error: 'Studioja nuk ekziston më.', code: 'NO_ORG' });
  if (o.status !== 'active' && !isPlatform(req.user)) return res.status(403).json({ error: 'Studioja juaj është e pezulluar. Kontaktoni administratorin e platformës.' });
  req.orgId = o.id; req.org = o;
  next();
}

const subjectInOrg = (subjectId, orgId) => !!db.prepare('SELECT 1 FROM subjects WHERE id=? AND org_id=?').get(subjectId, orgId);

module.exports = { isPlatform, orgIdOf, getOrg, planInfo, canAddSubjects, serviceLimit, serviceUsed, requireOrg, subjectInOrg, PLATFORM_ROLES };
