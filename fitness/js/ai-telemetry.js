// === /fitness/js/ai-telemetry.js ===
// Rolling telemetry: fatigue, stability, miss rate, RT trend
// ✅ tiny, no deps

'use strict';

export class AITelemetry {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      maxHist: 48,
      rtCap: 1400,
    }, opts);

    // store recent resolved events: {t, yMiss, rt, type, phase, hp, feverOn}
    this.hist = [];
  }

  _push(e) {
    this.hist.push(e);
    while (this.hist.length > this.cfg.maxHist) this.hist.shift();
  }

  observeResolved({ now, type, grade, rtMs, playerHp, feverOn, bossPhase, diffKey }) {
    const isMiss = (type === 'timeout') || (grade === 'miss') || (grade === 'bomb');
    const rt = (rtMs == null || rtMs === '') ? null : Math.max(0, Math.min(this.cfg.rtCap, rtMs));

    this._push({
      t: now || performance.now(),
      yMiss: isMiss ? 1 : 0,
      rt,
      type: type || '',
      grade: grade || '',
      phase: bossPhase || 1,
      hp: (playerHp == null) ? 1 : playerHp,
      feverOn: !!feverOn,
      diff: diffKey || 'normal'
    });
  }

  _mean(arr) {
    if (!arr.length) return null;
    let s = 0;
    for (const v of arr) s += v;
    return s / arr.length;
  }

  _std(arr, mean) {
    if (!arr.length) return null;
    const m = mean == null ? this._mean(arr) : mean;
    if (m == null) return null;
    let s = 0;
    for (const v of arr) s += (v - m) * (v - m);
    return Math.sqrt(s / arr.length);
  }

  snapshot() {
    const H = this.hist;
    const n = H.length;

    // miss rate
    let miss = 0;
    for (const e of H) miss += e.yMiss;
    const missRate = n ? (miss / n) : 0;

    // RT arrays for normal hits only
    const rtAll = [];
    const rtRecent = [];
    const rtEarly = [];

    for (let i = 0; i < n; i++) {
      const e = H[i];
      if (e.rt == null) continue;
      rtAll.push(e.rt);
      // split early vs recent halves for trend
      if (i < Math.floor(n / 2)) rtEarly.push(e.rt);
      else rtRecent.push(e.rt);
    }

    const rtMean = this._mean(rtAll);
    const rtStd = this._std(rtAll, rtMean);

    const earlyMean = this._mean(rtEarly);
    const recentMean = this._mean(rtRecent);

    // fatigue: if recent RT slower than early RT + missRate high + hp low
    let fatigue = 0;
    if (earlyMean != null && recentMean != null) {
      const drift = (recentMean - earlyMean) / 500; // scale
      fatigue += Math.max(0, Math.min(1, drift));
    }
    fatigue += Math.max(0, Math.min(1, (missRate - 0.25) / 0.35));

    // hp low time (approx via last hp)
    const lastHp = n ? H[n - 1].hp : 1;
    fatigue += (lastHp <= 0.34) ? 0.25 : 0;

    fatigue = Math.max(0, Math.min(1, fatigue / 1.6));

    // stability: lower std => better stability
    let stability = 0.5;
    if (rtStd != null) {
      // rtStd ~ 0..400 -> map to stability 1..0
      stability = 1 - Math.max(0, Math.min(1, rtStd / 420));
    }

    const last = n ? H[n - 1] : null;

    return {
      n,
      missRate: +missRate.toFixed(3),
      rtMean: (rtMean == null) ? '' : +rtMean.toFixed(1),
      rtStd: (rtStd == null) ? '' : +rtStd.toFixed(1),
      rtTrend: (earlyMean != null && recentMean != null) ? +(recentMean - earlyMean).toFixed(1) : '',
      fatigue: +fatigue.toFixed(3),
      stability: +stability.toFixed(3),
      lastHp: (last ? +last.hp.toFixed(3) : 1),
      lastPhase: (last ? last.phase : 1),
      lastDiff: (last ? last.diff : 'normal'),
      feverOn: (last ? !!last.feverOn : false)
    };
  }
}