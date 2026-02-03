// === /fitness/js/session-logger.js ===
// Session-level CSV logger (Shadow Breaker)
// ✅ Export: SessionLogger (named export)  <-- PATCH for engine import
// ✅ Export: downloadSessionCsv(logger, filename)
// - Stores 1+ session rows (normally 1 per run)
// - CSV header uses union of keys across rows (stable columns)

'use strict';

function isObj(v){ return !!v && typeof v === 'object' && !Array.isArray(v); }

function escCsv(v){
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function unionKeys(rows){
  const set = new Set();
  for (const r of rows) {
    if (!isObj(r)) continue;
    for (const k of Object.keys(r)) set.add(k);
  }
  return Array.from(set);
}

export class SessionLogger {
  constructor(){
    /**
     * session rows
     * 1 row recommended keys:
     * {
     *  ts_start_ms, ts_end_ms, duration_sec,
     *  mode, diff,
     *  boss_index_end, phase_end, bosses_cleared,
     *  score, max_combo, miss, accuracy_pct, grade,
     *  rt_mean_ms, rt_p50_ms, rt_p90_ms,
     *  hp_end, shield_end, fever_end,
     *  participant_id, group, note,
     *  seed, build, device
     * }
     */
    this.rows = [];
  }

  clear(){
    this.rows.length = 0;
  }

  /**
   * Add a session row
   * @param {Object} row
   */
  add(row){
    if (!isObj(row)) return;
    this.rows.push(row);
  }

  /**
   * Replace last row (common pattern: create row at start, finalize at end)
   * @param {Object} row
   */
  setLast(row){
    if (!isObj(row)) return;
    if (!this.rows.length) this.rows.push(row);
    else this.rows[this.rows.length - 1] = row;
  }

  /**
   * Merge fields into last row
   * @param {Object} patch
   */
  patchLast(patch){
    if (!isObj(patch)) return;
    if (!this.rows.length) this.rows.push({});
    Object.assign(this.rows[this.rows.length - 1], patch);
  }

  /**
   * Convert rows to CSV text
   * - header is union of keys across all rows (stable)
   */
  toCsv(){
    if (!this.rows.length) return '';

    const cols = unionKeys(this.rows);
    const lines = [];
    lines.push(cols.join(','));

    for (const row of this.rows) {
      const line = cols.map(c => escCsv(row ? row[c] : ''));
      lines.push(line.join(','));
    }
    return lines.join('\n');
  }
}

/**
 * Download session CSV
 * @param {SessionLogger} logger
 * @param {string} filename
 */
export function downloadSessionCsv(logger, filename = 'shadow-breaker-session.csv'){
  try{
    if (!logger || typeof logger.toCsv !== 'function') {
      console.warn('[SessionLogger] invalid logger for download');
      return;
    }
    const csv = logger.toCsv();
    if (!csv) {
      alert('ยังไม่มีข้อมูลสรุปรอบนี้');
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