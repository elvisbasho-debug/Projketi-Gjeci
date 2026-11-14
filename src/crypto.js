'use strict';

// Enkriptim i kredencialeve të ndjeshme (p.sh. fjalëkalimi e-Albania i subjektit).
// Përdor AES-256-GCM. Çelësi merret nga CRED_KEY (ndryshoje në prodhim!).

const crypto = require('crypto');

const RAW = process.env.CRED_KEY || 'finbot-cred-key-ndrysho-ne-prodhim-32b';
// Normalizo çelësin në 32 byte
const KEY = crypto.createHash('sha256').update(RAW).digest();

function encrypt(plain) {
  if (plain == null || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: iv.tag.payload (base64)
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

function decrypt(blob) {
  if (!blob) return null;
  try {
    const [ivb, tagb, data] = blob.split('.');
    const iv = Buffer.from(ivb, 'base64');
    const tag = Buffer.from(tagb, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]);
    return dec.toString('utf8');
  } catch (e) {
    return null;
  }
}

// A është vendosur një kredencial (pa e zbuluar vlerën)
function isSet(blob) { return !!blob; }

module.exports = { encrypt, decrypt, isSet };
