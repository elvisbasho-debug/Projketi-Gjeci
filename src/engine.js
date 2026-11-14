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
  const sim = profiles.simulate(service.code);
  return { ok: sim.ok, process_ms: rnd(8000, 20000), result: sim.result, status: sim.ok ? sim.status : 'deshtoi', data: sim.data };
}

async function processOne(execId) {
  running++;
  const ex = db.prepare('SELECT * FROM executions WHERE id=?').get(execId);
  if (!ex) { running--; return; }
  const service = db.prepare('SELECT * FROM services WHERE id=?').get(ex.service_id);
  const subject = db.prepare('SELECT * FROM subjects WHERE id=?').get(ex.subject_id);

  db.prepare("UPDATE executions SET status='ne_ekzekutim', started_at=datetime('now'), attempts=attempts+1 WHERE id=?").run(execId);
  log(execId, 'info', `Nisi roboti "${service.name}" për subjektin "${subject ? subject.name : '?'}".`);

  if (subject && !subject.ealbania_pass) {
    log(execId, 'warn', 'Subjekti nuk ka fjalëkalim e-Albania të ruajtur — përdoret modaliteti i simuluar.');
  }

  try {
    // Zgjidh konektorin real nëse ekziston, përndryshe simulim.
    const connector = robots[service.code];
    let out;
    if (connector && typeof connector.run === 'function') {
      // Konektori real merr kredencialet e dekriptuara.
      const creds = subject ? { user: subject.ealbania_user, pass: decrypt(subject.ealbania_pass) } : {};
      out = await connector.run(subject, creds, service);
    } else {
      out = await runRobotSimulated(service, subject);
    }

    const finalStatus = out.ok ? 'kryer' : 'deshtoi';
    db.prepare("UPDATE executions SET status=?, process_ms=?, result=?, finished_at=datetime('now') WHERE id=?")
      .run(finalStatus, out.process_ms || null, out.result || null, execId);
    log(execId, out.ok ? 'info' : 'error', out.result || (out.ok ? 'Përfundoi.' : 'Dështoi.'));

    // Përditëso rekordin subjekt×shërbim
    if (subject) {
      const recStatus = out.status || finalStatus;
      db.prepare(`
        INSERT INTO service_records (service_id, subject_id, status, result, data, updated_at)
        VALUES (?,?,?,?,?,datetime('now'))
        ON CONFLICT(service_id, subject_id) DO UPDATE SET status=excluded.status, result=excluded.result, data=excluded.data, updated_at=datetime('now')
      `).run(ex.service_id, ex.subject_id, recStatus, out.result || null, JSON.stringify(out.data || {}));
    }

    // Njoftim automatik kur ekzekutimi dështon
    if (!out.ok) {
      db.prepare("INSERT INTO notifications (title, body, level) VALUES (?,?,?)").run(
        'Ekzekutim i dështuar',
        `${service.name} — ${subject ? subject.name : ''}: ${out.result || 'gabim'}`,
        'error'
      );
    }
  } catch (e) {
    db.prepare("UPDATE executions SET status='deshtoi', result=?, finished_at=datetime('now') WHERE id=?").run(String(e.message || e), execId);
    log(execId, 'error', 'Gabim: ' + (e.message || e));
  } finally {
    running--;
  }
}

function tick() {
  if (running >= CONCURRENCY) return;
  const slots = CONCURRENCY - running;
  const pending = db.prepare("SELECT id FROM executions WHERE status='ne_radhe' ORDER BY id LIMIT ?").all(slots);
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
