'use strict';

// Mbjell të dhënat fillestare: owner-i i fshehtë, admin-i, dhe pak demo.
// Ekzekuto: npm run seed

const db = require('./db');
const { hashPassword } = require('./auth');

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@finbot.al';
const OWNER_PASS = process.env.OWNER_PASS || 'Owner1234!';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@finbot.al';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Admin1234!';

function upsertUser(name, email, pass, role, createdBy) {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return exists.id;
  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, created_by) VALUES (?, ?, ?, ?, ?)
  `).run(name, email, hashPassword(pass), role, createdBy || null);
  return info.lastInsertRowid;
}

const ownerId = upsertUser('Pronari', OWNER_EMAIL, OWNER_PASS, 'owner', null);
const adminId = upsertUser('Administratori', ADMIN_EMAIL, ADMIN_PASS, 'admin', ownerId);

// Demo klientë
const clientCount = db.prepare('SELECT COUNT(*) c FROM clients').get().c;
if (clientCount === 0) {
  const ins = db.prepare(`INSERT INTO clients (name, nipt, email, phone, city, created_by) VALUES (?, ?, ?, ?, ?, ?)`);
  ins.run('Alpha Trading SH.P.K.', 'K12345678L', 'info@alpha.al', '+355 69 111 2233', 'Tiranë', adminId);
  ins.run('Beta Market SH.P.K.', 'L87654321M', 'kontakt@beta.al', '+355 68 444 5566', 'Durrës', adminId);
  ins.run('Gamma Konsulencë', 'M11223344N', 'office@gamma.al', '+355 67 777 8899', 'Vlorë', adminId);

  const pins = db.prepare(`INSERT INTO products (name, unit, unit_price, vat_rate, created_by) VALUES (?, ?, ?, ?, ?)`);
  pins.run('Konsulencë financiare (orë)', 'orë', 2500, 20, adminId);
  pins.run('Mbajtje kontabiliteti (muaj)', 'muaj', 15000, 20, adminId);
  pins.run('Deklaratë tatimore', 'copë', 5000, 20, adminId);

  // Një faturë demo
  const inv = db.prepare(`INSERT INTO invoices (number, client_id, issue_date, due_date, status, created_by) VALUES (?, ?, date('now'), date('now','+15 day'), 'sent', ?)`)
    .run('FAT-' + new Date().getFullYear() + '-0001', 1, adminId);
  const iit = db.prepare(`INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, vat_rate) VALUES (?, ?, ?, ?, ?)`);
  iit.run(inv.lastInsertRowid, 'Mbajtje kontabiliteti - Nëntor', 1, 15000, 20);
  iit.run(inv.lastInsertRowid, 'Konsulencë financiare', 4, 2500, 20);

  db.prepare(`INSERT INTO expenses (date, category, supplier, description, amount, vat_rate, created_by) VALUES (date('now'), 'Zyra', 'Vodafone', 'Internet & telefon', 3500, 20, ?)`).run(adminId);
}

console.log('\n  Të dhënat u mbollën me sukses.\n');
console.log('  OWNER (i fshehtë):  ' + OWNER_EMAIL + '  /  ' + OWNER_PASS);
console.log('  ADMIN:              ' + ADMIN_EMAIL + '  /  ' + ADMIN_PASS + '\n');
console.log('  Ndryshoji fjalëkalimet pas hyrjes së parë.\n');
