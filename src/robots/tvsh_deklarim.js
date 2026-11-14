'use strict';

/*
  ROBOT SHEMBULL — "Deklarimi dhe Informacioni mbi TVSH-në"
  ----------------------------------------------------------
  Tregon strukturën reale të një roboti RPA:
    1) hap një browser,
    2) hyn në portal me kredencialet e subjektit,
    3) lexon vlerat (TVSH, totali, kredi),
    4) (në prodhim) kryen deklarimin,
    5) kthen rezultatin e strukturuar.

  Tani punon kundër një PORTALI DEMO LOKAL (public/mock-portal.html), që i gjithë
  tubacioni të provohet pa prekur sisteme reale.

  PËR PORTALIN REAL:
    - vendos MOCK_PORTAL_URL = URL-ja reale (p.sh. e-Albania / Self-Care)
    - përshtat selektorët (#username, #password, #login, #tvsh-value …)
    - shto hapat e deklarimit dhe trajtimin e OTP/captcha nëse duhen.
*/

const { chromium } = require('playwright');

const PORTAL_URL = process.env.MOCK_PORTAL_URL ||
  `http://localhost:${process.env.PORT || 3000}/mock-portal.html`;

function toInt(s) { return parseInt(String(s || '').replace(/[^\d-]/g, ''), 10) || 0; }

async function run(subject, creds, service) {
  const t0 = Date.now();

  if (!creds || !creds.user || !creds.pass) {
    return { ok: false, result: 'Mungojnë kredencialet e-Albania të subjektit.', process_ms: Date.now() - t0, status: 'deshtoi', data: {} };
  }

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();

    // 1) Hap portalin
    await page.goto(PORTAL_URL, { waitUntil: 'networkidle', timeout: 20000 });

    // 2) Hyr me kredencialet e subjektit
    await page.fill('#username', creds.user);
    await page.fill('#password', creds.pass);
    await page.click('#login');

    // 3) Prit panelin dhe lexo vlerat
    await page.waitForSelector('#tvsh-value', { timeout: 15000 });
    const tvsh = await page.textContent('#tvsh-value');
    const total = await page.textContent('#total-value');
    const kredi = await page.textContent('#kredi-value');

    // 4) Në prodhim: këtu do klikohej "Deklaro" dhe do konfirmohej deklarimi.
    //    await page.click('#deklaro'); await page.waitForSelector('#konfirmim');

    const data = { tvsh_mujore: toInt(tvsh), totali: toInt(total), kredi: toInt(kredi) };
    return {
      ok: true,
      result: 'Të dhënat u lexuan nga portali dhe deklarimi u përgatit.',
      process_ms: Date.now() - t0,
      status: 'deklaruar',
      data,
    };
  } catch (e) {
    return { ok: false, result: 'Gabim gjatë automatizimit: ' + (e.message || e), process_ms: Date.now() - t0, status: 'deshtoi', data: {} };
  } finally {
    await browser.close();
  }
}

module.exports = { run };
