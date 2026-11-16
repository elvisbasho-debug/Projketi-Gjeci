'use strict';

/*
  FATURIMI I STUDIOVE
  -------------------
  - Në ditën e 1 të çdo muaji (ose me dorë nga faqja "Studiot") lëshohet një faturë për muajin
    që sapo mbaroi, për çdo studio aktive që nuk është në periudhë prove.
  - Shuma = çmimi i planit + (biznese mbi kufirin × tarifa shtesë), plus TVSH-ja e platformës.
  - Afati i pagesës: 15 ditë. Faturat e papaguara pas afatit dalin "të vonuara" dhe studioja
    merr një njoftim kujtese (një herë në 7 ditë).
*/

const db = require('./db');
const { getOrg, planInfo } = require('./org');

const DUE_DAYS = Number(process.env.INVOICE_DUE_DAYS || 15);
const VAT_RATE = Number(process.env.INVOICE_VAT_RATE ?? 0.2);
const round = n => Math.round(n * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const prevMonth = () => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };

// Të dhënat e lëshuesit të faturës (platforma)
function issuer() {
  const row = db.prepare("SELECT value FROM settings WHERE key='platform'").get();
  return Object.assign({ name: 'Finbot', nipt: '', address: 'Tiranë, Shqipëri', email: '', iban: '', bank: '' }, row ? JSON.parse(row.value) : {});
}
function saveIssuer(data) {
  const keep = ['name', 'nipt', 'address', 'email', 'iban', 'bank'];
  const v = Object.fromEntries(keep.map(k => [k, String((data || {})[k] || '').trim()]));
  db.prepare("INSERT INTO settings (key,value) VALUES ('platform', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(v));
  return v;
}

function nextNumber(year) {
  const last = db.prepare("SELECT number FROM invoices WHERE number LIKE ? ORDER BY id DESC LIMIT 1").get(`FB-${year}-%`);
  const n = last ? Number(last.number.split('-')[2]) + 1 : 1;
  return `FB-${year}-${String(n).padStart(4, '0')}`;
}

const inTrial = (o, period) => !!o.trial_ends && o.trial_ends >= `${period}-28`;

// Lëshon faturat për një muaj. Kthen { created, skipped }
function generateInvoices(period = prevMonth()) {
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error('Periudhë e pavlefshme');
  let created = 0, skipped = 0;
  const orgs = db.prepare("SELECT id FROM orgs WHERE status='active'").all();
  db.transaction(() => {
    for (const { id } of orgs) {
      const o = getOrg(id);
      if (inTrial(o, period) || db.prepare('SELECT 1 FROM invoices WHERE org_id=? AND period=?').get(id, period)) { skipped++; continue; }
      const p = planInfo(o);
      const subtotal = round(p.price_month + p.extra * p.price_extra);
      const vat = round(subtotal * VAT_RATE);
      const issued = today();
      db.prepare(`INSERT INTO invoices (org_id, number, period, plan_code, plan_name, base_price, subjects, plan_limit, extra, extra_price,
        subtotal, vat_rate, vat, total, issued_at, due_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, nextNumber(issued.slice(0, 4)), period, p.plan_code, p.plan_name, p.price_month, p.used, p.limit, p.extra, p.price_extra,
          subtotal, VAT_RATE, vat, round(subtotal + vat), issued, addDays(issued, DUE_DAYS));
      db.prepare("INSERT INTO notifications (title, body, level, org_id) VALUES (?,?,'info',?)")
        .run('Fatura e re e abonimit', `Fatura për ${period}: ${round(subtotal + vat)} € (afati ${addDays(issued, DUE_DAYS)}). Shihni Cilësimet → Faturat.`, id);
      created++;
    }
  })();
  return { created, skipped, period };
}

// Statusi i shfaqur: "vonuar" kur afati ka kaluar dhe s'është paguar
const displayStatus = inv => (inv.status === 'e_papaguar' && inv.due_date < today() ? 'vonuar' : inv.status);

// Kujtesë për faturat e vonuara (më së shumti një herë në 7 ditë për faturë)
function remindOverdue() {
  const t = today();
  const rows = db.prepare(`SELECT * FROM invoices WHERE status='e_papaguar' AND due_date < ? AND (reminded_at IS NULL OR reminded_at <= ?)`).all(t, addDays(t, -7));
  for (const inv of rows) {
    db.prepare("INSERT INTO notifications (title, body, level, org_id) VALUES (?,?,'error',?)")
      .run('Faturë e vonuar', `Fatura ${inv.number} (${inv.total} €) ka kaluar afatin ${inv.due_date}. Ju lutemi kryeni pagesën.`, inv.org_id);
    db.prepare('UPDATE invoices SET reminded_at=? WHERE id=?').run(t, inv.id);
  }
  return rows.length;
}

// Kontroll ditor: në datën 1 lëshohen faturat e muajit të kaluar; çdo ditë dërgohen kujtesat
let timer = null;
function daily() {
  try {
    if (new Date().getUTCDate() === 1 || !db.prepare('SELECT 1 FROM invoices WHERE period=?').get(prevMonth())) {
      if (process.env.BILLING_AUTO !== '0' && db.prepare('SELECT COUNT(*) c FROM invoices').get().c > 0) generateInvoices(prevMonth());
    }
    remindOverdue();
  } catch (e) { console.error('billing:', e.message); }
}
function start() {
  if (timer) return;
  daily();
  timer = setInterval(daily, 6 * 60 * 60 * 1000);
}

module.exports = { generateInvoices, remindOverdue, displayStatus, issuer, saveIssuer, prevMonth, start };
