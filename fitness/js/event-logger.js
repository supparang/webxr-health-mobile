// === js/event-logger.js — Event-level CSV logger (Research schema v2) ===
'use strict';

export class EventLogger {
  constructor() {
    this.logs = [];
  }

  add(row) {
    this.logs.push(row);
  }

  /**
   * สร้าง CSV โดย:
   * 1) รวม key จากทุก log
   * 2) จัดลำดับคอลัมน์ตาม PREFERRED_EVENT_COLS ก่อน
   * 3) key อื่น ๆ (ถ้ามี) จะตามหลังแบบเรียงตามตัวอักษร
   */
  toCsv() {
    if (!this.logs.length) return '';

    // ลำดับคอลัมน์หลักตามแผนงานวิจัย (event-level)
    const PREFERRED_EVENT_COLS = [
      // meta / research info
      'participant',
      'group',
      'note',

      // session + run info
      'session_id',
      'run_index',
      'diff',
      'diff_label',
      'event_type',
      'ts',

      // target / boss info (ตามที่อาจารย์ระบุ)
      'target_id',
      'boss_id',
      'boss_phase',
      'is_decoy',
      'is_bossface',
      'decoy',       // เก็บไว้เผื่อใช้งานโค้ดเก่า
      'bossFace',    // เช่นกัน

      // timing + performance
      'grade',
      'age_ms',
      'fever_on',
      'score_delta',
      'combo_before',
      'combo_after',
      'player_hp_before',
      'player_hp_after',
      'fever_before',
      'fever_after',

      // stimulus config
      'target_size_px',
      'spawn_interval_ms',
      'phase_at_spawn',
      'phase_spawn_index',

      // position & zone
      'x_norm',
      'y_norm',
      'zone_lr',
      'zone_ud'
    ];

    // 1) รวม key จากทุก log
    const keySet = new Set();
    for (const row of this.logs) {
      for (const k of Object.keys(row)) {
        keySet.add(k);
      }
    }

    // 2) สร้างลำดับคอลัมน์: เริ่มจาก PREFERRED ที่มีจริง จากนั้นตามด้วย key อื่น ๆ
    const cols = [];
    for (const k of PREFERRED_EVENT_COLS) {
      if (keySet.has(k)) {
        cols.push(k);
        keySet.delete(k);
      }
    }
    // key ที่เหลือ → sort ตามตัวอักษรแล้วต่อท้าย
    const rest = Array.from(keySet).sort();
    cols.push(...rest);

    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const lines = [];
    lines.push(cols.join(',')); // header

    for (const row of this.logs) {
      const line = cols.map(c => esc(row[c])).join(',');
      lines.push(line);
    }

    return lines.join('\n');
  }
}
