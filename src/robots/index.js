'use strict';

/*
  REGJISTRI I KONEKTORËVE (robotëve realë)
  -----------------------------------------
  Motori (src/engine.js) kontrollon nëse ekziston një konektor për kodin e
  shërbimit. Nëse po, e thërret me kredencialet e DEKRIPTUARA të subjektit;
  përndryshe përdor ekzekutim të simuluar.

  Si parazgjedhje konektorët NUK ngarkohen (që motori të mos hapë browser për
  çdo ekzekutim gjatë zhvillimit). Aktivizoji me variablin e mjedisit:

      ROBOTS_REAL=1 npm start

  Çdo shërbim ka modulin e vet me funksionin run(subject, creds, service).
  Për ta lidhur me portalin real, redakto skedarin përkatës te src/robots/.
*/

const connectors = {};

if (process.env.ROBOTS_REAL === '1') {
  const CODES = [
    'mbledhje_fatura', 'tvsh_deklarim', 'detyrime_realtime', 'xhiro_shpenzime',
    'tvsh_krahasim', 'tatim_burim_qira', 'listepagesa_esig', 'dogana_importe',
    'cats_dokumente', 'padeklaruara', 'pash',
  ];
  for (const code of CODES) {
    try { connectors[code] = require('./' + code); }
    catch (e) { console.error('  Konektori "' + code + '" nuk u ngarkua:', e.message); }
  }
  console.log('  Konektorët realë u aktivizuan (' + Object.keys(connectors).length + ' shërbime).');
}

module.exports = connectors;
