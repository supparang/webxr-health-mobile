// === /fitness/js/dl-features.js ===
// DLFeatures — lightweight feature collector for Shadow Breaker
// ✅ tracks shots/spawns, hits, misses, streak/combo proxy, tempo, RT-ish proxy
// ✅ produces snapshot for predictor/coach (heuristic now, ML later)
// Export: DLFeatures

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function clamp01(v){ return clamp(Number(v)||0, 0, 1); }

export class DLFeatures {
  constructor(){
    this.reset();
  }

  reset(){
    // ---- counters ----
    this.totalShots = 0;   // "opportunities" (engine calls onShot when spawn)
    this.hits = 0;
    this.misses = 0;

    // ---- streak/tempo ----
    this.hitStreak = 0;
    this.bestStreak = 0;

    // timestamps (ms)
    this.t0 = performance.now();
    this.lastShotAt = 0;
    this.lastHitAt = 0;
    this.lastMissAt = 0;

    // ---- rolling windows ----
    this.hitTimes = [];     // deltas between hits (ms) for tempo
    this.shotTimes = [];    // deltas between spawns (ms) for spawn tempo
    this.windowMax = 24;

    // ---- RT proxy ----
    // We don't have exact "spawn->hit" here unless engine provides it.
    // So we store time between "opportunity" and hit as coarse proxy:
    this.pendingShots = []; // queue of shot timestamps (ms)
    this.rtSamples = [];    // estimated rt (ms) = hitAt - oldestPendingShotAt

    // ---- derived ----
    this._lastSnapshot = null;
  }

  // Called when engine spawns a target (opportunity)
  onShot(tsMs){
    const t = Number.isFinite(tsMs) ? tsMs : performance.now();
    this.totalShots++;

    if (this.lastShotAt > 0){
      const d = t - this.lastShotAt;
      if (d > 0 && d < 8000){
        this.shotTimes.push(d);
        if (this.shotTimes.length > this.windowMax) this.shotTimes.shift();
      }
    }
    this.lastShotAt = t;

    // queue for RT proxy
    this.pendingShots.push(t);
    if (this.pendingShots.length > this.windowMax) this.pendingShots.shift();
  }

  // Called when user hits something (any target)
  onHit(tsMs){
    const t = Number.isFinite(tsMs) ? tsMs : performance.now();
    this.hits++;
    this.hitStreak++;
    this.bestStreak = Math.max(this.bestStreak, this.hitStreak);

    if (this.lastHitAt > 0){
      const d = t - this.lastHitAt;
      if (d > 0 && d < 6000){
        this.hitTimes.push(d);
        if (this.hitTimes.length > this.windowMax) this.hitTimes.shift();
      }
    }
    this.lastHitAt = t;

    // RT proxy: match earliest pending shot
    if (this.pendingShots.length){
      const s = this.pendingShots.shift();
      const rt = t - s;
      if (rt > 0 && rt < 8000){
        this.rtSamples.push(rt);
        if (this.rtSamples.length > this.windowMax) this.rtSamples.shift();
      }
    }
  }

  // Called when a target expires (renderer callback) or engine decides MISS
  onMiss(tsMs){
    const t = Number.isFinite(tsMs) ? tsMs : performance.now();
    this.misses++;
    this.hitStreak = 0;
    this.lastMissAt = t;

    // drop one pending shot if exists (to keep queue aligned)
    if (this.pendingShots.length) this.pendingShots.shift();
  }

  getTotalShots(){ return this.totalShots|0; }
  getHits(){ return this.hits|0; }
  getMisses(){ return this.misses|0; }

  // ---------- stats helpers ----------
  _mean(arr){
    if (!arr || !arr.length) return 0;
    let s = 0;
    for (const v of arr) s += v;
    return s / arr.length;
  }
  _median(arr){
    if (!arr || !arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = (a.length/2)|0;
    return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2;
  }
  _sd(arr){
    if (!arr || arr.length < 2) return 0;
    const mu = this._mean(arr);
    let s2 = 0;
    for (const v of arr) s2 += (v-mu)*(v-mu);
    return Math.sqrt(s2 / (arr.length - 1));
  }

  // Build a snapshot for AI predictor/coach
  // Engine can pass extra info (hp/fever/phase/boss etc.)
  snapshot(extra = {}){
    const judged = this.hits + this.misses;
    const accPct = judged > 0 ? (this.hits / judged) * 100 : 0;

    const rtMean = this._mean(this.rtSamples);
    const rtMed  = this._median(this.rtSamples);
    const rtSd   = this._sd(this.rtSamples);

    // pace: average spawn interval (ms) and hit interval (ms)
    const spawnMean = this._mean(this.shotTimes);
    const hitMean   = this._mean(this.hitTimes);

    // simple fatigue proxy: more misses recently + slowing hits
    const slowHit = hitMean > 0 ? clamp01((hitMean - 420) / 1200) : 0; // 420ms baseline
    const missRate = judged > 0 ? clamp01(this.misses / judged) : 0;

    const fatigueProxy = clamp01(
      missRate * 0.55 +
      slowHit * 0.35 +
      (Number(extra.hp)!=null ? clamp01((1 - (Number(extra.hp)/100))) * 0.10 : 0)
    );

    const snap = {
      // core
      accPct: Number(accPct.toFixed(2)),
      hits: this.hits|0,
      misses: this.misses|0,
      judged: judged|0,
      totalShots: this.totalShots|0,

      // streak
      hitStreak: this.hitStreak|0,
      bestStreak: this.bestStreak|0,

      // tempo
      spawnIntervalMeanMs: Math.round(spawnMean || 0),
      hitIntervalMeanMs: Math.round(hitMean || 0),

      // RT proxy
      rtMeanMs: Math.round(rtMean || 0),
      rtMedianMs: Math.round(rtMed || 0),
      rtSdMs: Math.round(rtSd || 0),

      // explainable risk
      missRate: Number(missRate.toFixed(3)),
      fatigueProxy: Number(fatigueProxy.toFixed(3)),

      // passthrough extras for AI
      ...extra
    };

    this._lastSnapshot = snap;
    return snap;
  }

  lastSnapshot(){
    return this._lastSnapshot;
  }
}