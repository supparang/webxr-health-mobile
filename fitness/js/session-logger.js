// === js/session-logger.js — Session-level CSV logger (Research schema v2) ===
'use strict';

export class SessionLogger {
  constructor() {
    this.sessions = [];
  }

  add(row) {
    this.sessions.push(row);
  }

  /**
   * ทำ CSV แบบ:
   * 1) รวม keys ของทุก session
   * 2) จัดลำดับตาม PREFERRED_SESSION_COLS ก่อน
   * 3) คีย์อื่นที่มีจริงจะใส่ต่อท้าย
   */
  toCsv() {
    if (!this.sessions.length) return '';

    const PREFERRED_SESSION_COLS = [
      // identity
      'session_id',
      'build_version',

      // mode / diff / structure
      'mode',
      'difficulty',
      'training_phase',
      'run_index',

      // time
      'start_ts',
      'end_ts',
      'duration_s',
      'end_reason',

      // main outcome
      'final_score',
      'grade',

      // performance
      'total_targets',
      'total_hits',
      'total_miss',
      'total_bombs_hit',
      'accuracy_pct',
      'max_combo',
      'perfect_count',
      'good_count',
      'bad_count',

      // RT metrics
      'avg_rt_normal_ms',
      'std_rt_normal_ms',
      'avg_rt_decoy_ms',
      'std_rt_decoy_ms',

      // FEVER & HP & boss progression
      'fever_count',
      'fever_total_time_s',
      'low_hp_time_s',
      'bosses_cleared',
      'menu_to_play_ms',

      // research metadata
      'participant',
      'group',
      'note',

      // environment
      'env_ua',
      'env_viewport_w',
      'env_viewport_h',
      'env_input_mode',

      // system / quality
      'error_count',
      'focus_events'
    ];

    // 1) รวม key ของทุก session log
    const keySet = new Set();
    for (const row of this.sessions) {
      for (const k of Object.keys(row)) {
        keySet.add(k);
      }
    }

    // 2) เรียงคอลัมน์ตาม preferred → ตามด้วย key อื่น
    const cols = [];
    for (const k of PREFERRED_SESSION_COLS) {
      if (keySet.has(k)) {
        cols.push(k);
        keySet.delete(k);
      }
    }

    // key ที่เหลือ → sort แล้วปิดท้าย
    const rest = Array.from(keySet).sort();
    cols.push(...rest);

    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n'))
        return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };

    const lines = [];
    lines.push(cols.join(',')); // header

    for (const row of this.sessions) {
      lines.push(cols.map(c => esc(row[c])).join(','));
    }

    return lines.join('\n');
  }
}
