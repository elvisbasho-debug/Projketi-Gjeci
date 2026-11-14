'use strict';

const express = require('express');
const db = require('../db');
const { requireRole } = require('../auth');

const router = express.Router();

router.get('/', requireRole('viewer'), (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 100').all();
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE is_read=0').get().c;
  res.json({ items: rows, unread, total: rows.length });
});

router.post('/:id/read', requireRole('viewer'), (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/read-all', requireRole('viewer'), (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1').run();
  res.json({ ok: true });
});

module.exports = router;
