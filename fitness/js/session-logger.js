// === /fitness/js/session-logger.js ===
'use strict';

/**
 * Session-level CSV logger
 * - เก็บ 1 แถวต่อ 1 session (สรุป)
 * - รองรับ export class SessionLogger ตามที่ engine import
 */
export class SessionLogger {
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