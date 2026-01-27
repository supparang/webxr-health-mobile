// === /fitness/js/event-logger.js — Event-level CSV logger (PATCH 2026-01-27) ===
'use strict';

export class EventLogger {
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

    // ✅ รวมคอลัมน์ให้ “นิ่ง” แม้บาง row จะมี field เพิ่ม/หาย
    const colSet = new Set();
    for (const r of this.logs) Object.keys(r).forEach(k => colSet.add(k));
    const cols = Array.from(colSet);

    const esc = (v) => {
      const s = (v === null || v === undefined) ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const head = cols.join(',');
    const lines = this.logs.map(r => cols.map(c => esc(r[c])).join(','));
    return [head, ...lines].join('\n');
  }
}

/**
 * helper สำหรับดาวน์โหลดไฟล์ CSV event-level
 * @param {EventLogger} logger
 * @param {string} filename
 */
export function downloadEventCsv(logger, filename = 'shadow-breaker-events.csv') {
  try {
    if (!logger || typeof logger.toCsv !== 'function') {
      console.warn('[EventLogger] invalid logger for download');
      return;
    }

    const csv = logger.toCsv();
    if (!csv) {
      alert('ยังไม่มีข้อมูลเหตุการณ์ในรอบนี้');
      return;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 0);
  } catch (err) {
    console.error('Download event CSV failed', err);
    alert('ไม่สามารถดาวน์โหลดไฟล์ CSV (event) ได้');
  }
}