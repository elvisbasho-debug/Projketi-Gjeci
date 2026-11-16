'use strict';

/*
  Skema e çdo shërbimi: kolonat specifike të tabelës, veprimet e menusë
  "Veprime" dhe udhëzuesi i shkurtër. Përdoret nga API-ja dhe nga eksporti CSV.

  type: money | num | text | status
  Veprimi i parë është veprimi i parazgjedhur (butoni ▶ te rreshti).
*/

const SCHEMA = {
  mbledhje_fatura: {
    columns: [
      { key: 'status_blerje', label: 'Status blerje', type: 'status' },
      { key: 'status_shitje', label: 'Status shitje', type: 'status' },
      { key: 'fatura', label: 'Fatura', type: 'num' },
    ],
    actions: [
      { key: 'blerjet', label: 'Mblidh blerjet' },
      { key: 'shitjet', label: 'Mblidh shitjet' },
    ],
    guide: 'Mbledh faturat e blerjeve dhe të shitjeve nga Self-Care për periudhën e zgjedhur. Vendos periudhën me "Datat masive" para se të nisësh mbledhjen.',
  },
  tvsh_deklarim: {
    columns: [
      { key: 'status_deklarim', label: 'Status deklarim', type: 'status' },
      { key: 'status_info', label: 'Statusi info', type: 'status' },
      { key: 'kredi', label: 'Kredi', type: 'money' },
      { key: 'tvsh_mujore', label: 'TVSH mujore', type: 'money' },
      { key: 'totali', label: 'Totali', type: 'money' },
      { key: 'tvsh_paguar', label: 'TVSH e paguar', type: 'money' },
    ],
    actions: [
      { key: 'deklaro', label: 'Deklaro TVSH-në' },
      { key: 'kontrollo', label: 'Kontrollo deklarimin' },
      { key: 'info', label: 'Mblidh informacionin e TVSH-së' },
    ],
    metric: 'tvsh_mujore', // treguesi i Statistikave
    guide: 'Deklaro TVSH-në për periudhën, kontrollo nëse deklarimi është pranuar dhe mblidh informacionin (kredi, TVSH mujore, totali). Vlerat negative tregojnë kredi për t\'u bartur.',
  },
  detyrime_realtime: {
    columns: [{ key: 'detyrime', label: 'Detyrime gjithsej', type: 'money' }],
    actions: [{ key: 'kontrollo', label: 'Kontrollo detyrimet' }],
    guide: 'Lexon detyrimet tatimore në kohë reale dhe urdhërpagesat e gjeneruara për çdo subjekt.',
  },
  xhiro_shpenzime: {
    columns: [
      { key: 'te_ardhura', label: 'Të ardhurat', type: 'money' },
      { key: 'shpenzime', label: 'Shpenzimet', type: 'money' },
      { key: 'bilanci', label: 'Bilanci i trans.', type: 'money' },
    ],
    actions: [{ key: 'mblidh', label: 'Mblidh xhiron dhe shpenzimet' }],
    guide: 'Mbledh xhiron dhe shpenzimet nga Self-Care dhe llogarit bilancin e transaksioneve për periudhën.',
  },
  tvsh_krahasim: {
    columns: [{ key: 'krahasimi', label: 'Rezultati i krahasimit', type: 'text' }],
    actions: [{ key: 'krahaso', label: 'Krahaso Self-Care me C@ts' }],
    guide: 'Krahason TVSH-në e deklaruar në Self-Care me atë në C@ts dhe shënon mospërputhjet.',
  },
  tatim_burim_qira: {
    columns: [{ key: 'rezultati', label: 'Rezultati i deklarimit', type: 'text' }],
    actions: [{ key: 'deklaro', label: 'Deklaro tatimin në burim' }],
    guide: 'Deklaron tatimin në burim për qiratë. Subjekti duhet të jetë i regjistruar për tatim në burim.',
  },
  listepagesa_esig: {
    columns: [{ key: 'rezultati', label: 'Rezultati', type: 'text' }],
    actions: [
      { key: 'deklaro', label: 'Deklaro listëpagesën' },
      { key: 'kontrollo', label: 'Kontrollo DIVA' },
    ],
    guide: 'Deklaron listëpagesën (E-Sig 25) dhe kontrollon nëse plotëson kushtet e DIVA-s.',
  },
  dogana_importe: {
    columns: [
      { key: 'deklarata', label: 'Deklarata', type: 'num' },
      { key: 'totali_doganor', label: 'Totali doganor', type: 'money' },
    ],
    actions: [{ key: 'kontrollo', label: 'Kontrollo deklaratat doganore' }],
    guide: 'Kontrollon deklaratat doganore të importeve dhe mbledh totalin doganor.',
  },
  cats_dokumente: {
    columns: [{ key: 'dokumente', label: 'Dokumenta', type: 'num' }],
    actions: [{ key: 'kontrollo', label: 'Kontrollo dokumentet' }],
    guide: 'Kontrollon dokumentet e reja në C@ts (njoftime, vendime, kërkesa) për çdo subjekt.',
  },
  padeklaruara: {
    columns: [
      { key: 'deklarata', label: 'Deklarata', type: 'num' },
      { key: 'afati', label: 'Afati më i afërt', type: 'text' },
    ],
    actions: [{ key: 'kontrollo', label: 'Kontrollo të padeklaruarat' }],
    guide: 'Gjen deklaratat që nuk janë dorëzuar ende dhe afatin më të afërt.',
  },
  pash: {
    columns: [
      { key: 'te_ardhura_shitja', label: 'Të ardhura nga shitja', type: 'money' },
      { key: 'fitimi_humbja', label: 'Fitimi neto / Humbja', type: 'money' },
    ],
    actions: [{ key: 'mblidh', label: 'Mblidh pasqyrën' }],
    guide: 'Mbledh pasqyrën e të ardhurave dhe shpenzimeve (PASH) për vitin.',
  },
};

const FALLBACK = { columns: [], actions: [{ key: 'ekzekuto', label: 'Ekzekuto' }], guide: '' };

function schemaFor(code) { return SCHEMA[code] || FALLBACK; }

module.exports = { SCHEMA, schemaFor };
