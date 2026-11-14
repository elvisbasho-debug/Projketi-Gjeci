'use strict';

/* ============ Helpers ============ */
const $ = (sel, el = document) => el.querySelector(sel);
const root = document.getElementById('root');
let ME = null;         // përdoruesi aktual
let COMPANY = {};      // cilësimet e kompanisë

const api = {
  async req(method, url, body) {
    const opt = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch('/api' + url, opt);
    let data = null;
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((data && data.error) || 'Gabim serveri');
    return data;
  },
  get: (u) => api.req('GET', u),
  post: (u, b) => api.req('POST', u, b),
  put: (u, b) => api.req('PUT', u, b),
  del: (u) => api.req('DELETE', u),
};

const fmt = (n) => (Number(n) || 0).toLocaleString('sq-AL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n) => fmt(n) + ' ' + (COMPANY.currency || 'Lek');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ROLE_LEVEL = { viewer: 1, accountant: 2, admin: 3, owner: 4 };
const can = (role) => ME && ROLE_LEVEL[ME.role] >= ROLE_LEVEL[role];

function toast(msg, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

/* ============ Icons ============ */
const I = {
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
  invoice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M14 2v5h5M8 13h8M8 17h5"/></svg>',
  client: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 7a3 3 0 0 1 0 6M18 20a6 6 0 0 0-3-5"/></svg>',
  product: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8 12 3 3 8l9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>',
  expense: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>',
  report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-9"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="3.2"/><path d="M2 20a6 6 0 0 1 12 0M16 5a3.5 3.5 0 0 1 0 7M22 20a6 6 0 0 0-4-5.6"/></svg>',
  audit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6 1.6 1.6 0 0 0 8 1.1V1a2 2 0 0 1 4 0v.1A1.6 1.6 0 0 0 17 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H23a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.1z"/></svg>',
  logo: '<svg viewBox="0 0 24 24" width="26" height="26" fill="#2f6df6"><rect width="24" height="24" rx="6"/><path d="M7 7h10M7 12h10M7 17h6" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 5v14M5 12h14"/></svg>',
};

/* ============ Auth ============ */
async function boot() {
  try {
    const r = await api.get('/auth/me');
    ME = r.user;
    COMPANY = await api.get('/settings/company').catch(() => ({}));
    renderApp();
  } catch (e) {
    renderLogin();
  }
}

function renderLogin(err) {
  root.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="brand">${I.logo}<b style="font-size:19px">Defteri</b></div>
        <h1>Mirë se vini</h1>
        <p class="sub">Hyni në llogarinë tuaj të kontabilitetit</p>
        <form id="loginForm">
          <div class="field"><label>Email</label><input name="email" type="email" required placeholder="ju@kompania.al" autocomplete="username"></div>
          <div class="field"><label>Fjalëkalimi</label><input name="password" type="password" required placeholder="••••••••" autocomplete="current-password"></div>
          <div class="err-text">${err ? esc(err) : ''}</div>
          <button class="btn" style="width:100%;justify-content:center;margin-top:6px" type="submit">Hyr</button>
        </form>
      </div>
    </div>`;
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Duke hyrë…';
    try {
      const r = await api.post('/auth/login', { email: f.email.value, password: f.password.value });
      ME = r.user;
      COMPANY = await api.get('/settings/company').catch(() => ({}));
      location.hash = '#/';
      renderApp();
    } catch (err) {
      renderLogin(err.message);
    }
  };
}

async function logout() {
  await api.post('/auth/logout').catch(() => {});
  ME = null;
  renderLogin();
}

/* ============ App shell ============ */
const NAV = [
  { key: '', label: 'Paneli', icon: 'dash', role: 'viewer' },
  { key: 'invoices', label: 'Faturat', icon: 'invoice', role: 'viewer' },
  { key: 'clients', label: 'Klientët', icon: 'client', role: 'viewer' },
  { key: 'products', label: 'Produkte & Shërbime', icon: 'product', role: 'viewer' },
  { key: 'expenses', label: 'Shpenzimet', icon: 'expense', role: 'viewer' },
  { key: 'reports', label: 'Raporte & TVSH', icon: 'report', role: 'viewer' },
  { sep: true, role: 'admin' },
  { key: 'users', label: 'Përdoruesit', icon: 'users', role: 'admin' },
  { key: 'audit', label: 'Regjistri i veprimeve', icon: 'audit', role: 'admin' },
  { key: 'settings', label: 'Cilësimet', icon: 'settings', role: 'admin' },
];

function renderApp() {
  root.innerHTML = `
    <div class="app">
      <aside class="sidebar" id="sidebar">
        <div class="logo">${I.logo}<b>Defteri</b></div>
        <nav id="nav"></nav>
        <div class="spacer"></div>
        <div class="nav-sep"></div>
        <div class="user-chip" id="userChip" style="cursor:pointer">
          <div class="nm">${esc(ME.name)}</div>
          <div class="rl">${roleLabel(ME.role)}</div>
        </div>
        <button class="nav-item" id="logoutBtn" style="margin-top:4px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Dalje
        </button>
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
  $('#userChip').onclick = () => { location.hash = '#/profile'; };
  $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
  window.onhashchange = route;
  route();
}

function roleLabel(r) {
  return { owner: 'Pronar', admin: 'Administrator', accountant: 'Kontabilist', viewer: 'Vëzhgues' }[r] || r;
}

/* ============ Router ============ */
const ROUTES = {
  '': viewDashboard,
  'invoices': viewInvoices,
  'clients': viewClients,
  'products': viewProducts,
  'expenses': viewExpenses,
  'reports': viewReports,
  'users': viewUsers,
  'audit': viewAudit,
  'settings': viewSettings,
  'profile': viewProfile,
};

function route() {
  const key = (location.hash.replace(/^#\//, '').split('/')[0]) || '';
  const fn = ROUTES[key] || viewDashboard;
  const navItem = NAV.find(n => n.key === key);
  if (navItem && !can(navItem.role)) { $('#view').innerHTML = '<div class="empty">Nuk keni akses në këtë faqe.</div>'; return; }
  document.querySelectorAll('.nav-item[data-key]').forEach(b => b.classList.toggle('active', b.dataset.key === key));
  const titles = { '': 'Paneli', invoices: 'Faturat', clients: 'Klientët', products: 'Produkte & Shërbime', expenses: 'Shpenzimet', reports: 'Raporte & TVSH', users: 'Përdoruesit', audit: 'Regjistri i veprimeve', settings: 'Cilësimet', profile: 'Profili im' };
  $('#pageTitle').textContent = titles[key] || 'Defteri';
  $('#view').innerHTML = '<div class="empty">Duke ngarkuar…</div>';
  fn($('#view'));
}

/* ============ Modal ============ */
function modal(title, bodyHtml, { wide, onSave, saveLabel } = {}) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="x">&times;</button></div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-foot">
        <button class="btn ghost" data-close>Anulo</button>
        ${onSave ? `<button class="btn" data-save>${esc(saveLabel || 'Ruaj')}</button>` : ''}
      </div>
    </div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector('.x').onclick = close;
  bg.querySelector('[data-close]').onclick = close;
  bg.onclick = (e) => { if (e.target === bg) close(); };
  if (onSave) {
    bg.querySelector('[data-save]').onclick = async () => {
      const btn = bg.querySelector('[data-save]'); btn.disabled = true;
      try { await onSave(bg); close(); } catch (e) { toast(e.message, true); btn.disabled = false; }
    };
  }
  return { bg, close };
}

function confirmBox(msg, onYes, { danger } = {}) {
  const m = modal('Konfirmim', `<p style="margin:0">${esc(msg)}</p>`, {
    saveLabel: 'Po, vazhdo',
    onSave: async () => { await onYes(); },
  });
  if (danger) m.bg.querySelector('[data-save]').classList.add('danger');
}

/* ============ Views ============ */
async function viewDashboard(el) {
  const d = await api.get('/reports/dashboard');
  const monthly = await api.get('/reports/monthly').catch(() => []);
  const maxV = Math.max(1, ...monthly.map(m => m.net));
  el.innerHTML = `
    <div class="grid stats" style="margin-bottom:18px">
      ${stat('Të ardhura (paguar)', money(d.income_net), 'i-green', I.invoice)}
      ${stat('Për t\'u arkëtuar', money(d.outstanding), 'i-amber', I.expense)}
      ${stat('Shpenzime', money(d.expenses_net), 'i-red', I.expense)}
      ${stat('Fitimi', money(d.profit), 'i-blue', I.report)}
    </div>
    <div class="grid" style="grid-template-columns:1fr 1fr;align-items:start">
      <div class="card">
        <div class="card-head"><h3>Qarkullimi — 12 muajt e fundit</h3></div>
        <div class="card-body">
          ${monthly.length ? `<div class="bars">${monthly.map(m => `
            <div class="bar-col" title="${money(m.net)}">
              <div class="bar" style="height:${Math.round(m.net / maxV * 100)}%"></div>
              <small>${m.ym.slice(5)}/${m.ym.slice(2,4)}</small>
            </div>`).join('')}</div>` : '<div class="empty">Ende pa të dhëna</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>TVSH & Përmbledhje</h3></div>
        <div class="card-body">
          <table>
            <tr><td>TVSH e mbledhur (shitje)</td><td class="num">${money(d.vat_collected)}</td></tr>
            <tr><td>TVSH e zbritshme (blerje)</td><td class="num">${money(d.vat_deductible)}</td></tr>
            <tr><td><b>TVSH për të paguar</b></td><td class="num"><b>${money(d.vat_due)}</b></td></tr>
            <tr><td>Klientë gjithsej</td><td class="num">${d.clients}</td></tr>
            <tr><td>Fatura gjithsej</td><td class="num">${d.invoices}</td></tr>
          </table>
        </div>
      </div>
    </div>`;
}

function stat(label, value, icoClass, icon) {
  return `<div class="stat">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div class="label">${label}</div>
      <div class="ico ${icoClass}">${icon}</div>
    </div>
    <div class="value">${value}</div>
  </div>`;
}

/* ---- Clients ---- */
async function viewClients(el) {
  const list = await api.get('/clients');
  el.innerHTML = `
    <div class="toolbar">
      <input class="search" id="q" placeholder="Kërko klient, NIPT, email…">
      ${can('accountant') ? `<button class="btn" id="add">${I.plus} Klient i ri</button>` : ''}
    </div>
    <div class="card"><table>
      <thead><tr><th>Emri</th><th>NIPT</th><th>Email</th><th>Telefon</th><th>Qyteti</th><th></th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div>`;
  const render = (rows) => {
    $('#rows').innerHTML = rows.length ? rows.map(c => `
      <tr>
        <td><b>${esc(c.name)}</b></td><td>${esc(c.nipt || '—')}</td><td>${esc(c.email || '—')}</td>
        <td>${esc(c.phone || '—')}</td><td>${esc(c.city || '—')}</td>
        <td class="num">${can('accountant') ? `
          <button class="btn ghost sm" data-edit="${c.id}">Ndrysho</button>
          <button class="btn ghost sm" data-del="${c.id}">Fshi</button>` : ''}</td>
      </tr>`).join('') : '<tr><td colspan="6"><div class="empty">Asnjë klient</div></td></tr>';
    $('#rows').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => clientForm(rows.find(x => x.id == b.dataset.edit)));
    $('#rows').querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmBox('Të fshihet ky klient?', async () => { await api.del('/clients/' + b.dataset.del); toast('U fshi'); viewClients(el); }, { danger: true }));
  };
  render(list);
  let t;
  $('#q').oninput = (e) => { clearTimeout(t); t = setTimeout(async () => render(await api.get('/clients?q=' + encodeURIComponent(e.target.value))), 250); };
  if ($('#add')) $('#add').onclick = () => clientForm();
}

function clientForm(c) {
  c = c || {};
  modal(c.id ? 'Ndrysho klientin' : 'Klient i ri', `
    <div class="field"><label>Emri *</label><input id="c_name" value="${esc(c.name)}"></div>
    <div class="row2">
      <div class="field"><label>NIPT</label><input id="c_nipt" value="${esc(c.nipt)}"></div>
      <div class="field"><label>Qyteti</label><input id="c_city" value="${esc(c.city)}"></div>
    </div>
    <div class="row2">
      <div class="field"><label>Email</label><input id="c_email" value="${esc(c.email)}"></div>
      <div class="field"><label>Telefon</label><input id="c_phone" value="${esc(c.phone)}"></div>
    </div>
    <div class="field"><label>Adresa</label><input id="c_address" value="${esc(c.address)}"></div>
    <div class="field"><label>Shënime</label><textarea id="c_notes" rows="2">${esc(c.notes)}</textarea></div>
  `, {
    onSave: async (bg) => {
      const body = {
        name: $('#c_name', bg).value.trim(), nipt: $('#c_nipt', bg).value, city: $('#c_city', bg).value,
        email: $('#c_email', bg).value, phone: $('#c_phone', bg).value, address: $('#c_address', bg).value, notes: $('#c_notes', bg).value,
      };
      if (!body.name) throw new Error('Emri është i detyrueshëm');
      if (c.id) await api.put('/clients/' + c.id, body); else await api.post('/clients', body);
      toast('U ruajt'); route();
    }
  });
}

/* ---- Products ---- */
async function viewProducts(el) {
  const list = await api.get('/products');
  el.innerHTML = `
    <div class="toolbar"><div></div>${can('accountant') ? `<button class="btn" id="add">${I.plus} Produkt / shërbim</button>` : ''}</div>
    <div class="card"><table>
      <thead><tr><th>Emri</th><th>Njësia</th><th class="num">Çmimi</th><th class="num">TVSH %</th><th></th></tr></thead>
      <tbody>${list.length ? list.map(p => `<tr>
        <td><b>${esc(p.name)}</b>${p.description ? '<br><small class="muted">' + esc(p.description) + '</small>' : ''}</td>
        <td>${esc(p.unit)}</td><td class="num">${money(p.unit_price)}</td><td class="num">${p.vat_rate}%</td>
        <td class="num">${can('accountant') ? `<button class="btn ghost sm" data-edit="${p.id}">Ndrysho</button> <button class="btn ghost sm" data-del="${p.id}">Fshi</button>` : ''}</td>
      </tr>`).join('') : '<tr><td colspan="5"><div class="empty">Asnjë produkt</div></td></tr>'}</tbody>
    </table></div>`;
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => productForm(list.find(x => x.id == b.dataset.edit)));
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmBox('Të fshihet?', async () => { await api.del('/products/' + b.dataset.del); toast('U fshi'); viewProducts(el); }, { danger: true }));
  if ($('#add')) $('#add').onclick = () => productForm();
}

