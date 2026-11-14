'use strict';

/*
  KONEKTOR — "Kontrollo Deklaratat e Mia të Padeklaruara"
  Login-i real në portal kryhet nga baza (src/robots/base.js).
  Tani përdoret profili i shërbimit për të dhënat (simulim).

  PËR PORTALIN REAL: hap komentin te `extract`, vendos `portalUrl` dhe shkruaj
  hapat specifikë (navigim, lexim vlerash, deklarim, OTP nëse duhet).
*/

const { makeConnector } = require('./base');

module.exports = makeConnector('padeklaruara', {
  // portalUrl: 'https://portali-real.example.al/padeklaruara',
  // extract: async (page, subject, service) => {
  //   // await page.goto(...); await page.click(...);
  //   // const vlera = await page.textContent('#selektori');
  //   return { status: 'kryer', result: 'Kryer', data: { /* ... */ } };
  // },
});
