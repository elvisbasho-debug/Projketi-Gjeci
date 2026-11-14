'use strict';

/*
  BAZA E PËRBASHKËT E KONEKTORËVE
  --------------------------------
  Pjesa e përbashkët e çdo roboti real: hap browser-in, hyn në portal me
  kredencialet e subjektit, dhe (opsionalisht) lexon vlera nga faqja.

  Çdo shërbim ka modulin e vet te src/robots/<kodi>.js që e përdor këtë bazë.
  Për portalin real: jep `portalUrl` dhe shkruaj hapat te `extract(page)`.
*/

const { chromium } = require('playwright');
const profiles = require('../profiles');

const DEFAULT_PORTAL = process.env.MOCK_PORTAL_URL ||
  `http://localhost:${process.env.PORT || 3000}/mock-portal.html`;

function toInt(s) { return parseInt(String(s || '').replace(/[^\d-]/g, ''), 10) || 0; }

// Hap browser-in dhe hyn në portal. Kthen { browser, page }.
async function openAndLogin(creds, portalUrl) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(portalUrl || DEFAULT_PORTAL, { waitUntil: 'networkidle', timeout: 20000 });
    await page.fill('#username', creds.user);
    await page.fill('#password', creds.pass);
    await page.click('#login');
    await page.waitForSelector('#tvsh-value', { timeout: 15000 });
    return { browser, page };
  } catch (e) {
    await browser.close();
    throw e;
  }
}

/*
  Fabrikë konektorësh. `extract(page, subject, service)` kthen
  { status, result, data }. Nëse mungon, përdoret profili i simuluar i shërbimit
  (por login-i real në portal kryhet gjithsesi).
*/
function makeConnector(serviceCode, opts = {}) {
  const { portalUrl, extract } = opts;
  return {
    async run(subject, creds, service) {
      const t0 = Date.now();
      if (!creds || !creds.user || !creds.pass) {
        return { ok: false, result: 'Mungojnë kredencialet e-Albania të subjektit.', process_ms: Date.now() - t0, status: 'deshtoi', data: {} };
      }
      let browser;
      try {
        const res = await openAndLogin(creds, portalUrl);
        browser = res.browser;
        const out = extract ? await extract(res.page, subject, service) : profiles.simulate(serviceCode);
        return { ok: out.status !== 'deshtoi', process_ms: Date.now() - t0, result: out.result, status: out.status, data: out.data || {} };
      } catch (e) {
        return { ok: false, result: 'Gabim gjatë automatizimit: ' + (e.message || e), process_ms: Date.now() - t0, status: 'deshtoi', data: {} };
      } finally {
        if (browser) await browser.close();
      }
    },
  };
}

module.exports = { openAndLogin, makeConnector, toInt, DEFAULT_PORTAL };