function productForm(p) {
  p = p || { vat_rate: COMPANY.default_vat || 20, unit: 'copë' };
  modal(p.id ? 'Ndrysho produktin' : 'Produkt i ri', `
    <div class="field"><label>Emri *</label><input id="p_name" value="${esc(p.name)}"></div>
    <div class="field"><label>Përshkrimi</label><input id="p_desc" value="${esc(p.description)}"></div>
    <div class="row3">
      <div class="field"><label>Njësia</label><input id="p_unit" value="${esc(p.unit)}"></div>
      <div class="field"><label>Çmimi (pa TVSH)</label><input id="p_price" type="number" step="0.01" value="${p.unit_price || 0}"></div>
      <div class="field"><label>TVSH %</label><input id="p_vat" type="number" step="0.01" value="${p.vat_rate}"></div>
    </div>
  `, {
    onSave: async (bg) => {
      const body = { name: $('#p_name', bg).value.trim(), description: $('#p_desc', bg).value, unit: $('#p_unit', bg).value, unit_price: $('#p_price', bg).value, vat_rate: $('#p_vat', bg).value };
      if (!body.name) throw new Error('Emri është i detyrueshëm');
      if (p.id) await api.put('/products/' + p.id, body); else await api.post('/products', body);
      toast('U ruajt'); route();
    }
  });
}

