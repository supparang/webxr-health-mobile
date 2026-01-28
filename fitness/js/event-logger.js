// === /fitness/js/event-logger.js — Event-level CSV logger (PATCH 2026-01-27) ===
'use strict';

export class EventLogger {
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

    // ✅ ทำคอลัมน์ให้ “นิ่ง” โดย union keys ทุกแถว (กัน field เพิ่ม/หาย)
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
 * helper สำหรับดาวน์โหลดไฟล์ CSV event-level
 * @param {string} filename
 * @param {string} csvText
 */
export function downloadCsv(filename, csvText) {
  if (!csvText) {
    alert('ยังไม่มีข้อมูลให้ดาวน์โหลด');
    return;
  }
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'events.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}