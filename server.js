'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { requireAuth } = require('./src/auth');
require('./src/db'); // nis migrimet
const engine = require('./src/engine');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

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

// Frontend statik
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Nuk u gjet' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Finbot po punon → http://localhost:${PORT}`);
  engine.start();
});
