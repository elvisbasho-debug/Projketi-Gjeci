'use strict';

const express = require('express');
const db = require('../db');
const { requireRole } = require('../auth');
const { planInfo, serviceLimit, serviceUsed } = require('../org');

const router = express.Router();
const ORG = 'subject_id IN (SELECT id FROM subjects WHERE org_id = ?)';

// Përmbledhja e panelit kryesor (për studion aktive)
router.get('/dashboard', requireRole('viewer'), (req, res) => {
  const services = db.prepare('SELECT id FROM services').all();
  let used = 0, max = 0, active = 0;
  for (const s of services) { const l = serviceLimit(req.orgId, s.id); max += l.max_limit; used += serviceUsed(req.orgId, s.id); if (l.active) active++; }

  const execs = {};
  db.prepare(`SELECT status, COUNT(*) c FROM executions WHERE ${ORG} GROUP BY status`).all(req.orgId).forEach(r => execs[r.status] = r.c);

  const recent = db.prepare(`
    SELECT r.status, r.updated_at, sub.id AS subject_id, sub.name AS subject_name, sv.id AS service_id, sv.name AS service_name
    FROM service_records r JOIN subjects sub ON sub.id=r.subject_id JOIN services sv ON sv.id=r.service_id
    WHERE sub.org_id = ? ORDER BY r.updated_at DESC LIMIT 8
  `).all(req.orgId);

  res.json({
    services_total: services.length,
    services_active: active,
    subjects: db.prepare('SELECT COUNT(*) c FROM subjects WHERE org_id=?').get(req.orgId).c,
    usage_used: used,
    usage_max: max,
    plan: planInfo(req.orgId),
    exec_done: execs['kryer'] || 0,
    exec_queue: (execs['ne_radhe'] || 0) + (execs['ne_ekzekutim'] || 0) + (execs['duke_riprovuar'] || 0),
    exec_failed: execs['deshtoi'] || 0,
    recent,
  });
});

// Regjistri i veprimeve të studios. Veprimet e owner-it nuk shihen nga askush tjetër.
router.get('/audit', requireRole('studio_admin'), (req, res) => {
  const hideOwner = req.user.role !== 'owner' ? "AND (user_role != 'owner' OR user_role IS NULL)" : '';
  res.json(db.prepare(`SELECT * FROM audit_log WHERE org_id = ? ${hideOwner} ORDER BY id DESC LIMIT 300`).all(req.orgId));
});

module.exports = router;
