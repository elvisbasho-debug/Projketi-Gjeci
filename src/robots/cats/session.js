'use strict';

/*
  SESIONET E C@ts
  ---------------
  Hyrja është pjesa më e ngadaltë (te VA ~50s). Prandaj mbajmë një sesion
  (BrowserContext me cookies) për çdo subjekt për disa minuta: kërkesa e dytë
  e klientit përdor të njëjtin sesion pa rihyrë.
*/

const { chromium } = require('playwright');
const cfg = require('./config');

let browserP = null;
const sessions = new Map(); // subjectId → { ctx, page, expires, pending }

async function browser() {
  if (!browserP) browserP = chromium.launch({ args: ['--no-sandbox'] }).catch(e => { browserP = null; throw e; });
  return browserP;
}

async function login(creds, log) {
  const b = await browser();
  const ctx = await b.newContext({ locale: 'sq-AL' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(cfg.loginTimeoutMs);
  try {
    log('info', 'AUTH_STARTED', 'Po hyhet në C@ts…');
    await page.goto(cfg.base + cfg.logonPath, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="UserName"]', creds.user);
    await page.fill('input[name="Password"]', creds.pass);
    const terms = page.locator('input[type="checkbox"][name="AcceptTermsAndConditions"]');
    if (await terms.count()) await terms.check();
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.locator('form[action*="Authenticate"] [type="submit"]').first().click(),
    ]);
    // Nëse jemi ende te faqja e hyrjes → kredenciale të gabuara ose bllokim
    if (/Account\/(LogOn|Authenticate)/i.test(page.url())) {
      const msg = (await page.locator('.validation-summary-errors, .field-validation-error, .alert-danger').allInnerTexts().catch(() => [])).join(' ').trim();
      throw new Error('Hyrja në C@ts dështoi' + (msg ? ': ' + msg : ' (kontrollo përdoruesin/fjalëkalimin te subjekti)'));
    }
    log('success', 'AUTH_SUCCEEDED', 'Hyrja në C@ts u krye.');
    return { ctx, page };
  } catch (e) {
    await ctx.close().catch(() => {});
    log('error', 'AUTH_FAILED', e.message);
    throw e;
  }
}

// Kthen një sesion të vlefshëm (i ripërdorur ose i ri). Hyrjet paralele për të njëjtin subjekt bashkohen.
async function getSession(subjectId, creds, log) {
  const s = sessions.get(subjectId);
  if (s && s.page && s.expires > Date.now()) { log('info', 'AUTH_REUSED', 'Po përdoret sesioni ekzistues i C@ts.'); return s; }
  if (s && s.pending) return s.pending;
  if (s && s.ctx) await s.ctx.close().catch(() => {});
  const pending = login(creds, log).then(r => {
    const entry = { ...r, expires: Date.now() + cfg.sessionTtlMs };
    sessions.set(subjectId, entry);
    return entry;
  }).catch(e => { sessions.delete(subjectId); throw e; });
  sessions.set(subjectId, { pending });
  return pending;
}

async function dropSession(subjectId) {
  const s = sessions.get(subjectId);
  sessions.delete(subjectId);
  if (s && s.ctx) await s.ctx.close().catch(() => {});
}

// Thirrje JSON me cookies e sesionit (si thirrjet që bën vetë portali)
async function getJson(session, pathTpl, vars) {
  const path = pathTpl.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vars[k] == null ? '' : vars[k]));
  const res = await session.ctx.request.get(cfg.base + path, { headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' } });
  if (res.status() === 401 || res.status() === 403 || /Account\/LogOn/i.test(res.url())) {
    const err = new Error('Sesioni i C@ts skadoi'); err.sessionExpired = true; throw err;
  }
  if (!res.ok()) throw new Error(`C@ts ktheu ${res.status()} për ${path.split('?')[0]}`);
  return res.json();
}

module.exports = { getSession, dropSession, getJson };
