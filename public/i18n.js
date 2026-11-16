'use strict';
/*
  Preferencat e përdoruesit (në këtë shfletues): tema dhe gjuha.
  - Tema: 'light' | 'dark' | 'system' → atributi data-theme te <html>.
  - Gjuha: 'sq' (parazgjedhur) | 'en'. Aplikacioni shkruhet shqip; në anglisht
    tekstet e njohura zëvendësohen me fjalorin më poshtë sapo shfaqen në faqe.
*/
(function () {
  const read = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  const PREFS = {
    get theme() { return read('fb-theme') || 'system'; },
    get lang() { return read('fb-lang') || 'sq'; },
    setTheme(t) { write('fb-theme', t); applyTheme(); },
    setLang(l) { write('fb-lang', l); location.reload(); },
  };
  window.FB_PREFS = PREFS;

  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    const t = PREFS.theme;
    const dark = t === 'dark' || (t === 'system' && mq && mq.matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
  applyTheme();
  if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);

  document.documentElement.lang = PREFS.lang;
  if (PREFS.lang !== 'en') return;

  const D = {
    // Navigimi dhe titujt
    'Paneli': 'Dashboard', 'Shërbimet': 'Services', 'Shërbimi': 'Service', 'Pyet VA': 'Ask VA', 'Subjektet': 'Subjects', 'Subjekti': 'Subject',
    'Automatizimi': 'Automation', 'Njoftimet': 'Notifications', 'Mbështetje': 'Support', 'Përdoruesit': 'Users', 'Regjistri': 'Log',
    'Cilësimet': 'Settings', 'Dalje': 'Log out', 'Dil': 'Log out', 'Profili im': 'My profile', 'Regjistri i veprimeve': 'Audit log',
    'Kreu': 'Home', 'Historiku': 'History', 'Statistika': 'Statistics', 'Mirë se vini': 'Welcome', 'Hyr': 'Sign in',
    'Platforma juaj e kontabilitetit të automatizuar': 'Your automated accounting platform', 'Fjalëkalimi': 'Password', 'Email': 'Email',
    // Paneli
    'Shërbime të disponueshme': 'Available services', 'Caktuar për llogarinë': 'Assigned to the account', 'Shërbime aktive': 'Active services',
    'Në punë': 'Running', 'Përdorimi mujor': 'Monthly usage', 'Muaji aktual': 'Current month', 'Subjekte': 'Subjects', 'Gjithsej': 'Total',
    'Automatizimi — përmbledhje': 'Automation — summary', 'Shiko →': 'View →', 'Ekzekutime të kryera': 'Completed runs',
    'Në radhë / ekzekutim': 'Queued / running', 'Të dështuara': 'Failed', 'Rekordet e fundit': 'Recent records', 'Ende pa rekorde': 'No records yet',
    // Statuset
    'Aktiv': 'Active', 'Joaktiv': 'Inactive', 'Aktive': 'Active', 'Pezulluar': 'Suspended', 'Kryer': 'Done', 'Dështoi': 'Failed', 'Deklaruar': 'Declared',
    'Në pritje': 'Pending', 'Në radhë': 'Queued', 'Në ekzekutim': 'Running', 'Duke riprovuar': 'Retrying', 'Anuluar': 'Cancelled', 'Gati': 'Ready',
    'Në proces': 'In progress', 'Dështuar': 'Failed', 'Përputhet': 'Matches', 'Nuk përputhet': 'Does not match',
    // Faqja e shërbimit
    '← Shërbimet': '← Services', 'Filtra': 'Filters', 'Shfaq panelin': 'Show panel', 'Shto subjekt': 'Add subject', 'Importo': 'Import',
    'Eksporto': 'Export', 'Datat masive': 'Bulk dates', 'Veprime': 'Actions', 'Rifresko': 'Refresh', 'Ndalo': 'Stop', 'Hap': 'Open',
    'Shfaq detajet e rezultateve': 'Show result details', 'Statusi i rezultatit': 'Result status', 'Statusi i subjektit': 'Subject status',
    'Të gjitha': 'All', 'Pastro': 'Clear', 'Kuota mujore': 'Monthly quota', 'Rinovohet më': 'Renews on', 'Skadon më': 'Expires on',
    'Periudha': 'Period', 'Veprimet': 'Actions', 'Pa caktuar': 'Not set', 'Të ndryshme': 'Various', 'Emri i subjektit': 'Subject name',
    'Përditësuar': 'Updated', 'Statusi': 'Status', 'Rezultati': 'Result', 'Importo nga skedar CSV': 'Import from CSV file',
    'Importo nga shërbimet e tjera': 'Import from other services', 'Shkarko template importi': 'Download import template',
    'Eksporto CSV': 'Export CSV', 'Të gjitha në një PDF': 'All in one PDF', 'Një PDF për subjekt (.zip)': 'One PDF per subject (.zip)',
    'Fshi të gjitha subjektet': 'Remove all subjects', 'Ekzekuto për të gjitha subjektet aktive të studios': 'Run for all active subjects of the studio',
    'Vendos datat për të gjitha regjistrimet': 'Set dates for all records', 'Data e fillimit': 'Start date', 'Data e mbarimit': 'End date',
    'Muaji i kaluar': 'Last month', 'Ky muaj': 'This month', 'Ky vit': 'This year', 'Ruaj': 'Save', 'Mbyll': 'Close', 'Anulo': 'Cancel',
    'Po, vazhdo': 'Yes, continue', 'Konfirmim': 'Confirmation', 'Shto': 'Add', 'Zgjidh të gjitha': 'Select all', 'Kërko…': 'Search…',
    'Shërbimi burim': 'Source service', 'Importo nga një shërbim tjetër': 'Import from another service', 'Udhëzuesi': 'Guide', 'Hapat': 'Steps',
    'Ekzekutim masiv': 'Bulk run', 'Ekzekuto për të gjithë': 'Run for all', 'Skadimi': 'Expiry', 'Rinovohet': 'Renews', 'Subjekte këtë muaj': 'Subjects this month',
    // Kolonat e shërbimeve
    'Status blerje': 'Purchases status', 'Status shitje': 'Sales status', 'Fatura': 'Invoices', 'Status deklarim': 'Declaration status',
    'Statusi info': 'Info status', 'Kredi': 'Credit', 'TVSH mujore': 'Monthly VAT', 'Totali': 'Total', 'Detyrime gjithsej': 'Total liabilities',
    'Të ardhurat': 'Revenue', 'Shpenzimet': 'Expenses', 'Bilanci i trans.': 'Transaction balance', 'Rezultati i krahasimit': 'Comparison result',
    'Rezultati i deklarimit': 'Declaration result', 'Deklarata': 'Declarations', 'Totali doganor': 'Customs total', 'Dokumenta': 'Documents',
    'Afati më i afërt': 'Nearest deadline', 'Të ardhura nga shitja': 'Sales revenue', 'Fitimi neto / Humbja': 'Net profit / loss',
    // Pamja e rekordit
    'Gjendja': 'State', 'Përshkrimi': 'Description', 'Periudha dhe PDF': 'Period and PDF', 'Ruaj periudhën': 'Save period',
    'PDF i gjendjes': 'Current-state PDF', 'PDF-të e periudhës (.zip)': 'Period PDFs (.zip)', 'Ekzekutimet e fundit': 'Recent runs',
    'Veprimi': 'Action', 'Kohët': 'Times', 'Log-et': 'Logs', 'Data': 'Date', 'Nga muaji': 'From month', 'Deri në muajin': 'To month',
    'Raport PDF': 'PDF report', 'Maksimizo': 'Maximize', 'Minimizo': 'Minimize', 'Të gjithë': 'All', 'Krahasimi mujor': 'Monthly comparison',
    'Muaji': 'Month', 'Totali vjetor': 'Yearly total', 'Të gjitha nivelet': 'All levels', 'Informacion': 'Info', 'Sukses': 'Success',
    'Paralajmërim': 'Warning', 'Gabim': 'Error', 'Kërko në regjistër…': 'Search the log…', 'Të dhënat e subjektit': 'Subject details',
    'Emri i subjektit *': 'Subject name *', 'NIPT i subjektit *': 'Tax ID *', 'Përdoruesi e-Albania': 'e-Albania user', 'Statusi i subjektit *': 'Subject status *',
    'Fjalëkalimi e-Albania': 'e-Albania password', 'Shfaq': 'Show', 'Hiq nga ky shërbim': 'Remove from this service', 'Vetëm lexim.': 'Read only.',
    'Ende pa ekzekutime': 'No runs yet', 'Duke ngarkuar…': 'Loading…', 'Ende pa rezultat': 'No result yet',
    // Pyet VA
    'Të gjitha subjektet': 'All subjects', 'Bisedë e re': 'New chat', 'Përmbledhje': 'Summary', 'Dështimet': 'Failures', 'Përdorimi': 'Usage',
    'Dërgo': 'Send', 'Shkruaj pyetjen…': 'Type your question…', 'VA mund të gabojë. Verifiko shifrat.': 'VA can make mistakes. Check the numbers.',
    'Si po ecën puna sot?': 'How is work going today?', 'Shërbimet e tua, në një bisedë': 'Your services, in one chat',
    // Subjektet / përdoruesit / të tjera
    'Kërko sipas emrit ose NIPT-it…': 'Search by name or tax ID…', 'Importo CSV': 'Import CSV', 'Ndrysho': 'Edit', 'Fshi': 'Delete',
    'Kredencialet': 'Credentials', 'Pa fjalëkalim': 'No password', 'Shërbimet e subjektit': 'Subject services', 'Ndrysho subjektin': 'Edit subject',
    'Portali i klientit': 'Client portal', 'Krijo llogari': 'Create account', 'Pezullo': 'Suspend', 'Aktivizo': 'Activate', 'Hyrja e fundit': 'Last login',
    'Emri': 'Name', 'Roli': 'Role', 'Ndrysho fjalëkalimin': 'Change password', 'Fjalëkalimi aktual': 'Current password', 'Fjalëkalimi i ri': 'New password',
    'Ruaj ndryshimet': 'Save changes', 'Preferencat': 'Preferences', 'Tema': 'Theme', 'Gjuha': 'Language', 'E ndriçuar': 'Light', 'E errët': 'Dark',
    'Sistemi': 'System', 'Ndalo të gjitha': 'Stop all', 'Të gjitha shërbimet': 'All services', 'Të gjitha statuset': 'All statuses',
    'Radha e ekzekutimeve': 'Run queue', 'Mediana pritjes': 'Median wait', 'Mediana procesim': 'Median processing',
    'Pronar': 'Owner', 'Administrator': 'Administrator', 'Kontabilist': 'Accountant', 'Vëzhgues': 'Viewer',
    'Kërko': 'Search', 'TVSH e paguar': 'VAT paid','NIPT': 'Tax ID', 'Kërko subjekt, NIPT, status ose vlerë…': 'Search subject, tax ID, status or value…', 'Rekordi': 'Record', 'Kërko shërbime…': 'Search services…', 'Kuota rinovohet më': 'Quota renews on',
    'Subjekt, NIPT ose shërbim…': 'Subject, tax ID or service…', 'Asnjë rezultat': 'No results', 'Shërbim': 'Service',
    'Subjekt, NIPT, shërbim, përdorues ose rezultat': 'Subject, tax ID, service, user or result',
    'Studiot': 'Studios', 'Studiot dhe planet': 'Studios and plans', 'Studioja': 'Studio', 'Studio e re': 'New studio', 'Planet e abonimit': 'Subscription plans',
    'Adminët e platformës': 'Platform admins', 'Hyr': 'Enter', 'Plani': 'Plan', 'Biznese': 'Businesses', 'Për muaj': 'Per month', 'Abonimi': 'Subscription',
    'Biznese sipas planit': 'Businesses on plan', 'Përdorimi i shërbimeve': 'Service usage', 'Të ardhura mujore': 'Monthly revenue', 'Adminë': 'Admins',
    '— Zgjidh studion —': '— Select studio —', 'Zgjidhni studion': 'Select a studio', 'Administrator i studios': 'Studio administrator',
    'Admin i platformës': 'Platform admin', 'Klient': 'Client', 'Krijo studion': 'Create studio', 'Ndrysho studion': 'Edit studio',
    // Portali i klientit
    'TVSH në kohë reale': 'Real-time VAT', 'Kërko TVSH-në tani': 'Get my VAT now', 'Duke marrë të dhënat…': 'Fetching data…',
    'Kërkesat e fundit': 'Recent requests', 'Kredi e mbartur': 'Credit carried forward', 'Deklarimi': 'Declaration',
    'TVSH për t’u paguar': 'VAT to pay', 'TVSH për t’u rimbursuar / kredi': 'VAT refundable / credit', 'Ende pa kërkesa.': 'No requests yet.',
    'Kërkesa u pranua, po përgatitet…': 'Request received, preparing…', 'Po lidhemi me portalin tatimor…': 'Connecting to the tax portal…',
    'Po merren të dhënat nga portali tatimor…': 'Fetching data from the tax portal…', 'TVSH-ja u përditësua': 'VAT updated',
  };
  const PATTERNS = [
    [/^(\d+) në ekzekutim$/, '$1 running'], [/^(\d+) kredite$/, '$1 credits'], [/^U ndaluan (\d+)$/, 'Stopped $1'],
    [/^Përditësuar më (.+)$/, 'Updated $1'], [/^(\d+) rreshta(.*)$/, '$1 rows$2'], [/^NIPT (.+)$/, 'Tax ID $1'],
  ];

  const tr = s => {
    const k = s.trim(); if (!k) return null;
    if (D[k]) return s.replace(k, D[k]);
    for (const [re, rep] of PATTERNS) if (re.test(k)) return s.replace(k, k.replace(re, rep));
    return null;
  };
  function walk(root) {
    if (root.nodeType === 3) { const t = tr(root.nodeValue); if (t !== null && t !== root.nodeValue) root.nodeValue = t; return; }
    if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
    for (const a of ['placeholder', 'title']) { const v = root.getAttribute(a); if (v) { const t = tr(v); if (t !== null) root.setAttribute(a, t); } }
    if (root.tagName === 'OPTION' || root.tagName === 'BUTTON' || root.childNodes.length) root.childNodes.forEach(walk);
  }
  new MutationObserver(ms => ms.forEach(m => {
    if (m.type === 'characterData') walk(m.target);
    else m.addedNodes.forEach(walk);
  })).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener('DOMContentLoaded', () => walk(document.body));
})();
