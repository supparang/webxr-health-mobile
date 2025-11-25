// === js/session-logger.js — Session-level CSV logger (Shadow Breaker) ===
'use strict';

export class SessionLogger {
  constructor() {
    /**
     * เก็บ summary ราย session / run
     * ตัวอย่างโครงสร้างหนึ่งแถว (ตาม engine.js):
     *
     * {
     *   session_id,
     *   build_version,
     *
     *   mode,
     *   difficulty,
     *   training_phase,
     *   run_index,
     *
     *   start_ts,
     *   end_ts,
     *   duration_s,
     *   end_reason,
     *
     *   final_score,
     *   grade,
     *
     *   total_targets,
     *   total_hits,
     *   total_miss,
     *   total_bombs_hit,
     *
     *   accuracy_pct,
     *   max_combo,
     *
     *   perfect_count,
     *   good_count,
     *   bad_count,
     *
     *   avg_rt_normal_ms,
     *   std_rt_normal_ms,
     *   avg_rt_decoy_ms,
     *   std_rt_decoy_ms,
     *
     *   fever_count,
     *   fever_total_time_s,
     *   low_hp_time_s,
     *   bosses_cleared,
     *   menu_to_play_ms,
     *
     *   participant,
     *   group,
     *   note,
     *
     *   env_ua,
     *   env_viewport_w,
     *   env_viewport_h,
     *   env_input_mode,
     *
     *   error_count,
     *   focus_events
     * }
     *
     * แต่ logger รองรับ field ใด ๆ ตามที่ engine ใส่มา
     */
    this.sessions = [];
  }

  /**
   * เพิ่ม 1 session summary
   * @param {Object} row
   */
  add(row) {
    if (!row || typeof row !== 'object') return;
    this.sessions.push(row);
  }

  /**
   * ล้างข้อมูลทั้งหมด (ใช้กรณีเริ่ม block ทดลองใหม่)
   */
  clear() {
    this.sessions.length = 0;
  }

  /**
   * แปลง sessions → CSV text
   * - ใช้ key ของแถวแรกเป็น header
   * - ค่า null/undefined → ""
   */
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
    // header
    lines.push(cols.join(','));

    // rows
    for (const row of this.sessions) {
      const line = cols.map(col => esc(row[col]));
      lines.push(line.join(','));
    }

    return lines.join('\n');
  }
}