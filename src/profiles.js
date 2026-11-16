'use strict';

// Profilet e simuluar për çdo shërbim. Japin rezultate realiste specifike për
// shërbimin DHE për veprimin (p.sh. "blerjet" te mbledhja e faturave).
// Përdoret nga motori dhe nga seed-i. Kthen { status, result, data } ku data
// bashkohet me të dhënat ekzistuese të rekordit.

const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const chance = p => Math.random() < p;

const PROFILES = {
  mbledhje_fatura: action => {
    const st = chance(0.85) ? 'Kryer' : 'Dështoi';
    if (action === 'shitjet') return { status: st === 'Kryer' ? 'kryer' : 'deshtoi', result: 'Shitjet: ' + st, data: { status_shitje: st, fatura: rnd(0, 120) } };
    if (action === 'blerjet') return { status: st === 'Kryer' ? 'kryer' : 'deshtoi', result: 'Blerjet: ' + st, data: { status_blerje: st, fatura: rnd(0, 120) } };
    return { status: 'kryer', result: 'Mbledhja u krye', data: { status_blerje: 'Kryer', status_shitje: 'Kryer', fatura: rnd(0, 120) } };
  },
  tvsh_deklarim: action => {
    if (action === 'deklaro') return { status: 'deklaruar', result: 'TVSH-ja u deklarua', data: { status_deklarim: 'Deklaruar' } };
    if (action === 'kontrollo') { const d = chance(0.8); return { status: d ? 'deklaruar' : 'kryer', result: d ? 'Deklarata është e pranuar' : 'Nuk është deklaruar ende', data: { status_deklarim: d ? 'Deklaruar' : 'Pa deklaruar' } }; }
    const kredi = rnd(0, 800000), tvsh = rnd(-300000, 100000);
    const out = { status: 'kryer', result: 'Informacioni i TVSH-së u mblodh', data: { status_info: 'Kryer', kredi, tvsh_mujore: tvsh, totali: tvsh - Math.round(kredi / 4), tvsh_paguar: rnd(0, 250000) } };
    if (!action) { out.status = 'deklaruar'; out.result = 'Deklaruar'; out.data.status_deklarim = 'Deklaruar'; }
    return out;
  },
  detyrime_realtime: () => ({ status: 'kryer', result: 'Kryer', data: { detyrime: rnd(0, 6000000) } }),
  xhiro_shpenzime: () => { const ta = rnd(0, 20000000), sh = rnd(0, 15000000); return { status: 'kryer', result: 'Kryer', data: { te_ardhura: ta, shpenzime: sh, bilanci: ta - sh } }; },
  tvsh_krahasim: () => { const ok = chance(0.7); return { status: ok ? 'kryer' : 'deshtoi', result: ok ? 'Përputhet' : 'Nuk përputhet', data: { krahasimi: ok ? 'Përputhet' : 'Nuk përputhet' } }; },
  tatim_burim_qira: () => { const ok = chance(0.6); const r = ok ? 'Deklaruar' : 'Dështoi – I paregjistruar T.B'; return { status: ok ? 'deklaruar' : 'deshtoi', result: r, data: { rezultati: r } }; },
  listepagesa_esig: () => { const r = pick(['Deklaruar', 'Plotëson DIVA', 'Nuk vendoset DIVA', 'Nuk plotëson DIVA', 'Nuk ka të dhëna DIVA']); const ok = r === 'Deklaruar' || r === 'Plotëson DIVA'; return { status: ok ? 'kryer' : 'deshtoi', result: r, data: { rezultati: r } }; },
  dogana_importe: () => { const n = rnd(0, 5); return { status: 'kryer', result: 'Kryer', data: { deklarata: n, totali_doganor: n * rnd(50000, 900000) } }; },
  cats_dokumente: () => { const ok = chance(0.75); return { status: ok ? 'kryer' : 'deshtoi', result: ok ? 'Kryer' : 'Dështoi', data: { dokumente: ok ? rnd(0, 3) : 0 } }; },
  padeklaruara: () => ({ status: 'kryer', result: 'Kryer', data: { deklarata: rnd(0, 4), afati: '14.12.2026' } }),
  pash: () => ({ status: 'kryer', result: 'Kryer', data: { te_ardhura_shitja: rnd(1000000, 150000000), fitimi_humbja: rnd(-20000000, 60000000) } }),
};

function simulate(code, action) {
  const f = PROFILES[code] || PROFILES.tvsh_deklarim;
  const r = f(action);
  return { ok: r.status !== 'deshtoi', ...r };
}

// Etiketat shqip për fushat e të dhënave (për pamjen e detajeve)
const LABELS = {
  tvsh_mujore: 'TVSH mujore', totali: 'Totali', kredi: 'Kredi', fatura: 'Fatura të mbledhura',
  detyrime: 'Detyrime gjithsej', te_ardhura: 'Të ardhura', shpenzime: 'Shpenzime', bilanci: 'Bilanci i transaksioneve',
  deklarata: 'Deklarata', dokumente: 'Dokumente', afati: 'Afati më i afërt',
  te_ardhura_shitja: 'Të ardhura nga shitja', fitimi_humbja: 'Fitimi neto / Humbja',
  status_blerje: 'Status blerje', status_shitje: 'Status shitje', status_deklarim: 'Status deklarim', status_info: 'Statusi info',
  krahasimi: 'Rezultati i krahasimit', rezultati: 'Rezultati', totali_doganor: 'Totali doganor',
};

module.exports = { simulate, LABELS, rnd };
