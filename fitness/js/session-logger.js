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

export class SessionLogger {
  constructor(meta = {}) {
    this.meta = meta;
    this.summary = null;
  }

  setSummary(obj){
    this.summary = obj || null;
  }

  downloadCsv(prefix='session'){
    const name = `${prefix}_${Date.now()}.csv`;
    const row = { ...this.meta, ...(this.summary || {}) };
    dlText(name, toCsv([row]));
  }
}