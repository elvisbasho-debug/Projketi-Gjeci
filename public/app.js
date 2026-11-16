'use strict';

/* ============ Helpers ============ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = document.getElementById('root');
let ME = null, COMPANY = {};

const api = {
  async req(method, url, body) {
    const opt = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch('/api' + url, opt);
    let data = null; try { data = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((data && data.error) || 'Gabim serveri');
    return data;
  },
  get: u => api.req('GET', u), post: (u, b) => api.req('POST', u, b),
  put: (u, b) => api.req('PUT', u, b), del: u => api.req('DELETE', u),
};

const nf = n => (Number(n) || 0).toLocaleString('sq-AL');
const money = n => nf(n) + ' ' + (COMPANY.currency || 'Lek');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ROLE_LEVEL = { client: 0, viewer: 1, accountant: 2, studio_admin: 3, admin: 4, owner: 5 };
const can = role => ME && ROLE_LEVEL[ME.role] >= ROLE_LEVEL[role];
const roleLabel = r => ({ owner: 'Pronar', admin: 'Admin i platformës', studio_admin: 'Administrator i studios', accountant: 'Kontabilist', viewer: 'Vëzhgues', client: 'Klient' }[r] || r);
let PLATFORM = false, ORG = null; // nga /auth/me
const timeAgo = t => t ? esc(t) : '—';
const secs = ms => ms ? (ms >= 1000 ? Math.round(ms / 1000) + 's' : ms + 'ms') : '—';

function toast(msg, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : ''); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2800);
}

// Shkarkim skedari (CSV/PDF) përmes fetch → blob
async function downloadFile(url, filename) {
  toast('Duke përgatitur…');
  try {
    const r = await fetch('/api' + url, { credentials: 'same-origin' });
    if (!r.ok) { let e; try { e = (await r.json()).error; } catch (_) {} throw new Error(e || 'Gabim gjatë shkarkimit'); }
    const blob = await r.blob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (e) { toast(e.message, true); }
}
function importSubjectsCsv(onDone) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,text/csv';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try { const r = await api.post('/subjects/import', { csv: await f.text() }); toast(`U importuan ${r.created} subjekte (${r.skipped} u kapërcyen)`); onDone(); }
    catch (e) { toast(e.message, true); }
  };
  inp.click();
}

// Statuset
const EXEC_ST = { ne_radhe: ['Në radhë', 'b-draft'], ne_ekzekutim: ['Në ekzekutim', 'b-sent'], duke_riprovuar: ['Duke riprovuar', 'b-sent'], kryer: ['Kryer', 'b-paid'], deshtoi: ['Dështoi', 'b-overdue'], anuluar: ['Anuluar', 'b-cancelled'] };
const REC_ST = { ne_pritje: ['Në pritje', 'b-draft'], kryer: ['Kryer', 'b-paid'], deshtoi: ['Dështoi', 'b-overdue'], deklaruar: ['Deklaruar', 'b-paid'] };
const badge = (map, st) => { const v = map[st] || [st, 'b-draft']; return `<span class="badge ${v[1]}">${v[0]}</span>`; };

// Të dhënat e rekordeve (specifike për çdo shërbim)
const DATA_LABELS = { tvsh_mujore: 'TVSH mujore', totali: 'Totali', kredi: 'Kredi', fatura: 'Fatura të mbledhura', detyrime: 'Detyrime gjithsej', te_ardhura: 'Të ardhura', shpenzime: 'Shpenzime', bilanci: 'Bilanci i transaksioneve', deklarata: 'Deklarata', dokumente: 'Dokumente', afati: 'Afati më i afërt', te_ardhura_shitja: 'Të ardhura nga shitja', fitimi_humbja: 'Fitimi neto / Humbja' };
const PRIMARY_KEYS = ['totali', 'te_ardhura_shitja', 'detyrime', 'bilanci', 'fatura', 'deklarata', 'dokumente'];
function primaryValue(data) {
  if (!data) return '—';
  for (const k of PRIMARY_KEYS) if (data[k] != null) return nf(data[k]);
  const ks = Object.keys(data); for (const k of ks) if (typeof data[k] === 'number') return nf(data[k]);
  return ks.length ? esc(String(data[ks[0]])) : '—';
}
function renderDataRows(data) {
  const ks = Object.keys(data || {});
  if (!ks.length) return '<tr><td class="muted" colspan="2">Pa të dhëna shtesë</td></tr>';
  return ks.map(k => `<tr><td>${esc(DATA_LABELS[k] || k)}</td><td class="num">${typeof data[k] === 'number' ? nf(data[k]) : esc(String(data[k]))}</td></tr>`).join('');
}

/* ============ Icons ============ */
const I = {
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
  services: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  va: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
  subjects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 7a3 3 0 0 1 0 6M18 20a6 6 0 0 0-3-5"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="3.2"/><path d="M2 20a6 6 0 0 1 12 0M16 5a3.5 3.5 0 0 1 0 7M22 20a6 6 0 0 0-4-5.6"/></svg>',
  audit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6 1.6 1.6 0 0 0 8 1.1V1a2 2 0 0 1 4 0v.1A1.6 1.6 0 0 0 17 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H23a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.1z"/></svg>',
  logo: '<svg viewBox="0 0 24 24" width="28" height="28"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#123a78"/><stop offset="1" stop-color="#071a3a"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#lg)"/><rect x="5.5" y="13" width="3.2" height="5" rx="1" fill="#ffffff"/><rect x="10.4" y="9" width="3.2" height="9" rx="1" fill="#f5c400"/><rect x="15.3" y="6" width="3.2" height="12" rx="1" fill="#18a957"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 5v14M5 12h14"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
};

/* ============ Auth / boot ============ */
async function boot() {
  try {
    await loadMe();
    renderApp();
  } catch (e) { renderLogin(); }
}

function renderLogin(err) {
  root.innerHTML = `
    <div class="login-wrap"><div class="login-card">
      <div class="brand">${I.logo}<b style="font-size:19px">Finbot</b></div>
      <div class="accent-bar"></div>
      <h1>Mirë se vini</h1>
      <p class="sub">Platforma juaj e kontabilitetit të automatizuar</p>
      <form id="loginForm">
        <div class="field"><label>Email</label><input name="email" type="email" required placeholder="ju@studio.al" autocomplete="username"></div>
        <div class="field"><label>Fjalëkalimi</label><input name="password" type="password" required placeholder="••••••••" autocomplete="current-password"></div>
        <div class="err-text">${err ? esc(err) : ''}</div>
        <button class="btn" style="width:100%;justify-content:center;margin-top:6px" type="submit">Hyr</button>
      </form>
    </div></div>`;
  $('#loginForm').onsubmit = async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector('button');
    btn.disabled = true; btn.textContent = 'Duke hyrë…';
    try { await api.post('/auth/login', { email: f.email.value, password: f.password.value });
      await loadMe(); location.hash = PLATFORM && !ORG ? '#/platform' : '#/'; renderApp();
    } catch (err) { renderLogin(err.message); }
  };
}
async function loadMe() {
  const me = await api.get('/auth/me');
  ME = me.user; PLATFORM = !!me.platform; ORG = me.org;
  COMPANY = ORG && ME.role !== 'client' ? await api.get('/settings/company').catch(() => ({})) : {};
}
async function logout() { await api.post('/auth/logout').catch(() => {}); ME = null; renderLogin(); }

/* ============ Shell ============ */
const NAV = [
  { key: '', label: 'Paneli', icon: 'dash', role: 'viewer' },
  { key: 'services', label: 'Shërbimet', icon: 'services', role: 'viewer' },
  { key: 'va', label: 'Pyet VA', icon: 'va', role: 'viewer' },
  { key: 'subjects', label: 'Subjektet', icon: 'subjects', role: 'viewer' },
  { key: 'automation', label: 'Automatizimi', icon: 'auto', role: 'viewer' },
  { key: 'notifications', label: 'Njoftimet', icon: 'bell', role: 'viewer' },
  { key: 'support', label: 'Mbështetje', icon: 'support', role: 'viewer' },
  { sep: true, role: 'studio_admin' },
  { key: 'users', label: 'Përdoruesit', icon: 'users', role: 'studio_admin' },
  { key: 'audit', label: 'Regjistri', icon: 'audit', role: 'studio_admin' },
  { key: 'settings', label: 'Cilësimet', icon: 'settings', role: 'studio_admin' },
  { sep: true, role: 'admin' },
  { key: 'platform', label: 'Studiot', icon: 'dash', role: 'admin' },
];
const NO_ORG_OK = ['platform', 'profile', 'support'];

function renderApp() {
  if (ME.role === 'client') return renderClientPortal();
  root.innerHTML = `
    <div class="app">
      <aside class="sidebar" id="sidebar">
        <div class="logo">${I.logo}<b>Finbot</b></div>
        <nav id="nav"></nav>
        <div class="spacer"></div><div class="nav-sep"></div>
        <div class="user-chip" id="userChip" style="cursor:pointer"><div class="nm">${esc(ME.name)}</div><div class="rl">${roleLabel(ME.role)}</div></div>
        <button class="nav-item" id="logoutBtn" style="margin-top:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>Dalje</button>
      </aside>
      <div class="main">
        <div class="topbar">
          <div style="display:flex;align-items:center;gap:12px">
            <button class="menu-btn" id="menuBtn"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>
            <h2 id="pageTitle">Paneli</h2>
          </div>
          <div class="org-chip" id="companyName">${orgChip()}</div>
        </div>
        <div class="content" id="view"></div>
      </div>
      <nav class="bottom-nav">
        <a href="#/" data-bn="">${I.dash}<span>Kreu</span></a>
        <a href="#/services" data-bn="services">${I.services}<span>Shërbimet</span></a>
        <a href="#/va" data-bn="va" class="bn-ai">${I.va}<span>AI</span></a>
        <button id="bnSearch">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'}<span>Kërko</span></button>
        <button id="bnMenu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg><span>Menu</span></button>
      </nav>
    </div>`;
  bindOrgChip();
  $('#bnMenu').onclick = () => $('#sidebar').classList.toggle('open');
  $('#bnSearch').onclick = globalSearch;
  const nav = $('#nav');
  NAV.forEach(n => {
    if (!can(n.role)) return;
    if (n.sep) { nav.insertAdjacentHTML('beforeend', '<div class="nav-sep"></div>'); return; }
    const b = document.createElement('button');
    b.className = 'nav-item'; b.dataset.key = n.key;
    b.innerHTML = I[n.icon] + '<span>' + n.label + '</span>';
    b.onclick = () => { location.hash = '#/' + n.key; $('#sidebar').classList.remove('open'); };
    nav.appendChild(b);
  });
  $('#logoutBtn').onclick = logout;
  $('#userChip').onclick = () => location.hash = '#/profile';
  $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
  window.onhashchange = route; route();
}

/* ============ Router ============ */
const ROUTES = {
  '': viewDashboard, services: viewServices, service: viewServiceDetail, record: viewRecord, va: viewVA,
  subjects: viewSubjects, subject: viewSubjectDetail, automation: viewAutomation, notifications: viewNotifications,
  support: viewSupport, users: viewUsers, audit: viewAudit, settings: viewSettings, profile: viewProfile, platform: viewPlatform,
};
const NAV_ALIAS = { service: 'services', record: 'services', subject: 'subjects' };
let AUTO_TIMER = null;
function route() {
  if (AUTO_TIMER) { clearInterval(AUTO_TIMER); AUTO_TIMER = null; }
  const parts = location.hash.replace(/^#\//, '').split('/');
  const key = parts[0] || '';
  const fn = ROUTES[key] || viewDashboard;
  const navItem = NAV.find(n => n.key === key);
  if (navItem && !can(navItem.role)) { $('#view').innerHTML = '<div class="empty">Nuk keni akses.</div>'; return; }
  if (!ORG && !NO_ORG_OK.includes(key)) {
    $('#pageTitle').textContent = 'Zgjidhni studion';
    $('#view').innerHTML = `<div class="card" style="max-width:520px"><div class="card-body">
      <h3 style="margin-top:0">Asnjë studio e zgjedhur</h3>
      <p class="muted">Si ${esc(roleLabel(ME.role).toLowerCase())}, zgjidhni një studio për të parë bizneset, shërbimet dhe robotët e saj.</p>
      <a class="btn" href="#/platform">Hap "Studiot"</a></div></div>`;
    return;
  }
  $$('.nav-item[data-key]').forEach(b => b.classList.toggle('active', b.dataset.key === (NAV_ALIAS[key] || key)));
  $$('.bottom-nav [data-bn]').forEach(b => b.classList.toggle('active', b.dataset.bn === (NAV_ALIAS[key] || key)));
  if ($('#sidebar')) $('#sidebar').classList.remove('open');
  const titles = { '': 'Paneli', services: 'Shërbimet', service: 'Shërbimi', va: 'Pyet VA', subjects: 'Subjektet', subject: 'Subjekti', automation: 'Automatizimi', notifications: 'Njoftimet', support: 'Mbështetje', users: 'Përdoruesit', audit: 'Regjistri i veprimeve', settings: 'Cilësimet', profile: 'Profili im', platform: 'Studiot dhe planet' };
  $('#pageTitle').textContent = titles[key] || 'Finbot';
  $('#view').innerHTML = '<div class="empty">Duke ngarkuar…</div>';
  fn($('#view'), parts[1], parts[2], parts[3]);
}

/* ---- Kërkimi global (subjekte + shërbime) ---- */
async function globalSearch() {
  const services = await api.get('/services').catch(() => []);
  const m = modal('Kërko', `<input class="search" id="gq" placeholder="Subjekt, NIPT ose shërbim…" style="width:100%" autofocus><div id="gres" class="gres"></div>`);
  const box = $('#gres', m.bg), inp = $('#gq', m.bg);
  let t;
  const run = async () => {
    const q = inp.value.trim();
    if (!q) { box.innerHTML = ''; return; }
    const subs = await api.get('/subjects?q=' + encodeURIComponent(q)).catch(() => []);
    const sv = services.filter(s => s.name.toLowerCase().includes(q.toLowerCase()));
    box.innerHTML = [...subs.slice(0, 8).map(s => `<a href="#/subject/${s.id}"><b>${esc(s.name)}</b><span class="muted">${esc(s.nipt || '')}</span></a>`),
      ...sv.map(s => `<a href="#/service/${s.id}"><b>${esc(s.name)}</b><span class="muted">Shërbim</span></a>`)].join('') || '<div class="muted small" style="padding:12px 4px">Asnjë rezultat</div>';
    $$('a', box).forEach(a => a.onclick = () => m.close());
  };
  inp.oninput = () => { clearTimeout(t); t = setTimeout(run, 200); };
  setTimeout(() => inp.focus(), 50);
}

/* ============ Modal ============ */
function modal(title, bodyHtml, { wide, onSave, saveLabel } = {}) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}"><div class="modal-head"><h3>${esc(title)}</h3><button class="x">&times;</button></div>
    <div class="modal-body">${bodyHtml}</div>
    <div class="modal-foot"><button class="btn ghost" data-close>Mbyll</button>${onSave ? `<button class="btn" data-save>${esc(saveLabel || 'Ruaj')}</button>` : ''}</div></div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector('.x').onclick = close; bg.querySelector('[data-close]').onclick = close;
  bg.onclick = e => { if (e.target === bg) close(); };
  if (onSave) bg.querySelector('[data-save]').onclick = async () => {
    const btn = bg.querySelector('[data-save]'); btn.disabled = true;
    try { await onSave(bg); close(); } catch (e) { toast(e.message, true); btn.disabled = false; }
  };
  return { bg, close };
}
function confirmBox(msg, onYes, { danger } = {}) {
  const m = modal('Konfirmim', `<p style="margin:0">${esc(msg)}</p>`, { saveLabel: 'Po, vazhdo', onSave: async () => onYes() });
  if (danger) m.bg.querySelector('[data-save]').classList.add('danger');
}
function stat(label, value, icoClass, icon, sub) {
  return `<div class="stat"><div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div class="label">${label}</div><div class="ico ${icoClass}">${icon}</div></div>
    <div class="value">${value}</div>${sub ? `<div class="muted" style="font-size:12px;margin-top:2px">${sub}</div>` : ''}</div>`;
}

