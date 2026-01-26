// === /fitness/js/event-logger.js — Event-level CSV logger (stable columns) ===
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

    // ✅ stable columns union
    const colSet = new Set();
    for (const r of this.logs) Object.keys(r).forEach(k => colSet.add(k));
    const cols = Array.from(colSet);

    const esc = (v) => {
      const s = (v === null || v === undefined) ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const head = cols.join(',');
    const lines = this.logs.map(r => cols.map(c => esc(r[c])).join(','));
    return [head, ...lines].join('\n');
  }
}