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
const ROLE_LEVEL = { viewer: 1, accountant: 2, admin: 3, owner: 4 };
const can = role => ME && ROLE_LEVEL[ME.role] >= ROLE_LEVEL[role];
const roleLabel = r => ({ owner: 'Pronar', admin: 'Administrator', accountant: 'Kontabilist', viewer: 'Vëzhgues' }[r] || r);
const timeAgo = t => t ? esc(t) : '—';
const secs = ms => ms ? (ms >= 1000 ? Math.round(ms / 1000) + 's' : ms + 'ms') : '—';

function toast(msg, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : ''); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2800);
}

// Statuset
const EXEC_ST = { ne_radhe: ['Në radhë', 'b-draft'], ne_ekzekutim: ['Në ekzekutim', 'b-sent'], duke_riprovuar: ['Duke riprovuar', 'b-sent'], kryer: ['Kryer', 'b-paid'], deshtoi: ['Dështoi', 'b-overdue'], anuluar: ['Anuluar', 'b-cancelled'] };
const REC_ST = { ne_pritje: ['Në pritje', 'b-draft'], kryer: ['Kryer', 'b-paid'], deshtoi: ['Dështoi', 'b-overdue'], deklaruar: ['Deklaruar', 'b-paid'] };
const badge = (map, st) => { const v = map[st] || [st, 'b-draft']; return `<span class="badge ${v[1]}">${v[0]}</span>`; };

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
  logo: '<svg viewBox="0 0 24 24" width="26" height="26"><rect width="24" height="24" rx="6" fill="#1f6ff0"/><rect x="5.5" y="13" width="3.2" height="5" rx="1" fill="#ffffff"/><rect x="10.4" y="9" width="3.2" height="9" rx="1" fill="#f5b70a"/><rect x="15.3" y="6" width="3.2" height="12" rx="1" fill="#17a65a"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 5v14M5 12h14"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
};

/* ============ Auth / boot ============ */
async function boot() {
  try {
    ME = (await api.get('/auth/me')).user;
    COMPANY = await api.get('/settings/company').catch(() => ({}));
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
    try { ME = (await api.post('/auth/login', { email: f.email.value, password: f.password.value })).user;
      COMPANY = await api.get('/settings/company').catch(() => ({})); location.hash = '#/'; renderApp();
    } catch (err) { renderLogin(err.message); }
  };
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
  { sep: true, role: 'admin' },
  { key: 'users', label: 'Përdoruesit', icon: 'users', role: 'admin' },
  { key: 'audit', label: 'Regjistri', icon: 'audit', role: 'admin' },
  { key: 'settings', label: 'Cilësimet', icon: 'settings', role: 'admin' },
];

function renderApp() {
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
          <div class="muted" id="companyName">${esc(COMPANY.name || '')}</div>
        </div>
        <div class="content" id="view"></div>
      </div>
    </div>`;
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
  '': viewDashboard, services: viewServices, service: viewServiceDetail, va: viewVA,
  subjects: viewSubjects, automation: viewAutomation, notifications: viewNotifications,
  support: viewSupport, users: viewUsers, audit: viewAudit, settings: viewSettings, profile: viewProfile,
};
let AUTO_TIMER = null;
function route() {
  if (AUTO_TIMER) { clearInterval(AUTO_TIMER); AUTO_TIMER = null; }
  const parts = location.hash.replace(/^#\//, '').split('/');
  const key = parts[0] || '';
  const fn = ROUTES[key] || viewDashboard;
  const navItem = NAV.find(n => n.key === key);
  if (navItem && !can(navItem.role)) { $('#view').innerHTML = '<div class="empty">Nuk keni akses.</div>'; return; }
  $$('.nav-item[data-key]').forEach(b => b.classList.toggle('active', b.dataset.key === (key === 'service' ? 'services' : key)));
  const titles = { '': 'Paneli', services: 'Shërbimet', service: 'Shërbimi', va: 'Pyet VA', subjects: 'Subjektet', automation: 'Automatizimi', notifications: 'Njoftimet', support: 'Mbështetje', users: 'Përdoruesit', audit: 'Regjistri i veprimeve', settings: 'Cilësimet', profile: 'Profili im' };
  $('#pageTitle').textContent = titles[key] || 'Finbot';
  $('#view').innerHTML = '<div class="empty">Duke ngarkuar…</div>';
  fn($('#view'), parts[1]);
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
      ${stat('Përdorimi mujor', d.usage_used + ' / ' + d.usage_max, 'i-amber', I.dash, 'Muaji aktual')}
      ${stat('Subjekte', d.subjects, 'i-violet', I.subjects, 'Gjithsej')}
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
          <thead><tr><th>Subjekti</th><th>Shërbimi</th><th>Status</th></tr></thead>
          <tbody>${d.recent.length ? d.recent.map(r => `<tr><td><b>${esc(r.subject_name)}</b></td><td class="muted">${esc(r.service_name)}</td><td>${badge(REC_ST, r.status)}</td></tr>`).join('') : '<tr><td colspan="3"><div class="empty">Ende pa rekorde</div></td></tr>'}</tbody>
        </table></div>
      </div>
    </div>`;
}