/* ---- Invoices ---- */
const STATUS_LABEL = { draft: 'Draft', sent: 'Dërguar', paid: 'Paguar', overdue: 'Vonuar', cancelled: 'Anuluar' };
async function viewInvoices(el) {
  const list = await api.get('/invoices');
  el.innerHTML = `
    <div class="toolbar">
      <select class="search" id="filter" style="padding-left:12px;background:none;min-width:180px">
        <option value="">Të gjitha statuset</option>
        ${Object.entries(STATUS_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
      ${can('accountant') ? `<button class="btn" id="add">${I.plus} Faturë e re</button>` : ''}
    </div>
    <div class="card"><table>
      <thead><tr><th>Numri</th><th>Klienti</th><th>Data</th><th>Afati</th><th class="num">Vlera</th><th>Statusi</th><th></th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div>`;
  const render = (rows) => {
    $('#rows').innerHTML = rows.length ? rows.map(i => `<tr>
      <td><b>${esc(i.number)}</b></td><td>${esc(i.client_name)}</td><td>${esc(i.issue_date)}</td><td>${esc(i.due_date || '—')}</td>
      <td class="num">${money(i.total)}</td><td><span class="badge b-${i.status}">${STATUS_LABEL[i.status]}</span></td>
      <td class="num"><button class="btn ghost sm" data-view="${i.id}">Hap</button></td>
    </tr>`).join('') : '<tr><td colspan="7"><div class="empty">Asnjë faturë</div></td></tr>';
    $('#rows').querySelectorAll('[data-view]').forEach(b => b.onclick = () => invoiceDetail(b.dataset.view, el));
  };
  render(list);
  $('#filter').onchange = async (e) => render(await api.get('/invoices' + (e.target.value ? '?status=' + e.target.value : '')));
  if ($('#add')) $('#add').onclick = () => invoiceForm(null, el);
}

