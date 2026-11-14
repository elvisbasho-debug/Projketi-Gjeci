'use strict';

/*
  KONEKTOR — "Deklarimi dhe kontrolli i listëpagesës (Esig-25)"
  Login-i real në portal kryhet nga baza (src/robots/base.js).
  Tani përdoret profili i shërbimit për të dhënat (simulim).

  PËR PORTALIN REAL: hap komentin te `extract`, vendos `portalUrl` dhe shkruaj
  hapat specifikë (navigim, lexim vlerash, deklarim, OTP nëse duhet).
*/

const { makeConnector } = require('./base');

module.exports = makeConnector('listepagesa_esig', {
  // portalUrl: 'https://portali-real.example.al/listepagesa_esig',
  // extract: async (page, subject, service) => {
  //   // await page.goto(...); await page.click(...);
  //   // const vlera = await page.textContent('#selektori');
  //   return { status: 'kryer', result: 'Kryer', data: { /* ... */ } };
  // },
});
