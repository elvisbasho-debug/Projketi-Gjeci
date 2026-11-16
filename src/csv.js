'use strict';

// CSV i thjeshtë: lexim (mbështet thonjëza) dhe shkrim me BOM për Excel.

function parseLine(line, sep = ',') {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else { if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ''; } else cur += c; }
  }
  out.push(cur); return out.map(s => s.trim());
}

function parse(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  return lines.map(l => parseLine(l, sep));
}

const cell = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
function build(header, rows) {
  return '﻿' + [header, ...rows].map(r => r.map(cell).join(',')).join('\n');
}

module.exports = { parse, build };
