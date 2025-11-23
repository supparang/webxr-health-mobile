// === js/event-logger.js — Research Event Logger (2025-11-24) ===
'use strict';

/**
 * EventLogger: บันทึกข้อมูลระดับ "เป้าต่อเป้า" (hit/miss/bomb)
 * รูปแบบตรงกับวิธีวิจัย RM-ANOVA / Mixed Model / SEM
 */
export class EventLogger {
  constructor() {
    this.logs = [];
  }

  add(ev) {
    // ป้องกัน field หาย
    const safe = (v) => (v == null ? '' : v);

    this.logs.push({
      participant: safe(ev.participant),
      group: safe(ev.group),
      note: safe(ev.note),

      difficulty: safe(ev.diff),
      session_id: safe(ev.session_id),
      run_index: safe(ev.run_index),

      event_type: safe(ev.event_type),
      timestamp_s: safe(ev.ts),

      target_id: safe(ev.target_id),
      boss_id: safe(ev.boss_id),
      boss_phase: safe(ev.boss_phase),
      is_decoy: ev.decoy ? 1 : 0,
      is_bossface: ev.bossFace ? 1 : 0,

      grade: safe(ev.grade),
      age_ms: safe(ev.age_ms),

      score_delta: safe(ev.score_delta),
      combo_before: safe(ev.combo_before),
      combo_after: safe(ev.combo_after),

      player_hp_before: safe(ev.player_hp_before),
      player_hp_after: safe(ev.player_hp_after),
      fever_before: safe(ev.fever_before),
      fever_after: safe(ev.fever_after),

      target_size_px: safe(ev.target_size_px),
      spawn_interval_ms: safe(ev.spawn_interval_ms),
      phase_at_spawn: safe(ev.phase_at_spawn),
      phase_spawn_index: safe(ev.phase_spawn_index),

      x_norm: safe(ev.x_norm),
      y_norm: safe(ev.y_norm),

      // zone (ซ้าย/ขวา + บน/ล่าง)
      zone_lr: ev.x_norm != null ? (ev.x_norm < 0.5 ? 'L' : 'R') : '',
      zone_ud: ev.y_norm != null ? (ev.y_norm < 0.5 ? 'T' : 'B') : ''
    });
  }

  clear() {
    this.logs = [];
  }

  /** ส่งออกเป็น CSV string */
  toCsv() {
    const header = Object.keys(this.logs[0] || {});
    const rows = [header.join(',')];

    for (const row of this.logs) {
      rows.push(header.map(h => JSON.stringify(row[h] ?? '')).join(','));
    }
    return rows.join('\n');
  }
}