async function invoiceDetail(id, el) {
  const inv = await api.get('/invoices/' + id);
  const t = inv.totals;
  const body = `
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:18px">
      <div>
        <div class="muted">Nga</div><b>${esc(COMPANY.name || '')}</b><br>
        <small class="muted">${esc(COMPANY.nipt || '')} · ${esc(COMPANY.address || '')}</small>
      </div>
      <div style="text-align:right">
        <div class="muted">Për</div><b>${esc(inv.client_name)}</b><br>
        <small class="muted">${esc(inv.client_nipt || '')} ${inv.client_city ? '· ' + esc(inv.client_city) : ''}</small>
      </div>
    </div>
    <div class="row3" style="margin-bottom:16px">
      <div><div class="muted">Data</div>${esc(inv.issue_date)}</div>
      <div><div class="muted">Afati</div>${esc(inv.due_date || '—')}</div>
      <div><div class="muted">Statusi</div><span class="badge b-${inv.status}">${STATUS_LABEL[inv.status]}</span></div>
    </div>
    <table style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <thead><tr><th>Përshkrimi</th><th class="num">Sasia</th><th class="num">Çmimi</th><th class="num">TVSH</th><th class="num">Vlera</th></tr></thead>
      <tbody>${inv.items.map(it => `<tr><td>${esc(it.description)}</td><td class="num">${it.quantity}</td><td class="num">${money(it.unit_price)}</td><td class="num">${it.vat_rate}%</td><td class="num">${money(it.quantity * it.unit_price)}</td></tr>`).join('')}</tbody>
    </table>
    <div style="margin-left:auto;width:260px;margin-top:16px">
      <table><tr><td>Nëntotali</td><td class="num">${money(t.subtotal)}</td></tr>
      <tr><td>TVSH</td><td class="num">${money(t.vat)}</td></tr>
      <tr><td><b>TOTALI</b></td><td class="num"><b>${money(t.total)}</b></td></tr></table>
    </div>
    ${inv.notes ? `<p class="muted" style="margin-top:14px">${esc(inv.notes)}</p>` : ''}`;

  const m = modal('Faturë ' + inv.number, body, { wide: true });
  // Veprime në footer
  const foot = m.bg.querySelector('.modal-foot');
  foot.innerHTML = `<button class="btn ghost" onclick="window.print()">Printo</button>`;
  if (can('accountant')) {
    const statusSel = document.createElement('select');
    statusSel.className = 'field'; statusSel.style.cssText = 'padding:9px 12px;border:1px solid var(--border);border-radius:9px;margin-right:auto';
    statusSel.innerHTML = Object.entries(STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${k === inv.status ? 'selected' : ''}>${v}</option>`).join('');
    statusSel.onchange = async () => { await api.post('/invoices/' + id + '/status', { status: statusSel.value }); toast('Statusi u përditësua'); viewInvoices(el); };
    foot.prepend(statusSel);
    const edit = document.createElement('button'); edit.className = 'btn ghost'; edit.textContent = 'Ndrysho';
    edit.onclick = () => { m.close(); invoiceForm(inv, el); };
    const del = document.createElement('button'); del.className = 'btn danger'; del.textContent = 'Fshi';
    del.onclick = () => confirmBox('Të fshihet fatura?', async () => { await api.del('/invoices/' + id); m.close(); toast('U fshi'); viewInvoices(el); }, { danger: true });
    foot.append(edit, del);
  }
}

async function invoiceForm(inv, el) {
  const clients = await api.get('/clients');
  const products = await api.get('/products');
  if (!clients.length) { toast('Shto një klient fillimisht', true); return; }
  inv = inv || { items: [{ description: '', quantity: 1, unit_price: 0, vat_rate: COMPANY.default_vat || 20 }], status: 'draft', issue_date: new Date().toISOString().slice(0, 10) };

  const prodOpts = '<option value="">— produkt —</option>' + products.map(p => `<option value="${p.id}">${esc(p.name)} (${fmt(p.unit_price)})</option>`).join('');
  const itemRow = (it = {}) => `<tr>
    <td><input class="d" value="${esc(it.description)}" placeholder="Përshkrimi"></td>
    <td style="width:90px"><input class="q" type="number" step="0.01" value="${it.quantity ?? 1}"></td>
    <td style="width:120px"><input class="u" type="number" step="0.01" value="${it.unit_price ?? 0}"></td>
    <td style="width:80px"><input class="v" type="number" step="0.01" value="${it.vat_rate ?? 20}"></td>
    <td style="width:120px" class="num lt">0.00</td>
    <td style="width:34px"><button class="btn ghost sm rm">&times;</button></td>
  </tr>`;

  const m = modal(inv.id ? 'Ndrysho faturën ' + inv.number : 'Faturë e re', `
    <div class="row2">
      <div class="field"><label>Klienti *</label><select id="i_client">${clients.map(c => `<option value="${c.id}" ${c.id === inv.client_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Shto nga produkti</label><select id="i_prod">${prodOpts}</select></div>
    </div>
    <div class="row3">
      <div class="field"><label>Data</label><input id="i_date" type="date" value="${esc(inv.issue_date)}"></div>
      <div class="field"><label>Afati i pagesës</label><input id="i_due" type="date" value="${esc(inv.due_date)}"></div>
      <div class="field"><label>Statusi</label><select id="i_status">${Object.entries(STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${k === inv.status ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    </div>
    <label style="font-size:13px;font-weight:600;color:#42506e">Artikujt</label>
    <table class="items-table" style="margin:6px 0 10px"><thead><tr><th>Përshkrimi</th><th class="num">Sasia</th><th class="num">Çmimi</th><th class="num">TVSH%</th><th class="num">Vlera</th><th></th></tr></thead><tbody id="items"></tbody></table>
    <button class="btn ghost sm" id="addItem">${I.plus} Shto rresht</button>
    <div style="margin-left:auto;width:240px;margin-top:14px" id="totals"></div>
    <div class="field" style="margin-top:14px"><label>Shënime</label><textarea id="i_notes" rows="2">${esc(inv.notes)}</textarea></div>
  `, {
    wide: true, saveLabel: inv.id ? 'Ruaj ndryshimet' : 'Krijo faturën',
    onSave: async (bg) => {
      const items = [...bg.querySelectorAll('#items tr')].map(tr => ({
        description: tr.querySelector('.d').value,
        quantity: tr.querySelector('.q').value,
        unit_price: tr.querySelector('.u').value,
        vat_rate: tr.querySelector('.v').value,
      })).filter(it => it.description.trim() || Number(it.unit_price));
      if (!items.length) throw new Error('Shtoni të paktën një artikull');
      const body = {
        client_id: Number($('#i_client', bg).value), issue_date: $('#i_date', bg).value, due_date: $('#i_due', bg).value,
        status: $('#i_status', bg).value, notes: $('#i_notes', bg).value, items,
      };
      if (inv.id) await api.put('/invoices/' + inv.id, body); else await api.post('/invoices', body);
      toast('Fatura u ruajt'); viewInvoices(el);
    }
  });

  const itemsBody = $('#items', m.bg);
  const recalc = () => {
    let sub = 0, vat = 0;
    itemsBody.querySelectorAll('tr').forEach(tr => {
      const q = +tr.querySelector('.q').value || 0, u = +tr.querySelector('.u').value || 0, v = +tr.querySelector('.v').value || 0;
      const line = q * u; sub += line; vat += line * v / 100;
      tr.querySelector('.lt').textContent = fmt(line);
    });
    $('#totals', m.bg).innerHTML = `<table><tr><td>Nëntotali</td><td class="num">${money(sub)}</td></tr><tr><td>TVSH</td><td class="num">${money(vat)}</td></tr><tr><td><b>Totali</b></td><td class="num"><b>${money(sub + vat)}</b></td></tr></table>`;
  };
  const wire = (tr) => {
    tr.querySelectorAll('input').forEach(i => i.oninput = recalc);
    tr.querySelector('.rm').onclick = () => { if (itemsBody.children.length > 1) { tr.remove(); recalc(); } };
  };
  (inv.items || []).forEach(it => { itemsBody.insertAdjacentHTML('beforeend', itemRow(it)); wire(itemsBody.lastElementChild); });
  recalc();
  $('#addItem', m.bg).onclick = () => { itemsBody.insertAdjacentHTML('beforeend', itemRow()); wire(itemsBody.lastElementChild); recalc(); };
  $('#i_prod', m.bg).onchange = (e) => {
    const p = products.find(x => x.id == e.target.value); if (!p) return;
    itemsBody.insertAdjacentHTML('beforeend', itemRow({ description: p.name, quantity: 1, unit_price: p.unit_price, vat_rate: p.vat_rate }));
    wire(itemsBody.lastElementChild); recalc(); e.target.value = '';
  };
}

/* ---- Expenses ---- */
async function viewExpenses(el) {
  const list = await api.get('/expenses');
  el.innerHTML = `
    <div class="toolbar"><div></div>${can('accountant') ? `<button class="btn" id="add">${I.plus} Shpenzim i ri</button>` : ''}</div>
    <div class="card"><table>
      <thead><tr><th>Data</th><th>Kategoria</th><th>Furnitori</th><th>Përshkrimi</th><th class="num">Vlera</th><th class="num">TVSH</th><th class="num">Totali</th><th></th></tr></thead>
      <tbody>${list.length ? list.map(x => `<tr>
        <td>${esc(x.date)}</td><td>${esc(x.category || '—')}</td><td>${esc(x.supplier || '—')}</td><td>${esc(x.description || '—')}</td>
        <td class="num">${money(x.amount)}</td><td class="num">${money(x.vat_amount)}</td><td class="num"><b>${money(x.total)}</b></td>
        <td class="num">${can('accountant') ? `<button class="btn ghost sm" data-edit="${x.id}">Ndrysho</button> <button class="btn ghost sm" data-del="${x.id}">Fshi</button>` : ''}</td>
      </tr>`).join('') : '<tr><td colspan="8"><div class="empty">Asnjë shpenzim</div></td></tr>'}</tbody>
    </table></div>`;
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => expenseForm(list.find(x => x.id == b.dataset.edit)));
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmBox('Të fshihet?', async () => { await api.del('/expenses/' + b.dataset.del); toast('U fshi'); viewExpenses(el); }, { danger: true }));
  if ($('#add')) $('#add').onclick = () => expenseForm();
}

function expenseForm(x) {
  x = x || { date: new Date().toISOString().slice(0, 10), vat_rate: COMPANY.default_vat || 20 };
  modal(x.id ? 'Ndrysho shpenzimin' : 'Shpenzim i ri', `
    <div class="row2">
      <div class="field"><label>Data</label><input id="e_date" type="date" value="${esc(x.date)}"></div>
      <div class="field"><label>Kategoria</label><input id="e_cat" value="${esc(x.category)}" placeholder="p.sh. Zyra, Transport"></div>
    </div>
    <div class="field"><label>Furnitori</label><input id="e_sup" value="${esc(x.supplier)}"></div>
    <div class="field"><label>Përshkrimi</label><input id="e_desc" value="${esc(x.description)}"></div>
    <div class="row2">
      <div class="field"><label>Vlera (pa TVSH)</label><input id="e_amt" type="number" step="0.01" value="${x.amount || 0}"></div>
      <div class="field"><label>TVSH %</label><input id="e_vat" type="number" step="0.01" value="${x.vat_rate}"></div>
    </div>
  `, {
    onSave: async (bg) => {
      const body = { date: $('#e_date', bg).value, category: $('#e_cat', bg).value, supplier: $('#e_sup', bg).value, description: $('#e_desc', bg).value, amount: $('#e_amt', bg).value, vat_rate: $('#e_vat', bg).value };
      if (!Number(body.amount)) throw new Error('Vlera është e detyrueshme');
      if (x.id) await api.put('/expenses/' + x.id, body); else await api.post('/expenses', body);
      toast('U ruajt'); route();
    }
  });
}

/* ---- Reports ---- */
async function viewReports(el) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  el.innerHTML = `
    <div class="card" style="margin-bottom:18px">
      <div class="card-head"><h3>Deklarata e TVSH</h3></div>
      <div class="card-body">
        <div class="row3" style="align-items:end">
          <div class="field"><label>Nga data</label><input id="from" type="date" value="${from}"></div>
          <div class="field"><label>Deri më</label><input id="to" type="date" value="${to}"></div>
          <div class="field"><button class="btn" id="run" style="width:100%;justify-content:center">Gjenero raportin</button></div>
        </div>
        <div id="vatOut"></div>
      </div>
    </div>`;
  const run = async () => {
    const r = await api.get(`/reports/vat?from=${$('#from').value}&to=${$('#to').value}`);
    $('#vatOut').innerHTML = `<table>
      <tr><th>Zëri</th><th class="num">Baza</th><th class="num">TVSH</th></tr>
      <tr><td>Shitje (TVSH e mbledhur)</td><td class="num">${money(r.sales_net)}</td><td class="num">${money(r.sales_vat)}</td></tr>
      <tr><td>Blerje (TVSH e zbritshme)</td><td class="num">${money(r.purchases_net)}</td><td class="num">${money(r.purchases_vat)}</td></tr>
      <tr style="border-top:2px solid var(--border)"><td><b>TVSH për të paguar</b></td><td class="num">—</td><td class="num"><b style="color:${r.vat_due >= 0 ? 'var(--red)' : 'var(--green)'}">${money(r.vat_due)}</b></td></tr>
    </table>`;
  };
  $('#run').onclick = run; run();
}

