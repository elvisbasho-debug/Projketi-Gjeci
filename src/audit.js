'use strict';

const db = require('./db');

const stmt = db.prepare(`
  INSERT INTO audit_log (user_id, user_name, user_role, action, entity, entity_id, details)
  VALUES (@user_id, @user_name, @user_role, @action, @entity, @entity_id, @details)
`);

// Shkruan një ngjarje në regjistrin e veprimeve.
function log(user, action, entity, entityId, details) {
  try {
    stmt.run({
      user_id: user ? user.id : null,
      user_name: user ? user.name : 'sistem',
      user_role: user ? user.role : null,
      action,
      entity: entity || null,
      entity_id: entityId || null,
      details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
    });
  } catch (e) {
    // mos e bllokon kërkesën nëse dështon logimi
    console.error('audit error:', e.message);
  }
}

module.exports = { log };
