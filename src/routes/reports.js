'use strict';

const express = require('express');
const db = require('../db');
const { requireRole } = require('../auth');

const router = express.Router();

// Përmbledhja e panelit kryesor
router.get('/dashboard', requireRole('viewer'), (req, res) => {
  const servicesTotal = db.prepare('SELECT COUNT(*) c FROM services').get().c;
  const servicesActive = db.prepare('SELECT COUNT(*) c FROM service_quotas WHERE active=1').get().c;
  const subjects = db.prepare('SELECT COUNT(*) c FROM subjects').get().c;
  const usage = db.prepare('SELECT COALESCE(SUM(used),0) used, COALESCE(SUM(max_limit),0) max FROM service_quotas').get();

  const execs = {};
  db.prepare('SELECT status, COUNT(*) c FROM executions GROUP BY status').all().forEach(r => execs[r.status] = r.c);

  const recent = db.prepare(`
    SELECT r.status, r.updated_at, sub.id AS subject_id, sub.name AS subject_name, sv.id AS service_id, sv.name AS service_name
    FROM service_records r JOIN subjects sub ON sub.id=r.subject_id JOIN services sv ON sv.id=r.service_id
    ORDER BY r.updated_at DESC LIMIT 8
  `).all();

  res.json({
    services_total: servicesTotal,
    services_active: servicesActive,
    subjects,
    usage_used: usage.used,
    usage_max: usage.max,
    exec_done: execs['kryer'] || 0,
    exec_queue: (execs['ne_radhe'] || 0) + (execs['ne_ekzekutim'] || 0) + (execs['duke_riprovuar'] || 0),
    exec_failed: execs['deshtoi'] || 0,
    recent,
  });
});

// Regjistri i veprimeve — owner sheh gjithçka; të tjerët nuk shohin veprimet e owner-it.
router.get('/audit', requireRole('admin'), (req, res) => {
  let rows;
  if (req.user.role === 'owner') {
    rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 300').all();
  } else {
    rows = db.prepare("SELECT * FROM audit_log WHERE user_role != 'owner' OR user_role IS NULL ORDER BY id DESC LIMIT 300").all();
  }
  res.json(rows);
});

module.exports = router;
