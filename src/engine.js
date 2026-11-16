'use strict';

/*
  MOTORI I ROBOTËVE (automatizimi)
  ---------------------------------
  Përpunon radhën e ekzekutimeve: ne_radhe → ne_ekzekutim → kryer/deshtoi.
  Tani ekzekutimi është i SIMULUAR, që platforma të punojë fund-e-krye.

  Për robotë REALË: zëvendëso funksionin runRobot() me konektorin përkatës
  (p.sh. automatizim browseri me Playwright që logohet në e-Albania/Self-Care
  me kredencialet e subjektit dhe kryen deklarimin). Çdo shërbim mund të ketë
  modulin e vet te src/robots/<code>.js me një funksion run(subject) → {ok, result, data}.
*/

const db = require('./db');
const { decrypt } = require('./crypto');
const profiles = require('./profiles');
const { schemaFor } = require('./service-schema');

let robots = {};
try { robots = require('./robots'); } catch (e) { robots = {}; }

const CONCURRENCY = 3;
let running = 0;
let timer = null;

function log(execId, level, msg) {
  db.prepare('INSERT INTO execution_logs (execution_id, level, message) VALUES (?,?,?)').run(execId, level, msg);
}

// Konektori i parazgjedhur: i simuluar. Kthen sukses ~85% të rasteve.
async function runRobotSimulated(service, subject) {
  const rnd = profiles.rnd;
  await new Promise(r => setTimeout(r, 2000 + Math.random() * 4000)); // simulim i shkurtuar
  // ~10% dështim i rastësishëm (lidhje/portal), përndryshe profili i shërbimit.
  if (Math.random() < 0.1) {
    return { ok: false, process_ms: rnd(8000, 20000), result: 'Dështoi — gabim gjatë lidhjes me portalin', status: 'deshtoi', data: {} };
  }
  const sim = profiles.simulate(service.code, service.__action);
  return { ok: sim.ok, process_ms: rnd(8000, 20000), result: sim.result, status: sim.ok ? sim.status : 'deshtoi', data: sim.data };
}

