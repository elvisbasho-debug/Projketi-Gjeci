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

  Për të shtuar një robot të ri real:
    1. Krijo src/robots/<kodi_sherbimit>.js me funksionin
       async run(subject, creds, service) → { ok, result, process_ms, status, data }
    2. Shtoje më poshtë te lista.
*/

const connectors = {};

if (process.env.ROBOTS_REAL === '1') {
  connectors.tvsh_deklarim = require('./tvsh_deklarim');
  // connectors.listepagesa_esig = require('./listepagesa_esig');
  // connectors.pash            = require('./pash');
  console.log('  Konektorët realë të robotëve u aktivizuan (ROBOTS_REAL=1).');
}

module.exports = connectors;
