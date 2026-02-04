'use strict';

function toCsv(rows){
  const esc = (v)=>{
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const head = keys.map(esc).join(',');
  const body = rows.map(r=>keys.map(k=>esc(r[k])).join(',')).join('\n');
  return head + '\n' + body;
}

function dlText(filename, text){
  const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

export class EventLogger {
  constructor(meta = {}) {
    this.meta = meta;
    this.rows = [];
    this.t0 = performance.now();
  }

  push(type, payload = {}) {
    const t = performance.now() - this.t0;
    this.rows.push({
      t_ms: Math.round(t),
      type,
      ...this.meta,
      payload: JSON.stringify(payload || {})
    });
  }

  downloadCsv(prefix='events'){
    const name = `${prefix}_${Date.now()}.csv`;
    dlText(name, toCsv(this.rows));
  }
}