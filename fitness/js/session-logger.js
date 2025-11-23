// === js/session-logger.js — Session-level CSV logger ===
'use strict';

export class SessionLogger {
  constructor() {
    this.sessions = [];
  }

  add(row) {
    this.sessions.push(row);
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
      lines.push(cols.map(c => esc(row[c])).join(','));
    }
    return lines.join('\n');
  }
}
