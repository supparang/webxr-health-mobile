// === /fitness/js/session-logger.js ===
// Session-level CSV logger (Shadow Breaker)
// ✅ Export: SessionLogger (named) + downloadSessionCsv()
// ✅ Also provides helper filenames (timestamped)
// NOTE: Keep lightweight, no deps

'use strict';

function pad2(n){ return String(n).padStart(2,'0'); }
function nowStamp(){
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function escCsv(v){
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g,'""')}"`;
  return s;
}

export class SessionLogger {
  constructor(){
    this.sessionMeta = null;     // object for session row (final)
    this.sessionRow = null;      // final row
    this.totalJudged = 0;
    this.totalHit = 0;

    // optional extra stats
    this.sumRt = 0;
    this.sumRtSq = 0;
    this.minRt = Infinity;
    this.maxRt = 0;

    this._startedAtMs = 0;
    this._endedAtMs = 0;
  }

  begin(meta = {}){
    this.sessionMeta = Object.assign({}, meta);
    this.sessionRow = null;

    this.totalJudged = 0;
    this.totalHit = 0;

    this.sumRt = 0;
    this.sumRtSq = 0;
    this.minRt = Infinity;
    this.maxRt = 0;

    this._startedAtMs = Date.now();
    this._endedAtMs = 0;
  }

  // called when something is judged but not necessarily hit
  onJudged(isHit){
    this.totalJudged += 1;
    if (isHit) this.totalHit += 1;
  }

  // called on a successful hit (rt optional)
  onHit(isHit, rtMs){
    this.onJudged(!!isHit);

    const rt = Number(rtMs);
    if (Number.isFinite(rt) && rt > 0) {
      this.sumRt += rt;
      this.sumRtSq += rt * rt;
      this.minRt = Math.min(this.minRt, rt);
      this.maxRt = Math.max(this.maxRt, rt);
    }
  }

  // called on miss (timeout/whiff)
  onMiss(){
    this.onJudged(false);
  }

  end(finalStats = {}){
    this._endedAtMs = Date.now();

    const judged = this.totalJudged || 0;
    const hit = this.totalHit || 0;
    const accPct = judged > 0 ? (hit / judged) * 100 : 0;

    const rtN = (hit > 0 && Number.isFinite(this.sumRt)) ? hit : 0;
    const rtMean = rtN > 0 ? (this.sumRt / rtN) : '';
    let rtSd = '';
    if (rtN > 1) {
      const mean = this.sumRt / rtN;
      const varPop = (this.sumRtSq / rtN) - (mean * mean);
      const varS = varPop * (rtN / (rtN - 1)); // unbiased-ish
      rtSd = Math.sqrt(Math.max(0, varS));
    }

    const row = Object.assign(
      {
        ts_start_ms: this._startedAtMs,
        ts_end_ms: this._endedAtMs,
        session_id: this.sessionMeta?.session_id || '',
        mode: this.sessionMeta?.mode || '',
        diff: this.sessionMeta?.diff || '',
        duration_sec: this.sessionMeta?.duration_sec ?? '',
        participant_id: this.sessionMeta?.participant_id || '',
        group: this.sessionMeta?.group || '',
        note: this.sessionMeta?.note || '',

        judged,
        hit,
        accuracy_pct: Number.isFinite(accPct) ? Number(accPct.toFixed(1)) : '',
        rt_mean_ms: (rtMean === '' ? '' : Number(rtMean.toFixed(1))),
        rt_sd_ms: (rtSd === '' ? '' : Number(rtSd.toFixed(1))),
        rt_min_ms: (this.minRt === Infinity ? '' : this.minRt),
        rt_max_ms: (this.maxRt || ''),

      },
      finalStats || {}
    );

    this.sessionRow = row;
    return row;
  }

  toCsv(){
    if (!this.sessionRow) return '';
    const cols = Object.keys(this.sessionRow);
    const lines = [];
    lines.push(cols.join(','));
    lines.push(cols.map(k => escCsv(this.sessionRow[k])).join(','));
    return lines.join('\n');
  }

  makeSessionFilename(prefix='shadow-breaker-session'){
    const sid = this.sessionMeta?.session_id ? String(this.sessionMeta.session_id) : 'session';
    return `${prefix}_${sid}_${nowStamp()}.csv`;
  }

  makeEventFilename(prefix='shadow-breaker-events'){
    const sid = this.sessionMeta?.session_id ? String(this.sessionMeta.session_id) : 'session';
    return `${prefix}_${sid}_${nowStamp()}.csv`;
  }
}

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