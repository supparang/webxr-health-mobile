// === js/event-logger.js — Event-level CSV logger (Shadow Breaker, 2025-12-04) ===
'use strict';

export class EventLogger {
  constructor() {
    /**
     * เก็บ log ราย event
     * แต่ละแถวเป็น object เช่น
     * {
     *   participant, group, note,
     *   session_id, run_index,
     *   event_type, ts,
     *   target_id, boss_id, boss_phase,
     *   decoy, bossFace,
     *   grade, age_ms,
     *   diff, diff_label,
     *   fever_on,
     *   score_delta, combo_before, combo_after,
     *   player_hp_before, player_hp_after,
     *   fever_before, fever_after,
     *   target_size_px, spawn_interval_ms,
     *   phase_at_spawn, phase_spawn_index,
     *   x_norm, y_norm,
     *   zone_lr, zone_ud,
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
   * header = union ของทุก key จากทุกแถว
   * - เรียงตาม order ของแถวแรกเป็นหลัก แล้วค่อยตามลำดับที่เจอในแถวถัด ๆ ไป
   */
  _buildHeaderCols() {
    if (!this.logs.length) return [];

    const cols = [];
    const seen = new Set();

    const pushKeys = (obj) => {
      for (const k of Object.keys(obj)) {
        if (!seen.has(k)) {
          seen.add(k);
          cols.push(k);
        }
      }
    };

    // แถวแรกก่อน
    pushKeys(this.logs[0]);
    // แถวอื่น ๆ เผื่อมี field เพิ่ม
    for (let i = 1; i < this.logs.length; i++) {
      pushKeys(this.logs[i]);
    }
    return cols;
  }

  /**
   * แปลง logs → CSV text
   * - ค่า null/undefined → ""
   * - ถ้าใช้กับ Excel/ภาษาไทย แนะนำให้ prepend BOM ตอนสร้าง Blob ในฝั่งที่เรียกใช้
   */
  toCsv() {
    if (!this.logs.length) return '';

    const cols = this._buildHeaderCols();

    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const lines = [];
    // header
    lines.push(cols.join(','));

    // rows
    for (const row of this.logs) {
      const line = cols.map(col => esc(row[col]));
      lines.push(line.join(','));
    }

    return lines.join('\n');
  }
}
