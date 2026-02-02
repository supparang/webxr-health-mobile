// === /fitness/js/event-logger.js ===
// Event-level CSV logger (Shadow Breaker)
// ✅ Export: EventLogger (named) + downloadEventCsv()
// ✅ Rows are flexible objects; header is from first row keys
// NOTE: Keep lightweight, no deps

'use strict';

function escCsv(v){
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g,'""')}"`;
  return s;
}

export class EventLogger {
  constructor() {
    /**
     * เก็บ log ราย event
     * ตัวอย่าง 1 แถว:
     * {
     *   ts_ms, mode, diff,
     *   boss_index, boss_phase,
     *   target_id, target_type, is_boss_face,
     *   event_type, rt_ms, grade,
     *   score_delta, combo_after, score_after,
     *   player_hp, boss_hp,
     *   ...อื่น ๆ ตามที่ engine ใส่มา
     * }
     */
    this.logs = [];
  }

  /**
   * เพิ่ม 1 event row
   * @param {Object} row
   */
  add(row) {
    if (!row || typeof row !== 'object') return;
    this.logs.push(row);
  }

  /**
   * ล้างข้อมูลทั้งหมด (ใช้กรณีเริ่ม session ใหม่)
   */
  clear() {
    this.logs.length = 0;
  }

  /**
   * แปลง logs → CSV text
   * - ใช้ key ของแถวแรกเป็น header (เรียงตาม Object.keys)
   * - ถ้าแถวหลัง ๆ มี key เพิ่ม/ลด จะดึงเฉพาะคอลัมน์ที่อยู่ใน header
   * - ค่า null/undefined → ""
   */
  toCsv() {
    if (!this.logs.length) return '';

    // ใช้ key ของ log แถวแรกเป็นคอลัมน์หลัก
    const cols = Object.keys(this.logs[0]);

    const lines = [];
    // header
    lines.push(cols.join(','));

    // rows
    for (const row of this.logs) {
      const line = cols.map(col => escCsv(row[col]));
      lines.push(line.join(','));
    }

    return lines.join('\n');
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
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download event CSV failed', err);
    alert('ไม่สามารถดาวน์โหลดไฟล์ CSV (event) ได้');
  }
}