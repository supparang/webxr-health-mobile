// === /fitness/js/feature-logger.js — Feature-level CSV logger (1Hz) ===
'use strict';

export class FeatureLogger {
  constructor(){
    this.rows = [];
  }
  add(row){
    if (!row || typeof row !== 'object') return;
    this.rows.push(row);
  }
  clear(){ this.rows.length = 0; }
  toCsv(){
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
    for (const r of this.rows){
      lines.push(cols.map(c => esc(r[c])).join(','));
    }
    return lines.join('\n');
  }
}