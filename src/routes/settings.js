'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { requireRole } = require('../auth');

const router = express.Router();

router.get('/company', requireRole('viewer'), (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key='company'").get();
  res.json(row ? JSON.parse(row.value) : {});
});

router.put('/company', requireRole('admin'), (req, res) => {
  const data = req.body || {};
  db.prepare("INSERT INTO settings (key,value) VALUES ('company', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(JSON.stringify(data));
  audit.log(req.user, 'ndryshoi_kompanine', 'settings', null, null);
  res.json({ ok: true });
});

module.exports = router;
