'use strict';

// Mbjell: owner/admin + subjekte demo + rekorde + pak ekzekutime të kryera.
// Ekzekuto: npm run seed

const db = require('./db');
const { hashPassword } = require('./auth');
const { encrypt } = require('./crypto');
const profiles = require('./profiles');

// Në prodhim: asnjë fjalëkalim i parazgjedhur dhe asnjë e dhënë demo.
const PROD = process.env.NODE_ENV === 'production';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@finbot.al';
const OWNER_PASS = process.env.OWNER_PASS || (PROD ? '' : 'Owner1234!');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@finbot.al';
const ADMIN_PASS = process.env.ADMIN_PASS || (PROD ? '' : 'Admin1234!');

if (PROD && OWNER_PASS.length < 10) {
  console.error('  GABIM: në prodhim vendosni OWNER_PASS (të paktën 10 karaktere).');
  process.exit(1);
}

function upsertUser(name, email, pass, role, createdBy) {
  const ex = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (ex) return ex.id;
  return db.prepare('INSERT INTO users (name,email,password_hash,role,created_by) VALUES (?,?,?,?,?)')
    .run(name, email, hashPassword(pass), role, createdBy || null).lastInsertRowid;
}

const ownerId = upsertUser('Pronari', OWNER_EMAIL, OWNER_PASS, 'owner', null);
const adminId = ADMIN_PASS ? upsertUser('Administratori', ADMIN_EMAIL, ADMIN_PASS, 'admin', ownerId) : ownerId;

