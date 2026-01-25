// === /fitness/js/session-logger.js — Session-level CSV logger (Shadow Breaker) ===
'use strict';

export class SessionLogger {
  constructor() {
    /**
     * เก็บ summary ราย session
     * ตัวอย่าง 1 แถว:
     * {
     *   session_id, build_version,
     *   mode, difficulty, training_phase, run_index,
     *   start_ts, end_ts, duration_s, end_reason,
     *   final_score, grade,
     *   total_targets, total_hits, total_miss,
     *   accuracy_pct, max_combo,
     *   avg_rt_normal_ms, avg_rt_decoy_ms,
     *   fever_total_time_s, low_hp_time_s,
     *   bosses_cleared,
     *   participant, group, note,
     *   ... env_ua, env_viewport_w/h, ...
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

  /**
   * Convert logs -> CSV text
   * - ใช้ key ของแถวแรกเป็น header หลัก
   */
  toCsv() {
    if (!this.logs.length) return '';

    const cols = Object.keys(this.logs[0]);

    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const lines = [];
    lines.push(cols.join(','));

    for (const row of this.logs) {
      const line = cols.map(col => esc(row[col]));
      lines.push(line.join(','));
    }

    return lines.join('\n');
  }
}

/**
 * helper สำหรับดาวน์โหลดไฟล์ CSV session-level
 * @param {SessionLogger} logger
 * @param {string} filename
 */
export function downloadSessionCsv(logger, filename = 'shadow-breaker-session.csv') {
  try {
    if (!logger || typeof logger.toCsv !== 'function') {
      console.warn('[SessionLogger] invalid logger for download');
      return;
    }

    const csv = logger.toCsv();
    if (!csv) {
      alert('ยังไม่มีข้อมูลสรุป session ให้ดาวน์โหลด');
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
    console.error('Download session CSV failed', err);
    alert('ไม่สามารถดาวน์โหลดไฟล์ CSV (session) ได้');
  }
}
