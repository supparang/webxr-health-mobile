// === /fitness/js/session-logger.js ===
// Session-level CSV logger (Shadow Breaker) — PRODUCTION (PATCH)
// ✅ Exports: SessionLogger, downloadSessionCsv
// ✅ Stable schema (union keys) + safe CSV escaping

'use strict';

function escCsv(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function uniqPush(arr, key) {
  if (!key) return;
  if (!arr.includes(key)) arr.push(key);
}

function defaultOrder(cols) {
  const core = [
    'ts_start_ms',
    'ts_end_ms',
    'duration_s',
    'mode', 'diff',
    'session_id',
    'participant_id', 'group', 'note',
    'bosses_cleared',
    'final_phase',
    'score',
    'max_combo',
    'miss',
    'hit_good',
    'hit_bad',
    'hit_bomb',
    'hit_heal',
    'hit_shield',
    'accuracy_pct',
    'grade',
    'avg_rt_ms',
    'min_rt_ms',
    'max_rt_ms',
    'fever_uses',
    'shield_gain',
    'hp_end',
    'boss_hp_end'
  ];

  const out = [];
  for (const k of core) if (cols.includes(k)) out.push(k);
  for (const k of cols) if (!out.includes(k)) out.push(k);
  return out;
}

function makeSessionId() {
  // short & deterministic enough for local logs
  const r = Math.random().toString(16).slice(2, 10);
  return `SB-${Date.now().toString(36)}-${r}`;
}

export class SessionLogger {
  constructor() {
    this.sessions = [];   // array of session summary objects
    this._cols = [];      // union schema for CSV
  }

  clear() {
    this.sessions.length = 0;
    this._cols.length = 0;
  }

  /**
   * Add 1 session summary row
   * @param {Object} row
   */
  add(row) {
    if (!row || typeof row !== 'object') return;

    // normalize a little
    if (!row.session_id) row.session_id = makeSessionId();
    if (row.ts_start_ms == null) row.ts_start_ms = Date.now();

    this.sessions.push(row);

    // union schema
    for (const k of Object.keys(row)) {
      uniqPush(this._cols, k);
    }
  }

  /**
   * Convenience: build a session summary from engine stats
   * (engine can call this or just pass raw object to add())
   */
  fromStats(stats = {}) {
    const row = Object.assign({}, stats);

    // common fallbacks
    if (row.ts_start_ms == null) row.ts_start_ms = Date.now();
    if (row.ts_end_ms == null && row.duration_s != null) {
      row.ts_end_ms = row.ts_start_ms + Math.round(Number(row.duration_s) * 1000);
    }
    if (row.duration_s == null && row.ts_end_ms != null) {
      row.duration_s = Math.max(0, (Number(row.ts_end_ms) - Number(row.ts_start_ms)) / 1000);
    }

    this.add(row);
    return row;
  }

  getColumns() {
    return this._cols.slice();
  }

  toCsv(opts = {}) {
    if (!this.sessions.length) return '';

    const cols = (opts.columns && Array.isArray(opts.columns) && opts.columns.length)
      ? opts.columns.slice()
      : defaultOrder(this._cols.length ? this._cols : Object.keys(this.sessions[0]));

    const lines = [];
    lines.push(cols.join(','));

    for (const row of this.sessions) {
      const line = cols.map((c) => escCsv(row[c]));
      lines.push(line.join(','));
    }

    return lines.join('\n');
  }
}

export function downloadSessionCsv(logger, filename = 'shadow-breaker-session.csv') {
  try {
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