// === /fitness/js/event-logger.js ===
// Event-level CSV logger (Shadow Breaker) — PRODUCTION (PATCH)
// ✅ Collects per-event rows
// ✅ Stable schema: union keys across all rows (consistent CSV columns)
// ✅ Safe CSV escaping
// Exports: EventLogger, downloadEventCsv

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
  // Put core columns first (nice for analysis), then the rest.
  const core = [
    'ts_ms',
    'mode', 'diff',
    'session_id',
    'boss_index', 'boss_phase',
    'target_id', 'target_type', 'is_boss_face',
    'event_type',
    'rt_ms', 'grade',
    'score_delta', 'score_after',
    'combo_after',
    'player_hp', 'boss_hp',
    'fever', 'fever_on',
    'shield',
    'miss',
    'note'
  ];

  const out = [];
  for (const k of core) if (cols.includes(k)) out.push(k);
  for (const k of cols) if (!out.includes(k)) out.push(k);
  return out;
}

export class EventLogger {
  constructor() {
    this.logs = [];
    this._cols = []; // union schema
  }

  clear() {
    this.logs.length = 0;
    this._cols.length = 0;
  }

  add(row) {
    if (!row || typeof row !== 'object') return;

    // normalize common columns a bit (optional but helps)
    if (row.ts_ms == null) row.ts_ms = Date.now();

    this.logs.push(row);

    // union schema
    for (const k of Object.keys(row)) {
      uniqPush(this._cols, k);
    }
  }

  getColumns() {
    return this._cols.slice();
  }

  toCsv(opts = {}) {
    if (!this.logs.length) return '';

    const cols = (opts.columns && Array.isArray(opts.columns) && opts.columns.length)
      ? opts.columns.slice()
      : defaultOrder(this._cols.length ? this._cols : Object.keys(this.logs[0]));

    const lines = [];
    lines.push(cols.join(','));

    for (const row of this.logs) {
      const line = cols.map((c) => escCsv(row[c]));
      lines.push(line.join(','));
    }

    return lines.join('\n');
  }
}

export function downloadEventCsv(logger, filename = 'shadow-breaker-events.csv') {
  try {
    if (!logger || typeof logger.toCsv !== 'function') {
      console.warn('[EventLogger] invalid logger for download');
      return;
    }

    const csv = logger.toCsv();
    if (!csv) {
      alert('ยังไม่มีข้อมูลเหตุการณ์ในรอบนี้');
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
    console.error('Download event CSV failed', err);
    alert('ไม่สามารถดาวน์โหลดไฟล์ CSV (event) ได้');
  }
}