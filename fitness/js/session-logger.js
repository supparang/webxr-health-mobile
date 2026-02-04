// === /fitness/js/session-logger.js ===
// Session-level CSV logger (Shadow Breaker)
// ✅ EXPORTS: SessionLogger, downloadSessionCsv

'use strict';

export class SessionLogger {
  constructor() {
    this.rows = [];
  }

  add(row) {
    if (!row || typeof row !== 'object') return;
    this.rows.push(row);
  }

  clear() {
    this.rows.length = 0;
  }

  toCsv() {
    if (!this.rows.length) return '';

    // รวมคอลัมน์ทั้งหมดที่เคยโผล่ (กัน key ไม่เท่ากัน)
    const colSet = new Set();
    for (const r of this.rows) Object.keys(r).forEach(k => colSet.add(k));
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
    for (const r of this.rows) {
      lines.push(cols.map(c => esc(r[c])).join(','));
    }
    return lines.join('\n');
  }
}

export function downloadSessionCsv(logger, filename = 'shadow-breaker-session.csv') {
  try {
    if (!logger || typeof logger.toCsv !== 'function') {
      console.warn('[SessionLogger] invalid logger for download');
      return;
    }
    const csv = logger.toCsv();
    if (!csv) {
      alert('ยังไม่มีข้อมูลสรุป session ในรอบนี้');
      return;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download session CSV failed', err);
    alert('ไม่สามารถดาวน์โหลดไฟล์ CSV (session) ได้');
  }
}