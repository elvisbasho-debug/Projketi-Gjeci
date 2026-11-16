'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    /* ---------- Përdoruesit dhe sistemi i roleve ---------- */
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'viewer',   -- owner | admin | accountant | viewer
      status        TEXT NOT NULL DEFAULT 'active',   -- active | suspended
      created_by    INTEGER,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_login    TEXT
    );

    /* ---------- Subjektet (tatimpaguesit që menaxhon kontabilisti) ---------- */
    CREATE TABLE IF NOT EXISTS subjects (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      nipt          TEXT,
      ealbania_user TEXT,
      ealbania_pass TEXT,              -- i enkriptuar (AES-GCM)
      selfcare_pass TEXT,              -- i enkriptuar
      status        TEXT NOT NULL DEFAULT 'active',  -- active | inactive
      notes         TEXT,
      created_by    INTEGER,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    /* ---------- Katalogu i shërbimeve (robotët) ---------- */
    CREATE TABLE IF NOT EXISTS services (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      code        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      description TEXT,
      category    TEXT,
      sort_order  INTEGER DEFAULT 0
    );

    /* ---------- Kuotat për çdo shërbim ---------- */
    CREATE TABLE IF NOT EXISTS service_quotas (
      service_id  INTEGER PRIMARY KEY REFERENCES services(id),
      max_limit   INTEGER NOT NULL DEFAULT 20,
      used        INTEGER NOT NULL DEFAULT 0,
      active      INTEGER NOT NULL DEFAULT 1,
      expires_at  TEXT,
      renews_at   TEXT
    );

    /* ---------- Rekordet: subjekt × shërbim ---------- */
    CREATE TABLE IF NOT EXISTS service_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id  INTEGER NOT NULL REFERENCES services(id),
      subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      status      TEXT NOT NULL DEFAULT 'ne_pritje', -- ne_pritje | kryer | deshtoi | deklaruar
      result      TEXT,            -- tekst i lirë / status i rezultatit
      data        TEXT,            -- JSON me vlera (TVSH, totali, kredi, etj.)
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(service_id, subject_id)
    );

    /* ---------- Radha e ekzekutimeve (automatizimi) ---------- */
    CREATE TABLE IF NOT EXISTS executions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id    INTEGER NOT NULL REFERENCES services(id),
      subject_id    INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      status        TEXT NOT NULL DEFAULT 'ne_radhe', -- ne_radhe | ne_ekzekutim | kryer | deshtoi | anuluar | duke_riprovuar
      attempts      INTEGER NOT NULL DEFAULT 0,
      wait_ms       INTEGER,
      process_ms    INTEGER,
      result        TEXT,
      run_by        TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      started_at    TEXT,
      finished_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS execution_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      execution_id  INTEGER NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
      level         TEXT DEFAULT 'info',   -- info | warn | error
      message       TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    /* ---------- Njoftimet ---------- */
    CREATE TABLE IF NOT EXISTS notifications (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      body        TEXT,
      level       TEXT DEFAULT 'info',
      is_read     INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    /* ---------- Mbështetja (bileta) ---------- */
    CREATE TABLE IF NOT EXISTS tickets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      subject     TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'hapur',  -- hapur | ne_proces | mbyllur
      created_by  INTEGER,
      creator_name TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      author      TEXT,
      body        TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    /* ---------- Pyet VA (biseda me asistentin) ---------- */
    CREATE TABLE IF NOT EXISTS va_messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      role        TEXT,            -- user | assistant
      body        TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    /* ---------- Regjistri i veprimeve ---------- */
    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      user_name   TEXT,
      user_role   TEXT,
      action      TEXT NOT NULL,
      entity      TEXT,
      entity_id   INTEGER,
      details     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Migrime shtesë (kolona të reja në tabela ekzistuese)
  const addColumn = (table, col, def) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  };
  addColumn('service_records', 'period_from', 'TEXT');   // periudha e punës (Datat masive)
  addColumn('service_records', 'period_to', 'TEXT');
  addColumn('executions', 'action', 'TEXT');             // veprimi specifik (p.sh. 'blerjet')
  addColumn('users', 'subject_id', 'INTEGER');           // për rolin 'client': biznesi që i përket

  db.exec(`
    /* ---------- Historiku i rezultateve për çdo rekord (për Statistika/Historik) ---------- */
    CREATE TABLE IF NOT EXISTS record_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id  INTEGER NOT NULL REFERENCES services(id),
      subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      period      TEXT,            -- YYYY-MM
      action      TEXT,
      status      TEXT,
      result      TEXT,
      data        TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS ix_hist ON record_history(service_id, subject_id, period);

    /* ---------- Kërkesat e klientëve (portali i klientit: TVSH në kohë reale) ---------- */
    CREATE TABLE IF NOT EXISTS client_requests (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id    INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      user_id       INTEGER,
      kind          TEXT NOT NULL DEFAULT 'tvsh',
      execution_id  INTEGER,
      status        TEXT NOT NULL DEFAULT 'ne_radhe',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Cilësimet e workspace/kompanisë
  const hasCompany = db.prepare("SELECT value FROM settings WHERE key='company'").get();
  if (!hasCompany) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('company', ?)").run(
      JSON.stringify({
        name: 'Studio Kontabël Finbot',
        nipt: 'L00000000X',
        address: 'Tiranë, Shqipëri',
        phone: '+355 69 000 0000',
        email: 'info@finbot.al',
        currency: 'Lek',
        va_credits: 10,
      })
    );
  }

  // Katalogu i shërbimeve (robotët) — krijohet një herë
  const svcCount = db.prepare('SELECT COUNT(*) c FROM services').get().c;
  if (svcCount === 0) {
    const SERVICES = [
      ['mbledhje_fatura',  'Mbledhja e faturave nga Self-Care', 'Mbledh faturat nga Self-Care.', 'Mbledhje'],
      ['tvsh_deklarim',    'Deklarimi dhe Informacioni mbi TVSH-në', 'Përgatit deklarimin dhe sheh informacionin mbi TVSH-në.', 'Deklarim'],
      ['detyrime_realtime','Detyrimet në kohë reale dhe Urdhërpagesat', 'Sheh detyrimet në kohë reale dhe urdhërpagesat e gjeneruara.', 'Kontroll'],
      ['xhiro_shpenzime',  'Xhiro dhe shpenzime nga Self-Care', 'Mbledh dhe rishiko të ardhurat dhe shpenzimet nga Self-Care.', 'Mbledhje'],
      ['tvsh_krahasim',    'Krahasimi i TVSH-së (Selfcare VS. C@ts)', 'Krahaso vlerat e TVSH-së ndërmjet Self-Care dhe C@ts.', 'Kontroll'],
      ['tatim_burim_qira', 'Deklarimi i Tatimit në Burim (Qira)', 'Deklaro tatimin në burim për qiratë.', 'Deklarim'],
      ['listepagesa_esig', 'Deklarimi dhe kontrolli i listëpagesës (Esig-25)', 'Deklaro dhe kontrollo listëpagesën E-Sig 25.', 'Deklarim'],
      ['dogana_importe',   'Kontrolli i Deklaratës Doganore (Importe)', 'Kontrollo deklaratat doganore për importet.', 'Kontroll'],
      ['cats_dokumente',   'Kontrolli i dokumenteve nga C@ts', 'Kontrollo dokumentet e mbledhura nga C@ts.', 'Kontroll'],
      ['padeklaruara',     'Kontrollo Deklaratat e Mia të Padeklaruara', 'Kontrollo deklaratat e padeklaruara për subjektet e regjistruara.', 'Kontroll'],
      ['pash',             'PASH – Pasqyra e të ardhurave dhe shpenzimeve', 'Gjenero pasqyrën e të ardhurave dhe shpenzimeve.', 'Raport'],
    ];
    const ins = db.prepare('INSERT INTO services (code, name, description, category, sort_order) VALUES (?, ?, ?, ?, ?)');
    const insQuota = db.prepare("INSERT INTO service_quotas (service_id, max_limit, used, active, expires_at, renews_at) VALUES (?, 20, 0, 1, date('now','+32 day'), date('now','start of month','+1 month'))");
    SERVICES.forEach((s, i) => {
      const info = ins.run(s[0], s[1], s[2], s[3], i);
      insQuota.run(info.lastInsertRowid);
    });
  }
}

migrate();

module.exports = db;
