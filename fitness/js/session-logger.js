// === /fitness/js/session-logger.js ===
// Session-level CSV logger (Shadow Breaker)
// ✅ FIX: exports named 'SessionLogger' (so engine.js can import { SessionLogger } )
// ✅ Stores 1 session summary row + internal counters for snapshot
// ✅ Exports: SessionLogger, downloadSessionCsv

'use strict';

function clamp(v, a, b) { return Math.max(a, Math.min(b, Number(v) || 0)); }
function safeStr(v) { return (v == null) ? '' : String(v); }

function escCsv(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function objToCsvRow(obj, cols) {
  return cols.map(c => escCsv(obj[c])).join(',');
}

export class SessionLogger {
  constructor() {
    this.clear();
  }

  clear() {
    // session meta
    this.session = {
      session_id: '',
      ts_start_ms: '',
      ts_end_ms: '',
      mode: 'normal',
      diff: 'normal',
      duration_sec: 70,
      participant_id: '',
      group: '',
      note: ''
    };

    // session summary metrics
    this.summary = {
      time_sec: 0,
      score: 0,
      max_combo: 0,
      miss: 0,
      bosses_cleared: 0,
      phase: 1,
      accuracy_pct: 0,
      grade: 'C'
    };

    // internal counters for snapshot / accuracy
    this.totalJudged = 0;   // judged events (hit + miss-like)
    this.totalHit = 0;      // good/perfect hits
    this.hitPerfect = 0;
    this.hitGood = 0;
    this.hitBad = 0;
    this.missCount = 0;

    // for offset stats (simple)
    this._rtSum = 0;
    this._rtN = 0;
    this._rtAbsSum = 0;

    // one-row log
    this.rows = [];
  }

  begin(meta = {}) {
    this.clear();

    this.session.session_id = safeStr(meta.session_id || '');
    this.session.ts_start_ms = Date.now();
    this.session.mode = safeStr(meta.mode || 'normal');
    this.session.diff = safeStr(meta.diff || 'normal');
    this.session.duration_sec = Number(meta.duration_sec) || 70;
    this.session.participant_id = safeStr(meta.participant_id || '');
    this.session.group = safeStr(meta.group || '');
    this.session.note = safeStr(meta.note || '');

    return this.session.session_id;
  }

  onJudged(isHit) {
    this.totalJudged += 1;
    if (isHit) this.totalHit += 1;
    else this.missCount += 1;
  }

  onHit(isGoodOrPerfect, rtMs) {
    // judged as hit
    this.totalJudged += 1;

    if (isGoodOrPerfect) {
      this.totalHit += 1;
      // bucket into good/perfect later in engine if want — we approximate:
      // if rt <= 300 ms => perfect-ish else good
      const r = Number(rtMs) || 0;
      if (r > 0 && r <= 300) this.hitPerfect += 1;
      else this.hitGood += 1;
    } else {
      this.hitBad += 1;
    }

    const rt = Math.max(1, Number(rtMs) || 0);
    this._rtSum += rt;
    this._rtAbsSum += Math.abs(rt);
    this._rtN += 1;
  }

  onMiss() {
    this.totalJudged += 1;
    this.missCount += 1;
  }

  makeSnapshot(extra = {}) {
    // For AI predictor — match keys used in ai-predictor.js comment
    const judged = this.totalJudged || 0;
    const miss = this.missCount || 0;
    const hitMiss = miss; // naming compatibility

    const accPct = judged > 0 ? (this.totalHit / judged) * 100 : 0;

    // offsetAbsMean: we don't have musical offset in this game;
    // we approximate using RT variance surrogate: mean absolute "timing error" in seconds
    const rtAbsMeanSec = this._rtN > 0 ? (this._rtAbsSum / this._rtN) / 1000 : 0;

    return Object.assign({
      accPct,
      hitMiss,
      hitPerfect: this.hitPerfect,
      hitGreat: 0,
      hitGood: this.hitGood,
      combo: 0,
      offsetAbsMean: rtAbsMeanSec,
      hp: Number(extra.hp) || 100,
      songTime: Number(extra.elapsedSec) || 0,
      durationSec: Number(extra.durationSec) || 70
    }, extra || {});
  }

  end(summary = {}) {
    this.session.ts_end_ms = Date.now();

    // compute acc
    const judged = this.totalJudged || 0;
    const accPct = judged > 0 ? (this.totalHit / judged) * 100 : 0;

    this.summary.time_sec = Number(summary.time_sec) || 0;
    this.summary.score = Number(summary.score) || 0;
    this.summary.max_combo = Number(summary.max_combo) || 0;
    this.summary.miss = Number(summary.miss) || this.missCount || 0;
    this.summary.bosses_cleared = Number(summary.bosses_cleared) || 0;
    this.summary.phase = Number(summary.phase) || 1;
    this.summary.accuracy_pct = Number.isFinite(summary.accuracy_pct) ? Number(summary.accuracy_pct) : accPct;
    this.summary.grade = safeStr(summary.grade || 'C');

    // finalize single row
    const row = Object.assign({}, this.session, this.summary, {
      judged_total: judged,
      hit_total: this.totalHit,
      miss_total: this.missCount,
      rt_mean_ms: this._rtN > 0 ? (this._rtSum / this._rtN) : '',
      rt_abs_mean_ms: this._rtN > 0 ? (this._rtAbsSum / this._rtN) : ''
    });

    this.rows = [row];
    return row;
  }

  toCsv() {
    if (!this.rows || !this.rows.length) return '';

    const cols = Object.keys(this.rows[0]);
    const lines = [];
    lines.push(cols.join(','));
    for (const r of this.rows) lines.push(objToCsvRow(r, cols));
    return lines.join('\n');
  }

  makeSessionFilename(prefix = 'shadow-breaker-session') {
    const id = this.session.session_id || 'session';
    const mode = this.session.mode || 'normal';
    const diff = this.session.diff || 'normal';
    return `${prefix}_${id}_${mode}_${diff}.csv`;
  }

  makeEventFilename(prefix = 'shadow-breaker-events') {
    const id = this.session.session_id || 'session';
    const mode = this.session.mode || 'normal';
    const diff = this.session.diff || 'normal';
    return `${prefix}_${id}_${mode}_${diff}.csv`;
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
      alert('ยังไม่มีข้อมูลสรุป Session ในรอบนี้');
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