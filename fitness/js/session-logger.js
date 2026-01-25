// === js/session-logger.js — Session CSV logger (FIXED export) ===
'use strict';

export class SessionLogger {
  constructor() {
    this.rows = [];
  }

  clear() {
    this.rows.length = 0;
  }

  add(row) {
    if (!row || typeof row !== 'object') return;
    this.rows.push(row);
  }

  toCsv() {
    if (!this.rows.length) return '';

    // รวมคอลัมน์ให้นิ่ง
    const colSet = new Set();
    for (const r of this.rows) Object.keys(r).forEach(k => colSet.add(k));
    const cols = Array.from(colSet);

    const esc = (v) => {
      const s = (v === null || v === undefined) ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const head = cols.join(',');
    const lines = this.rows.map(r => cols.map(c => esc(r[c])).join(','));
    return [head, ...lines].join('\n');
  }
}