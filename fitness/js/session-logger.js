// === /fitness/js/session-logger.js ===
// Session-level CSV logger (Shadow Breaker)
// ✅ Named export: SessionLogger (fixes: "does not provide an export named 'SessionLogger'")

'use strict';

export class SessionLogger {
  constructor() {
    this.sessions = [];
  }

  add(row) {
    if (!row || typeof row !== 'object') return;
    this.sessions.push(row);
  }

  clear() {
    this.sessions.length = 0;
  }

  toCsv() {
    if (!this.sessions.length) return '';

    const cols = Object.keys(this.sessions[0]);

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

    for (const row of this.sessions) {
      lines.push(cols.map(c => esc(row[c])).join(','));
    }

    return lines.join('\n');
  }
}

export function downloadSessionCsv(logger, filename = 'shadow-breaker-session.csv') {
  try {
    if (!logger || typeof logger.toCsv !== 'function') return;

    const csv = logger.toCsv();
    if (!csv) {
      alert('ยังไม่มีข้อมูลสรุปรอบนี้');
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