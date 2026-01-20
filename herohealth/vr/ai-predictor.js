// === /herohealth/vr/ai-predictor.js ===
// HHA AI Predictor — PRODUCTION (Explainable, lightweight, cross-game ready)
// ✅ Emits: hha:predict {game, risk, reasons, at, meta}
// ✅ No ML runtime (safe for kids). Uses rolling stats + interpretable rules.
// ✅ Designed for research: deterministic-ish + feature logging ready.
//
// Usage (in hydration.safe.js):
//   import { createAIPredictor } from '../vr/ai-predictor.js';
//   const PRED = createAIPredictor({ emit, game:'hydration' });
//   ...
//   PRED.onUpdate({ t, waterPct, waterZone, misses, combo, acc, inStorm, inEndWindow, shield, dt });
//   // and optionally: const snap = PRED.getLast();

'use strict';

export function createAIPredictor(opts = {}){
  const WIN = (typeof window !== 'undefined') ? window : globalThis;
  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : ((name, detail)=>{ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } });

  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const now=()=> Date.now();

  const game = String(opts.game || 'game').toLowerCase();

  // Rolling window (seconds)
  const W = clamp(opts.windowSec ?? 8, 3, 20);

  // State
  const S = {
    lastAt: 0,
    lastEmitAt: 0,
    last: null,

    // rolling arrays (timestamped)
    missPts: [], // {t, v} v=misses
    comboPts: [],// {t, v} v=combo
    zonePts: [], // {t, v} v=zone code
    waterPts: [],// {t, v} v=waterPct

    // derived
    missRate: 0,        // misses per sec
    comboDropRate: 0,   // negative slope
    zoneGreenFrac: 0,   // fraction in GREEN
    waterVel: 0,        // pct per sec (signed)
  };

  function prune(arr, t){
    const minT = t - W;
    while(arr.length && arr[0].t < minT) arr.shift();
  }

  function slope(arr){
    // simple slope = (last-first)/dt
    if(arr.length < 2) return 0;
    const a = arr[0], b = arr[arr.length-1];
    const dt = Math.max(0.001, b.t - a.t);
    return (b.v - a.v) / dt;
  }

  function zoneCode(z){
    const s = String(z||'').toUpperCase();
    if(s==='GREEN') return 1;
    if(s==='LOW') return 2;
    if(s==='HIGH') return 3;
    return 0;
  }

  function greenFrac(arr){
    if(arr.length < 2) return 0;
    // approximate by counting points in green
    let g=0;
    for(const p of arr){ if(p.v === 1) g++; }
    return g / arr.length;
  }

  function compute(t, st){
    prune(S.missPts, t); prune(S.comboPts, t); prune(S.zonePts, t); prune(S.waterPts, t);

    S.missRate = Math.max(0, slope(S.missPts));          // miss/sec
    S.comboDropRate = Math.min(0, slope(S.comboPts));    // negative => drop
    S.zoneGreenFrac = greenFrac(S.zonePts);
    S.waterVel = slope(S.waterPts);                      // pct/sec

    const acc = clamp(st.acc ?? 0, 0, 100) / 100;
    const shield = (st.shield|0);
    const inStorm = !!st.inStorm;
    const inEndWindow = !!st.inEndWindow;

    // --- Risk scores (0..1) ---
    // 1) Risk leaving GREEN: low green fraction + velocity toward extremes + low accuracy
    let riskZone = 0;
    const z = String(st.waterZone||'').toUpperCase();
    if(z !== 'GREEN'){
      riskZone = 0.75; // already out
    } else {
      const vel = Math.abs(S.waterVel); // fast swing => unstable
      riskZone =
        0.15 +
        (0.55 * (1 - S.zoneGreenFrac)) +
        (0.20 * clamp(vel/18, 0, 1)) +
        (0.10 * (1 - acc));
    }
    riskZone = clamp(riskZone, 0, 1);

    // 2) Risk storm fail: during storm & end window, low shield + miss rate
    let riskStorm = 0;
    if(inStorm){
      riskStorm =
        0.18 +
        (0.45 * clamp(S.missRate/0.8, 0, 1)) +
        (0.25 * (shield<=0 ? 1 : shield===1 ? 0.5 : 0.15)) +
        (0.12 * (1 - acc)) +
        (inEndWindow ? 0.15 : 0);
    }
    riskStorm = clamp(riskStorm, 0, 1);

    // 3) Risk panic/fatigue: high miss rate + combo collapse
    let riskPanic =
      0.10 +
      (0.55 * clamp(S.missRate/1.0, 0, 1)) +
      (0.20 * clamp((-S.comboDropRate)/6, 0, 1)) +
      (0.15 * (1 - acc));
    riskPanic = clamp(riskPanic, 0, 1);

    // Combine (weighted)
    const risk =
      clamp(0.42*riskZone + 0.38*riskStorm + 0.20*riskPanic, 0, 1);

    // Reasons (explainable)
    const reasons = [];
    if(riskZone > 0.55){
      reasons.push(`zoneRisk↑ (GREEN stability ${(S.zoneGreenFrac*100).toFixed(0)}%, vel ${S.waterVel.toFixed(1)}%/s)`);
    }
    if(riskStorm > 0.55){
      reasons.push(`stormRisk↑ (missRate ${S.missRate.toFixed(2)}/s, shield ${shield}${inEndWindow?' +end':''})`);
    }
    if(riskPanic > 0.55){
      reasons.push(`panicRisk↑ (missRate ${S.missRate.toFixed(2)}/s, comboSlope ${S.comboDropRate.toFixed(2)}/s)`);
    }
    if(reasons.length===0){
      reasons.push('stable');
    }

    return {
      game,
      risk,
      riskZone,
      riskStorm,
      riskPanic,
      reasons,
      meta: {
        acc: Number((acc*100).toFixed(1)),
        missRate: Number(S.missRate.toFixed(3)),
        comboSlope: Number(S.comboDropRate.toFixed(3)),
        greenFrac: Number(S.zoneGreenFrac.toFixed(3)),
        waterVel: Number(S.waterVel.toFixed(3)),
        shield,
        inStorm,
        inEndWindow
      }
    };
  }

  function maybeEmit(t, pack){
    const cd = clamp(opts.cooldownMs ?? 900, 250, 4000);
    if(t - S.lastEmitAt < cd) return;
    S.lastEmitAt = t;
    emit('hha:predict', Object.assign({ at: now() }, pack));
  }

  function onUpdate(st = {}){
    const t = Number(st.t ?? (performance.now()/1000)) || 0;
    // feed rolling points (seconds domain)
    S.missPts.push({ t, v: Number(st.misses||0) });
    S.comboPts.push({ t, v: Number(st.combo||0) });
    S.zonePts.push({ t, v: zoneCode(st.waterZone) });
    S.waterPts.push({ t, v: Number(st.waterPct ?? 50) });

    const pack = compute(t, st);
    S.last = pack;

    // emit only when meaningful or periodic
    const big = pack.risk >= 0.60 || pack.riskStorm >= 0.60 || pack.riskZone >= 0.60;
    if(big) maybeEmit(t, Object.assign({ level:'warn' }, pack));
    else if(opts.emitStable) maybeEmit(t, Object.assign({ level:'ok' }, pack));
  }

  function getLast(){ return S.last; }

  return { onUpdate, getLast };
}