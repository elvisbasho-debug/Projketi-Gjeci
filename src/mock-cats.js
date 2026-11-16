'use strict';

/*
  C@ts I SIMULUAR — vetëm për zhvillim/testim (nuk ngarkohet në prodhim).
  Ka të njëjtën formë hyrjeje si portali real (UserName, Password, AcceptTermsAndConditions,
  __RequestVerificationToken) dhe dy thirrje JSON pas hyrjes. Fjalëkalimi i pranuar: "demo-fjalekalim"
  (ai që përdor seed-i për subjektet demo).
*/

const express = require('express');
const crypto = require('crypto');

const router = express.Router();
router.use(express.urlencoded({ extended: false }));
const sessions = new Set();
const PASS = process.env.MOCK_CATS_PASS || 'demo-fjalekalim';
const cookieName = 'mockcats';
const authed = req => sessions.has((req.headers.cookie || '').split(/;\s*/).map(c => c.split('=')).find(c => c[0] === cookieName)?.[1]);

const logon = err => `<!doctype html><html><head><meta charset="utf-8"><title>Log On</title></head><body>
  <h1>E-Tax (simulim lokal)</h1>${err ? `<div class="validation-summary-errors"><ul><li>${err}</li></ul></div>` : ''}
  <form action="/mock-cats/Account/Authenticate?returnUrl=%2F" method="post">
    <input type="hidden" name="__RequestVerificationToken" value="${crypto.randomBytes(8).toString('hex')}">
    <input type="text" name="UserName"> <input type="password" name="Password">
    <select name="LanguageID"><option value="1">Shqip</option></select>
    <input type="checkbox" name="AcceptTermsAndConditions" value="true"><input type="hidden" name="AcceptTermsAndConditions" value="false">
    <input type="submit" value="Hyr">
  </form></body></html>`;

router.get('/Account/LogOn', (req, res) => res.send(logon()));
router.post('/Account/Authenticate', async (req, res) => {
  await new Promise(r => setTimeout(r, 1500)); // hyrja reale është e ngadaltë
  const terms = [].concat(req.body.AcceptTermsAndConditions || []).includes('true');
  if (!req.body.UserName || req.body.Password !== PASS) return res.send(logon('Emri i përdoruesit ose fjalëkalimi është i pasaktë.'));
  if (!terms) return res.send(logon('Duhet të pranoni kushtet.'));
  const sid = crypto.randomBytes(12).toString('hex'); sessions.add(sid);
  res.setHeader('Set-Cookie', `${cookieName}=${sid}; Path=/mock-cats; HttpOnly`);
  res.redirect('/mock-cats/Home');
});
router.get('/Home', (req, res) => authed(req) ? res.send('<!doctype html><title>Home</title><h1>Mirëseerdhët</h1>') : res.redirect('/mock-cats/Account/LogOn'));

// Vlera të qëndrueshme për NIPT + periudhë (që testet të përsëriten)
const seeded = (s, lo, hi) => { const h = crypto.createHash('md5').update(s).digest().readUInt32BE(0); return lo + (h % (hi - lo + 1)); };

router.get('/api/monthly', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
  const k = `${req.query.nipt}|${req.query.period}`;
  const vat = seeded(k + 'v', -300000, 120000), credit = seeded(k + 'c', 0, 600000);
  res.json({ data: { vatMonthly: vat, credit, total: vat - Math.round(credit / 4), declarationStatus: seeded(k + 'd', 0, 3) ? 'Deklaruar' : 'Pa deklaruar' } });
});
router.get('/api/ledger', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
  const y = Number(req.query.year), now = new Date();
  const last = y === now.getFullYear() ? now.getMonth() : 12; // muajt e mbyllur
  const rows = Array.from({ length: last }, (_, i) => {
    const p = `${String(i + 1).padStart(2, '0')}-${y}`;
    return { period: p, paid: seeded(req.query.nipt + p, 0, 250000), date: `${y}-${String(i + 1).padStart(2, '0')}-15` };
  });
  res.json({ rows });
});

module.exports = router;