// Subjekte demo (vetëm jashtë prodhimit)
if (!PROD && db.prepare('SELECT COUNT(*) c FROM subjects').get().c === 0) {
  const DEMO = [
    ['Alfa Trading SH.P.K.', 'K12345678L'],
    ['Beta Market SH.P.K.', 'L87654321M'],
    ['Gamma Konsulencë', 'M11223344N'],
    ['Delta Ndërtim', 'K55667788O'],
    ['Epsilon Services', 'L99887766P'],
    ['Zeta Logjistikë', 'M44556677Q'],
  ];
  const ins = db.prepare('INSERT INTO subjects (name,nipt,ealbania_user,ealbania_pass,status,created_by,org_id) VALUES (?,?,?,?,?,?,1)');
  DEMO.forEach(([name, nipt]) => ins.run(name, nipt, nipt, encrypt('demo-fjalekalim'), 'active', adminId));

  const subjects = db.prepare('SELECT id FROM subjects WHERE org_id=1').all();
  const services = db.prepare('SELECT id, code FROM services').all();

  // Rekorde + disa ekzekutime të kryera për të pasur të dhëna në panel/automatizim
  const insRec = db.prepare(`INSERT INTO service_records (service_id, subject_id, status, result, data) VALUES (?,?,?,?,?)`);
  const insExec = db.prepare(`INSERT INTO executions (service_id, subject_id, status, attempts, wait_ms, process_ms, result, run_by, started_at, finished_at)
    VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`);
  const insLog = db.prepare(`INSERT INTO execution_logs (execution_id, level, message) VALUES (?,?,?)`);

  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  const insHist = db.prepare('INSERT INTO record_history (service_id, subject_id, period, status, result, data, created_at) VALUES (?,?,?,?,?,?,?)');
  const now = new Date();
  // Periudhat mujore nga janari 2 vjet më parë deri muajin e kaluar (për Statistika/Historik)
  const periods = [];
  for (let d = new Date(now.getFullYear() - 2, 0, 1); d < new Date(now.getFullYear(), now.getMonth(), 1); d.setMonth(d.getMonth() + 1)) {
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  for (const svc of services) {
    // zë ~4 subjekte për shërbim
    const used = Math.min(subjects.length, rnd(2, subjects.length));
    for (let i = 0; i < used; i++) {
      const sub = subjects[i];
      let sim, data = {};
      for (const p of periods) {
        sim = profiles.simulate(svc.code);
        data = { ...data, ...sim.data };
        insHist.run(svc.id, sub.id, p, sim.status, sim.result, JSON.stringify(sim.data), `${p}-15 10:00:00`);
      }
      insRec.run(svc.id, sub.id, sim.status, sim.result, JSON.stringify(data));
      const ex = insExec.run(svc.id, sub.id, sim.ok ? 'kryer' : 'deshtoi', 1, rnd(0, 60000), rnd(8000, 20000), sim.result, 'admin@finbot.al');
      insLog.run(ex.lastInsertRowid, 'info', 'Nisi ekzekutimi i robotit.');
      insLog.run(ex.lastInsertRowid, sim.ok ? 'info' : 'error', sim.ok ? 'Të dhënat u përpunuan me sukses.' : 'Dështoi lidhja me portalin.');
    }
    // përditëso kuotën
    db.prepare('UPDATE service_quotas SET used=? WHERE service_id=?').run(used, svc.id);
  }

  // Një njoftim mirëseardhjeje
  db.prepare("INSERT INTO notifications (title, body, level, org_id) VALUES (?,?,?,1)")
    .run('Mirë se vini në Finbot', 'Platforma u konfigurua. Shtoni subjektet dhe nisni shërbimet.', 'info');
}

// Llogari demo (vetëm jashtë prodhimit): admini i studios #1, klienti i portalit, dhe një studio e dytë
const DEMO = process.env.NODE_ENV !== 'production';
const STUDIO_EMAIL = process.env.STUDIO_EMAIL || 'studio@finbot.al';
const STUDIO_PASS = process.env.STUDIO_PASS || 'Studio1234!';
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || 'klient@finbot.al';
const CLIENT_PASS = process.env.CLIENT_PASS || 'Klient1234!';
if (DEMO) {
  if (!db.prepare('SELECT id FROM users WHERE email=?').get(STUDIO_EMAIL)) {
    db.prepare("INSERT INTO users (name,email,password_hash,role,created_by,org_id) VALUES (?,?,?,'studio_admin',?,1)")
      .run('Administratori i studios', STUDIO_EMAIL, hashPassword(STUDIO_PASS), adminId);
  }
  if (!db.prepare('SELECT id FROM users WHERE email=?').get(CLIENT_EMAIL)) {
    const first = db.prepare('SELECT id FROM subjects WHERE org_id=1 ORDER BY id LIMIT 1').get();
    if (first) db.prepare("INSERT INTO users (name,email,password_hash,role,created_by,subject_id,org_id) VALUES (?,?,?,'client',?,?,1)")
      .run('Klient demo', CLIENT_EMAIL, hashPassword(CLIENT_PASS), adminId, first.id);
  }
  // Studio e dytë me dy biznese — për të provuar që studiot nuk shohin të dhënat e njëra-tjetrës
  if (!db.prepare("SELECT id FROM orgs WHERE name='Studio Demo Durrës'").get()) {
    const o = db.prepare("INSERT INTO orgs (name, nipt, plan_code, va_credits, created_by) VALUES ('Studio Demo Durrës','L11111111A','profesional',300,?)").run(ownerId).lastInsertRowid;
    const ins = db.prepare("INSERT INTO subjects (name,nipt,ealbania_user,ealbania_pass,status,created_by,org_id) VALUES (?,?,?,?,'active',?,?)");
    ins.run('Port Shipping SH.P.K.', 'K22222222B', 'K22222222B', encrypt('demo-fjalekalim'), ownerId, o);
    ins.run('Plazh Hotel', 'L33333333C', 'L33333333C', encrypt('demo-fjalekalim'), ownerId, o);
  }
}

console.log('\n  Të dhënat u mbollën me sukses.\n');
// Në prodhim fjalëkalimet nuk shkruhen kurrë në log-e
const show = p => (PROD ? '(nga OWNER_PASS / ADMIN_PASS)' : p);
console.log('  OWNER (i fshehtë):  ' + OWNER_EMAIL + '  /  ' + show(OWNER_PASS));
if (ADMIN_PASS) console.log('  ADMIN:              ' + ADMIN_EMAIL + '  /  ' + show(ADMIN_PASS));
if (DEMO) {
  console.log('  STUDIO (admin):     ' + STUDIO_EMAIL + '  /  ' + STUDIO_PASS);
  console.log('  KLIENT (portali):   ' + CLIENT_EMAIL + '  /  ' + CLIENT_PASS);
}
console.log('');
