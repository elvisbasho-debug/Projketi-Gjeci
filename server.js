'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { requireAuth } = require('./src/auth');
require('./src/db'); // nis migrimet

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// API
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', requireAuth, require('./src/routes/users'));
app.use('/api/clients', requireAuth, require('./src/routes/clients'));
app.use('/api/products', requireAuth, require('./src/routes/products'));
app.use('/api/invoices', requireAuth, require('./src/routes/invoices'));
app.use('/api/expenses', requireAuth, require('./src/routes/expenses'));
app.use('/api/reports', requireAuth, require('./src/routes/reports'));
app.use('/api/settings', requireAuth, require('./src/routes/settings'));

// Frontend statik
app.use(express.static(path.join(__dirname, 'public')));

// Fallback për SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Nuk u gjet' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Finbot po punon → http://localhost:${PORT}\n`);
});
