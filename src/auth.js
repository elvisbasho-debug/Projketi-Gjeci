'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'finbot-dev-secret-ndrysho-ne-prodhim';
const TOKEN_TTL = '7d';

// Hierarkia e roleve (sa më i lartë numri, aq më shumë të drejta)
// client (portali i biznesit) = 0 → nuk kalon asnjë kontroll roli të studios.
// studio_admin menaxhon studion e vet; admin/owner janë të platformës.
const ROLE_LEVEL = { client: 0, viewer: 1, accountant: 2, studio_admin: 3, admin: 4, owner: 5 };

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Merr token-in nga cookie ose Authorization header
function getToken(req) {
  if (req.cookies && req.cookies.token) return req.cookies.token;
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

// Middleware: kërkon përdorues të loguar
function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'I paautorizuar' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, name, email, role, status, subject_id, org_id, active_org_id FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'Përdoruesi nuk ekziston' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Llogaria juaj është pezulluar' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesion i pavlefshëm' });
  }
}

// Middleware: kërkon rol minimal
function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'I paautorizuar' });
    if ((ROLE_LEVEL[req.user.role] || 0) < (ROLE_LEVEL[minRole] ?? 99)) {
      return res.status(403).json({ error: 'Nuk keni të drejta të mjaftueshme' });
    }
    next();
  };
}

function isOwner(user) {
  return user && user.role === 'owner';
}

module.exports = {
  JWT_SECRET,
  ROLE_LEVEL,
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
  requireRole,
  isOwner,
};