/* ---- Users (owner/admin) ---- */
async function viewUsers(el) {
  const list = await api.get('/users');
  const roleBadge = (r) => `<span class="badge b-${r}">${roleLabel(r)}</span>`;
  el.innerHTML = `
    <div class="toolbar">
      <div class="muted">${ME.role === 'owner' ? 'Si pronar, ju shihni të gjithë përdoruesit.' : 'Menaxhoni ekipin tuaj.'}</div>
      <button class="btn" id="add">${I.plus} Përdorues i ri</button>
    </div>
    <div class="card"><table>
      <thead><tr><th>Emri</th><th>Email</th><th>Roli</th><th>Statusi</th><th>Hyrja e fundit</th><th></th></tr></thead>
      <tbody>${list.map(u => `<tr>
        <td><b>${esc(u.name)}</b>${u.id === ME.id ? ' <small class="muted">(ju)</small>' : ''}</td>
        <td>${esc(u.email)}</td><td>${roleBadge(u.role)}</td>
        <td><span class="badge b-${u.status}">${u.status === 'active' ? 'Aktiv' : 'Pezulluar'}</span></td>
        <td class="muted">${u.last_login ? esc(u.last_login) : '—'}</td>
        <td class="num">
          ${u.id !== ME.id ? `
            <button class="btn ghost sm" data-edit="${u.id}">Ndrysho</button>
            <button class="btn ghost sm" data-status="${u.id}">${u.status === 'active' ? 'Pezullo' : 'Riaktivizo'}</button>
            <button class="btn ghost sm" data-del="${u.id}">Fshi</button>` : ''}
        </td>
      </tr>`).join('')}</tbody>
    </table></div>
    ${ME.role === 'owner' ? '' : '<p class="muted" style="margin-top:14px;font-size:12.5px">Shënim: disa llogari sistemi mund të mos shfaqen në këtë listë.</p>'}`;

  $('#add').onclick = () => userForm();
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => userForm(list.find(x => x.id == b.dataset.edit)));
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    const u = list.find(x => x.id == b.dataset.del);
    confirmBox(`Të nxirret jashtë "${u.name}"? Ky veprim fshin llogarinë përgjithmonë.`, async () => { await api.del('/users/' + u.id); toast('Përdoruesi u fshi'); viewUsers(el); }, { danger: true });
  });
  el.querySelectorAll('[data-status]').forEach(b => b.onclick = async () => {
    const u = list.find(x => x.id == b.dataset.status);
    const status = u.status === 'active' ? 'suspended' : 'active';
    await api.post('/users/' + u.id + '/status', { status }); toast(status === 'suspended' ? 'U pezullua' : 'U riaktivizua'); viewUsers(el);
  });
}

