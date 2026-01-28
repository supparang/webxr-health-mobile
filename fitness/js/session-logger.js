// === /fitness/js/session-logger.js — Session-level CSV logger (Shadow Breaker) ===
'use strict';

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

    // รวมคอลัมน์แบบ "stable" (ไม่พังถ้าบางแถวมี key เพิ่ม)
    const colSet = new Set();
    for (const r of this.logs) Object.keys(r).forEach(k => colSet.add(k));
    const cols = Array.from(colSet);

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

export function downloadSessionCsv(logger, filename='shadow-breaker-session.csv') {
  try {
    if (!logger || typeof logger.toCsv !== 'function') return;
    const csv = logger.toCsv();
    if (!csv) { alert('ยังไม่มีข้อมูล Session ให้ดาวน์โหลด'); return; }
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Download session CSV failed', e);
    alert('ไม่สามารถดาวน์โหลดไฟล์ CSV (session) ได้');
  }
}