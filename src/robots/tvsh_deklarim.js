'use strict';

/*
  KONEKTOR — "Deklarimi dhe Informacioni mbi TVSH-në"
  Shembulli i plotë: pas login-it, LEXON vlerat realisht nga faqja.
  Për portalin real: jep portalUrl dhe përshtat selektorët/hapat te extract().
*/

const { makeConnector, toInt } = require('./base');

module.exports = makeConnector('tvsh_deklarim', {
  // portalUrl: 'https://portali-real.example.al/tvsh',
  extract: async (page) => {
    const tvsh = await page.textContent('#tvsh-value');
    const total = await page.textContent('#total-value');
    const kredi = await page.textContent('#kredi-value');
    // Në prodhim këtu do klikohej "Deklaro" dhe do konfirmohej:
    //   await page.click('#deklaro'); await page.waitForSelector('#konfirmim');
    return {
      status: 'deklaruar',
      result: 'Të dhënat u lexuan dhe deklarimi u përgatit.',
      data: { tvsh_mujore: toInt(tvsh), totali: toInt(total), kredi: toInt(kredi) },
    };
  },
});
