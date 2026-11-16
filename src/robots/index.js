'use strict';

/*
  REGJISTRI I KONEKTORËVE (robotëve realë)
  -----------------------------------------
  Motori (src/engine.js) kontrollon nëse ekziston një konektor për kodin e
  shërbimit. Nëse po, e thërret me kredencialet e DEKRIPTUARA të subjektit;
  përndryshe përdor ekzekutim të simuluar.

  Aktivizimi me variablin e mjedisit ROBOTS_REAL:
      ROBOTS_REAL=1                 → të gjithë konektorët
      ROBOTS_REAL=tvsh_deklarim     → vetëm ata të listuar (të ndarë me presje)
  Konektori i TVSH-së (C@ts) konfigurohet te src/robots/cats/config.js.
*/

const connectors = {};
const CODES = [
  'mbledhje_fatura', 'tvsh_deklarim', 'detyrime_realtime', 'xhiro_shpenzime',
  'tvsh_krahasim', 'tatim_burim_qira', 'listepagesa_esig', 'dogana_importe',
  'cats_dokumente', 'padeklaruara', 'pash',
];
const want = (process.env.ROBOTS_REAL || '').trim();
const enabled = want === '1' ? CODES : want ? want.split(',').map(s => s.trim()).filter(c => CODES.includes(c)) : [];

for (const code of enabled) {
  try { connectors[code] = require('./' + code); }
  catch (e) { console.error('  Konektori "' + code + '" nuk u ngarkua:', e.message); }
}
if (enabled.length) console.log('  Konektorët realë: ' + Object.keys(connectors).join(', '));

module.exports = connectors;
