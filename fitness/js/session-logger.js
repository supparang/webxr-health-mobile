// === js/session-logger.js — Session-level CSV logger (FIXED export) ===
'use strict';

export class SessionLogger {
  constructor() { this.logs = []; }
  add(row) { if (row && typeof row === 'object') this.logs.push(row); }
  clear() { this.logs.length = 0; }
  toCsv() {
    if (!this.logs.length) return '';
    const cols = Object.keys(this.logs[0]);
    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [cols.join(',')];
    for (const row of this.logs) lines.push(cols.map(c => esc(row[c])).join(','));
    return lines.join('\n');
  }
}