/* ============ Services ============ */
async function viewServices(el) {
  const list = await api.get('/services');
  el.innerHTML = `
    <div class="toolbar"><div class="muted">Shërbime të mbështetura nga robotët dhe kufij mujorë.</div><div class="muted">Shfaqur: ${list.length} / ${list.length}</div></div>
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
}

async function viewServiceDetail(el, id) {
  const s = await api.get('/services/' + id);
  const subjects = await api.get('/subjects');
  const notInService = subjects.filter(sub => !s.records.find(r => r.subject_id === sub.id));
  el.innerHTML = `
    <button class="btn ghost sm" id="back" style="margin-bottom:14px">&larr; Shërbimet</button>
    <div class="card">
      <div class="card-head">
        <div><h3>${esc(s.name)}</h3><div class="muted" style="font-size:13px;margin-top:2px">${esc(s.description || '')}</div></div>
        <div style="display:flex;gap:8px">
          ${can('accountant') ? `<button class="btn" id="runAll">${I.play} Ekzekuto të gjitha</button>` : ''}
          ${can('accountant') ? `<button class="btn ghost" id="addSub">${I.plus} Shto subjekt</button>` : ''}
          <button class="btn ghost" id="refresh">Rifresko</button>
        </div>
      </div>
      <div class="card-body" style="padding:0">
        <table>
          <thead><tr><th>#</th><th>Statusi subjektit</th><th>Emri</th><th>NIPT</th><th>Përditësuar</th><th>Rezultati</th><th class="num">TVSH/Totali</th><th></th></tr></thead>
          <tbody id="rows">${s.records.length ? s.records.map((r, i) => `<tr>
            <td class="muted">${i + 1}</td>
            <td><span class="badge ${r.subject_status === 'active' ? 'b-active' : 'b-cancelled'}">${r.subject_status === 'active' ? 'Aktiv' : 'Joaktiv'}</span></td>
            <td><b>${esc(r.subject_name)}</b></td><td class="muted">${esc(r.nipt || '—')}</td>
            <td class="muted">${timeAgo(r.updated_at)}</td><td>${badge(REC_ST, r.status)}</td>
            <td class="num">${r.data && r.data.totali != null ? nf(r.data.totali) : '—'}</td>
            <td class="num">
              ${can('accountant') ? `<button class="btn ghost sm" data-run="${r.subject_id}">${I.play}</button>` : ''}
              <button class="btn ghost sm" data-det="${r.subject_id}">Detaje</button>
            </td></tr>`).join('') : '<tr><td colspan="8"><div class="empty">Asnjë subjekt te ky shërbim. Shtoni një.</div></td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
  $('#back').onclick = () => location.hash = '#/services';
  $('#refresh').onclick = () => viewServiceDetail(el, id);
  if ($('#runAll')) $('#runAll').onclick = async () => {
    if (!s.records.length) return toast('Shto subjekte fillimisht', true);
    const r = await api.post('/services/' + id + '/run', {}); toast(`U futën në radhë ${r.queued} ekzekutime`); location.hash = '#/automation';
  };
  if ($('#addSub')) $('#addSub').onclick = () => {
    if (!notInService.length) return toast('Të gjitha subjektet janë shtuar', true);
    modal('Shto subjekt te shërbimi', `<div class="field"><label>Subjekti</label><select id="ss">${notInService.map(x => `<option value="${x.id}">${esc(x.name)} ${x.nipt ? '(' + esc(x.nipt) + ')' : ''}</option>`).join('')}</select></div>`, {
      saveLabel: 'Shto', onSave: async bg => { await api.post('/services/' + id + '/subjects', { subject_id: Number($('#ss', bg).value) }); toast('U shtua'); viewServiceDetail(el, id); }
    });
  };
  $$('[data-run]', el).forEach(b => b.onclick = async () => { await api.post('/services/' + id + '/run', { subject_ids: [Number(b.dataset.run)] }); toast('U fut në radhë'); location.hash = '#/automation'; });
  $$('[data-det]', el).forEach(b => b.onclick = () => {
    const r = s.records.find(x => x.subject_id == b.dataset.det);
    const d = r.data || {};
    modal('Detaje — ' + r.subject_name, `
      <div class="row3" style="margin-bottom:10px">
        <div><div class="muted">Statusi</div>${badge(REC_ST, r.status)}</div>
        <div><div class="muted">Përditësuar</div>${timeAgo(r.updated_at)}</div>
        <div><div class="muted">Rezultati</div>${esc(r.result || '—')}</div>
      </div>
      <table style="border:1px solid var(--border);border-radius:8px">
        <tr><td>TVSH mujore</td><td class="num">${d.tvsh_mujore != null ? nf(d.tvsh_mujore) : '—'}</td></tr>
        <tr><td>Totali</td><td class="num">${d.totali != null ? nf(d.totali) : '—'}</td></tr>
        <tr><td>Kredi</td><td class="num">${d.kredi != null ? nf(d.kredi) : '—'}</td></tr>
      </table>`, {});
  });
}

/* ============ Subjects ============ */
async function viewSubjects(el) {
  const list = await api.get('/subjects');
  el.innerHTML = `
    <div class="toolbar"><input class="search" id="q" placeholder="Kërko sipas emrit ose NIPT-it…">
      ${can('accountant') ? `<button class="btn" id="add">${I.plus} Shto subjekt</button>` : ''}</div>
    <div class="card"><table>
      <thead><tr><th>Emri</th><th>NIPT</th><th>e-Albania</th><th>Kredencialet</th><th>Statusi</th><th></th></tr></thead>
      <tbody id="rows"></tbody></table></div>`;
  const render = rows => {
    $('#rows').innerHTML = rows.length ? rows.map(s => `<tr>
      <td><b>${esc(s.name)}</b></td><td class="muted">${esc(s.nipt || '—')}</td><td class="muted">${esc(s.ealbania_user || '—')}</td>
      <td>${s.has_ealbania_pass ? '<span class="badge b-active">e-Albania ✓</span>' : '<span class="badge b-draft">Pa fjalëkalim</span>'}</td>
      <td><span class="badge ${s.status === 'active' ? 'b-active' : 'b-cancelled'}">${s.status === 'active' ? 'Aktiv' : 'Joaktiv'}</span></td>
      <td class="num">${can('accountant') ? `<button class="btn ghost sm" data-edit="${s.id}">Ndrysho</button> <button class="btn ghost sm" data-del="${s.id}">Fshi</button>` : ''}</td>
    </tr>`).join('') : '<tr><td colspan="6"><div class="empty">Asnjë subjekt</div></td></tr>';
    $$('[data-edit]').forEach(b => b.onclick = () => subjectForm(rows.find(x => x.id == b.dataset.edit)));
    $$('[data-del]').forEach(b => b.onclick = () => confirmBox('Të fshihet subjekti?', async () => { await api.del('/subjects/' + b.dataset.del); toast('U fshi'); viewSubjects(el); }, { danger: true }));
  };
  render(list);
  let t; $('#q').oninput = e => { clearTimeout(t); t = setTimeout(async () => render(await api.get('/subjects?q=' + encodeURIComponent(e.target.value))), 250); };
  if ($('#add')) $('#add').onclick = () => subjectForm();
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
    const qs = []; if (svcFilter) qs.push('service_id=' + svcFilter); if (stFilter) qs.push('status=' + stFilter);
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
          <div style="display:flex;gap:8px">
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
async function viewVA(el) {
  const d = await api.get('/va/messages');
  el.innerHTML = `
    <div class="card va-card">
      <div class="card-head"><div style="display:flex;align-items:center;gap:10px">${I.logo}<div><h3 style="margin:0">Pyet VA</h3><div class="muted" style="font-size:12px">Shërbimet e tua, në një bisedë</div></div></div>
        <span class="badge b-admin">${d.credits} kredite</span></div>
      <div class="va-msgs" id="msgs">${d.messages.length ? d.messages.map(m => vaBubble(m.role, m.body)).join('') : `
        <div class="va-empty">
          <div class="va-spark">${I.va}</div><h3>Si po ecën puna sot?</h3>
          <p class="muted">Pyet për gjendjen e shërbimeve, subjekteve dhe ekzekutimeve.</p>
          <div class="va-suggest">
            <button class="va-chip">Cilat ekzekutime kanë dështuar dhe pse?</button>
            <button class="va-chip">Si është përdorimi i kuotave?</button>
            <button class="va-chip">Përmbledhje e TVSH-së</button>
          </div></div>`}</div>
      <div class="va-input"><input id="vaq" placeholder="Shkruaj pyetjen…"><button class="btn" id="vasend">Dërgo</button></div>
      <div class="muted" style="padding:0 16px 12px;font-size:12px">VA mund të gabojë. Verifiko shifrat.</div>
    </div>`;
  const msgs = $('#msgs');
  const send = async q => {
    if (!q.trim()) return;
    if (msgs.querySelector('.va-empty')) msgs.innerHTML = '';
    msgs.insertAdjacentHTML('beforeend', vaBubble('user', q)); msgs.scrollTop = msgs.scrollHeight;
    $('#vaq').value = ''; const typing = document.createElement('div'); typing.innerHTML = vaBubble('assistant', '…'); msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
    try { const r = await api.post('/va/ask', { question: q }); typing.remove(); msgs.insertAdjacentHTML('beforeend', vaBubble('assistant', r.answer)); }
    catch (e) { typing.remove(); toast(e.message, true); }
    msgs.scrollTop = msgs.scrollHeight;
  };
  $('#vasend').onclick = () => send($('#vaq').value);
  $('#vaq').onkeydown = e => { if (e.key === 'Enter') send($('#vaq').value); };
  $$('.va-chip', el).forEach(c => c.onclick = () => send(c.textContent));
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
    <div class="toolbar"><div class="muted">${ME.role==='owner'?'Si pronar, ju shihni të gjithë përdoruesit.':'Menaxhoni ekipin tuaj.'}</div><button class="btn" id="add">${I.plus} Përdorues i ri</button></div>
    <div class="card"><table><thead><tr><th>Emri</th><th>Email</th><th>Roli</th><th>Statusi</th><th>Hyrja e fundit</th><th></th></tr></thead>
      <tbody>${list.map(u => `<tr><td><b>${esc(u.name)}</b>${u.id===ME.id?' <small class="muted">(ju)</small>':''}</td><td>${esc(u.email)}</td>
        <td><span class="badge b-${u.role}">${roleLabel(u.role)}</span></td>
        <td><span class="badge ${u.status==='active'?'b-active':'b-suspended'}">${u.status==='active'?'Aktiv':'Pezulluar'}</span></td>
        <td class="muted">${u.last_login?esc(u.last_login):'—'}</td>
        <td class="num">${u.id!==ME.id?`<button class="btn ghost sm" data-edit="${u.id}">Ndrysho</button> <button class="btn ghost sm" data-status="${u.id}">${u.status==='active'?'Pezullo':'Riaktivizo'}</button> <button class="btn ghost sm" data-del="${u.id}">Fshi</button>`:''}</td>
      </tr>`).join('')}</tbody></table></div>
    ${ME.role==='owner'?'':'<p class="muted" style="margin-top:14px;font-size:12.5px">Disa llogari sistemi mund të mos shfaqen në këtë listë.</p>'}`;
  $('#add').onclick = () => userForm();
  $$('[data-edit]').forEach(b => b.onclick = () => userForm(list.find(x => x.id == b.dataset.edit)));
  $$('[data-del]').forEach(b => b.onclick = () => { const u = list.find(x => x.id == b.dataset.del); confirmBox(`Të nxirret jashtë "${u.name}"? Llogaria fshihet përgjithmonë.`, async () => { await api.del('/users/' + u.id); toast('U fshi'); viewUsers(el); }, { danger: true }); });
  $$('[data-status]').forEach(b => b.onclick = async () => { const u = list.find(x => x.id == b.dataset.status); const status = u.status === 'active' ? 'suspended' : 'active'; await api.post('/users/' + u.id + '/status', { status }); toast(status === 'suspended' ? 'U pezullua' : 'U riaktivizua'); viewUsers(el); });
}
function userForm(u) {
  u = u || { role: 'viewer' };
  const roles = ME.role === 'owner' ? ['owner', 'admin', 'accountant', 'viewer'] : ['admin', 'accountant', 'viewer'];
  modal(u.id ? 'Ndrysho përdoruesin' : 'Përdorues i ri', `
    <div class="field"><label>Emri *</label><input id="u_name" value="${esc(u.name)}"></div>
    <div class="field"><label>Email *</label><input id="u_email" type="email" value="${esc(u.email)}"></div>
    <div class="row2"><div class="field"><label>Roli</label><select id="u_role">${roles.map(r => `<option value="${r}" ${r===u.role?'selected':''}>${roleLabel(r)}</option>`).join('')}</select></div>
      <div class="field"><label>${u.id?'Fjalëkalim i ri (opsional)':'Fjalëkalimi *'}</label><input id="u_pass" type="password" placeholder="${u.id?'Lëre bosh':''}"></div></div>
    ${ME.role==='owner'&&u.role==='admin'?'<p class="muted" style="font-size:12.5px;margin:0">Ky admin do të ketë të drejta të plota operative, por nuk do ta shohë llogarinë tuaj të pronarit.</p>':''}`, {
    onSave: async bg => {
      const body = { name: $('#u_name', bg).value.trim(), email: $('#u_email', bg).value.trim(), role: $('#u_role', bg).value, password: $('#u_pass', bg).value };
      if (!body.name || !body.email) throw new Error('Emri dhe email-i janë të detyrueshëm');
      if (!u.id && !body.password) throw new Error('Fjalëkalimi është i detyrueshëm');
      if (u.id) await api.put('/users/' + u.id, body); else await api.post('/users', body);
      toast('U ruajt'); route();
    }
  });
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
    await api.put('/settings/company', body); COMPANY = body; $('#companyName').textContent = body.name; toast('Cilësimet u ruajtën');
  };
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
        <h3 style="font-size:15px;margin:0 0 14px">Ndrysho fjalëkalimin</h3>
        <div class="field"><label>Fjalëkalimi aktual</label><input id="pw_cur" type="password"></div>
        <div class="field"><label>Fjalëkalimi i ri</label><input id="pw_new" type="password"></div>
        <button class="btn" id="pwBtn">Ndrysho fjalëkalimin</button>
      </div></div>`;
  $('#pwBtn').onclick = async () => {
    try { await api.post('/auth/change-password', { current: $('#pw_cur').value, next: $('#pw_new').value }); toast('Fjalëkalimi u ndryshua'); $('#pw_cur').value = ''; $('#pw_new').value = ''; }
    catch (e) { toast(e.message, true); }
  };
}

boot();
