'use strict';

// Profilet e simuluar për çdo shërbim — japin rezultate/të dhëna realiste
// specifike për llojin e shërbimit. Përdoret nga motori dhe nga seed-i.

const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const PROFILES = {
  mbledhje_fatura:   () => ({ status: 'kryer', result: 'Mbledhja u krye', data: { fatura: rnd(0, 120) } }),
  tvsh_deklarim:     () => ({ status: 'deklaruar', result: 'Deklaruar', data: { tvsh_mujore: rnd(-300000, 100000), totali: rnd(-500000, 200000), kredi: rnd(0, 800000) } }),
  detyrime_realtime: () => ({ status: 'kryer', result: 'Kryer', data: { detyrime: rnd(0, 6000000) } }),
  xhiro_shpenzime:   () => { const s = Math.random() > 0.3; return s ? { status: 'kryer', result: 'Kryer', data: { te_ardhura: rnd(0, 20000000), shpenzime: rnd(0, 15000000), bilanci: rnd(-2000000, 5000000) } } : { status: 'ne_pritje', result: 'Nuk ka nisur', data: { te_ardhura: 0, shpenzime: 0, bilanci: 0 } }; },
  tvsh_krahasim:     () => { const ok = Math.random() > 0.3; return { status: ok ? 'kryer' : 'deshtoi', result: ok ? 'Përputhet' : 'Nuk përputhet', data: {} }; },
  tatim_burim_qira:  () => { const ok = Math.random() > 0.4; return { status: ok ? 'deklaruar' : 'deshtoi', result: ok ? 'Deklaruar' : 'Dështoi – I paregjistruar T.B', data: {} }; },
  listepagesa_esig:  () => { const r = pick(['Deklaruar', 'Plotëson DIVA', 'Nuk vendoset DIVA', 'Nuk plotëson DIVA', 'Nuk ka të dhëna DIVA']); const ok = /deklaruar|plotëson diva/i.test(r) && r !== 'Nuk plotëson DIVA'; return { status: ok ? 'kryer' : 'deshtoi', result: r, data: {} }; },
  dogana_importe:    () => ({ status: 'kryer', result: 'Kryer', data: { deklarata: rnd(0, 5) } }),
  cats_dokumente:    () => { const ok = Math.random() > 0.25; return { status: ok ? 'kryer' : 'deshtoi', result: ok ? 'Kryer' : 'Dështoi', data: { dokumente: ok ? rnd(0, 3) : 0 } }; },
  padeklaruara:      () => ({ status: 'kryer', result: 'Kryer', data: { deklarata: rnd(1, 4), afati: '14.12.2026' } }),
  pash:              () => ({ status: 'kryer', result: 'Kryer', data: { te_ardhura_shitja: rnd(1000000, 150000000), fitimi_humbja: rnd(-20000000, 60000000) } }),
};

function simulate(code) {
  const f = PROFILES[code] || PROFILES.tvsh_deklarim;
  const r = f();
  return { ok: r.status !== 'deshtoi', ...r };
}

// Etiketat shqip për fushat e të dhënave (për pamjen e detajeve)
const LABELS = {
  tvsh_mujore: 'TVSH mujore', totali: 'Totali', kredi: 'Kredi', fatura: 'Fatura të mbledhura',
  detyrime: 'Detyrime gjithsej', te_ardhura: 'Të ardhura', shpenzime: 'Shpenzime', bilanci: 'Bilanci i transaksioneve',
  deklarata: 'Deklarata', dokumente: 'Dokumente', afati: 'Afati më i afërt',
  te_ardhura_shitja: 'Të ardhura nga shitja', fitimi_humbja: 'Fitimi neto / Humbja',
};

module.exports = { simulate, LABELS, rnd };
