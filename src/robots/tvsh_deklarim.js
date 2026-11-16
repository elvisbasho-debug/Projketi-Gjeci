'use strict';

/*
  KONEKTORI REAL — "Deklarimi dhe Informacioni mbi TVSH-në" (C@ts)
  -----------------------------------------------------------------
  Rrjedha (si te VA, shih docs/KONEKTORI-TVSH.md):
    1. Hyrje në C@ts me kredencialet e subjektit (sesion i ripërdorshëm)
    2. Pasqyra mujore për muajin aktual → TVSH mujore, kredi, totali
    3. Libri kontabël TaxTypeId=7 për 3 vitet e fundit → TVSH e paguar sipas periudhave
  Veprimet: 'info' (lexim), 'kontrollo' (lexim i statusit të deklarimit), 'deklaro' (dorëzim zyrtar →
  i ndaluar pa ROBOTS_ALLOW_DECLARE=1).
*/

const cfg = require('./cats/config');
const { getSession, dropSession, getJson } = require('./cats/session');

// Numra: JSON → si janë; tekst shqip "1.234,56" → 1234.56
const num = v => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[^\d.,-]/g, '');
  return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0;
};

// Normalizon përgjigjet e portalit në formatin e Finbot. Emrat e fushave të portalit real
// konfirmohen kur të shihen; këtu pranohen disa variante të zakonshme.
function pick(o, ...keys) { for (const k of keys) if (o && o[k] != null) return o[k]; return null; }
function parseMonthly(j) {
  const r = j && (j.data || j);
  return {
    tvsh_mujore: num(pick(r, 'vatMonthly', 'tvshMujore', 'VatBalance', 'tvsh_mujore')),
    kredi: num(pick(r, 'credit', 'kredi', 'VatCredit')),
    totali: num(pick(r, 'total', 'totali', 'Total')),
    status_deklarim: pick(r, 'declarationStatus', 'statusDeklarimi', 'DeclarationStatus'),
  };
}
function parseLedger(j) {
  const rows = Array.isArray(j) ? j : (j && (j.rows || j.data || j.items)) || [];
  return rows.map(x => ({
    period: String(pick(x, 'period', 'Period', 'periudha') || ''),         // MM-YYYY ose YYYY-MM
    paguar: num(pick(x, 'paid', 'Paid', 'amount', 'Amount', 'shuma')),
    data: pick(x, 'date', 'Date', 'data'),
  })).filter(x => x.period);
}
const toYm = p => /^\d{2}-\d{4}$/.test(p) ? `${p.slice(3)}-${p.slice(0, 2)}` : p.slice(0, 7);

async function run(subject, creds, service, action, ctx) {
  const t0 = Date.now();
  const log = (ctx && ctx.log) || (() => {});
  const fail = msg => ({ ok: false, status: 'deshtoi', result: msg, data: {}, process_ms: Date.now() - t0 });

  if (action === 'deklaro' && !cfg.allowDeclare) {
    log('warn', 'DECLARE_BLOCKED', 'Deklarimi real është i çaktivizuar (ROBOTS_ALLOW_DECLARE).');
    return fail('Deklarimi real i TVSH-së është i çaktivizuar në këtë server. Përdor "Mblidh informacionin" ose "Kontrollo".');
  }
  if (!creds || !creds.user || !creds.pass) return fail('Mungojnë kredencialet e C@ts te subjekti (përdoruesi dhe fjalëkalimi).');
  if (!cfg.monthlyPath || !cfg.ledgerPath) {
    log('warn', 'CONNECTOR_NOT_CONFIGURED', 'Mungojnë adresat e pasqyrës mujore / librit të TVSH-së në C@ts.');
    return fail('Konektori i C@ts nuk është konfiguruar ende (CATS_MONTHLY_PATH / CATS_LEDGER_PATH).');
  }

  const now = new Date();
  const period = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const vars = { nipt: subject.nipt, taxTypeId: cfg.vatTaxTypeId, period };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const session = await getSession(subject.id, creds, log);
      log('info', 'PASH_MONTHLY_OVERVIEW_STARTED', `Duke marrë të dhëna nga Pasqyra Mujore për ${period}`);
      const monthly = parseMonthly(await getJson(session, cfg.monthlyPath, vars));
      log('success', 'PASH_MONTHLY_OVERVIEW_SUCCEEDED', `Përfundoi marrja e të dhënave nga Pasqyra Mujore për ${period}`);

      if (action === 'kontrollo') {
        const d = monthly.status_deklarim;
        return { ok: true, status: /deklar/i.test(d || '') ? 'deklaruar' : 'kryer', result: d ? 'Statusi i deklarimit: ' + d : 'Statusi i deklarimit nuk u gjet',
          data: { status_deklarim: d || 'Pa deklaruar' }, process_ms: Date.now() - t0 };
      }

      const history = [];
      for (const year of [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]) {
        log('info', 'CATS_TAX_LEDGER_COLLECTION_STARTED', `Po mblidhet libri kontabël C@ts për TaxTypeId ${cfg.vatTaxTypeId}, viti ${year}.`);
        const rows = parseLedger(await getJson(session, cfg.ledgerPath, { ...vars, year }));
        rows.forEach(r => history.push({ period: toYm(r.period), data: { tvsh_paguar: r.paguar } }));
        log('success', 'CATS_TAX_LEDGER_COLLECTION_SUCCEEDED', `U mblodhën ${rows.length} rreshta për ${year}.`);
      }
      log('success', 'VAT_INFO_SUCCEEDED', 'Të dhënat e TVSH-së u përditësuan.');
      const lastPaid = history.slice().sort((a, b) => b.period.localeCompare(a.period))[0];
      return {
        ok: true, status: 'kryer', result: 'Informacioni i TVSH-së u mblodh nga C@ts',
        data: { status_info: 'Kryer', tvsh_mujore: monthly.tvsh_mujore, kredi: monthly.kredi, totali: monthly.totali,
          ...(lastPaid ? { tvsh_paguar: lastPaid.data.tvsh_paguar } : {}),
          ...(monthly.status_deklarim ? { status_deklarim: monthly.status_deklarim } : {}) },
        history, process_ms: Date.now() - t0,
      };
    } catch (e) {
      if (e.sessionExpired && attempt === 1) { log('warn', 'SESSION_EXPIRED', 'Sesioni skadoi, po rihyhet.'); await dropSession(subject.id); continue; }
      log('error', 'VAT_INFO_FAILED', e.message);
      return fail('C@ts: ' + e.message);
    }
  }
  return fail('C@ts: sesioni nuk u rikthye');
}

module.exports = { run };
