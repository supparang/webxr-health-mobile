// === /fitness/js/session-logger.js — Session CSV logger (PATCH 2026-01-27) ===
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

    // รวมคอลัมน์ให้ “นิ่ง” แม้บาง row จะมี field เพิ่ม/หาย
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

/**
 * helper: ดาวน์โหลด CSV (session-level)
 * @param {string} filename
 * @param {string} csvText
 */
export function downloadSessionCsv(filename, csvText) {
  try {
    if (!csvText) {
      alert('ยังไม่มีข้อมูลให้ดาวน์โหลด');
      return;
    }
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'shadow-breaker-session.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  } catch (err) {
    console.error('Download session CSV failed', err);
    alert('ไม่สามารถดาวน์โหลดไฟล์ CSV (session) ได้');
  }
}