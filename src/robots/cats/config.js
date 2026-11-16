'use strict';

/*
  KONFIGURIMI I C@ts (efiling.tatime.gov.al)
  ------------------------------------------
  Hyrja (e konfirmuar nga faqja publike, 16 Nov 2026):
    GET  /cats_public/Account/LogOn                → forma me __RequestVerificationToken
    POST /cats_public/Account/Authenticate         → UserName, Password, LanguageID, AcceptTermsAndConditions

  Thirrjet pas hyrjes (libri i TVSH-së me TaxTypeId=7, Pasqyra mujore) NUK janë konfirmuar ende:
  vendosen me variablat e mjedisit sapo të shihen në portal me një llogari të autorizuar.
  Pa to, konektori ndalon me një mesazh të qartë dhe nuk shpik të dhëna.

  Për zhvillim: CATS_BASE_URL=http://localhost:3000/mock-cats përdor portalin e simuluar lokal.
*/

const base = (process.env.CATS_BASE_URL || 'https://efiling.tatime.gov.al').replace(/\/$/, '');
const isMock = /\/mock-cats$/.test(base);

module.exports = {
  base,
  isMock,
  logonPath: process.env.CATS_LOGON_PATH || (isMock ? '/Account/LogOn' : '/cats_public/Account/LogOn'),
  // Shabllone: {nipt}, {taxTypeId}, {year}, {period} (MM-YYYY) zëvendësohen në kohë ekzekutimi
  ledgerPath: process.env.CATS_LEDGER_PATH || (isMock ? '/api/ledger?nipt={nipt}&taxTypeId={taxTypeId}&year={year}' : ''),
  monthlyPath: process.env.CATS_MONTHLY_PATH || (isMock ? '/api/monthly?nipt={nipt}&period={period}' : ''),
  vatTaxTypeId: Number(process.env.CATS_VAT_TAX_TYPE_ID || 7),
  sessionTtlMs: Number(process.env.CATS_SESSION_TTL_MS || 10 * 60 * 1000),
  loginTimeoutMs: Number(process.env.CATS_LOGIN_TIMEOUT_MS || 90 * 1000),
  // Deklarimi real dorëzon dokument zyrtar → i ndaluar pa leje të qartë në mjedis
  allowDeclare: process.env.ROBOTS_ALLOW_DECLARE === '1',
};
