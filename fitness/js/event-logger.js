// === /fitness/js/event-logger.js ===
// Event logger (CSV-friendly; in-memory)
// ✅ Export: EventLogger

'use strict';

function csvEscape(v){
  const s = String(v ?? '');
  if (/[\",\\n]/.test(s)) return '\"' + s.replace(/\"/g,'\"\"') + '\"';
  return s;
}

export class EventLogger {
  constructor(){
    this.rows = [];
    this.startTs = Date.now();
  }

  reset(){
    this.rows = [];
    this.startTs = Date.now();
  }

  log(type, data = {}){
    const tMs = Date.now() - this.startTs;
    this.rows.push({
      tMs,
      type: String(type || ''),
      ...data
    });
  }

  toCSV(){
    const rows = this.rows || [];
    const keys = new Set(['tMs','type']);
    for (const r of rows) Object.keys(r||{}).forEach(k=>keys.add(k));
    const cols = Array.from(keys);

    const head = cols.map(csvEscape).join(',');
    const body = rows.map(r => cols.map(k => csvEscape(r[k])).join(',')).join('\\n');
    return head + '\\n' + body;
  }
}