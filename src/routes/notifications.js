'use strict';

const express = require('express');
const db = require('../db');
const { requireRole } = require('../auth');

const router = express.Router();
// Pas requireOrg: njoftimet e studios aktive.

router.get('/', requireRole('viewer'), (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE org_id=? ORDER BY id DESC LIMIT 100').all(req.orgId);
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE is_read=0 AND org_id=?').get(req.orgId).c;
  res.json({ items: rows, unread, total: rows.length });
});

router.post('/:id/read', requireRole('viewer'), (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND org_id=?').run(req.params.id, req.orgId);
  res.json({ ok: true });
});

router.post('/read-all', requireRole('viewer'), (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE org_id=?').run(req.orgId);
  res.json({ ok: true });
});

module.exports = router;
