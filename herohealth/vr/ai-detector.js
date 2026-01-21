// === /herohealth/vr/ai-predictor.js ===
// AI Predictor — PRODUCTION (Explainable Risk + Research-friendly)
// ✅ Emits: hha:predict { game, risk, level, probFail, features, weights, at }
// ✅ Deterministic-ish in research (no random)
// ✅ Designed to be trained later: features are stable, numeric

'use strict';

export function createAIPredictor(opts = {}){
  const WIN = (typeof window !== 'undefined') ? window : globalThis;

  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : ((name, detail)=>{ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } });

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const now=()=>Date.now();

  const game = String(opts.game || 'game').toLowerCase();
  const run  = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const inResearch = (run === 'research' || run === 'study');

  const cooldownMs = clamp(parseInt(qs('predCd', String(opts.cooldownMs ?? 900)),10)||900, 200, 6000);
  const emitStable = (String(qs('predStable', String(opts.emitStable ?? '0'))).toLowerCase() === '1');

  // weights: tune per game (explainable)
  // you can override by query: ?w_miss=1.2 etc.
  const W = {
    missRate: 1.05,
    accLow:   0.95,
    comboLow: 0.55,
    zoneBad:  0.75, // in storm: must be LOW/HIGH, but outside storm should stay GREEN
    storm:    0.55,
    endWin:   0.85,
    shield0:  0.65,
    fatigue:  0.35,
    // bias
    bias:    -0.85
  };

  // query overrides
  Object.keys(W).forEach(k=>{
    const q = qs('w_'+k, null);
    if(q!==null){
      const v = parseFloat(q);
      if(Number.isFinite(v)) W[k]=v;
    }
  });

  const S = {
    lastAt: 0,
    last: null
  };

  function sigmoid(x){ return 1/(1+Math.exp(-x)); }

  function riskLevel(r){
    if (r >= 0.72) return 'danger';
    if (r >= 0.50) return 'care';
    return 'ok';
  }

  function onUpdate(st = {}){
    const t = now();
    if (t - S.lastAt < cooldownMs) return S.last;
    S.lastAt = t;

    // expected inputs from hydration.safe.js
    const acc = clamp((st.acc ?? 0), 0, 100) / 100;
    const misses = clamp((st.misses ?? 0), 0, 9999);
    const combo = clamp((st.combo ?? 0), 0, 9999);
    const waterPct = clamp((st.waterPct ?? 50), 0, 100);
    const zone = String(st.waterZone ?? '').toUpperCase();
    const inStorm = !!st.inStorm;
    const inEnd = !!st.inEndWindow;
    const shield = (st.shield|0);
    const fatigue = clamp((st.fatigue ?? 0), 0, 1);

    // features (0..1)
    const f = {
      accLow: clamp(1 - acc, 0, 1),
      missRate: clamp(misses / Math.max(1, (st.elapsedSec ?? 25)), 0, 1), // misses per ~sec window
      comboLow: clamp(1 - (Math.min(combo, 18)/18), 0, 1),
      zoneBad: 0,
      storm: inStorm ? 1 : 0,
      endWin: inEnd ? 1 : 0,
      shield0: (shield<=0) ? 1 : 0,
      fatigue
    };

    // zoneBad meaning:
    // - outside storm: bad if not GREEN
    // - in storm: bad if still GREEN (because mini expects LOW/HIGH)
    if (!inStorm){
      f.zoneBad = (zone !== 'GREEN') ? 1 : 0;
    } else {
      f.zoneBad = (zone === 'GREEN') ? 1 : 0;
    }

    // score -> probFail
    let z =
      W.bias +
      W.missRate * f.missRate +
      W.accLow   * f.accLow +
      W.comboLow * f.comboLow +
      W.zoneBad  * f.zoneBad +
      W.storm    * f.storm +
      W.endWin   * f.endWin +
      W.shield0  * f.shield0 +
      W.fatigue  * f.fatigue;

    const probFail = clamp(sigmoid(z), 0, 1);
    const risk = probFail; // same scale

    const pack = {
      game,
      runMode: run,
      inResearch,
      risk,
      level: riskLevel(risk),
      probFail,
      waterPct,
      waterZone: zone,
      at: t,
      features: Object.assign({}, f),
      weights: Object.assign({}, W)
    };

    // emit only on change if emitStable=false
    if (!emitStable && S.last && S.last.level === pack.level){
      S.last = pack;
      return pack;
    }

    S.last = pack;
    emit('hha:predict', pack);
    return pack;
  }

  function getLast(){ return S.last; }

  return { onUpdate, getLast };
}