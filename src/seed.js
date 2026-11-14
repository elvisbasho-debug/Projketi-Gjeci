'use strict';

// Mbjell: owner/admin + subjekte demo + rekorde + pak ekzekutime të kryera.
// Ekzekuto: npm run seed

const db = require('./db');
const { hashPassword } = require('./auth');
const { encrypt } = require('./crypto');
const profiles = require('./profiles');

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@finbot.al';
const OWNER_PASS = process.env.OWNER_PASS || 'Owner1234!';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@finbot.al';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Admin1234!';

function upsertUser(name, email, pass, role, createdBy) {
  const ex = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (ex) return ex.id;
  return db.prepare('INSERT INTO users (name,email,password_hash,role,created_by) VALUES (?,?,?,?,?)')
    .run(name, email, hashPassword(pass), role, createdBy || null).lastInsertRowid;
}

const ownerId = upsertUser('Pronari', OWNER_EMAIL, OWNER_PASS, 'owner', null);
const adminId = upsertUser('Administratori', ADMIN_EMAIL, ADMIN_PASS, 'admin', ownerId);

// Subjekte demo
if (db.prepare('SELECT COUNT(*) c FROM subjects').get().c === 0) {
  const DEMO = [
    ['Alfa Trading SH.P.K.', 'K12345678L'],
    ['Beta Market SH.P.K.', 'L87654321M'],
    ['Gamma Konsulencë', 'M11223344N'],
    ['Delta Ndërtim', 'K55667788O'],
    ['Epsilon Services', 'L99887766P'],
    ['Zeta Logjistikë', 'M44556677Q'],
  ];
  const ins = db.prepare('INSERT INTO subjects (name,nipt,ealbania_user,ealbania_pass,status,created_by) VALUES (?,?,?,?,?,?)');
  DEMO.forEach(([name, nipt]) => ins.run(name, nipt, nipt, encrypt('demo-fjalekalim'), 'active', adminId));

  const subjects = db.prepare('SELECT id FROM subjects').all();
  const services = db.prepare('SELECT id, code FROM services').all();

  // Rekorde + disa ekzekutime të kryera për të pasur të dhëna në panel/automatizim
  const insRec = db.prepare(`INSERT INTO service_records (service_id, subject_id, status, result, data) VALUES (?,?,?,?,?)`);
  const insExec = db.prepare(`INSERT INTO executions (service_id, subject_id, status, attempts, wait_ms, process_ms, result, run_by, started_at, finished_at)
    VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`);
  const insLog = db.prepare(`INSERT INTO execution_logs (execution_id, level, message) VALUES (?,?,?)`);

  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  for (const svc of services) {
    // zë ~4 subjekte për shërbim
    const used = Math.min(subjects.length, rnd(2, subjects.length));
    for (let i = 0; i < used; i++) {
      const sub = subjects[i];
      const sim = profiles.simulate(svc.code);
      insRec.run(svc.id, sub.id, sim.status, sim.result, JSON.stringify(sim.data));
      const ex = insExec.run(svc.id, sub.id, sim.ok ? 'kryer' : 'deshtoi', 1, rnd(0, 60000), rnd(8000, 20000), sim.result, 'admin@finbot.al');
      insLog.run(ex.lastInsertRowid, 'info', 'Nisi ekzekutimi i robotit.');
      insLog.run(ex.lastInsertRowid, sim.ok ? 'info' : 'error', sim.ok ? 'Të dhënat u përpunuan me sukses.' : 'Dështoi lidhja me portalin.');
    }
    // përditëso kuotën
    db.prepare('UPDATE service_quotas SET used=? WHERE service_id=?').run(used, svc.id);
  }

  // Një njoftim mirëseardhjeje
  db.prepare("INSERT INTO notifications (title, body, level) VALUES (?,?,?)")
    .run('Mirë se vini në Finbot', 'Platforma u konfigurua. Shtoni subjektet dhe nisni shërbimet.', 'info');
}

console.log('\n  Të dhënat u mbollën me sukses.\n');
console.log('  OWNER (i fshehtë):  ' + OWNER_EMAIL + '  /  ' + OWNER_PASS);
console.log('  ADMIN:              ' + ADMIN_EMAIL + '  /  ' + ADMIN_PASS + '\n');