/* ============ Dashboard ============ */
async function viewDashboard(el) {
  const d = await api.get('/reports/dashboard');
  el.innerHTML = `
    <div class="grid stats" style="margin-bottom:18px">
      ${stat('Shërbime të disponueshme', d.services_total, 'i-blue', I.services, 'Caktuar për llogarinë')}
      ${stat('Shërbime aktive', d.services_active, 'i-green', I.auto, 'Në punë')}
      ${stat('Biznese sipas planit', d.plan ? d.plan.used + ' / ' + d.plan.limit : d.subjects, 'i-amber', I.subjects, d.plan ? 'Plani ' + esc(d.plan.plan_name) : 'Gjithsej')}
      ${stat('Përdorimi i shërbimeve', d.usage_used, 'i-violet', I.dash, 'Regjistrime në shërbime këtë muaj')}
    </div>
    <div class="grid" style="grid-template-columns:1fr 1fr;align-items:start">
      <div class="card">
        <div class="card-head"><h3>Automatizimi — përmbledhje</h3><a href="#/automation" class="muted" style="font-size:13px">Shiko &rarr;</a></div>
        <div class="card-body"><table>
          <tr><td>${badge(EXEC_ST,'kryer')} Ekzekutime të kryera</td><td class="num"><b>${d.exec_done}</b></td></tr>
          <tr><td>${badge(EXEC_ST,'ne_radhe')} Në radhë / ekzekutim</td><td class="num"><b>${d.exec_queue}</b></td></tr>
          <tr><td>${badge(EXEC_ST,'deshtoi')} Të dështuara</td><td class="num"><b>${d.exec_failed}</b></td></tr>
        </table></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Rekordet e fundit</h3></div>
        <div class="card-body" style="padding:0"><table>
          <thead><tr><th>Subjekti</th><th>Shërbimi</th><th>Status</th><th></th></tr></thead>
          <tbody>${d.recent.length ? d.recent.map(r => `<tr><td><b>${esc(r.subject_name)}</b></td><td class="muted">${esc(r.service_name)}</td><td>${badge(REC_ST, r.status)}</td>
            <td class="num nowrap"><a class="btn ghost sm" href="#/service/${r.service_id}">Shërbimi</a> <a class="btn ghost sm" href="#/record/${r.service_id}/${r.subject_id}">Rekordi</a></td></tr>`).join('') : '<tr><td colspan="4"><div class="empty">Ende pa rekorde</div></td></tr>'}</tbody>
        </table></div>
      </div>
    </div>
    <div class="card" style="margin-top:18px">
      <div class="card-head"><h3>Shërbimet</h3><input class="search" id="dq" placeholder="Kërko shërbime…"></div>
      <div class="card-body" style="padding:0"><table>
        <thead><tr><th>Shërbimi</th><th class="num">Përdorimi</th><th>Kuota rinovohet më</th></tr></thead>
        <tbody id="dsvc"></tbody></table></div>
    </div>`;
  const svcs = await api.get('/services');
  const paintSvc = q => { q = (q || '').toLowerCase();
    const rows = svcs.filter(s => s.name.toLowerCase().includes(q));
    $('#dsvc').innerHTML = rows.map(s => `<tr class="clickable" data-s="${s.id}"><td><b>${esc(s.name)}</b></td><td class="num">${s.used} / ${s.max_limit}</td><td class="muted">${esc(fmtDate(s.renews_at) || '—')}</td></tr>`).join('')
      || '<tr><td colspan="3"><div class="empty" style="padding:20px">Asnjë shërbim</div></td></tr>';
    $$('#dsvc [data-s]').forEach(r => r.onclick = () => location.hash = '#/service/' + r.dataset.s); };
  paintSvc(''); $('#dq').oninput = e => paintSvc(e.target.value);
}

/* ============ Services ============ */
async function viewServices(el) {
  const list = await api.get('/services');
  el.innerHTML = `
    <div class="toolbar"><div class="muted">Shërbime të mbështetura nga robotët dhe kufij mujorë.</div>
      <div style="display:flex;gap:10px;align-items:center">
        ${can('accountant') ? `<button class="btn" id="massRun">${I.play} Ekzekutim masiv</button>` : ''}
        <div class="muted">Shfaqur: ${list.length} / ${list.length}</div>
      </div></div>
    <div class="grid svc-grid">${list.map(s => {
      const pct = s.max_limit ? Math.round(s.used / s.max_limit * 100) : 0;
      return `<div class="card svc-card" data-id="${s.id}">
        <div class="svc-top"><h3>${esc(s.name)}</h3><span class="badge ${s.active ? 'b-active' : 'b-cancelled'}">${s.active ? 'Aktiv' : 'Joaktiv'}</span></div>
        <p class="muted svc-desc">${esc(s.description || '')}</p>
        <div class="svc-quota"><div class="qrow"><span class="muted">Subjekte këtë muaj</span><b>${s.used} / ${s.max_limit}</b></div>
          <div class="qbar"><div class="qfill" style="width:${pct}%"></div></div></div>
        <div class="svc-foot"><span class="muted">Skadimi<br><b>${esc(s.expires_at || '—')}</b></span><span class="muted" style="text-align:right">Rinovohet<br><b>${esc(s.renews_at || '—')}</b></span></div>
      </div>`;
    }).join('')}</div>`;
  $$('.svc-card', el).forEach(c => c.onclick = () => location.hash = '#/service/' + c.dataset.id);
  if ($('#massRun')) $('#massRun').onclick = () => {
    modal('Ekzekutim masiv', `
      <p class="muted" style="margin-top:0">Zgjidh një shërbim dhe ekzekutoje për <b>të gjitha subjektet aktive</b> njëherësh.</p>
      <div class="field"><label>Shërbimi</label><select id="mr_svc">${list.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
      <div class="muted" style="font-size:12.5px">Çdo subjekt do të futet në radhën e automatizimit. Mund t'i ndjekësh te "Automatizimi".</div>
    `, {
      saveLabel: 'Ekzekuto për të gjithë', onSave: async bg => {
        const sid = $('#mr_svc', bg).value;
        const r = await api.post('/services/' + sid + '/run', { all: true });
        toast(`U futën në radhë ${r.queued} ekzekutime`); location.hash = '#/automation';
      }
    });
  };
}

/* ---------- Ndihmës për menutë rënëse dhe vlerat e shërbimeve ---------- */
function dropdown(btn, items) {
  closeDropdowns();
  const m = document.createElement('div'); m.className = 'dd-menu';
  items.filter(Boolean).forEach(it => {
    if (it.sep) { m.insertAdjacentHTML('beforeend', '<div class="dd-sep"></div>'); return; }
    const b = document.createElement('button'); b.className = 'dd-item' + (it.danger ? ' danger' : '');
    b.innerHTML = (it.icon || '') + '<span>' + esc(it.label) + '</span>';
    b.onclick = e => { e.stopPropagation(); closeDropdowns(); it.onClick(); };
    m.appendChild(b);
  });
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect();
  const left = Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - m.offsetWidth - 8);
  m.style.top = (r.bottom + window.scrollY + 6) + 'px'; m.style.left = Math.max(8, left) + 'px';
  setTimeout(() => document.addEventListener('click', closeDropdowns, { once: true }), 0);
}
function closeDropdowns() { $$('.dd-menu').forEach(m => m.remove()); }

const VAL_BADGE = v => /dështoi|nuk përputhet|nuk plotëson|nuk vendoset|paregjistruar|pa deklaruar/i.test(v) ? 'b-overdue'
  : /kryer|deklaruar|përputhet|plotëson/i.test(v) ? 'b-paid' : 'b-draft';
function fmtValue(col, v) {
  if (v == null || v === '') return '<span class="muted">—</span>';
  if (col.type === 'money') return `<span class="${Number(v) < 0 ? 'neg' : ''}">${nf(v)}</span>`;
  if (col.type === 'num') return nf(v);
  if (col.type === 'status') return `<span class="badge ${VAL_BADGE(v)}">${esc(v)}</span>`;
  return `<span class="badge ${VAL_BADGE(v)}">${esc(v)}</span>`;
}
function pickFile(accept) {
  return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0]); i.click(); });
}
const fmtDate = d => d ? d.split('-').reverse().join('.') : '';
const ICO = {
  panel: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  filter: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3M7 8l5-5 5 5M5 21h14"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  cal: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg>',
  stop: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  book: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/></svg>',
  caret: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>',
};