async function processOne(execId) {
  running++;
  const ex = db.prepare('SELECT * FROM executions WHERE id=?').get(execId);
  if (!ex) { running--; return; }
  const service = db.prepare('SELECT * FROM services WHERE id=?').get(ex.service_id);
  const subject = db.prepare('SELECT * FROM subjects WHERE id=?').get(ex.subject_id);

  db.prepare(`UPDATE executions SET status='ne_ekzekutim', started_at=datetime('now'), attempts=attempts+1,
    wait_ms=CAST((julianday('now')-julianday(created_at))*86400000 AS INTEGER) WHERE id=?`).run(execId);
  const schema = schemaFor(service.code);
  const act = ex.action ? schema.actions.find(a => a.key === ex.action) : null;
  service.__action = ex.action || null;
  log(execId, 'info', `Nisi roboti "${service.name}"${act ? ' — ' + act.label : ''} për subjektin "${subject ? subject.name : '?'}".`);

  const connector = robots[service.code];
  if (!connector) log(execId, 'info', 'Modalitet i simuluar: konektori real për këtë shërbim nuk është aktiv.');

  try {
    // Zgjidh konektorin real nëse ekziston, përndryshe simulim.
    let out;
    if (connector && typeof connector.run === 'function') {
      // Konektori real merr kredencialet e dekriptuara dhe shkruan hapat e vet në regjistër.
      const creds = subject ? { user: subject.ealbania_user || subject.nipt, pass: subject.ealbania_pass ? decrypt(subject.ealbania_pass) : null } : {};
      out = await connector.run(subject, creds, service, ex.action || null, { log: (level, _code, msg) => log(execId, level, msg) });
    } else {
      out = await runRobotSimulated(service, subject);
    }

    // Ekzekutimi mund të jetë ndaluar ndërkohë nga përdoruesi → mos e mbishkruaj
    if (db.prepare('SELECT status FROM executions WHERE id=?').get(execId).status === 'anuluar') {
      db.prepare("UPDATE client_requests SET status='anuluar' WHERE execution_id=?").run(execId);
      return;
    }
    const finalStatus = out.ok ? 'kryer' : 'deshtoi';
    db.prepare("UPDATE executions SET status=?, process_ms=?, result=?, finished_at=datetime('now') WHERE id=?")
      .run(finalStatus, out.process_ms || null, out.result || null, execId);
    log(execId, out.ok ? (out.status === 'deklaruar' || out.status === 'kryer' ? 'success' : 'info') : 'error', out.result || (out.ok ? 'Përfundoi.' : 'Dështoi.'));

    // Përditëso rekordin subjekt×shërbim (të dhënat e reja BASHKOHEN me ato ekzistuese)
    if (subject) {
      const recStatus = out.status || finalStatus;
      const prev = db.prepare('SELECT data, period_from FROM service_records WHERE service_id=? AND subject_id=?').get(ex.service_id, ex.subject_id);
      const merged = { ...(prev && prev.data ? JSON.parse(prev.data) : {}), ...(out.data || {}) };
      db.prepare(`
        INSERT INTO service_records (service_id, subject_id, status, result, data, updated_at)
        VALUES (?,?,?,?,?,datetime('now'))
        ON CONFLICT(service_id, subject_id) DO UPDATE SET status=excluded.status, result=excluded.result, data=excluded.data, updated_at=datetime('now')
      `).run(ex.service_id, ex.subject_id, recStatus, out.result || null, JSON.stringify(merged));
      const period = (prev && prev.period_from ? prev.period_from : new Date().toISOString()).slice(0, 7);
      db.prepare('INSERT INTO record_history (service_id, subject_id, period, action, status, result, data) VALUES (?,?,?,?,?,?,?)')
        .run(ex.service_id, ex.subject_id, period, ex.action || null, recStatus, out.result || null, JSON.stringify(out.data || {}));
      // Historik shtesë nga portali (p.sh. TVSH e paguar sipas periudhave) → zëvendëson të njëjtën periudhë
      if (Array.isArray(out.history) && out.history.length) {
        const del = db.prepare("DELETE FROM record_history WHERE service_id=? AND subject_id=? AND period=? AND action='portal_ledger'");
        const ins = db.prepare("INSERT INTO record_history (service_id, subject_id, period, action, status, result, data) VALUES (?,?,?,'portal_ledger','kryer',?,?)");
        db.transaction(() => out.history.forEach(h => { del.run(ex.service_id, ex.subject_id, h.period); ins.run(ex.service_id, ex.subject_id, h.period, 'Nga libri i portalit', JSON.stringify(h.data || {})); }))();
      }
    }
    // Kërkesat e klientit të lidhura me këtë ekzekutim
    db.prepare("UPDATE client_requests SET status=?, result=?, data=?, finished_at=datetime('now') WHERE execution_id=?")
      .run(finalStatus, out.result || null, JSON.stringify(out.data || {}), execId);

    // Njoftim automatik kur ekzekutimi dështon
    if (!out.ok) {
      db.prepare("INSERT INTO notifications (title, body, level, org_id) VALUES (?,?,?,?)").run(
        'Ekzekutim i dështuar',
        `${service.name} — ${subject ? subject.name : ''}: ${out.result || 'gabim'}`,
        'error', subject ? subject.org_id : null
      );
    }
  } catch (e) {
    db.prepare("UPDATE executions SET status='deshtoi', result=?, finished_at=datetime('now') WHERE id=?").run(String(e.message || e), execId);
    log(execId, 'error', 'Gabim: ' + (e.message || e));
    db.prepare("UPDATE client_requests SET status='deshtoi' WHERE execution_id=?").run(execId);
  } finally {
    running--;
  }
}

function tick() {
  if (running >= CONCURRENCY) return;
  const slots = CONCURRENCY - running;
  // Kërkesat nga portali i klientit kanë përparësi (klienti pret para ekranit)
  const pending = db.prepare("SELECT id FROM executions WHERE status='ne_radhe' ORDER BY (run_by LIKE 'klient:%') DESC, id LIMIT ?").all(slots);
  for (const p of pending) {
    // shëno menjëherë që të mos merret dy herë
    db.prepare("UPDATE executions SET status='duke_riprovuar' WHERE id=? AND status='ne_radhe'").run(p.id);
    processOne(p.id);
  }
}

function start() {
  if (timer) return;
  // rikthe çdo ekzekutim të ngecur në 'ne_ekzekutim' nga një rinisje serveri
  db.prepare("UPDATE executions SET status='ne_radhe' WHERE status IN ('ne_ekzekutim','duke_riprovuar')").run();
  timer = setInterval(tick, 1500);
  console.log('  Motori i automatizimit u nis.');
}

module.exports = { start };
