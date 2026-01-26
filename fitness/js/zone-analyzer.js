// === /fitness/js/zone-analyzer.js ===
// Zone Analyzer — L/R performance + rolling trend
'use strict';

export class ZoneAnalyzer {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      windowSize: 18,     // rolling window events
      maxKeep: 220
    }, opts);
    this.reset();
  }

  reset() {
    this.events = []; // {t, zone, type, rt, hit}
  }

  add(ev) {
    if (!ev) return;
    this.events.push(ev);
    if (this.events.length > this.cfg.maxKeep) this.events.shift();
  }

  _lastN(n, zone) {
    const arr = [];
    for (let i = this.events.length - 1; i >= 0 && arr.length < n; i--) {
      const e = this.events[i];
      if (!zone || e.zone === zone) arr.push(e);
    }
    return arr.reverse();
  }

  stats(zone) {
    const w = this._lastN(this.cfg.windowSize, zone);
    if (!w.length) return {
      n: 0, hit: 0, miss: 0, missRate: 0, rtAvg: 0, slope: 0
    };

    let hit = 0, miss = 0, rtSum = 0, rtN = 0;
    const pts = [];
    for (const e of w) {
      if (e.hit) hit++;
      else miss++;
      if (e.hit && typeof e.rt === 'number') {
        rtSum += e.rt; rtN++;
        pts.push({ x: e.t, y: e.rt });
      }
    }

    const rtAvg = rtN ? (rtSum / rtN) : 0;

    // slope (simple linear fit on last window hit RT)
    let slope = 0;
    if (pts.length >= 4) {
      const x0 = pts[0].x;
      const xs = pts.map(p => (p.x - x0) / 1000); // sec
      const ys = pts.map(p => p.y);

      const n = xs.length;
      const sx = xs.reduce((a,b)=>a+b,0);
      const sy = ys.reduce((a,b)=>a+b,0);
      const sxx = xs.reduce((a,b)=>a+b*b,0);
      const sxy = xs.reduce((a,b,i)=>a+b*ys[i],0);

      const denom = (n*sxx - sx*sx);
      slope = denom ? ((n*sxy - sx*sy) / denom) : 0; // ms per sec
      slope = Math.max(-50, Math.min(50, slope));
    }

    const total = hit + miss;
    const missRate = total ? (miss / total) : 0;

    return { n: w.length, hit, miss, missRate, rtAvg, slope };
  }

  combined() {
    const L = this.stats('L');
    const R = this.stats('R');
    const all = this.stats(null);

    const bias =
      (L.n >= 6 && R.n >= 6)
        ? (L.missRate - R.missRate)   // + = left worse
        : 0;

    return { L, R, all, bias };
  }
}