// === /fitness/js/session-logger.js ===
// Session summary logger (single-row CSV)
// ✅ Export: SessionLogger

'use strict';

function csvEscape(v){
  const s = String(v ?? '');
  if (/[\",\\n]/.test(s)) return '\"' + s.replace(/\"/g,'\"\"') + '\"';
  return s;
}

export class SessionLogger {
  constructor(){
    this.reset();
  }

  reset(){
    this.meta = {};
    this.summary = {};
  }

  setMeta(meta = {}){
    this.meta = Object.assign({}, this.meta, meta||{});
  }

  setSummary(sum = {}){
    this.summary = Object.assign({}, this.summary, sum||{});
  }

  toCSV(){
    const row = Object.assign({}, this.meta||{}, this.summary||{});
    const cols = Object.keys(row);
    const head = cols.map(csvEscape).join(',');
    const body = cols.map(k => csvEscape(row[k])).join(',');
    return head + '\\n' + body;
  }
}