function userForm(u) {
  u = u || { role: 'viewer' };
  // Owner-i mund të caktojë çdo rol; admin-i jo "owner".
  const roles = ME.role === 'owner'
    ? ['owner', 'admin', 'accountant', 'viewer']
    : ['admin', 'accountant', 'viewer'];
  modal(u.id ? 'Ndrysho përdoruesin' : 'Përdorues i ri', `
    <div class="field"><label>Emri *</label><input id="u_name" value="${esc(u.name)}"></div>
    <div class="field"><label>Email *</label><input id="u_email" type="email" value="${esc(u.email)}"></div>
    <div class="row2">
      <div class="field"><label>Roli</label><select id="u_role">${roles.map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${roleLabel(r)}</option>`).join('')}</select></div>
      <div class="field"><label>${u.id ? 'Fjalëkalim i ri (opsional)' : 'Fjalëkalimi *'}</label><input id="u_pass" type="password" placeholder="${u.id ? 'Lëre bosh për të mos ndryshuar' : ''}"></div>
    </div>
    ${ME.role === 'owner' && u.role === 'admin' ? '<p class="muted" style="font-size:12.5px;margin:0">Ky admin do të ketë të drejta të plota operative, por nuk do ta shohë llogarinë tuaj të pronarit.</p>' : ''}
  `, {
    onSave: async (bg) => {
      const body = { name: $('#u_name', bg).value.trim(), email: $('#u_email', bg).value.trim(), role: $('#u_role', bg).value, password: $('#u_pass', bg).value };
      if (!body.name || !body.email) throw new Error('Emri dhe email-i janë të detyrueshëm');
      if (!u.id && !body.password) throw new Error('Fjalëkalimi është i detyrueshëm');
      if (u.id) await api.put('/users/' + u.id, body); else await api.post('/users', body);
      toast('U ruajt'); route();
    }
  });
}

/* ---- Audit ---- */
async function viewAudit(el) {
  const list = await api.get('/reports/audit');
  const ACTION = {
    hyri: 'Hyri', doli: 'Doli', krijoi_perdorues: 'Krijoi përdorues', ndryshoi_perdorues: 'Ndryshoi përdorues',
    pezulloi_perdorues: 'Pezulloi përdorues', riaktivizoi_perdorues: 'Riaktivizoi përdorues', fshiu_perdorues: 'Fshiu përdorues',
    krijoi_klient: 'Krijoi klient', ndryshoi_klient: 'Ndryshoi klient', fshiu_klient: 'Fshiu klient',
    krijoi_fature: 'Krijoi faturë', ndryshoi_fature: 'Ndryshoi faturë', fshiu_fature: 'Fshiu faturë', ndryshoi_status_fature: 'Ndryshoi status fature',
    krijoi_produkt: 'Krijoi produkt', ndryshoi_produkt: 'Ndryshoi produkt', fshiu_produkt: 'Fshiu produkt',
    krijoi_shpenzim: 'Krijoi shpenzim', ndryshoi_shpenzim: 'Ndryshoi shpenzim', fshiu_shpenzim: 'Fshiu shpenzim',
    tentoi_akses_owner: '⚠ Tentoi akses te pronari', ndryshoi_kompanine: 'Ndryshoi kompaninë', ndryshoi_fjalekalimin: 'Ndryshoi fjalëkalimin',
  };
  el.innerHTML = `
    <p class="muted" style="margin-top:0">${ME.role === 'owner' ? 'Ju shihni çdo veprim, përfshirë tentativat për të aksesuar llogarinë tuaj.' : 'Historik i veprimeve të ekipit.'}</p>
    <div class="card"><table>
      <thead><tr><th>Data</th><th>Përdoruesi</th><th>Roli</th><th>Veprimi</th><th>Detaje</th></tr></thead>
      <tbody>${list.length ? list.map(a => `<tr>
        <td class="muted" style="white-space:nowrap">${esc(a.created_at)}</td>
        <td>${esc(a.user_name || '—')}</td><td>${a.user_role ? `<span class="badge b-${a.user_role}">${roleLabel(a.user_role)}</span>` : '—'}</td>
        <td>${esc(ACTION[a.action] || a.action)}</td>
        <td class="muted">${esc(a.details || '')} ${a.entity ? '· ' + esc(a.entity) + (a.entity_id ? '#' + a.entity_id : '') : ''}</td>
      </tr>`).join('') : '<tr><td colspan="5"><div class="empty">Ende asnjë veprim</div></td></tr>'}</tbody>
    </table></div>`;
}

/* ---- Settings ---- */
async function viewSettings(el) {
  const c = await api.get('/settings/company');
  el.innerHTML = `
    <div class="card" style="max-width:640px">
      <div class="card-head"><h3>Të dhënat e kompanisë</h3></div>
      <div class="card-body">
        <div class="field"><label>Emri i kompanisë</label><input id="s_name" value="${esc(c.name)}"></div>
        <div class="row2">
          <div class="field"><label>NIPT</label><input id="s_nipt" value="${esc(c.nipt)}"></div>
          <div class="field"><label>Monedha</label><input id="s_cur" value="${esc(c.currency || 'Lek')}"></div>
        </div>
        <div class="field"><label>Adresa</label><input id="s_addr" value="${esc(c.address)}"></div>
        <div class="row2">
          <div class="field"><label>Telefon</label><input id="s_phone" value="${esc(c.phone)}"></div>
          <div class="field"><label>Email</label><input id="s_email" value="${esc(c.email)}"></div>
        </div>
        <div class="row2">
          <div class="field"><label>IBAN</label><input id="s_iban" value="${esc(c.iban)}"></div>
          <div class="field"><label>TVSH e parazgjedhur %</label><input id="s_vat" type="number" value="${c.default_vat ?? 20}"></div>
        </div>
        <button class="btn" id="save">Ruaj ndryshimet</button>
      </div>
    </div>`;
  $('#save').onclick = async () => {
    const body = { name: $('#s_name').value, nipt: $('#s_nipt').value, currency: $('#s_cur').value, address: $('#s_addr').value, phone: $('#s_phone').value, email: $('#s_email').value, iban: $('#s_iban').value, default_vat: Number($('#s_vat').value) };
    await api.put('/settings/company', body); COMPANY = body; $('#companyName').textContent = body.name; toast('Cilësimet u ruajtën');
  };
}

/* ---- Profile ---- */
function viewProfile(el) {
  el.innerHTML = `
    <div class="card" style="max-width:480px">
      <div class="card-head"><h3>Profili im</h3></div>
      <div class="card-body">
        <div class="field"><label>Emri</label><input value="${esc(ME.name)}" disabled></div>
        <div class="field"><label>Email</label><input value="${esc(ME.email)}" disabled></div>
        <div class="field"><label>Roli</label><input value="${roleLabel(ME.role)}" disabled></div>
        <hr style="border:none;border-top:1px solid var(--border);margin:18px 0">
        <h3 style="font-size:15px;margin:0 0 14px">Ndrysho fjalëkalimin</h3>
        <div class="field"><label>Fjalëkalimi aktual</label><input id="pw_cur" type="password"></div>
        <div class="field"><label>Fjalëkalimi i ri</label><input id="pw_new" type="password"></div>
        <button class="btn" id="pwBtn">Ndrysho fjalëkalimin</button>
      </div>
    </div>`;
  $('#pwBtn').onclick = async () => {
    try {
      await api.post('/auth/change-password', { current: $('#pw_cur').value, next: $('#pw_new').value });
      toast('Fjalëkalimi u ndryshua'); $('#pw_cur').value = ''; $('#pw_new').value = '';
    } catch (e) { toast(e.message, true); }
  };
}

/* ============ Start ============ */
boot();
