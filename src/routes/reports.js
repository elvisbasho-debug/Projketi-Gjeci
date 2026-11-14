'use strict';

const express = require('express');
const db = require('../db');
const { requireRole } = require('../auth');

const router = express.Router();

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// Përmbledhje për panelin kryesor
router.get('/dashboard', requireRole('viewer'), (req, res) => {
  const clients = db.prepare('SELECT COUNT(*) c FROM clients').get().c;
  const invoices = db.prepare('SELECT COUNT(*) c FROM invoices').get().c;

  const income = db.prepare(`
    SELECT COALESCE(SUM(quantity*unit_price),0) net,
           COALESCE(SUM(quantity*unit_price*vat_rate/100),0) vat
    FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
    WHERE i.status = 'paid'
  `).get();

  const outstanding = db.prepare(`
    SELECT COALESCE(SUM(quantity*unit_price*(1+vat_rate/100)),0) total
    FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
    WHERE i.status IN ('sent','overdue')
  `).get().total;

  const expenses = db.prepare(`SELECT COALESCE(SUM(amount),0) net, COALESCE(SUM(amount*vat_rate/100),0) vat FROM expenses`).get();

  const byStatus = db.prepare(`SELECT status, COUNT(*) c FROM invoices GROUP BY status`).all();

  // TVSH: e mbledhur (shitje të paguara) minus e zbritshme (shpenzime)
  const vatCollected = income.vat;
  const vatDeductible = expenses.vat;

  res.json({
    clients,
    invoices,
    income_net: round2(income.net),
    income_total: round2(income.net + income.vat),
    outstanding: round2(outstanding),
    expenses_net: round2(expenses.net),
    profit: round2(income.net - expenses.net),
    vat_collected: round2(vatCollected),
    vat_deductible: round2(vatDeductible),
    vat_due: round2(vatCollected - vatDeductible),
    by_status: byStatus,
  });
});

// Të ardhurat muaj pas muaji (12 muajt e fundit) për grafik
router.get('/monthly', requireRole('viewer'), (req, res) => {
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', i.issue_date) ym,
           COALESCE(SUM(quantity*unit_price),0) net
    FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
    WHERE i.status IN ('paid','sent','overdue')
    GROUP BY ym ORDER BY ym DESC LIMIT 12
  `).all().reverse();
  res.json(rows.map(r => ({ ...r, net: round2(r.net) })));
});

// Deklarata e TVSH për një periudhë
router.get('/vat', requireRole('accountant'), (req, res) => {
  const from = req.query.from || '0000-01-01';
  const to = req.query.to || '9999-12-31';
  const sales = db.prepare(`
    SELECT COALESCE(SUM(quantity*unit_price),0) net, COALESCE(SUM(quantity*unit_price*vat_rate/100),0) vat
    FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id
    WHERE i.issue_date BETWEEN ? AND ? AND i.status != 'cancelled' AND i.status != 'draft'
  `).get(from, to);
  const purchases = db.prepare(`
    SELECT COALESCE(SUM(amount),0) net, COALESCE(SUM(amount*vat_rate/100),0) vat
    FROM expenses WHERE date BETWEEN ? AND ?
  `).get(from, to);
  res.json({
    from, to,
    sales_net: round2(sales.net), sales_vat: round2(sales.vat),
    purchases_net: round2(purchases.net), purchases_vat: round2(purchases.vat),
    vat_due: round2(sales.vat - purchases.vat),
  });
});

// Regjistri i veprimeve (audit). Owner-i sheh gjithçka; të tjerët nuk shohin veprimet e owner- it.
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