/* ============ Faqja e shërbimit ============ */
async function viewServiceDetail(el, id) {
  // gjendja e faqes (ruhet gjatë rifreskimeve)
  const st = { q: '', recSt: '', subSt: '', sort: 'subject_name', dir: 1, details: false, panel: false, filters: false };
  try { Object.assign(st, JSON.parse(sessionStorage.getItem('svc-ui-' + id) || '{}'), { q: '' }); } catch (e) {}
  const save = () => { try { sessionStorage.setItem('svc-ui-' + id, JSON.stringify({ details: st.details, panel: st.panel, sort: st.sort, dir: st.dir })); } catch (e) {} };
  let s;

  // soft = rifreskim automatik: përditëso vetëm tabelën dhe numëruesit (pa prekur kërkimin/menutë)
  async function load(soft) {
    s = await api.get('/services/' + id);
    if (location.hash.split('/')[1] !== 'service' || location.hash.split('/')[2] !== String(id)) return; // përdoruesi ka ikur
    if (soft && $('.svc-toolbar', el)) paintDynamic(); else paint();
    if (AUTO_TIMER) { clearInterval(AUTO_TIMER); AUTO_TIMER = null; }
    if (s.active_executions > 0) AUTO_TIMER = setInterval(() => { if (!$('.modal-bg')) load(true).catch(() => {}); }, 4000);
  }
  function paintDynamic() {
    $('#headBadge').innerHTML = s.active_executions ? `<span class="badge b-sent pulse">${s.active_executions} në ekzekutim</span>` : '';
    if ($('#stopBtn')) $('#stopBtn').disabled = !s.active_executions;
    $('#panel').innerHTML = panelHtml();
    paintRows();
  }
  function panelHtml() {
    const quotaPct = Math.min(100, Math.round((s.used / (s.max_limit || 1)) * 100));
    const periods = [...new Set(s.records.map(r => r.period_from ? fmtDate(r.period_from) + ' – ' + fmtDate(r.period_to) : null).filter(Boolean))];
    return `
      <div><div class="muted">Kuota mujore</div><b>${s.used} / ${s.max_limit}</b><div class="qbar"><div class="qfill" style="width:${quotaPct}%"></div></div></div>
      <div><div class="muted">Rinovohet më</div><b>${esc(fmtDate(s.renews_at) || '—')}</b></div>
      <div><div class="muted">Skadon më</div><b>${esc(fmtDate(s.expires_at) || '—')}</b></div>
      <div><div class="muted">Në ekzekutim</div><b>${s.active_executions}</b></div>
      <div><div class="muted">Periudha</div><b>${periods.length === 1 ? esc(periods[0]) : periods.length ? 'Të ndryshme' : 'Pa caktuar'}</b></div>
      <div><div class="muted">Veprimet</div><b>${s.actions.map(a => esc(a.label)).join(' · ')}</b></div>`;
  }

  const cell = (r, k) => k === 'subject_name' ? r.subject_name : k === 'nipt' ? r.nipt : k === 'updated_at' ? r.updated_at
    : k === 'subject_status' ? r.subject_status : k === 'status' ? r.status : r.data[k];

  function visibleRows() {
    const q = st.q.trim().toLowerCase();
    let rows = s.records.filter(r => {
      if (st.recSt && r.status !== st.recSt) return false;
      if (st.subSt && r.subject_status !== st.subSt) return false;
      if (!q) return true;
      return [r.subject_name, r.nipt, r.result, REC_ST[r.status] && REC_ST[r.status][0], ...Object.values(r.data)].some(v => String(v == null ? '' : v).toLowerCase().includes(q));
    });
    rows = rows.slice().sort((a, b) => {
      const x = cell(a, st.sort), y = cell(b, st.sort);
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'sq')) * st.dir;
    });
    return rows;
  }

  function paint() {
    const acc = can('accountant');
    const cols = s.columns;
    const head = [['#', null], ['Statusi i subjektit', 'subject_status'], ['Emri i subjektit', 'subject_name'], ['NIPT', 'nipt'], ['Përditësuar', 'updated_at'], ['Statusi', 'status'],
      ...cols.map(c => [c.label, c.key, c.type === 'money' || c.type === 'num']),
      ...(st.details ? [['Rezultati', null], ['Periudha', null]] : []), ['', null]];
    el.innerHTML = `
      <button class="btn ghost sm" id="back" style="margin-bottom:14px">&larr; Shërbimet</button>
      <div class="page-head"><div><h1>${esc(s.name)}</h1><p class="muted">${esc(s.description || '')}</p></div>
        <div id="headBadge">${s.active_executions ? `<span class="badge b-sent pulse">${s.active_executions} në ekzekutim</span>` : ''}</div></div>
      <div class="card">
        <div class="svc-toolbar">
          <div class="tb-search"><input class="search" id="q" placeholder="Kërko subjekt, NIPT, status ose vlerë…" value="${esc(st.q)}">
            <button class="btn ghost icon ${st.filters || st.recSt || st.subSt ? 'on' : ''}" id="fbtn" title="Filtra">${ICO.filter}<span>Filtra</span></button></div>
          <div class="tb-actions">
            <button class="btn ghost ${st.panel ? 'on' : ''}" id="panelBtn">${ICO.panel}<span>Shfaq panelin</span></button>
            ${acc ? `<button class="btn green" id="addSub">${I.plus}<span>Shto subjekt</span></button>` : ''}
            ${acc ? `<button class="btn ghost" id="impBtn">${ICO.up}<span>Importo</span>${ICO.caret}</button>` : ''}
            <button class="btn ghost" id="expBtn">${ICO.down}<span>Eksporto</span>${ICO.caret}</button>
            ${acc ? `<button class="btn ghost" id="datesBtn">${ICO.cal}<span>Datat masive</span></button>` : ''}
            ${acc ? `<button class="btn" id="actBtn">${ICO.bolt}<span>Veprime</span>${ICO.caret}</button>` : ''}
            <button class="btn ghost" id="refresh">${ICO.refresh}<span>Rifresko</span></button>
            ${acc ? `<button class="btn danger" id="stopBtn" ${s.active_executions ? '' : 'disabled'}>${ICO.stop}<span>Ndalo</span></button>` : ''}
            ${s.guide ? `<button class="btn ghost icon" id="guideBtn" title="Udhëzuesi">${ICO.book}</button>` : ''}
          </div>
        </div>
        <div class="filters" ${st.filters ? '' : 'hidden'}>
          <label>Statusi i rezultatit<select id="fRec"><option value="">Të gjitha</option>${Object.entries(REC_ST).map(([k, v]) => `<option value="${k}" ${st.recSt === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
          <label>Statusi i subjektit<select id="fSub"><option value="">Të gjitha</option><option value="active" ${st.subSt === 'active' ? 'selected' : ''}>Aktiv</option><option value="inactive" ${st.subSt === 'inactive' ? 'selected' : ''}>Joaktiv</option></select></label>
          <button class="btn ghost sm" id="fClear">Pastro</button>
        </div>
        <div class="svc-panel" id="panel" ${st.panel ? '' : 'hidden'}>${panelHtml()}</div>
        <div class="tbl-meta">
          <label class="check"><input type="checkbox" id="det" ${st.details ? 'checked' : ''}> Shfaq detajet e rezultateve</label>
          <span class="muted" id="count"></span>
        </div>
        <div class="tbl-wrap"><table class="svc-table">
          <thead><tr>${head.map(([l, k, n]) => `<th class="${k ? 'sortable' : ''} ${n ? 'num' : ''}" ${k ? `data-sort="${k}"` : ''}><span>${esc(l)}</span>${k && st.sort === k ? `<span class="sort-ar">${st.dir > 0 ? ' ▲' : ' ▼'}</span>` : ''}</th>`).join('')}</tr></thead>
          <tbody id="rows"></tbody></table></div>
      </div>`;
    paintRows();
    bind();
  }

  function paintRows() {
    const acc = can('accountant');
    const rows = visibleRows();
    const def = s.actions[0];
    $('#count').textContent = `${rows.length} / ${s.records.length}`;
    const span = 7 + s.columns.length + (st.details ? 2 : 0);
    $('#rows').innerHTML = rows.length ? rows.map((r, i) => {
      const running = s.running_subjects.includes(r.subject_id);
      return `<tr data-open="${r.subject_id}" class="clickable">
        <td class="muted">${i + 1}</td>
        <td><span class="badge ${r.subject_status === 'active' ? 'b-active' : 'b-cancelled'}">${r.subject_status === 'active' ? 'Aktiv' : 'Joaktiv'}</span></td>
        <td><b>${esc(r.subject_name)}</b></td>
        <td class="muted">${esc(r.nipt || '—')}</td>
        <td class="muted nowrap">${timeAgo(r.updated_at)}</td>
        <td>${running ? '<span class="badge b-sent pulse">Në ekzekutim</span>' : badge(REC_ST, r.status)}</td>
        ${s.columns.map(c => `<td class="${c.type === 'money' || c.type === 'num' ? 'num' : ''}">${fmtValue(c, r.data[c.key])}</td>`).join('')}
        ${st.details ? `<td class="muted small">${esc(r.result || '—')}</td><td class="muted nowrap small">${r.period_from ? fmtDate(r.period_from) + ' – ' + fmtDate(r.period_to) : '—'}</td>` : ''}
        <td class="num nowrap">
          ${acc ? `<button class="btn ghost sm" data-run="${r.subject_id}" title="${esc(def.label)}" ${running ? 'disabled' : ''}>${I.play}</button>` : ''}
          <button class="btn ghost sm" data-open="${r.subject_id}">Hap</button>
        </td></tr>`;
    }).join('') : `<tr><td colspan="${span}"><div class="empty">${s.records.length ? 'Asnjë rezultat për këtë kërkim/filtër.' : 'Asnjë subjekt te ky shërbim. Shtoni ose importoni subjekte.'}</div></td></tr>`;
    $$('#rows [data-open]').forEach(b => b.onclick = e => { if (e.target.closest('[data-run]')) return; e.stopPropagation(); location.hash = `#/record/${s.id}/${b.dataset.open}`; });
    $$('#rows [data-run]').forEach(b => b.onclick = async e => {
      e.stopPropagation();
      try { await api.post(`/services/${s.id}/run`, { subject_ids: [Number(b.dataset.run)], action: def.key }); toast(`${def.label}: u fut në radhë`); load(); } catch (err) { toast(err.message, true); }
    });
  }

  function bind() {
    const acc = can('accountant');
    $('#back').onclick = () => location.hash = '#/services';
    let t; $('#q').oninput = e => { st.q = e.target.value; clearTimeout(t); t = setTimeout(paintRows, 120); };
    $('#fbtn').onclick = () => { st.filters = !st.filters; paint(); };
    $('#fRec').onchange = e => { st.recSt = e.target.value; paintRows(); };
    $('#fSub').onchange = e => { st.subSt = e.target.value; paintRows(); };
    $('#fClear').onclick = () => { st.recSt = st.subSt = st.q = ''; paint(); };
    $('#panelBtn').onclick = () => { st.panel = !st.panel; save(); paint(); };
    $('#det').onchange = e => { st.details = e.target.checked; save(); paint(); };
    $('#refresh').onclick = () => load().then(() => toast('U rifreskua'));
    $$('th[data-sort]').forEach(th => th.onclick = () => { const k = th.dataset.sort; st.dir = st.sort === k ? -st.dir : 1; st.sort = k; save(); paint(); });
    if ($('#guideBtn')) $('#guideBtn').onclick = () => modal('Udhëzuesi — ' + s.name, `<p style="margin-top:0;line-height:1.6">${esc(s.guide)}</p>
      <h4 style="margin:16px 0 6px">Veprimet</h4><ul style="margin:0;padding-left:18px;line-height:1.8">${s.actions.map(a => `<li>${esc(a.label)}</li>`).join('')}</ul>
      <h4 style="margin:16px 0 6px">Hapat</h4><ol style="margin:0;padding-left:18px;line-height:1.8"><li>Shto ose importo subjektet (me fjalëkalimin e-Albania te "Subjektet").</li><li>Vendos periudhën me "Datat masive".</li><li>Nis një veprim nga "Veprime" ose ▶ te rreshti.</li><li>Ndiq ecurinë këtu ose te "Automatizimi"; hap rreshtin për detajet.</li></ol>`);

    $('#expBtn').onclick = e => { e.stopPropagation(); dropdown(e.currentTarget, [
      { label: 'Eksporto CSV', onClick: () => downloadFile(`/services/${s.id}/export`, s.code + '.csv') },
      { label: 'Të gjitha në një PDF', onClick: () => downloadFile(`/services/${s.id}/pdf`, s.code + '-deklaratat.pdf') },
      { label: 'Një PDF për subjekt (.zip)', onClick: () => downloadFile(`/services/${s.id}/zip`, s.code + '-deklaratat.zip') },
    ]); };
    if (!acc) return;

    $('#addSub').onclick = async () => {
      const subjects = await api.get('/subjects');
      const free = subjects.filter(x => !s.records.find(r => r.subject_id === x.id));
      if (!free.length) return toast('Të gjitha subjektet janë shtuar', true);
      modal('Shto subjekte te shërbimi', `
        <input class="search" id="ssq" placeholder="Kërko…" style="width:100%;margin-bottom:10px">
        <label class="check" style="margin-bottom:8px"><input type="checkbox" id="ssall"> Zgjidh të gjitha</label>
        <div class="pick-list">${free.map(x => `<label class="check pick" data-txt="${esc((x.name + ' ' + (x.nipt || '')).toLowerCase())}"><input type="checkbox" value="${x.id}"> <b>${esc(x.name)}</b> <span class="muted">${esc(x.nipt || '')}</span></label>`).join('')}</div>
        <p class="muted" style="font-size:12px;margin:10px 0 0">Kuota: ${s.used} / ${s.max_limit}. Subjekte të reja krijohen te "Subjektet".</p>`, {
        saveLabel: 'Shto', onSave: async bg => {
          const ids = $$('.pick input:checked', bg).map(i => Number(i.value));
          if (!ids.length) throw new Error('Zgjidhni të paktën një subjekt');
          const r = await api.post(`/services/${s.id}/subjects`, { subject_ids: ids });
          toast(`U shtuan ${r.added}${r.full ? ` · ${r.full} jashtë kuotës` : ''}`); load();
        } });
      const bg = $('.modal-bg:last-child');
      $('#ssq', bg).oninput = e => { const q = e.target.value.toLowerCase(); $$('.pick', bg).forEach(p => p.hidden = !p.dataset.txt.includes(q)); };
      $('#ssall', bg).onchange = e => $$('.pick', bg).forEach(p => { if (!p.hidden) p.querySelector('input').checked = e.target.checked; });
    };

    $('#impBtn').onclick = e => { e.stopPropagation(); dropdown(e.currentTarget, [
      { label: 'Importo nga skedar CSV', onClick: async () => {
        const f = await pickFile('.csv,text/csv'); if (!f) return;
        try { const r = await api.post(`/services/${s.id}/import`, { csv: await f.text() });
          toast(`U shtuan ${r.added} subjekte (${r.created} të reja${r.skipped ? `, ${r.skipped} ekzistonin` : ''}${r.full ? `, ${r.full} jashtë kuotës` : ''}${r.invalid ? `, ${r.invalid} rreshta të pavlefshëm` : ''})`); load();
        } catch (err) { toast(err.message, true); } } },
      { label: 'Importo nga shërbimet e tjera', onClick: async () => {
        const list = (await api.get('/services')).filter(x => x.id !== s.id);
        modal('Importo nga një shërbim tjetër', `<div class="field"><label>Shërbimi burim</label><select id="src">${list.map(x => `<option value="${x.id}">${esc(x.name)} (${x.used})</option>`).join('')}</select></div>
          <p class="muted" style="font-size:12.5px;margin:0">Subjektet e atij shërbimi shtohen këtu (brenda kuotës). Ato që ekzistojnë kapërcehen.</p>`, {
          saveLabel: 'Importo', onSave: async bg => { const r = await api.post(`/services/${s.id}/import-from`, { source_service_id: Number($('#src', bg).value) });
            toast(`U shtuan ${r.added}${r.skipped ? ` · ${r.skipped} ekzistonin` : ''}${r.full ? ` · ${r.full} jashtë kuotës` : ''}`); load(); } });
      } },
      { sep: true },
      { label: 'Shkarko template importi', onClick: () => downloadFile(`/services/${s.id}/import-template`, `template-${s.code}.csv`) },
    ]); };

    $('#datesBtn').onclick = () => {
      const cur = s.records.find(r => r.period_from) || {};
      modal('Vendos datat për të gjitha regjistrimet', `
        <div class="row2"><div class="field"><label>Data e fillimit</label><input type="date" id="dfrom" value="${esc(cur.period_from || '')}"></div>
        <div class="field"><label>Data e mbarimit</label><input type="date" id="dto" value="${esc(cur.period_to || '')}"></div></div>
        <div class="chips">${[['Muaji i kaluar', -1], ['Ky muaj', 0], ['Ky vit', 'y']].map(([l, v]) => `<button class="chip" data-p="${v}">${l}</button>`).join('')}</div>
        <p class="muted" style="font-size:12.5px;margin:10px 0 0">Periudha vendoset për të ${s.records.length} subjektet e shërbimit dhe përdoret nga robotët dhe PDF-të.</p>`, {
        saveLabel: 'Ruaj', onSave: async bg => { const r = await api.post(`/services/${s.id}/bulk-dates`, { from: $('#dfrom', bg).value, to: $('#dto', bg).value }); toast(`Periudha u vendos për ${r.updated} subjekte`); load(); } });
      const bg = $('.modal-bg:last-child');
      const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      $$('.chip', bg).forEach(c => c.onclick = () => {
        const n = new Date(); let a, b;
        if (c.dataset.p === 'y') { a = new Date(n.getFullYear(), 0, 1); b = new Date(n.getFullYear(), 11, 31); }
        else { const m = n.getMonth() + Number(c.dataset.p); a = new Date(n.getFullYear(), m, 1); b = new Date(n.getFullYear(), m + 1, 0); }
        $('#dfrom', bg).value = iso(a); $('#dto', bg).value = iso(b);
      });
    };

    $('#actBtn').onclick = e => { e.stopPropagation(); dropdown(e.currentTarget, [
      ...s.actions.map(a => ({ label: a.label + ' — të gjitha', icon: I.play, onClick: async () => {
        try { const r = await api.post(`/services/${s.id}/run`, { action: a.key }); toast(`${a.label}: ${r.queued} në radhë`); load(); } catch (err) { toast(err.message, true); } } })),
      { label: 'Ekzekuto për të gjitha subjektet aktive të studios', icon: I.play, onClick: () => confirmBox(`Të shtohen te ky shërbim dhe të ekzekutohen të gjitha subjektet aktive (brenda kuotës ${s.max_limit})?`, async () => {
        const r = await api.post(`/services/${s.id}/run`, { all: true, action: s.actions[0].key }); toast(`${r.queued} në radhë`); load(); }) },
      { sep: true },
      { label: 'Fshi të gjitha subjektet', icon: ICO.trash, danger: true, onClick: () => confirmBox(`Të hiqen të ${s.records.length} subjektet nga ky shërbim? Subjektet mbeten te "Subjektet", por rezultatet e këtij shërbimi fshihen.`, async () => {
        const r = await api.del(`/services/${s.id}/subjects`); toast(`U hoqën ${r.removed} subjekte`); load(); }, { danger: true }) },
    ]); };

    $('#stopBtn').onclick = () => confirmBox(`Të ndalohen ${s.active_executions} ekzekutimet e këtij shërbimi?`, async () => { const r = await api.post(`/services/${s.id}/stop`); toast(`U ndaluan ${r.stopped}`); load(); }, { danger: true });
  }

  await load();
}

/* ============ Pamja e rekordit (subjekt × shërbim) me skeda ============ */
const MUAJT_SH = ['JAN', 'SHK', 'MAR', 'PRI', 'MAJ', 'QER', 'KOR', 'GUS', 'SHT', 'TET', 'NËN', 'DHJ'];
const LOG_LV = { info: 'Informacion', success: 'Sukses', warn: 'Paralajmërim', error: 'Gabim' };
const REC_TABS = [['home', 'Kreu'], ['history', 'Historiku'], ['stats', 'Statistika'], ['logs', 'Regjistri'], ['settings', 'Cilësimet']];

