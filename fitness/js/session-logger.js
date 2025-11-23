// === js/session-logger.js — Research Session Summary Logger (2025-11-24) ===
'use strict';

/**
 * SessionLogger: บันทึกสรุป "1 รอบเล่น"
 * ใช้สำหรับวิเคราะห์ผลรวม เช่น score, accuracy, FEVER, RT โดยรวม
 */
export class SessionLogger {
  constructor() {
    this.sessions = [];
  }

  add(s) {
    const safe = (v) => (v == null ? '' : v);

    this.sessions.push({
      session_id: safe(s.session_id),
      build_version: safe(s.build_version),

      mode: safe(s.mode),
      difficulty: safe(s.difficulty),
      training_phase: safe(s.training_phase),
      run_index: safe(s.run_index),

      start_ts: safe(s.start_ts),
      end_ts: safe(s.end_ts),
      duration_s: safe(s.duration_s),
      end_reason: safe(s.end_reason),

      final_score: safe(s.final_score),
      grade: safe(s.grade),

      total_targets: safe(s.total_targets),
      total_hits: safe(s.total_hits),
      total_miss: safe(s.total_miss),
      total_bombs_hit: safe(s.total_bombs_hit),

      accuracy_pct: safe(s.accuracy_pct),
      max_combo: safe(s.max_combo),

      perfect_count: safe(s.perfect_count),
      good_count: safe(s.good_count),
      bad_count: safe(s.bad_count),

      avg_rt_normal_ms: safe(s.avg_rt_normal_ms),
      std_rt_normal_ms: safe(s.std_rt_normal_ms),
      avg_rt_decoy_ms: safe(s.avg_rt_decoy_ms),
      std_rt_decoy_ms: safe(s.std_rt_decoy_ms),

      fever_count: safe(s.fever_count),
      fever_total_time_s: safe(s.fever_total_time_s),
      low_hp_time_s: safe(s.low_hp_time_s),
      bosses_cleared: safe(s.bosses_cleared),
      menu_to_play_ms: safe(s.menu_to_play_ms),

      participant: safe(s.participant),
      group: safe(s.group),
      note: safe(s.note),

      env_ua: safe(s.env_ua),
      env_viewport_w: safe(s.env_viewport_w),
      env_viewport_h: safe(s.env_viewport_h),
      env_input_mode: safe(s.env_input_mode),

      error_count: safe(s.error_count),
      focus_events: safe(s.focus_events)
    });
  }

  clear() {
    this.sessions = [];
  }

  toCsv() {
    const header = Object.keys(this.sessions[0] || {});
    const rows = [header.join(',')];

    for (const s of this.sessions) {
      rows.push(header.map(h => JSON.stringify(s[h] ?? '')).join(','));
    }
    return rows.join('\n');
  }
}
