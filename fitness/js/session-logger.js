// === fitness/js/session-logger.js ===
// Session-level CSV logger (Shadow Breaker)
'use strict';

export class SessionLogger {
  constructor() {
    this.sessions = [];
  }

  add(row) {
    if (!row || typeof row !== 'object') return;
    this.sessions.push(row);
  }

  clear() {
    this.sessions.length = 0;
  }

  toCsv() {
    if (!this.sessions.length) return '';

    const cols = Object.keys(this.sessions[0]);

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

    for (const row of this.sessions) {
      const line = cols.map(col => esc(row[col]));
      lines.push(line.join(','));
    }

    return lines.join('\n');
  }
}