'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { requireAuth } = require('./src/auth');
const db = require('./src/db'); // nis migrimet
const engine = require('./src/engine');

// Siguria në prodhim: kërko sekrete të forta.
if (process.env.NODE_ENV === 'production') {
  const missing = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.CRED_KEY) missing.push('CRED_KEY');
  if (missing.length) {
    console.error('GABIM: në prodhim duhet të vendosni: ' + missing.join(', ') +
      '\n  Gjenero: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    process.exit(1);
  }
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Health check (pa autentikim)
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// API
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', requireAuth, require('./src/routes/users'));
app.use('/api/subjects', requireAuth, require('./src/routes/subjects'));
app.use('/api/services', requireAuth, require('./src/routes/services'));
app.use('/api/executions', requireAuth, require('./src/routes/executions'));
app.use('/api/notifications', requireAuth, require('./src/routes/notifications'));
app.use('/api/tickets', requireAuth, require('./src/routes/tickets'));
app.use('/api/va', requireAuth, require('./src/routes/va'));
app.use('/api/reports', requireAuth, require('./src/routes/reports'));
app.use('/api/settings', requireAuth, require('./src/routes/settings'));
app.use('/api/client', requireAuth, require('./src/routes/client'));   // portali i klientit (TVSH në kohë reale)

// Frontend statik
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Nuk u gjet' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Mbjell automatikisht nëse baza është bosh (në prodhim kërkon OWNER_PASS).
try {
  const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (userCount === 0) {
    if (process.env.NODE_ENV === 'production' && !process.env.OWNER_PASS) {
      console.warn('  Baza është bosh. Vendos OWNER_PASS/ADMIN_PASS dhe ekzekuto: node src/seed.js');
    } else {
      require('./src/seed');
    }
  }
} catch (e) { console.error('seed check:', e.message); }

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Finbot po punon → http://localhost:${PORT}`);
  engine.start();
});
