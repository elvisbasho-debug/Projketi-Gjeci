'use strict';

const express = require('express');
const db = require('../db');
const audit = require('../audit');
const { requireRole } = require('../auth');
const { planInfo } = require('../org');

const router = express.Router();
// Të dhënat e studios aktive (pas requireOrg). Plani ndryshohet vetëm nga platforma (faqja "Studiot").

router.get('/company', requireRole('viewer'), (req, res) => {
  const o = req.org;
  res.json({ id: o.id, name: o.name, nipt: o.nipt, address: o.address, phone: o.phone, email: o.email,
    currency: o.currency || 'Lek', va_credits: o.va_credits, plan: planInfo(o) });
});

router.put('/company', requireRole('studio_admin'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'Emri i studios është i detyrueshëm' });
  db.prepare('UPDATE orgs SET name=?, nipt=?, address=?, phone=?, email=?, currency=? WHERE id=?')
    .run(String(b.name).trim(), b.nipt || null, b.address || null, b.phone || null, b.email || null, b.currency || 'Lek', req.orgId);
  audit.log(req.user, 'ndryshoi_studion', 'orgs', req.orgId, null);
  res.json({ ok: true });
});

/* ---- Faturat e abonimit të studios (vetëm lexim + PDF) ---- */
const billing = require('../billing');
const { htmlToPdf, buildInvoiceDoc } = require('../pdf');

router.get('/invoices', requireRole('studio_admin'), (req, res) => {
  res.json(db.prepare('SELECT * FROM invoices WHERE org_id=? AND status != ? ORDER BY id DESC').all(req.orgId, 'anuluar')
    .map(i => ({ ...i, display_status: billing.displayStatus(i) })));
});

router.get('/invoices/:id/pdf', requireRole('studio_admin'), async (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id=? AND org_id=?').get(req.params.id, req.orgId);
  if (!inv) return res.status(404).json({ error: 'Fatura nuk u gjet' });
  try {
    const pdf = await htmlToPdf(buildInvoiceDoc(billing.issuer(), req.org, { ...inv, display_status: billing.displayStatus(inv) }));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${inv.number}.pdf"`);
    res.send(pdf);
  } catch (e) { res.status(500).json({ error: 'Gabim gjatë gjenerimit të PDF: ' + e.message }); }
});

module.exports = router;
