// === /fitness/js/event-logger.js — Event-level CSV logger (Shadow Breaker) (PATCH 2026-01-27) ===
'use strict';

export class EventLogger {
  constructor() {
    /**
     * เก็บ log ราย event
     * แถวตัวอย่าง:
     * {
     *   ts_ms, mode, diff,
     *   boss_index, boss_phase,
     *   target_id, target_type, is_boss_face,
     *   event_type, rt_ms, grade,
     *   score_delta, combo_after, score_after,
     *   player_hp, boss_hp,
     *   participant_id, participant_group, participant_note, ...
     * }
     */
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
    for (const r of this.logs) {
      Object.keys(r).forEach(k => colSet.add(k));
    }
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
 * helper: ดาวน์โหลด CSV event-level
 * @param {EventLogger} logger
 * @param {string} filename
 */
export function downloadEventCsv(logger, filename = 'shadow-breaker-events.csv') {
  try {
    if (!logger || typeof logger.toCsv !== 'function') return;
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
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download event CSV failed', err);
    alert('ไม่สามารถดาวน์โหลดไฟล์ CSV (event) ได้');
  }
}