async function viewRecord(el, serviceId, subjectId, pane) {
  pane = REC_TABS.find(t => t[0] === pane) ? pane : 'home';
  const base = `/services/${serviceId}/records/${subjectId}`;
  let d;
  try { d = await api.get(base); } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  const { service: svc, record: rec } = d;
  const acc = can('accountant');
  $('#pageTitle').textContent = svc.name;
  el.innerHTML = `
    <button class="btn ghost sm" id="back" style="margin-bottom:14px">&larr; ${esc(svc.name)}</button>
    <div class="card rec-card">
      <div class="rec-head">
        <div><div class="eyebrow">${esc(svc.name)}</div><h1>${esc(rec.subject_name)}</h1>
          <div class="muted small">NIPT ${esc(rec.nipt || '—')} · <span class="badge ${rec.subject_status === 'active' ? 'b-active' : 'b-cancelled'}">${rec.subject_status === 'active' ? 'Aktiv' : 'Joaktiv'}</span></div></div>
        <div class="rec-head-actions">
          <a class="btn ghost" href="#/va/${esc(subjectId)}">${I.va}<span>Pyet VA</span></a>
          <button class="btn ghost" id="rRefresh">${ICO.refresh}<span>Rifresko</span></button>
          ${acc ? `<button class="btn danger" id="rStop" ${d.active ? '' : 'disabled'}>${ICO.stop}<span>Ndalo</span></button>` : ''}
        </div>
      </div>
      <div class="tabs">${REC_TABS.map(([k, l]) => `<button class="tab ${k === pane ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="rec-body" id="pane"><div class="empty">Duke ngarkuar…</div></div>
    </div>`;
  $('#back').onclick = () => location.hash = '#/service/' + serviceId;
  $$('.tab', el).forEach(b => b.onclick = () => { location.hash = `#/record/${serviceId}/${subjectId}/${b.dataset.tab}`; });
  $('#rRefresh').onclick = () => route();
  if ($('#rStop')) $('#rStop').onclick = () => confirmBox('Të ndalohen ekzekutimet e këtij subjekti te ky shërbim?', async () => {
    const act = d.executions.filter(e => ['ne_radhe', 'ne_ekzekutim', 'duke_riprovuar'].includes(e.status));
    for (const e of act) await api.post('/executions/' + e.id + '/stop').catch(() => {});
    toast(`U ndaluan ${act.length}`); route();
  }, { danger: true });

  const P = $('#pane');
  // rifreskim automatik kur ka ekzekutim aktiv (Kreu dhe Regjistri)
  const autoRefresh = fn => { if (d.active && (pane === 'home' || pane === 'logs')) AUTO_TIMER = setInterval(() => { if (!$('.modal-bg')) fn(); }, 4000); };
  const runAction = async key => {
    try { await api.post(`/services/${serviceId}/run`, { subject_ids: [Number(subjectId)], action: key });
      toast('U fut në radhë'); route(); } catch (e) { toast(e.message, true); }
  };

  /* ---- Kreu ---- */
  if (pane === 'home') {
    const ex = d.executions;
    const running = d.active > 0;
    P.innerHTML = `
      <div class="rec-grid">
        <section class="box">
          <h3>Gjendja</h3>
          <div class="kv"><span>Statusi</span>${running ? '<span class="badge b-sent pulse">Në ekzekutim</span>' : badge(REC_ST, rec.status)}</div>
          <div class="kv"><span>Përditësuar</span><b>${timeAgo(rec.updated_at)}</b></div>
          <div class="kv"><span>Përshkrimi</span><b>${esc(rec.result || 'Ende pa rezultat')}</b></div>
          ${svc.columns.length ? `<div class="vals">${svc.columns.map(c => `<div class="val"><div class="muted">${esc(c.label)}</div><div class="v">${fmtValue(c, rec.data[c.key])}</div></div>`).join('')}</div>` : ''}
          ${acc ? `<div class="btn-row">${svc.actions.map((a, i) => `<button class="btn ${i ? 'ghost' : ''}" data-act="${a.key}" ${running ? 'disabled' : ''}>${I.play}<span>${esc(a.label)}</span></button>`).join('')}</div>` : ''}
        </section>
        <section class="box">
          <h3>Periudha dhe PDF</h3>
          <div class="row2"><div class="field"><label>Data e fillimit</label><input type="date" id="pFrom" value="${esc(rec.period_from || '')}" ${acc ? '' : 'disabled'}></div>
            <div class="field"><label>Data e mbarimit</label><input type="date" id="pTo" value="${esc(rec.period_to || '')}" ${acc ? '' : 'disabled'}></div></div>
          <div class="btn-row">
            ${acc ? '<button class="btn ghost" id="pSave">Ruaj periudhën</button>' : ''}
            <button class="btn ghost" id="pPdf">${ICO.down}<span>PDF i gjendjes</span></button>
            <button class="btn ghost" id="pZip">${ICO.down}<span>PDF-të e periudhës (.zip)</span></button>
          </div>
          <p class="muted small" style="margin:10px 0 0">ZIP-i ka një PDF për çdo muaj të periudhës, nga historiku i rezultateve.</p>
        </section>
      </div>
      <section class="box" style="margin-top:16px">
        <h3>Ekzekutimet e fundit</h3>
        <div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Veprimi</th><th>Statusi</th><th>Rezultati</th><th>Kohët</th><th></th></tr></thead>
        <tbody>${ex.length ? ex.map(e => `<tr><td class="muted nowrap small">${esc(e.finished_at || e.created_at)}</td>
          <td class="small">${esc((svc.actions.find(a => a.key === e.action) || {}).label || '—')}</td><td>${badge(EXEC_ST, e.status)}</td>
          <td class="muted small">${esc(e.result || '—')}</td><td class="muted small nowrap">${secs(e.wait_ms)} / ${secs(e.process_ms)}</td>
          <td class="num"><button class="btn ghost sm" data-log="${e.id}">Log-et</button></td></tr>`).join('') : '<tr><td colspan="6"><div class="empty">Ende pa ekzekutime</div></td></tr>'}</tbody></table></div>
      </section>`;
    $$('[data-act]', P).forEach(b => b.onclick = () => runAction(b.dataset.act));
    $$('[data-log]', P).forEach(b => b.onclick = () => showLogs(b.dataset.log));
    const per = () => `from=${$('#pFrom').value}&to=${$('#pTo').value}`;
    if ($('#pSave')) $('#pSave').onclick = async () => { try { await api.req('PATCH', base, { period_from: $('#pFrom').value, period_to: $('#pTo').value }); toast('Periudha u ruajt'); } catch (e) { toast(e.message, true); } };
    $('#pPdf').onclick = () => downloadFile(base + '/pdf', `deklarate-${rec.subject_name}.pdf`);
    $('#pZip').onclick = () => downloadFile(base + '/zip?' + per(), `deklaratat-${rec.subject_name}.zip`);
    autoRefresh(() => route());
  }

  /* ---- Historiku ---- */
  if (pane === 'history') {
    const y = new Date().getFullYear();
    P.innerHTML = `
      <div class="pane-tools">
        <label>Nga muaji<input type="month" id="hFrom" value="${y - 2}-01"></label>
        <label>Deri në muajin<input type="month" id="hTo" value="${y}-12"></label>
        <span class="spacer"></span>
        <button class="btn ghost" id="hExp">${ICO.down}<span>Eksporto CSV</span></button>
      </div>
      <div class="tbl-wrap" id="hTable"><div class="empty">Duke ngarkuar…</div></div>`;
    const load = async () => {
      const qs = `from=${$('#hFrom').value}&to=${$('#hTo').value}`;
      const rows = await api.get(base + '/history?' + qs);
      $('#hTable').innerHTML = `<table><thead><tr><th>Data</th><th>Periudha</th><th>Veprimi</th><th>Statusi</th><th>Rezultati</th>${svc.columns.map(c => `<th class="${c.type === 'money' || c.type === 'num' ? 'num' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead>
        <tbody>${rows.length ? rows.map(h => `<tr><td class="muted small nowrap">${esc(h.created_at)}</td><td class="nowrap"><b>${esc(h.period)}</b></td>
          <td class="small">${esc((svc.actions.find(a => a.key === h.action) || {}).label || '—')}</td><td>${badge(REC_ST, h.status)}</td><td class="muted small">${esc(h.result || '—')}</td>
          ${svc.columns.map(c => `<td class="${c.type === 'money' || c.type === 'num' ? 'num' : ''}">${fmtValue(c, h.data[c.key])}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${5 + svc.columns.length}"><div class="empty">Asnjë rezultat në këtë periudhë</div></td></tr>`}</tbody></table>`;
      $('#hExp').onclick = () => downloadFile(base + '/history.csv?' + qs, `historiku-${rec.subject_name}.csv`);
    };
    $('#hFrom').onchange = load; $('#hTo').onchange = load;
    await load();
  }

  /* ---- Statistika ---- */
  if (pane === 'stats') {
    const st = await api.get(base + '/stats');
    let sel = new Set(MUAJT_SH.map((_, i) => i));
    const fmt = v => v == null ? '<span class="muted">—</span>' : (st.type === 'money' ? `<span class="${v < 0 ? 'neg' : ''}">${nf(v)}</span>` : nf(v));
    const paint = () => {
      const idx = [...sel].sort((a, b) => a - b);
      const totals = st.years.map((_, yi) => idx.reduce((s, i) => s + (st.months[i][yi] || 0), 0));
      const max = Math.max(1, ...idx.flatMap(i => st.months[i].map(v => Math.abs(v || 0))));
      $('#sBody').innerHTML = `
        <div class="stat-totals">${st.years.map((yr, yi) => `<div class="stat"><div class="label">${yr}</div><div class="value ${totals[yi] < 0 ? 'neg' : ''}">${nf(totals[yi])}</div><div class="muted small">Totali ${st.type === 'money' ? '(Lek)' : ''}</div></div>`).join('')}</div>
        <div class="box" style="margin:16px 0"><h3>Krahasimi mujor <span class="muted small">· ${esc(st.metric)}</span></h3>
          <div class="gbars">${idx.map(i => `<div class="gcol"><div class="gset">${st.months[i].map((v, yi) => `<div class="gbar y${yi} ${v < 0 ? 'negbar' : ''}" style="height:${Math.round(Math.abs(v || 0) / max * 100)}%" title="${st.years[yi]} ${MUAJT_SH[i]}: ${v == null ? '—' : nf(v)}"></div>`).join('')}</div><small>${MUAJT_SH[i]}</small></div>`).join('')}</div>
          <div class="legend">${st.years.map((yr, yi) => `<span><i class="y${yi}"></i>${yr}</span>`).join('')}</div></div>
        <div class="tbl-wrap"><table><thead><tr><th>Muaji</th>${st.years.map(y => `<th class="num">${y}</th>`).join('')}</tr></thead>
          <tbody>${idx.map(i => `<tr><td><b>${MUAJT_SH[i]}</b></td>${st.months[i].map(v => `<td class="num">${fmt(v)}</td>`).join('')}</tr>`).join('')}
          <tr class="total"><td>Totali</td>${totals.map(v => `<td class="num">${fmt(v)}</td>`).join('')}</tr></tbody></table></div>`;
    };
    P.innerHTML = `
      <div class="pane-tools">
        <div class="chips">${MUAJT_SH.map((m, i) => `<button class="chip on" data-m="${i}">${m}</button>`).join('')}<button class="chip" id="mAll">Të gjithë</button></div>
        <span class="spacer"></span>
        <button class="btn ghost" id="sPdf">${ICO.down}<span>Raport PDF</span></button>
        <button class="btn ghost" id="sMax">Maksimizo</button>
      </div>
      <div id="sBody"></div>`;
    $$('[data-m]', P).forEach(c => c.onclick = () => { const i = Number(c.dataset.m); if (sel.has(i) && sel.size > 1) sel.delete(i); else sel.add(i); c.classList.toggle('on', sel.has(i)); paint(); });
    $('#mAll').onclick = () => { sel = new Set(MUAJT_SH.map((_, i) => i)); $$('[data-m]', P).forEach(c => c.classList.add('on')); paint(); };
    $('#sPdf').onclick = () => downloadFile(base + '/stats.pdf', `statistika-${rec.subject_name}.pdf`);
    $('#sMax').onclick = () => { const c = $('.rec-card'); c.classList.toggle('maxi'); $('#sMax').textContent = c.classList.contains('maxi') ? 'Minimizo' : 'Maksimizo'; };
    paint();
  }

  /* ---- Regjistri ---- */
  if (pane === 'logs') {
    P.innerHTML = `
      <div class="pane-tools">
        <input class="search" id="lq" placeholder="Kërko në regjistër…">
        <select id="llv"><option value="">Të gjitha nivelet</option>${Object.entries(LOG_LV).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <span class="spacer"></span><span class="muted small" id="lInfo"></span>
      </div>
      <div class="logbox tall" id="lBox"></div>`;
    const load = async () => {
      const logs = await api.get(base + `/logs?q=${encodeURIComponent($('#lq').value)}&level=${$('#llv').value}`);
      $('#lInfo').textContent = `${logs.length} rreshta${d.active ? ' · rifreskim automatik' : ''}`;
      $('#lBox').innerHTML = logs.map(l => `<div class="logline lv-${l.level}"><span class="muted">${esc(l.created_at)}</span> <b>[${esc(LOG_LV[l.level] || l.level)}]</b> ${esc(l.message)} <span class="muted">#${l.execution_id}</span></div>`).join('') || '<div class="muted">Asnjë rresht</div>';
    };
    let t; $('#lq').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
    $('#llv').onchange = load;
    await load();
    autoRefresh(load);
  }

  /* ---- Cilësimet e subjektit ---- */
  if (pane === 'settings') {
    const sub = await api.get('/subjects/' + subjectId);
    P.innerHTML = `
      <section class="box" style="max-width:640px">
        <h3>Të dhënat e subjektit</h3>
        <div class="row2"><div class="field"><label>Emri i subjektit *</label><input id="cName" value="${esc(sub.name)}" ${acc ? '' : 'disabled'}></div>
          <div class="field"><label>NIPT i subjektit *</label><input id="cNipt" value="${esc(sub.nipt || '')}" ${acc ? '' : 'disabled'}></div></div>
        <div class="row2"><div class="field"><label>Përdoruesi e-Albania</label><input id="cUser" value="${esc(sub.ealbania_user || '')}" ${acc ? '' : 'disabled'}></div>
          <div class="field"><label>Statusi i subjektit *</label><select id="cSt" ${acc ? '' : 'disabled'}><option value="active" ${sub.status === 'active' ? 'selected' : ''}>Aktiv</option><option value="inactive" ${sub.status === 'inactive' ? 'selected' : ''}>Joaktiv</option></select></div></div>
        <div class="field"><label>Fjalëkalimi e-Albania ${sub.has_ealbania_pass ? '<span class="badge b-active" style="font-size:10px">i ruajtur</span>' : ''}</label>
          <div class="pass-wrap"><input id="cPass" type="password" placeholder="${sub.has_ealbania_pass ? 'Fjalëkalim i ruajtur; vendos një të ri për ta zëvendësuar' : 'Ruhet i enkriptuar'}" ${acc ? '' : 'disabled'} autocomplete="new-password">
          <label class="check small"><input type="checkbox" id="cShow"> Shfaq</label></div></div>
        ${acc ? `<div class="btn-row" style="justify-content:space-between">
          <button class="btn ghost danger-text" id="cRemove">${ICO.trash}<span>Hiq nga ky shërbim</span></button>
          <button class="btn" id="cSave">Ruaj</button></div>` : '<p class="muted small">Vetëm lexim.</p>'}
      </section>`;
    $('#cShow').onchange = e => $('#cPass').type = e.target.checked ? 'text' : 'password';
    if (!acc) return;
    $('#cSave').onclick = async () => {
      const name = $('#cName').value.trim(), nipt = $('#cNipt').value.trim();
      if (!name || !nipt) return toast('Emri dhe NIPT-i janë të detyrueshëm', true);
      try {
        await api.put('/subjects/' + subjectId, { name, nipt, ealbania_user: $('#cUser').value.trim(), status: $('#cSt').value, ealbania_pass: $('#cPass').value, notes: sub.notes });
        toast('U ruajt'); route();
      } catch (e) { toast(e.message, true); }
    };
    $('#cRemove').onclick = () => confirmBox(`Të hiqet "${sub.name}" nga "${svc.name}"? Rezultatet e këtij shërbimi për subjektin fshihen; subjekti mbetet te "Subjektet".`, async () => {
      await api.del(`/services/${serviceId}/subjects/${subjectId}`); toast('U hoq'); location.hash = '#/service/' + serviceId;
    }, { danger: true });
  }
}

/* ============ Subjects ============ */
async function viewSubjects(el) {
  const list = await api.get('/subjects');
  el.innerHTML = `
    <div class="toolbar"><input class="search" id="q" placeholder="Kërko sipas emrit ose NIPT-it…">
      <div style="display:flex;gap:8px">
        <button class="btn ghost" id="exp">Eksporto CSV</button>
        ${can('accountant') ? `<button class="btn ghost" id="imp">Importo CSV</button>` : ''}
        ${can('accountant') ? `<button class="btn" id="add">${I.plus} Shto subjekt</button>` : ''}
      </div></div>
    <div class="card"><table>
      <thead><tr><th>Emri</th><th>NIPT</th><th>e-Albania</th><th>Kredencialet</th><th>Statusi</th><th></th></tr></thead>
      <tbody id="rows"></tbody></table></div>`;
  const render = rows => {
    $('#rows').innerHTML = rows.length ? rows.map(s => `<tr>
      <td><b>${esc(s.name)}</b></td><td class="muted">${esc(s.nipt || '—')}</td><td class="muted">${esc(s.ealbania_user || '—')}</td>
      <td>${s.has_ealbania_pass ? '<span class="badge b-active">e-Albania ✓</span>' : '<span class="badge b-draft">Pa fjalëkalim</span>'}</td>
      <td><span class="badge ${s.status === 'active' ? 'b-active' : 'b-cancelled'}">${s.status === 'active' ? 'Aktiv' : 'Joaktiv'}</span></td>
      <td class="num"><button class="btn ghost sm" data-open="${s.id}">Hap</button>${can('accountant') ? ` <button class="btn ghost sm" data-edit="${s.id}">Ndrysho</button> <button class="btn ghost sm" data-del="${s.id}">Fshi</button>` : ''}</td>
    </tr>`).join('') : '<tr><td colspan="6"><div class="empty">Asnjë subjekt</div></td></tr>';
    $$('[data-open]').forEach(b => b.onclick = () => location.hash = '#/subject/' + b.dataset.open);
    $$('[data-edit]').forEach(b => b.onclick = () => subjectForm(rows.find(x => x.id == b.dataset.edit)));
    $$('[data-del]').forEach(b => b.onclick = () => confirmBox('Të fshihet subjekti?', async () => { await api.del('/subjects/' + b.dataset.del); toast('U fshi'); viewSubjects(el); }, { danger: true }));
  };
  render(list);
  let t; $('#q').oninput = e => { clearTimeout(t); t = setTimeout(async () => render(await api.get('/subjects?q=' + encodeURIComponent(e.target.value))), 250); };
  $('#exp').onclick = () => downloadFile('/subjects/export', 'subjektet.csv');
  if ($('#imp')) $('#imp').onclick = () => importSubjectsCsv(() => viewSubjects(el));
  if ($('#add')) $('#add').onclick = () => subjectForm();
}

async function viewSubjectDetail(el, id) {
  const s = await api.get('/subjects/' + id);
  el.innerHTML = `
    <button class="btn ghost sm" id="back" style="margin-bottom:14px">&larr; Subjektet</button>
    <div class="grid" style="grid-template-columns:320px 1fr;align-items:start">
      <div class="card">
        <div class="card-head"><h3>${esc(s.name)}</h3><span class="badge ${s.status === 'active' ? 'b-active' : 'b-cancelled'}">${s.status === 'active' ? 'Aktiv' : 'Joaktiv'}</span></div>
        <div class="card-body">
          <div class="field" style="margin-bottom:10px"><div class="muted" style="font-size:12px">NIPT</div><b>${esc(s.nipt || '—')}</b></div>
          <div class="field" style="margin-bottom:10px"><div class="muted" style="font-size:12px">Përdoruesi e-Albania</div><b>${esc(s.ealbania_user || '—')}</b></div>
          <div class="field" style="margin-bottom:10px"><div class="muted" style="font-size:12px">Kredencialet</div>${s.has_ealbania_pass ? '<span class="badge b-active">e-Albania ✓</span>' : '<span class="badge b-draft">Pa fjalëkalim</span>'} ${s.has_selfcare_pass ? '<span class="badge b-active">Self-Care ✓</span>' : ''}</div>
          ${s.notes ? `<div class="muted" style="font-size:13px">${esc(s.notes)}</div>` : ''}
          ${can('accountant') ? `<button class="btn ghost" id="edit" style="margin-top:8px">Ndrysho subjektin</button>` : ''}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Shërbimet e subjektit</h3></div>
        <div class="card-body" style="padding:0"><table>
          <thead><tr><th>Shërbimi</th><th>Statusi</th><th>Rezultati</th><th>Përditësuar</th><th></th></tr></thead>
          <tbody>${s.records.length ? s.records.map(r => `<tr>
            <td><b>${esc(r.service_name)}</b></td>
            <td>${badge(REC_ST, r.status)}</td>
            <td class="muted">${esc(r.result || '—')}</td>
            <td class="muted">${timeAgo(r.updated_at)}</td>
            <td class="num">
              ${can('accountant') ? `<button class="btn ghost sm" data-run="${r.service_id}">${I.play}</button>` : ''}
              <button class="btn ghost sm" data-pdf="${r.service_id}">PDF</button>
              <a class="btn ghost sm" href="#/record/${r.service_id}/${s.id}">Hap</a>
            </td></tr>`).join('') : '<tr><td colspan="5"><div class="empty">Ky subjekt nuk është regjistruar në asnjë shërbim</div></td></tr>'}</tbody>
        </table></div>
      </div>
    </div>`;
  $('#back').onclick = () => location.hash = '#/subjects';
  if ($('#edit')) $('#edit').onclick = () => subjectForm(s);
  if (can('accountant')) clientAccountsCard(el, s);
  $$('[data-run]', el).forEach(b => b.onclick = async () => { await api.post('/services/' + b.dataset.run + '/run', { subject_ids: [s.id] }); toast('U fut në radhë'); location.hash = '#/automation'; });
  $$('[data-pdf]', el).forEach(b => b.onclick = () => downloadFile('/services/' + b.dataset.pdf + '/records/' + s.id + '/pdf', 'deklarate.pdf'));
}

/* ---- Llogaritë e portalit të klientit (te faqja e subjektit) ---- */
async function clientAccountsCard(el, s) {
  const wrap = document.createElement('div');
  wrap.className = 'card'; wrap.style.marginTop = '18px';
  el.appendChild(wrap);
  const paint = async () => {
    const list = await api.get(`/subjects/${s.id}/clients`);
    wrap.innerHTML = `
      <div class="card-head"><div><h3>Portali i klientit</h3><div class="muted small" style="margin-top:2px">Biznesi hyn me llogarinë e vet dhe kërkon TVSH-në në kohë reale me një buton.</div></div>
        <button class="btn" id="caAdd">${I.plus} Krijo llogari</button></div>
      <div class="card-body" style="padding:0"><table>
        <thead><tr><th>Emri</th><th>Email</th><th>Statusi</th><th>Hyrja e fundit</th><th></th></tr></thead>
        <tbody>${list.length ? list.map(u => `<tr><td><b>${esc(u.name)}</b></td><td class="muted">${esc(u.email)}</td>
          <td><span class="badge ${u.status === 'active' ? 'b-active' : 'b-suspended'}">${u.status === 'active' ? 'Aktive' : 'Pezulluar'}</span></td>
          <td class="muted small">${esc(u.last_login || '—')}</td>
          <td class="num nowrap"><button class="btn ghost sm" data-tog="${u.id}" data-st="${u.status}">${u.status === 'active' ? 'Pezullo' : 'Aktivizo'}</button>
            <button class="btn ghost sm danger-text" data-del="${u.id}">Fshi</button></td></tr>`).join('')
          : '<tr><td colspan="5"><div class="empty" style="padding:24px">Ky biznes nuk ka ende llogari në portal.</div></td></tr>'}</tbody></table></div>`;
    $('#caAdd', wrap).onclick = () => modal('Llogari e re për ' + s.name, `
      <div class="field"><label>Emri i personit</label><input id="caName" placeholder="p.sh. Administratori i biznesit"></div>
      <div class="field"><label>Email (për hyrje)</label><input id="caEmail" type="email"></div>
      <div class="field"><label>Fjalëkalimi fillestar (min. 8 karaktere)</label><input id="caPass" type="text" autocomplete="off"></div>
      <p class="muted small" style="margin:0">Klienti sheh vetëm TVSH-në e biznesit të vet. Mund ta ndryshojë fjalëkalimin pas hyrjes.</p>`, {
      saveLabel: 'Krijo', onSave: async bg => {
        await api.post(`/subjects/${s.id}/clients`, { name: $('#caName', bg).value.trim(), email: $('#caEmail', bg).value.trim(), password: $('#caPass', bg).value });
        toast('Llogaria u krijua'); paint();
      } });
    $$('[data-tog]', wrap).forEach(b => b.onclick = async () => { await api.post(`/subjects/${s.id}/clients/${b.dataset.tog}/status`, { status: b.dataset.st === 'active' ? 'suspended' : 'active' }); paint(); });
    $$('[data-del]', wrap).forEach(b => b.onclick = () => confirmBox('Të fshihet kjo llogari e portalit?', async () => { await api.del(`/subjects/${s.id}/clients/${b.dataset.del}`); toast('U fshi'); paint(); }, { danger: true }));
  };
  await paint();
}

/* ============ PORTALI I KLIENTIT: TVSH në kohë reale ============ */
function renderClientPortal() {
  let poll = null;
  const STAGES = { ne_radhe: 'Kërkesa u pranua, po përgatitet…', duke_riprovuar: 'Po lidhemi me portalin tatimor…', ne_ekzekutim: 'Po merren të dhënat nga portali tatimor…' };
  root.innerHTML = `
    <div class="cp">
      <header class="cp-top"><div class="brand">${I.logo}<b>Finbot</b></div>
        <div class="cp-user"><span id="cpBiz" class="muted"></span><button class="btn ghost sm" id="cpPass">Fjalëkalimi</button><button class="btn ghost sm" id="cpOut">Dil</button></div></header>
      <main class="cp-main">
        <div class="cp-card">
          <div class="eyebrow">TVSH në kohë reale</div>
          <h1 id="cpName">…</h1>
          <p class="muted" id="cpNipt"></p>
          <button class="cp-btn" id="cpGo"><span class="cp-btn-ico">${ICO.refresh}</span><span id="cpGoTxt">Kërko TVSH-në tani</span></button>
          <div class="cp-status" id="cpStatus" hidden><span class="spinner"></span><span id="cpStage"></span></div>
          <div id="cpResult"></div>
        </div>
        <div class="cp-card cp-hist"><h3>Kërkesat e fundit</h3><div id="cpHist"></div></div>
      </main>
      <footer class="cp-foot muted">Të dhënat merren nga portali tatimor në momentin e kërkesës. Për pyetje kontaktoni kontabilistin tuaj.</footer>
    </div>`;
  $('#cpOut').onclick = () => { clearInterval(poll); logout(); };
  $('#cpPass').onclick = () => modal('Ndrysho fjalëkalimin', `
    <div class="field"><label>Fjalëkalimi aktual</label><input id="pc" type="password"></div>
    <div class="field"><label>Fjalëkalimi i ri</label><input id="pn" type="password"></div>`, {
    onSave: async bg => { await api.post('/auth/change-password', { current: $('#pc', bg).value, next: $('#pn', bg).value }); toast('Fjalëkalimi u ndryshua'); } });

  const money = v => v == null ? '—' : nf(v) + ' Lek';
  const resultHtml = (data, when, status, result) => {
    if (!data || (data.tvsh_mujore == null && data.kredi == null)) return '';
    const t = Number(data.tvsh_mujore);
    const label = t < 0 ? 'TVSH për t’u rimbursuar / kredi' : 'TVSH për t’u paguar';
    return `<div class="cp-result ${status === 'deshtoi' ? 'err' : ''}">
      <div class="cp-main-val"><div class="muted">${label}</div><div class="big ${t < 0 ? 'pos' : ''}">${money(Math.abs(t))}</div></div>
      <div class="cp-vals">
        <div><span class="muted">TVSH mujore</span><b>${money(data.tvsh_mujore)}</b></div>
        <div><span class="muted">Kredi e mbartur</span><b>${money(data.kredi)}</b></div>
        <div><span class="muted">Totali</span><b>${money(data.totali)}</b></div>
        ${data.status_deklarim ? `<div><span class="muted">Deklarimi</span><b>${esc(data.status_deklarim)}</b></div>` : ''}
      </div>
      <div class="muted small">Përditësuar më ${esc(when || '—')}${result ? ' · ' + esc(result) : ''}</div></div>`;
  };

  const paintHist = reqs => {
    $('#cpHist').innerHTML = reqs.length ? reqs.map(r => `<div class="cp-row">
      <span>${esc(r.created_at)}</span>
      <span>${r.status === 'kryer' ? '<span class="badge b-paid">Gati</span>' : r.status === 'deshtoi' ? '<span class="badge b-overdue">Dështoi</span>' : r.status === 'anuluar' ? '<span class="badge b-cancelled">Anuluar</span>' : '<span class="badge b-sent pulse">Në proces</span>'}</span>
      <b>${r.data && r.data.tvsh_mujore != null ? money(r.data.tvsh_mujore) : ''}</b></div>`).join('') : '<div class="muted small">Ende pa kërkesa.</div>';
  };

  const busy = on => { $('#cpGo').disabled = on; $('#cpGoTxt').textContent = on ? 'Duke marrë të dhënat…' : 'Kërko TVSH-në tani'; $('#cpStatus').hidden = !on; $('#cpGo').classList.toggle('loading', on); };

  const watch = id => {
    busy(true); clearInterval(poll);
    const check = async () => {
      try {
        const r = await api.get('/client/requests/' + id);
        $('#cpStage').textContent = STAGES[r.stage] || 'Duke përpunuar…';
        if (['kryer', 'deshtoi', 'anuluar'].includes(r.status)) {
          clearInterval(poll); busy(false);
          if (r.status === 'kryer') toast('TVSH-ja u përditësua');
          else toast(r.status === 'anuluar' ? 'Kërkesa u anulua' : 'Nuk u morën dot të dhënat. Provoni përsëri pak më vonë.', true);
          load();
        }
      } catch (e) { clearInterval(poll); busy(false); toast(e.message, true); }
    };
    check(); poll = setInterval(check, 2000);
  };

  const load = async () => {
    const o = await api.get('/client/overview');
    $('#cpName').textContent = o.subject.name; $('#cpNipt').textContent = o.subject.nipt ? 'NIPT ' + o.subject.nipt : '';
    $('#cpBiz').textContent = ME.name;
    const lastOk = o.requests.find(r => r.status === 'kryer' && r.data);
    $('#cpResult').innerHTML = lastOk ? resultHtml(lastOk.data, lastOk.finished_at, 'kryer', null)
      : o.latest ? resultHtml(o.latest.data, o.latest.updated_at, o.latest.status, null)
      : '<p class="muted" style="margin-top:18px">Shtypni butonin për të parë TVSH-në tuaj të këtij muaji.</p>';
    paintHist(o.requests);
    const open = o.requests.find(r => ['ne_radhe', 'ne_ekzekutim', 'duke_riprovuar'].includes(r.status));
    if (open && !poll) watch(open.id);
  };

  $('#cpGo').onclick = async () => {
    try { const r = await api.post('/client/tvsh'); poll = null; watch(r.request.id); load(); } catch (e) { toast(e.message, true); }
  };
  load().catch(e => toast(e.message, true));
}

function subjectForm(s) {
  s = s || { status: 'active' };
  modal(s.id ? 'Ndrysho subjektin' : 'Subjekt i ri', `
    <div class="row2">
      <div class="field"><label>Emri i subjektit *</label><input id="s_name" value="${esc(s.name)}"></div>
      <div class="field"><label>NIPT</label><input id="s_nipt" value="${esc(s.nipt)}"></div>
    </div>
    <div class="row2">
      <div class="field"><label>Përdoruesi e-Albania</label><input id="s_euser" value="${esc(s.ealbania_user)}" placeholder="NIPT ose email"></div>
      <div class="field"><label>Statusi</label><select id="s_status"><option value="active" ${s.status==='active'?'selected':''}>Aktiv</option><option value="inactive" ${s.status==='inactive'?'selected':''}>Joaktiv</option></select></div>
    </div>
    <div class="row2">
      <div class="field"><label>Fjalëkalimi e-Albania ${s.has_ealbania_pass ? '<span class="badge b-active" style="font-size:10px">i ruajtur</span>' : ''}</label><input id="s_epass" type="password" placeholder="${s.has_ealbania_pass ? 'Lëre bosh për të mos ndryshuar' : 'Ruhet i enkriptuar'}"></div>
      <div class="field"><label>Fjalëkalimi Self-Care ${s.has_selfcare_pass ? '<span class="badge b-active" style="font-size:10px">i ruajtur</span>' : ''}</label><input id="s_spass" type="password" placeholder="${s.has_selfcare_pass ? 'Lëre bosh' : 'Opsional'}"></div>
    </div>
    <p class="muted" style="font-size:12px;margin:4px 0 0">🔒 Fjalëkalimet ruhen të enkriptuara (AES) dhe përdoren vetëm nga robotët për të punuar në emër të subjektit.</p>
  `, {
    onSave: async bg => {
      const body = { name: $('#s_name', bg).value.trim(), nipt: $('#s_nipt', bg).value, ealbania_user: $('#s_euser', bg).value, status: $('#s_status', bg).value, ealbania_pass: $('#s_epass', bg).value, selfcare_pass: $('#s_spass', bg).value };
      if (!body.name) throw new Error('Emri është i detyrueshëm');
      if (s.id) await api.put('/subjects/' + s.id, body); else await api.post('/subjects', body);
      toast('U ruajt'); route();
    }
  });
}

/* ============ Automation ============ */
async function viewAutomation(el) {
  const render = async () => {
    const st = await api.get('/executions/stats');
    const svcFilter = $('#fsvc') ? $('#fsvc').value : '';
    const stFilter = $('#fst') ? $('#fst').value : '';
    const qFilter = $('#fq') ? $('#fq').value : '';
    const hadFocus = document.activeElement && document.activeElement.id === 'fq';
    const qs = []; if (svcFilter) qs.push('service_id=' + svcFilter); if (stFilter) qs.push('status=' + stFilter); if (qFilter) qs.push('q=' + encodeURIComponent(qFilter));
    const list = await api.get('/executions' + (qs.length ? '?' + qs.join('&') : ''));
    const services = window.__SVC || (window.__SVC = await api.get('/services'));
    el.innerHTML = `
      <div class="toolbar"><div class="muted">Monitoro dhe kontrollo radhën e robotëve. (Rifreskim automatik)</div>
        <div style="display:flex;gap:8px">${can('accountant') ? '<button class="btn danger" id="stopAll">Ndalo të gjitha</button>' : ''}<button class="btn ghost" id="refresh">Rifresko</button></div></div>
      <div class="grid auto-stats" style="margin-bottom:16px">
        ${stat('Në radhë', st.ne_radhe, 'i-amber', I.auto)}
        ${stat('Në ekzekutim', st.ne_ekzekutim, 'i-blue', I.auto)}
        ${stat('Kryer', st.kryer, 'i-green', I.auto)}
        ${stat('Dështuar', st.deshtoi, 'i-red', I.auto)}
        ${stat('Mediana pritjes', secs(st.mesatare_pritje_ms), 'i-violet', I.auto)}
        ${stat('Mediana procesim', secs(st.mesatare_procesim_ms), 'i-violet', I.auto)}
      </div>
      <div class="card">
        <div class="card-head"><h3>Radha e ekzekutimeve</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input class="search" id="fq" placeholder="Subjekt, NIPT, shërbim, përdorues ose rezultat" value="${esc(qFilter)}">
            <select class="search" id="fsvc" style="padding-left:12px;min-width:160px;background:none"><option value="">Të gjitha shërbimet</option>${services.map(s => `<option value="${s.id}" ${s.id==svcFilter?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
            <select class="search" id="fst" style="padding-left:12px;min-width:150px;background:none"><option value="">Të gjitha statuset</option>${Object.entries(EXEC_ST).map(([k,v])=>`<option value="${k}" ${k==stFilter?'selected':''}>${v[0]}</option>`).join('')}</select>
          </div></div>
        <div class="card-body" style="padding:0"><table>
          <thead><tr><th>Subjekti</th><th>Shërbimi</th><th>Status</th><th>Rezultati</th><th>Kohët</th><th>Ekzekutimi i fundit</th><th></th></tr></thead>
          <tbody>${list.length ? list.map(e => `<tr>
            <td><b>${esc(e.subject_name)}</b><br><small class="muted">${esc(e.nipt || '')}</small></td>
            <td class="muted">${esc(e.service_name)}</td>
            <td>${badge(EXEC_ST, e.status)}</td>
            <td class="muted" style="max-width:220px">${esc(e.result || '—')}</td>
            <td class="muted"><small>Pritja: ${secs(e.wait_ms)}<br>Procesim: ${secs(e.process_ms)}</small></td>
            <td class="muted"><small>${timeAgo(e.finished_at || e.started_at || e.created_at)}<br>${esc(e.run_by || '')}</small></td>
            <td class="num"><button class="btn ghost sm" data-log="${e.id}">Log-et</button>${can('accountant') && ['ne_radhe','ne_ekzekutim','duke_riprovuar'].includes(e.status) ? ` <button class="btn danger sm" data-stop="${e.id}">Ndalo</button>` : ''}</td>
          </tr>`).join('') : '<tr><td colspan="7"><div class="empty">Asnjë ekzekutim</div></td></tr>'}</tbody>
        </table></div></div>`;
    $('#refresh').onclick = render;
    $('#fsvc').onchange = render; $('#fst').onchange = render;
    let qt; $('#fq').oninput = () => { clearTimeout(qt); qt = setTimeout(render, 300); };
    if (hadFocus) { const i = $('#fq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    if ($('#stopAll')) $('#stopAll').onclick = () => confirmBox('Të ndalohen të gjitha në radhë?', async () => { const r = await api.post('/executions/stop-all'); toast(`U ndaluan ${r.stopped}`); render(); }, { danger: true });
    $$('[data-stop]', el).forEach(b => b.onclick = async () => { await api.post('/executions/' + b.dataset.stop + '/stop'); toast('U ndalua'); render(); });
    $$('[data-log]', el).forEach(b => b.onclick = () => showLogs(b.dataset.log));
  };
  await render();
  AUTO_TIMER = setInterval(() => { if (!document.querySelector('.modal-bg')) render().catch(() => {}); }, 4000);
}

async function showLogs(id) {
  const d = await api.get('/executions/' + id + '/logs');
  modal('Log-et — ' + d.subject_name, `
    <div class="muted" style="margin-bottom:10px">${esc(d.service_name)} · ${badge(EXEC_ST, d.status)}</div>
    <div class="logbox">${d.logs.map(l => `<div class="logline lv-${l.level}"><span class="muted">${esc(l.created_at)}</span> <b>[${l.level}]</b> ${esc(l.message)}</div>`).join('') || '<div class="muted">Pa log-e</div>'}</div>`, { wide: true });
}

/* ============ Pyet VA ============ */
async function viewVA(el, subjectId) {
  const subjects = await api.get('/subjects').catch(() => []);
  let sid = subjectId && subjects.find(s => String(s.id) === String(subjectId)) ? String(subjectId) : '';
  const QUICK = { 'Përmbledhje': 'Më jep një përmbledhje të gjendjes', 'Dështimet': 'Cilat ekzekutime kanë dështuar dhe pse?', 'Përdorimi': 'Si është përdorimi i kuotave?' };
  const SUGGEST_ALL = ['Cilat ekzekutime kanë dështuar dhe pse?', 'Si është përdorimi i kuotave?', 'Përmbledhje e TVSH-së për të gjitha subjektet'];
  const SUGGEST_SUB = ['Si ka ecur TVSH-ja e paguar këto tre vite?', 'Krahaso muajt dhe shpjego ndryshimet më të mëdha', 'A ka shërbime të dështuara për këtë subjekt?'];

  const paint = async () => {
    const d = await api.get('/va/messages' + (sid ? '?subject_id=' + sid : ''));
    const subj = subjects.find(s => String(s.id) === sid);
    el.innerHTML = `
      <div class="card va-card">
        <div class="card-head va-head">
          <div style="display:flex;align-items:center;gap:10px">${I.logo}<div><h3 style="margin:0">Pyet VA</h3>
            <div class="muted" style="font-size:12px">${subj ? 'Analizë për ' + esc(subj.name) : 'Shërbimet e tua, në një bisedë'}${d.ai ? ' · me AI (Claude)' : ''}</div></div></div>
          <div class="va-tools">
            <select id="vaSub" title="Analizo subjektin"><option value="">Të gjitha subjektet</option>${subjects.map(s => `<option value="${s.id}" ${String(s.id) === sid ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
            <button class="btn ghost sm" id="vaNew">Bisedë e re</button>
            <span class="badge b-admin">${d.credits} kredite</span>
          </div></div>
        <div class="va-quick">${Object.keys(QUICK).map(k => `<button class="chip" data-q="${esc(QUICK[k])}">${k}</button>`).join('')}</div>
        <div class="va-msgs" id="msgs">${d.messages.length ? d.messages.map(m => vaBubble(m.role, m.body)).join('') : `
          <div class="va-empty">
            <div class="va-spark">${I.va}</div><h3>${subj ? esc(subj.name) : 'Si po ecën puna sot?'}</h3>
            <p class="muted">${subj ? 'Pyet për TVSH-në, historikun, dështimet dhe vlerat e këtij subjekti.' : 'Pa zgjedhur subjekt, biseda përfshin të gjitha shërbimet e studios.'}</p>
            <div class="va-suggest">${(subj ? SUGGEST_SUB : SUGGEST_ALL).map(q => `<button class="va-chip">${esc(q)}</button>`).join('')}</div></div>`}</div>
        <div class="va-input"><input id="vaq" placeholder="Shkruaj pyetjen…"><button class="btn" id="vasend">Dërgo</button></div>
        <div class="muted" style="padding:0 16px 12px;font-size:12px">VA mund të gabojë. Verifiko shifrat.</div>
      </div>`;
    const msgs = $('#msgs'); msgs.scrollTop = msgs.scrollHeight;
    const send = async q => {
      if (!q.trim()) return;
      if (msgs.querySelector('.va-empty')) msgs.innerHTML = '';
      msgs.insertAdjacentHTML('beforeend', vaBubble('user', q)); msgs.scrollTop = msgs.scrollHeight;
      $('#vaq').value = ''; $('#vasend').disabled = true;
      const typing = document.createElement('div'); typing.innerHTML = vaBubble('assistant', '…'); msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
      try { const r = await api.post('/va/ask', { question: q, subject_id: sid || null }); typing.remove(); msgs.insertAdjacentHTML('beforeend', vaBubble('assistant', r.answer)); }
      catch (e) { typing.remove(); toast(e.message, true); }
      $('#vasend').disabled = false; msgs.scrollTop = msgs.scrollHeight;
    };
    $('#vasend').onclick = () => send($('#vaq').value);
    $('#vaq').onkeydown = e => { if (e.key === 'Enter') send($('#vaq').value); };
    $$('.va-chip', el).forEach(c => c.onclick = () => send(c.textContent));
    $$('.va-quick .chip', el).forEach(c => c.onclick = () => send(c.dataset.q));
    $('#vaSub').onchange = e => { location.hash = '#/va' + (e.target.value ? '/' + e.target.value : ''); };
    $('#vaNew').onclick = async () => { await api.del('/va/messages' + (sid ? '?subject_id=' + sid : '')); paint(); };
  };
  await paint();
}
function vaBubble(role, body) {
  return `<div class="va-row ${role}"><div class="va-bubble">${esc(body).replace(/\n/g, '<br>')}</div></div>`;
}

/* ============ Notifications ============ */
async function viewNotifications(el) {
  const d = await api.get('/notifications');
  el.innerHTML = `
    <div class="grid stats" style="grid-template-columns:1fr 1fr;margin-bottom:18px">
      ${stat('Të palexuara', d.unread, 'i-amber', I.bell)}
      ${stat('Njoftime gjithsej', d.total, 'i-blue', I.bell)}
    </div>
    <div class="card"><div class="card-head"><h3>Njoftimet</h3>${d.unread ? '<button class="btn ghost sm" id="readAll">Shëno të gjitha si të lexuara</button>' : ''}</div>
      <div class="card-body" style="padding:0">${d.items.length ? d.items.map(n => `
        <div class="notif ${n.is_read ? '' : 'unread'}"><div class="ndot"></div><div><b>${esc(n.title)}</b><div class="muted">${esc(n.body || '')}</div><small class="muted">${esc(n.created_at)}</small></div></div>`).join('') : '<div class="empty">Nuk ka ende njoftime</div>'}</div></div>`;
  if ($('#readAll')) $('#readAll').onclick = async () => { await api.post('/notifications/read-all'); viewNotifications(el); };
}

/* ============ Support ============ */
async function viewSupport(el) {
  const list = await api.get('/tickets');
  el.innerHTML = `
    <div class="toolbar"><div class="muted">Krijo bileta dhe ndiq bisedat me mbështetjen.</div><button class="btn" id="add">${I.plus} Hap biletë</button></div>
    <div class="card"><table><thead><tr><th>ID</th><th>Subjekti</th><th>Statusi</th><th>Krijuar nga</th><th>Përditësuar</th><th></th></tr></thead>
      <tbody>${list.length ? list.map(t => `<tr><td class="muted">#${t.id}</td><td><b>${esc(t.subject)}</b></td>
        <td><span class="badge ${t.status==='mbyllur'?'b-cancelled':t.status==='ne_proces'?'b-sent':'b-active'}">${t.status==='mbyllur'?'Mbyllur':t.status==='ne_proces'?'Në proces':'Hapur'}</span></td>
        <td class="muted">${esc(t.creator_name || '')}</td><td class="muted">${esc(t.updated_at)}</td>
        <td class="num"><button class="btn ghost sm" data-open="${t.id}">Hap</button></td></tr>`).join('') : '<tr><td colspan="6"><div class="empty">Nuk ka ende bileta</div></td></tr>'}</tbody></table></div>`;
  $('#add').onclick = () => modal('Hap biletë mbështetjeje', `
    <div class="field"><label>Titulli *</label><input id="t_sub"></div>
    <div class="field"><label>Mesazhi</label><textarea id="t_body" rows="4"></textarea></div>`, {
    saveLabel: 'Dërgo', onSave: async bg => { const sub = $('#t_sub', bg).value.trim(); if (!sub) throw new Error('Titulli është i detyrueshëm'); await api.post('/tickets', { subject: sub, body: $('#t_body', bg).value }); toast('Bileta u hap'); viewSupport(el); }
  });
  $$('[data-open]', el).forEach(b => b.onclick = () => ticketThread(b.dataset.open, el));
}
async function ticketThread(id, el) {
  const t = await api.get('/tickets/' + id);
  const m = modal('Biletë #' + t.id + ' — ' + t.subject, `
    <div class="logbox" id="thread">${t.messages.map(x => `<div class="tmsg"><b>${esc(x.author)}</b> <small class="muted">${esc(x.created_at)}</small><div>${esc(x.body).replace(/\n/g,'<br>')}</div></div>`).join('') || '<div class="muted">Pa mesazhe</div>'}</div>
    <div class="field" style="margin-top:12px"><textarea id="t_reply" rows="2" placeholder="Shkruaj përgjigje…"></textarea></div>`, {
    wide: true, saveLabel: 'Dërgo', onSave: async bg => { const body = $('#t_reply', bg).value.trim(); if (!body) throw new Error('Mesazhi është bosh'); await api.post('/tickets/' + id + '/messages', { body }); toast('U dërgua'); }
  });
}

/* ============ Users (owner/admin hidden logic) ============ */
async function viewUsers(el) {
  const list = await api.get('/users');
  el.innerHTML = `
    <div class="toolbar"><div class="muted">Ekipi i studios. Owner-i dhe adminët e platformës menaxhohen te "Studiot".</div><button class="btn" id="add">${I.plus} Përdorues i ri</button></div>
    <div class="card"><table><thead><tr><th>Emri</th><th>Email</th><th>Roli</th><th>Statusi</th><th>Hyrja e fundit</th><th></th></tr></thead>
      <tbody>${list.map(u => `<tr><td><b>${esc(u.name)}</b>${u.id===ME.id?' <small class="muted">(ju)</small>':''}</td><td>${esc(u.email)}</td>
        <td><span class="badge b-${u.role}">${roleLabel(u.role)}</span></td>
        <td><span class="badge ${u.status==='active'?'b-active':'b-suspended'}">${u.status==='active'?'Aktiv':'Pezulluar'}</span></td>
        <td class="muted">${u.last_login?esc(u.last_login):'—'}</td>
        <td class="num">${u.id!==ME.id?`<button class="btn ghost sm" data-edit="${u.id}">Ndrysho</button> <button class="btn ghost sm" data-status="${u.id}">${u.status==='active'?'Pezullo':'Riaktivizo'}</button> <button class="btn ghost sm" data-del="${u.id}">Fshi</button>`:''}</td>
      </tr>`).join('') || '<tr><td colspan="6"><div class="empty">Ende pa përdorues</div></td></tr>'}</tbody></table></div>`;
  $('#add').onclick = () => userForm();
  $$('[data-edit]').forEach(b => b.onclick = () => userForm(list.find(x => x.id == b.dataset.edit)));
  $$('[data-del]').forEach(b => b.onclick = () => { const u = list.find(x => x.id == b.dataset.del); confirmBox(`Të nxirret jashtë "${u.name}"? Llogaria fshihet përgjithmonë.`, async () => { await api.del('/users/' + u.id); toast('U fshi'); viewUsers(el); }, { danger: true }); });
  $$('[data-status]').forEach(b => b.onclick = async () => { const u = list.find(x => x.id == b.dataset.status); const status = u.status === 'active' ? 'suspended' : 'active'; await api.post('/users/' + u.id + '/status', { status }); toast(status === 'suspended' ? 'U pezullua' : 'U riaktivizua'); viewUsers(el); });
}
function userForm(u) {
  u = u || { role: 'viewer' };
  const roles = ['studio_admin', 'accountant', 'viewer'];
  modal(u.id ? 'Ndrysho përdoruesin' : 'Përdorues i ri', `
    <div class="field"><label>Emri *</label><input id="u_name" value="${esc(u.name)}"></div>
    <div class="field"><label>Email *</label><input id="u_email" type="email" value="${esc(u.email)}"></div>
    <div class="row2"><div class="field"><label>Roli</label><select id="u_role">${roles.map(r => `<option value="${r}" ${r===u.role?'selected':''}>${roleLabel(r)}</option>`).join('')}</select></div>
      <div class="field"><label>${u.id?'Fjalëkalim i ri (opsional)':'Fjalëkalimi *'}</label><input id="u_pass" type="password" placeholder="${u.id?'Lëre bosh':''}"></div></div>
    <p class="muted" style="font-size:12.5px;margin:0">Administratori i studios menaxhon ekipin dhe cilësimet; kontabilisti punon me bizneset dhe robotët; vëzhguesi vetëm sheh.</p>`, {
    onSave: async bg => {
      const body = { name: $('#u_name', bg).value.trim(), email: $('#u_email', bg).value.trim(), role: $('#u_role', bg).value, password: $('#u_pass', bg).value };
      if (!body.name || !body.email) throw new Error('Emri dhe email-i janë të detyrueshëm');
      if (!u.id && !body.password) throw new Error('Fjalëkalimi është i detyrueshëm');
      if (u.id) await api.put('/users/' + u.id, body); else await api.post('/users', body);
      toast('U ruajt'); route();
    }
  });
}

/* ============ Studioja aktive (krye) ============ */
const eur = n => (Number(n) || 0).toLocaleString('sq-AL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
function orgChip() {
  if (PLATFORM) return `<select id="orgSwitch" title="Studioja që po shihni"><option value="">— Zgjidh studion —</option></select>`;
  if (!ORG) return '';
  const p = ORG.plan;
  const pct = p.limit ? Math.min(100, Math.round(p.used / p.limit * 100)) : 0;
  return `<span class="muted">${esc(ORG.name)}</span><span class="plan-pill ${pct >= 90 ? 'warn' : ''}" title="Plani ${esc(p.plan_name)}">${esc(p.plan_name)} · ${p.used}/${p.limit} biznese</span>`;
}
async function bindOrgChip() {
  const sel = $('#orgSwitch'); if (!sel) return;
  const d = await api.get('/platform/orgs').catch(() => ({ orgs: [] }));
  sel.innerHTML = '<option value="">— Zgjidh studion —</option>' + d.orgs.map(o => `<option value="${o.id}" ${ORG && ORG.id === o.id ? 'selected' : ''}>${esc(o.name)}${o.status !== 'active' ? ' (pezulluar)' : ''}</option>`).join('');
  sel.onchange = () => switchOrg(sel.value || null);
}
async function switchOrg(id, goto) {
  await api.post('/platform/active-org', { org_id: id ? Number(id) : null });
  await loadMe();
  toast(ORG ? 'Po shihni: ' + ORG.name : 'Dolët nga studioja');
  renderApp();
  location.hash = goto || (ORG ? '#/' : '#/platform');
}

/* ============ Platforma: studiot, planet, adminët ============ */
async function viewPlatform(el) {
  const [d, plans, admins] = await Promise.all([api.get('/platform/orgs'), api.get('/platform/plans'), api.get('/platform/admins')]);
  const planOpt = cur => plans.map(p => `<option value="${p.code}" ${p.code === cur ? 'selected' : ''}>${esc(p.name)} — ${p.max_subjects} biznese, ${eur(p.price_month)}/muaj${p.price_extra ? ` + ${eur(p.price_extra)}/biznes shtesë` : ''}</option>`).join('');
  el.innerHTML = `
    <div class="grid stats" style="margin-bottom:18px">
      ${stat('Studio', d.totals.orgs, 'i-blue', I.dash, 'Gjithsej në platformë')}
      ${stat('Biznese', d.totals.subjects, 'i-green', I.subjects, 'Të regjistruara nga studiot')}
      ${stat('Të ardhura mujore', eur(d.totals.mrr), 'i-amber', I.services, 'Nga studiot aktive')}
      ${stat('Adminë', admins.length, 'i-violet', I.users, ME.role === 'owner' ? 'Përfshirë ju' : 'Të platformës')}
    </div>
    <div class="card">
      <div class="card-head"><h3>Studiot</h3><button class="btn" id="orgNew">${I.plus} Studio e re</button></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Studioja</th><th>Plani</th><th class="num">Biznese</th><th class="num">Për muaj</th><th>Statusi</th><th></th></tr></thead>
        <tbody>${d.orgs.map(o => { const p = o.plan; const pct = p.limit ? Math.min(100, Math.round(p.used / p.limit * 100)) : 0; return `<tr>
          <td><b>${esc(o.name)}</b><br><small class="muted">${esc(o.nipt || '')} · ${o.users} përdorues</small></td>
          <td>${esc(p.plan_name)}${o.max_subjects ? ' <small class="muted">(kufi i veçantë)</small>' : ''}</td>
          <td class="num"><b>${p.used}</b> / ${p.limit}${p.extra ? `<br><small class="muted">+${p.extra} shtesë</small>` : ''}<div class="qbar" style="margin-top:4px"><div class="qfill" style="width:${pct}%"></div></div></td>
          <td class="num"><b>${eur(p.monthly_total)}</b></td>
          <td><span class="badge ${o.status === 'active' ? 'b-active' : 'b-suspended'}">${o.status === 'active' ? 'Aktive' : 'Pezulluar'}</span>${o.trial_ends && o.trial_ends >= new Date().toISOString().slice(0, 10) ? `<br><span class="badge b-sent" style="margin-top:4px">Provë deri ${esc(fmtDate(o.trial_ends))}</span>` : ''}</td>
          <td class="num nowrap"><button class="btn sm" data-enter="${o.id}">Hyr</button> <button class="btn ghost sm" data-edit="${o.id}">Ndrysho</button></td></tr>`; }).join('')}</tbody></table></div>
    </div>
    <div class="grid plat-grid">
      <div class="card">
        <div class="card-head"><h3>Planet e abonimit</h3><span class="muted small">Çmimet në €/muaj, pa TVSH</span></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>Plani</th><th class="num">Biznese</th><th class="num">Çmimi</th><th class="num">Shtesë / biznes</th><th class="num">Kredite AI</th><th></th></tr></thead>
          <tbody>${plans.map(p => `<tr><td><b>${esc(p.name)}</b></td><td class="num">${p.max_subjects}</td><td class="num">${eur(p.price_month)}</td>
            <td class="num">${p.price_extra ? eur(p.price_extra) : '<span class="muted">—</span>'}</td><td class="num">${nf(p.ai_credits)}</td>
            <td class="num"><button class="btn ghost sm" data-plan="${p.code}">Ndrysho</button></td></tr>`).join('')}</tbody></table></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Adminët e platformës</h3><button class="btn ghost sm" id="admNew">${I.plus} Admin</button></div>
        <div class="tbl-wrap"><table><tbody>${admins.map(a => `<tr><td><b>${esc(a.name)}</b>${a.id === ME.id ? ' <small class="muted">(ju)</small>' : ''}<br><small class="muted">${esc(a.email)}</small></td>
          <td><span class="badge b-${a.role}">${roleLabel(a.role)}</span> ${a.status !== 'active' ? '<span class="badge b-suspended">Pezulluar</span>' : ''}</td>
          <td class="num nowrap">${a.id !== ME.id ? `<button class="btn ghost sm" data-astat="${a.id}" data-st="${a.status}">${a.status === 'active' ? 'Pezullo' : 'Aktivizo'}</button> <button class="btn ghost sm danger-text" data-adel="${a.id}">Fshi</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
        <p class="muted small" style="padding:0 18px 14px;margin:0">Adminët kanë të njëjtat të drejta si pronari, por nuk mund ta shohin, ta pezullojnë apo ta nxjerrin pronarin nga sistemi.</p>
      </div>
    </div>`;

  el.insertAdjacentHTML('beforeend', `
    <div class="card" style="margin-top:18px" id="invCard">
      <div class="card-head"><h3>Faturat e studiove</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input type="month" id="invPeriod" class="search" style="padding-left:12px;min-width:0">
          <button class="btn" id="invGen">Lësho faturat e muajit</button><button class="btn ghost" id="issuerBtn">Të dhënat e lëshuesit</button></div></div>
      <div id="invBody"><div class="empty">Duke ngarkuar…</div></div>
    </div>`);
  const prev = new Date(); prev.setDate(1); prev.setMonth(prev.getMonth() - 1);
  $('#invPeriod').value = prev.toISOString().slice(0, 7);
  const INV_ST = { e_papaguar: ['E papaguar', 'b-draft'], paguar: ['Paguar', 'b-paid'], anuluar: ['Anuluar', 'b-cancelled'], vonuar: ['E vonuar', 'b-overdue'] };
  const loadInv = async () => {
    const r = await api.get('/platform/invoices');
    $('#invBody').innerHTML = `
      <div class="inv-sum"><span>Paguar: <b>${eur(r.totals.paid)}</b></span><span>Pa paguar: <b>${eur(r.totals.unpaid)}</b></span><span class="${r.totals.overdue ? 'neg' : ''}">Të vonuara: <b>${eur(r.totals.overdue)}</b></span></div>
      <div class="tbl-wrap"><table><thead><tr><th>Nr.</th><th>Studioja</th><th>Periudha</th><th class="num">Totali</th><th>Afati</th><th>Statusi</th><th></th></tr></thead>
      <tbody>${r.invoices.length ? r.invoices.map(i => `<tr><td class="nowrap"><b>${esc(i.number)}</b></td><td>${esc(i.org_name)}</td><td>${esc(i.period)}</td>
        <td class="num">${eur(i.total)}</td><td class="muted nowrap">${esc(fmtDate(i.due_date))}</td><td>${badge(INV_ST, i.display_status)}</td>
        <td class="num nowrap"><button class="btn ghost sm" data-ipdf="${i.id}" data-num="${esc(i.number)}">PDF</button>
          ${i.status === 'e_papaguar' ? `<button class="btn sm green" data-ist="${i.id}" data-v="paguar">Paguar</button> <button class="btn ghost sm" data-ist="${i.id}" data-v="anuluar">Anulo</button>` : i.status === 'paguar' ? `<button class="btn ghost sm" data-ist="${i.id}" data-v="e_papaguar">Kthe</button>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="7"><div class="empty">Ende pa fatura. Lëshoni faturat e muajit të kaluar.</div></td></tr>'}</tbody></table></div>`;
    $$('[data-ipdf]').forEach(b => b.onclick = () => downloadFile('/platform/invoices/' + b.dataset.ipdf + '/pdf', b.dataset.num + '.pdf'));
    $$('[data-ist]').forEach(b => b.onclick = async () => { await api.post('/platform/invoices/' + b.dataset.ist + '/status', { status: b.dataset.v }); toast('U përditësua'); loadInv(); });
  };
  $('#invGen').onclick = () => confirmBox(`Të lëshohen faturat për ${$('#invPeriod').value} për të gjitha studiot aktive (përveç atyre në provë)?`, async () => {
    const r = await api.post('/platform/invoices/generate', { period: $('#invPeriod').value }); toast(`U lëshuan ${r.created} fatura${r.skipped ? ` · ${r.skipped} u kapërcyen` : ''}`); loadInv(); });
  $('#issuerBtn').onclick = async () => {
    const s = await api.get('/platform/issuer');
    modal('Të dhënat e lëshuesit të faturave', `
      <div class="row2"><div class="field"><label>Emri i kompanisë</label><input id="iName" value="${esc(s.name)}"></div><div class="field"><label>NIPT</label><input id="iNipt" value="${esc(s.nipt)}"></div></div>
      <div class="field"><label>Adresa</label><input id="iAddr" value="${esc(s.address)}"></div>
      <div class="field"><label>Email</label><input id="iEmail" value="${esc(s.email)}"></div>
      <div class="row2"><div class="field"><label>Banka</label><input id="iBank" value="${esc(s.bank)}"></div><div class="field"><label>IBAN</label><input id="iIban" value="${esc(s.iban)}"></div></div>`, {
      onSave: async bg => { await api.put('/platform/issuer', { name: $('#iName', bg).value, nipt: $('#iNipt', bg).value, address: $('#iAddr', bg).value, email: $('#iEmail', bg).value, bank: $('#iBank', bg).value, iban: $('#iIban', bg).value }); toast('U ruajt'); } });
  };
  loadInv();

  $$('[data-enter]', el).forEach(b => b.onclick = () => switchOrg(b.dataset.enter));
  const orgForm = o => {
    const isNew = !o; o = o || { plan_code: 'start', status: 'active' };
    modal(isNew ? 'Studio e re' : 'Ndrysho studion', `
      <div class="row2"><div class="field"><label>Emri i studios *</label><input id="oName" value="${esc(o.name || '')}"></div>
        <div class="field"><label>NIPT</label><input id="oNipt" value="${esc(o.nipt || '')}"></div></div>
      <div class="row2"><div class="field"><label>Email</label><input id="oEmail" value="${esc(o.email || '')}"></div>
        <div class="field"><label>Telefon</label><input id="oPhone" value="${esc(o.phone || '')}"></div></div>
      <div class="field"><label>Plani *</label><select id="oPlan">${planOpt(o.plan_code)}</select></div>
      <div class="row2"><div class="field"><label>Kufi i veçantë biznesesh (opsional)</label><input id="oMax" type="number" min="1" placeholder="Sipas planit" value="${o.max_subjects || ''}"></div>
        <div class="field"><label>Mbi kufirin</label><label class="check" style="margin-top:8px"><input type="checkbox" id="oOver" ${o.allow_overage ? 'checked' : ''}> Lejo pa bllokuar</label></div></div>
      ${isNew ? `<h4 style="margin:6px 0 10px">Administratori i studios</h4>
        <div class="row2"><div class="field"><label>Emri *</label><input id="aName"></div><div class="field"><label>Email (për hyrje) *</label><input id="aEmail" type="email"></div></div>
        <div class="field"><label>Fjalëkalimi fillestar * (min. 8)</label><input id="aPass" type="text" autocomplete="off"></div>
        <label class="check"><input type="checkbox" id="oTrial" checked> Provë falas 14 ditë (pa faturë deri në mbarim)</label>`
        : `<div class="field"><label>Statusi</label><select id="oStatus"><option value="active" ${o.status === 'active' ? 'selected' : ''}>Aktive</option><option value="suspended" ${o.status !== 'active' ? 'selected' : ''}>Pezulluar (s'mund të hyjë askush i studios)</option></select></div>`}`, {
      saveLabel: isNew ? 'Krijo studion' : 'Ruaj', onSave: async bg => {
        const body = { name: $('#oName', bg).value.trim(), nipt: $('#oNipt', bg).value.trim(), email: $('#oEmail', bg).value.trim(), phone: $('#oPhone', bg).value.trim(),
          plan_code: $('#oPlan', bg).value, max_subjects: $('#oMax', bg).value || null, allow_overage: $('#oOver', bg).checked };
        if (isNew) Object.assign(body, { admin_name: $('#aName', bg).value.trim(), admin_email: $('#aEmail', bg).value.trim(), admin_password: $('#aPass', bg).value, trial: $('#oTrial', bg).checked });
        else body.status = $('#oStatus', bg).value;
        if (isNew) await api.post('/platform/orgs', body); else await api.put('/platform/orgs/' + o.id, body);
        toast(isNew ? 'Studioja u krijua' : 'U ruajt'); await loadMe(); bindOrgChip(); viewPlatform(el);
      } });
  };
  $('#orgNew').onclick = () => orgForm();
  $$('[data-edit]', el).forEach(b => b.onclick = () => orgForm(d.orgs.find(o => o.id == b.dataset.edit)));
  $$('[data-plan]', el).forEach(b => b.onclick = () => {
    const p = plans.find(x => x.code === b.dataset.plan);
    modal('Plani ' + p.name, `
      <div class="field"><label>Emri</label><input id="pName" value="${esc(p.name)}"></div>
      <div class="row2"><div class="field"><label>Biznese të përfshira</label><input id="pMax" type="number" min="1" value="${p.max_subjects}"></div>
        <div class="field"><label>Çmimi mujor (€)</label><input id="pPrice" type="number" step="0.01" min="0" value="${p.price_month}"></div></div>
      <div class="row2"><div class="field"><label>Tarifë për çdo biznes mbi kufirin (€) <small class="muted">0 = bllokohet</small></label><input id="pExtra" type="number" step="0.01" min="0" value="${p.price_extra}"></div>
        <div class="field"><label>Kredite AI në muaj</label><input id="pAi" type="number" min="0" value="${p.ai_credits}"></div></div>`, {
      onSave: async bg => { await api.put('/platform/plans/' + p.code, { name: $('#pName', bg).value, max_subjects: $('#pMax', bg).value, price_month: $('#pPrice', bg).value, price_extra: $('#pExtra', bg).value, ai_credits: $('#pAi', bg).value });
        toast('Plani u ruajt'); viewPlatform(el); } });
  });
  $('#admNew').onclick = () => modal('Admin i ri i platformës', `
    <div class="field"><label>Emri *</label><input id="nName"></div>
    <div class="field"><label>Email *</label><input id="nEmail" type="email"></div>
    <div class="field"><label>Fjalëkalimi * (min. 8)</label><input id="nPass" type="password" autocomplete="new-password"></div>
    <p class="muted small" style="margin:0">Admini do të menaxhojë studiot, planet dhe adminët e tjerë. Pronarin nuk e sheh dhe nuk mund ta nxjerrë.</p>`, {
    saveLabel: 'Krijo', onSave: async bg => { await api.post('/platform/admins', { name: $('#nName', bg).value.trim(), email: $('#nEmail', bg).value.trim(), password: $('#nPass', bg).value, role: 'admin' });
      toast('Admini u krijua'); viewPlatform(el); } });
  $$('[data-astat]', el).forEach(b => b.onclick = async () => { await api.post('/platform/admins/' + b.dataset.astat + '/status', { status: b.dataset.st === 'active' ? 'suspended' : 'active' }); viewPlatform(el); });
  $$('[data-adel]', el).forEach(b => b.onclick = () => confirmBox('Të nxirret ky admin nga platforma? Llogaria fshihet përgjithmonë.', async () => { await api.del('/platform/admins/' + b.dataset.adel); toast('U fshi'); viewPlatform(el); }, { danger: true }));
}

/* ============ Audit ============ */
async function viewAudit(el) {
  const list = await api.get('/reports/audit');
  el.innerHTML = `
    <p class="muted" style="margin-top:0">${ME.role==='owner'?'Ju shihni çdo veprim, përfshirë tentativat për të aksesuar llogarinë tuaj.':'Historik i veprimeve të ekipit.'}</p>
    <div class="card"><table><thead><tr><th>Data</th><th>Përdoruesi</th><th>Roli</th><th>Veprimi</th><th>Detaje</th></tr></thead>
      <tbody>${list.length ? list.map(a => `<tr><td class="muted" style="white-space:nowrap">${esc(a.created_at)}</td><td>${esc(a.user_name||'—')}</td>
        <td>${a.user_role?`<span class="badge b-${a.user_role}">${roleLabel(a.user_role)}</span>`:'—'}</td>
        <td>${esc((a.action||'').replace(/_/g,' '))}</td>
        <td class="muted">${esc(a.details||'')} ${a.entity?'· '+esc(a.entity)+(a.entity_id?'#'+a.entity_id:''):''}</td></tr>`).join('') : '<tr><td colspan="5"><div class="empty">Ende asnjë veprim</div></td></tr>'}</tbody></table></div>`;
}

/* ============ Settings ============ */
async function viewSettings(el) {
  const c = await api.get('/settings/company');
  el.innerHTML = `
    <div class="card" style="max-width:640px"><div class="card-head"><h3>Të dhënat e studios/kompanisë</h3></div>
      <div class="card-body">
        <div class="field"><label>Emri</label><input id="s_name" value="${esc(c.name)}"></div>
        <div class="row2"><div class="field"><label>NIPT</label><input id="s_nipt" value="${esc(c.nipt)}"></div><div class="field"><label>Monedha</label><input id="s_cur" value="${esc(c.currency||'Lek')}"></div></div>
        <div class="field"><label>Adresa</label><input id="s_addr" value="${esc(c.address)}"></div>
        <div class="row2"><div class="field"><label>Telefon</label><input id="s_phone" value="${esc(c.phone)}"></div><div class="field"><label>Email</label><input id="s_email" value="${esc(c.email)}"></div></div>
        <button class="btn" id="save">Ruaj ndryshimet</button>
      </div></div>`;
  $('#save').onclick = async () => {
    const body = { ...c, name: $('#s_name').value, nipt: $('#s_nipt').value, currency: $('#s_cur').value, address: $('#s_addr').value, phone: $('#s_phone').value, email: $('#s_email').value };
    await api.put('/settings/company', body); await loadMe(); $('#companyName').innerHTML = orgChip(); bindOrgChip(); toast('Cilësimet u ruajtën');
  };
  const p = c.plan;
  if (p) el.insertAdjacentHTML('beforeend', `
    <div class="card" style="max-width:640px;margin-top:18px"><div class="card-head"><h3>Abonimi</h3><span class="badge b-admin">${esc(p.plan_name)}</span></div>
      <div class="card-body">
        <div class="kv"><span>Biznese të regjistruara</span><b>${p.used} / ${p.limit}</b></div>
        <div class="qbar" style="margin:8px 0 12px"><div class="qfill" style="width:${p.limit ? Math.min(100, Math.round(p.used / p.limit * 100)) : 0}%"></div></div>
        <div class="kv"><span>Çmimi i planit</span><b>${eur(p.price_month)} / muaj</b></div>
        ${p.price_extra ? `<div class="kv"><span>Çdo biznes mbi ${p.limit}</span><b>${eur(p.price_extra)} / muaj</b></div>` : ''}
        ${p.extra ? `<div class="kv"><span>Biznese shtesë këtë muaj</span><b>${p.extra}</b></div>` : ''}
        <div class="kv"><span>Totali i këtij muaji</span><b>${eur(p.monthly_total)}</b></div>
        <p class="muted small" style="margin:12px 0 0">${p.overage ? 'Mund të shtoni biznese mbi kufirin; faturohen veçmas.' : 'Kur arrini kufirin, për biznese të reja duhet një plan më i madh. Kontaktoni mbështetjen.'}</p>
      </div></div>`);
  const invs = await api.get('/settings/invoices').catch(() => []);
  const IST = { e_papaguar: ['E papaguar', 'b-draft'], paguar: ['Paguar', 'b-paid'], vonuar: ['E vonuar', 'b-overdue'] };
  el.insertAdjacentHTML('beforeend', `
    <div class="card" style="max-width:640px;margin-top:18px"><div class="card-head"><h3>Faturat</h3></div>
      <div class="tbl-wrap"><table><thead><tr><th>Nr.</th><th>Periudha</th><th class="num">Totali</th><th>Afati</th><th>Statusi</th><th></th></tr></thead>
      <tbody>${invs.length ? invs.map(i => `<tr><td><b>${esc(i.number)}</b></td><td>${esc(i.period)}</td><td class="num">${eur(i.total)}</td>
        <td class="muted">${esc(fmtDate(i.due_date))}</td><td>${badge(IST, i.display_status)}</td>
        <td class="num"><button class="btn ghost sm" data-spdf="${i.id}" data-num="${esc(i.number)}">PDF</button></td></tr>`).join('')
        : '<tr><td colspan="6"><div class="empty" style="padding:24px">Ende pa fatura.</div></td></tr>'}</tbody></table></div></div>`);
  $$('[data-spdf]', el).forEach(b => b.onclick = () => downloadFile('/settings/invoices/' + b.dataset.spdf + '/pdf', b.dataset.num + '.pdf'));
}

/* ============ Profile ============ */
function viewProfile(el) {
  el.innerHTML = `
    <div class="card" style="max-width:480px"><div class="card-head"><h3>Profili im</h3></div>
      <div class="card-body">
        <div class="field"><label>Emri</label><input value="${esc(ME.name)}" disabled></div>
        <div class="field"><label>Email</label><input value="${esc(ME.email)}" disabled></div>
        <div class="field"><label>Roli</label><input value="${roleLabel(ME.role)}" disabled></div>
        <hr style="border:none;border-top:1px solid var(--border);margin:18px 0">
        <h3 style="font-size:15px;margin:0 0 6px">Preferencat</h3>
        <div class="pref-row"><span>Tema</span><div class="seg" id="prefTheme">${[['light', 'E ndriçuar'], ['dark', 'E errët'], ['system', 'Sistemi']].map(([k, l]) => `<button data-v="${k}" class="${window.FB_PREFS && FB_PREFS.theme === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="pref-row"><span>Gjuha</span><div class="seg" id="prefLang">${[['sq', 'Shqip'], ['en', 'English']].map(([k, l]) => `<button data-v="${k}" class="${window.FB_PREFS && FB_PREFS.lang === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <hr style="border:none;border-top:1px solid var(--border);margin:18px 0">
        <h3 style="font-size:15px;margin:0 0 14px">Ndrysho fjalëkalimin</h3>
        <div class="field"><label>Fjalëkalimi aktual</label><input id="pw_cur" type="password"></div>
        <div class="field"><label>Fjalëkalimi i ri</label><input id="pw_new" type="password"></div>
        <button class="btn" id="pwBtn">Ndrysho fjalëkalimin</button>
      </div></div>`;
  $('#pwBtn').onclick = async () => {
    try { await api.post('/auth/change-password', { current: $('#pw_cur').value, next: $('#pw_new').value }); toast('Fjalëkalimi u ndryshua'); $('#pw_cur').value = ''; $('#pw_new').value = ''; }
    catch (e) { toast(e.message, true); }
  };
  $$('#prefTheme button').forEach(b => b.onclick = () => { FB_PREFS.setTheme(b.dataset.v); $$('#prefTheme button').forEach(x => x.classList.toggle('on', x === b)); });
  $$('#prefLang button').forEach(b => b.onclick = () => { if (FB_PREFS.lang !== b.dataset.v) FB_PREFS.setLang(b.dataset.v); });
}

boot();
