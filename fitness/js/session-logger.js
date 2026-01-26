// === /fitness/js/session-logger.js ===
// Session-level CSV logger (Shadow Breaker) — FIXED export: SessionLogger
'use strict';

export class SessionLogger {
  constructor() {
    this.rows = [];
  }

  add(row) {
    if (!row || typeof row !== 'object') return;
    this.rows.push(row);
  }

  clear() {
    this.rows.length = 0;
  }

  toCsv() {
    if (!this.rows.length) return '';
    const cols = Object.keys(this.rows[0]);

    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const lines = [];
    lines.push(cols.join(','));
    for (const row of this.rows) {
      lines.push(cols.map(c => esc(row[c])).join(','));
    }
    return lines.join('\n');
  }
}