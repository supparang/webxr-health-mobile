// === /fitness/js/event-logger.js ===
'use strict';

export class EventLogger {
  constructor() {
    this.logs = [];
  }

  add(row) {
    if (!row || typeof row !== 'object') return;
    this.logs.push(row);
  }

  clear() {
    this.logs.length = 0;
  }

  toCsv() {
    if (!this.logs.length) return '';

    const cols = Object.keys(this.logs[0]);

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
    for (const row of this.logs) {
      lines.push(cols.map(c => esc(row[c])).join(','));
    }
    return lines.join('\n');
  }
}