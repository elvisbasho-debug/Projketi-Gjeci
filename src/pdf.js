'use strict';

// Gjeneron PDF nga HTML duke përdorur Chromium (Playwright).
const { chromium } = require('playwright');
const archiver = require('archiver');
const { schemaFor } = require('./service-schema');

async function htmlToPdf(html) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
    });
  } finally {
    await browser.close();
  }
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = n => (Number(n) || 0).toLocaleString('sq-AL');

// Stili i përbashkët i deklaratave
function docStyle() {
  return `
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2a44; font-size: 12px; margin: 0; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1f6ff0; padding-bottom: 14px; margin-bottom: 18px; }
      .brand { display: flex; align-items: center; gap: 8px; }
      .brand .logo { width: 26px; height: 26px; border-radius: 6px; background: #1f6ff0; display: inline-block; position: relative; }
      .brand b { font-size: 18px; }
      .muted { color: #697089; }
      h1 { font-size: 16px; margin: 0 0 2px; }
      .meta { margin: 14px 0; }
      .meta div { margin-bottom: 3px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid #e2e8f2; }
      th { background: #f2f7ff; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #42506e; }
      td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
      .total-row td { font-weight: bold; border-top: 2px solid #1f6ff0; }
      .foot { margin-top: 30px; font-size: 10px; color: #8a93ab; border-top: 1px solid #e2e8f2; padding-top: 10px; }
      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    </style>`;
}

function headerHtml(company) {
  return `
    <div class="head">
      <div class="brand"><span class="logo"></span><b>Finbot</b></div>
      <div style="text-align:right" class="muted">
        <div><b>${esc(company.name || '')}</b></div>
        <div>${esc(company.nipt || '')}</div>
        <div>${esc(company.address || '')}</div>
      </div>
    </div>`;
}

// Një deklaratë për një rekord (subjekt × shërbim)
function declarationPage(company, service, rec) {
  const d = rec.data ? (typeof rec.data === 'string' ? JSON.parse(rec.data) : rec.data) : {};
  const today = new Date().toISOString().slice(0, 10);
  return `
    <div class="page">
      ${headerHtml(company)}
      <h1>${esc(service.name)}</h1>
      <div class="muted">Deklaratë / përmbledhje e gjeneruar nga platforma</div>
      <div class="meta">
        <div><b>Subjekti:</b> ${esc(rec.subject_name)}</div>
        <div><b>NIPT:</b> ${esc(rec.nipt || '—')}</div>
        <div><b>Statusi:</b> ${esc(rec.status || '—')}</div>
        <div><b>Data:</b> ${today}</div>
      </div>
      ${rec.period_from || rec.period_to ? `<div class="meta"><b>Periudha:</b> ${esc(rec.period_from || '…')} – ${esc(rec.period_to || '…')}</div>` : ''}
      <table>
        <thead><tr><th>Zëri</th><th class="num">Vlera</th></tr></thead>
        <tbody>
          ${(schemaFor(service.code).columns.length ? schemaFor(service.code).columns : Object.keys(d).map(k => ({ key: k, label: k, type: typeof d[k] === 'number' ? 'num' : 'text' })))
            .map(c => `<tr><td>${esc(c.label)}</td><td class="num">${d[c.key] == null ? '—' : (c.type === 'money' ? nf(d[c.key]) + ' Lek' : c.type === 'num' ? nf(d[c.key]) : esc(d[c.key]))}</td></tr>`).join('')}
          <tr class="total-row"><td>Rezultati</td><td class="num">${esc(rec.result || '—')}</td></tr>
        </tbody>
      </table>
      <div class="foot">Gjeneruar nga Finbot më ${today}. Dokument informativ — verifikoni shifrat para deklarimit zyrtar.</div>
    </div>`;
}

function buildDeclarationDoc(company, service, records) {
  return `<!doctype html><html><head><meta charset="utf-8">${docStyle()}</head><body>${records.map(r => declarationPage(company, service, r)).join('')}</body></html>`;
}

// Raport statistikor: vlera mujore për 3 vite + totalet vjetore
const MUAJT = ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'];
function buildStatsDoc(company, service, rec, st) {
  const fmt = v => v == null ? '—' : nf(v);
  return `<!doctype html><html><head><meta charset="utf-8">${docStyle()}</head><body><div class="page">
    ${headerHtml(company)}
    <h1>Statistika — ${esc(service.name)}</h1>
    <div class="meta"><div><b>Subjekti:</b> ${esc(rec.subject_name)}</div><div><b>NIPT:</b> ${esc(rec.nipt || '—')}</div>
      <div><b>Treguesi:</b> ${esc(st.metric)}${st.type === 'money' ? ' (Lek)' : ''}</div></div>
    <table><thead><tr><th>Muaji</th>${st.years.map(y => `<th class="num">${y}</th>`).join('')}</tr></thead>
      <tbody>${st.months.map((m, i) => `<tr><td>${MUAJT[i]}</td>${m.map(v => `<td class="num">${fmt(v)}</td>`).join('')}</tr>`).join('')}
      <tr class="total-row"><td>Totali vjetor</td>${st.totals.map(v => `<td class="num">${nf(v)}</td>`).join('')}</tr></tbody></table>
    <div class="foot">Gjeneruar nga Finbot më ${new Date().toISOString().slice(0, 10)}.</div>
  </div></body></html>`;
}

// Gjeneron një PDF për çdo rekord (një browser i vetëm) dhe i kthen si buffer-a.
async function recordsToPdfBuffers(company, service, records) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const out = [];
  try {
    const page = await browser.newPage();
    for (const r of records) {
      await page.setContent(buildDeclarationDoc(company, service, [r]), { waitUntil: 'load' });
      const buf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' } });
      const safe = String(r.subject_name || 'subjekt').replace(/[^\w\-]+/g, '_');
      out.push({ filename: `${safe}.pdf`, buffer: buf });
    }
  } finally {
    await browser.close();
  }
  return out;
}

// Paketon disa buffer-a në një ZIP (kthen Buffer).
function zipBuffers(files) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks = [];
    archive.on('data', c => chunks.push(c));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    for (const f of files) archive.append(f.buffer, { name: f.filename });
    archive.finalize();
  });
}

module.exports = { htmlToPdf, buildDeclarationDoc, buildStatsDoc, recordsToPdfBuffers, zipBuffers };
