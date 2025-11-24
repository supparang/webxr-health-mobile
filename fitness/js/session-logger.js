// === js/session-logger.js — Shadow Breaker Session Logger (Research CSV v1) ===
'use strict';

/**
 * SessionLogger
 * - เก็บ session summary แต่ละรอบเล่น (จาก engine.stopGame)
 * - แปลงเป็น CSV เพื่องานวิจัย
 *
 * ใช้ร่วมกับ engine.js:
 *   this.sessionLogger = new SessionLogger();
 *   this.sessionLogger.add(summary);
 *   this.sessionLogger.toCsv();
 */

const PREFERRED_SESSION_COLS = [
  // --- core metadata ---
  'session_id',
  'build_version',

  // --- mode / condition ---
  'mode',
  'difficulty',
  'training_phase',
  'run_index',

  // --- timing ---
  'start_ts',
  'end_ts',
  'duration_s',
  'end_reason',

  // --- performance summary ---
  'final_score',
  'grade',
  'total_targets',
  'total_hits',
  'total_miss',
  'total_bombs_hit',
  'accuracy_pct',
  'max_combo',
  'perfect_count',
  'good_count',
  'bad_count',

  // --- RT stats ---
  'avg_rt_normal_ms',
  'std_rt_normal_ms',
  'avg_rt_decoy_ms',
  'std_rt_decoy_ms',

  // --- FEVER / HP / boss ---
  'fever_count',
  'fever_total_time_s',
  'low_hp_time_s',
  'bosses_cleared',
  'menu_to_play_ms',

  // --- research meta ---
  'participant',
  'group',
  'note',

  // --- environment / telemetry ---
  'env_ua',
  'env_viewport_w',
  'env_viewport_h',
  'env_input_mode',
  'error_count',
  'focus_events'
];

function _escapeCsvCell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);

  // ตัด \r\n ให้เป็น \n เดียวเพื่อความเรียบร้อย
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // ถ้ามีเครื่องหมายคำพูด , หรือ newline → ใส่ "" ครอบ
  if (/[",\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export class SessionLogger {
  constructor() {
    /** @type {Array<Object>} */
    this.sessions = [];
  }

  /**
   * เพิ่ม session summary 1 แถว
   * summary ควรเป็น object จาก engine.stopGame()
   */
  add(summary) {
    if (!summary || typeof summary !== 'object') return;
    // clone แบบตื้น ๆ ป้องกันโดน mutate ภายนอก
    this.sessions.push({ ...summary });
  }

  /**
   * ล้างข้อมูลทั้งหมดใน logger
   */
  clear() {
    this.sessions.length = 0;
  }

  /**
   * คืนค่า CSV text สำหรับดาวน์โหลด
   */
  toCsv() {
    if (!this.sessions.length) {
      // ส่ง header อย่างเดียวไว้ก่อน (กันไฟล์ว่าง)
      const header = PREFERRED_SESSION_COLS.join(',');
      return header + '\r\n';
    }

    const cols = PREFERRED_SESSION_COLS.slice();
    const lines = [];

    // header
    lines.push(cols.join(','));

    // rows
    for (const s of this.sessions) {
      const row = cols.map((col) => {
        const val = (s[col] !== undefined && s[col] !== null) ? s[col] : '';
        return _escapeCsvCell(val);
      });
      lines.push(row.join(','));
    }

    return lines.join('\r\n');
  }
}
