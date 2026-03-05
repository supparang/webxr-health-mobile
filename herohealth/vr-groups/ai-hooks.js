// === /herohealth/vr-groups/ai-hooks.js ===
// HeroHealth AI Hooks — GroupsVR (Prediction-only, Explainable) — PRODUCTION
// FULL v20260305a-GROUPS-AI-PRED-EXPLAIN
// ✅ Enable only when ?ai=1 AND run!=research
// ✅ Computes hazardRisk (0..1) + topFactors[2] from live gameplay signals
// ✅ Emits: hha:ai_pred {enabled, hazardRisk, topFactors, snapshot}
// ✅ Provides: window.HHA_AI = { onSpawn,onHit,onExpire,onTick,onEnd,getPrediction,reset }
// Notes:
// - This is NOT adaptive difficulty (no gameplay changes), prediction/coach only.
// - Deterministic-ish when seed provided (uses xmur3+sfc32) but still robust without.
(function(){
  'use strict';
  const WIN = window;

  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }
  const RUN = String(qs('run','play')).toLowerCase();
  const AI_ON = String(qs('ai','0')).toLowerCase();
  const ENABLED = (RUN !== 'research') && (AI_ON === '1' || AI_ON === 'true');

  // seed (deterministic-ish)
  const SEED = String(qs('seed','') || Date.now());

  function xmur3(str){
    str = String(str||'');
    let h = 1779033703 ^ str.length;
    for(let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  const _s = xmur3('HHA|GroupsAI|' + SEED);
  const rng = sfc32(_s(), _s(), _s(), _s());

  function clamp(v,a,b){
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }
  function nowMs(){
    return (performance && performance.now) ? performance.now() : Date.now();
  }
  function ema(prev, x, alpha){
    alpha = clamp(alpha, 0.01, 0.99);
    return prev + alpha * (x - prev);
  }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }

  // -------------------------
  // Live signals (prediction inputs)
  // -------------------------
  const S = {
    enabled: ENABLED,
    lastAt: 0,

    // counters
    shots: 0,
    hits: 0,
    miss: 0,

    // moving signals
    accEma: 0.75,        // 0..1
    missRateEma: 0.10,   // 0..1
    cadenceEma: 0.45,    // shots/sec
    ttlPressureEma: 0.25,// 0..1 (proxy from expire events)
    latePressureEma: 0.0,// 0..1 (from elapsed ratio if provided)
    jitterEma: 0.15,     // 0..1 (variance of cadence)
    // time tracking
    lastShotAt: 0,
    lastShotDt: 0,
    // stage/context
    stage: 'main',
    diff: String(qs('diff','normal')).toLowerCase(),
    view: String(qs('view','mobile')).toLowerCase(),
    // internal prediction
    hazardRisk: 0.25,
    topFactors: ['—','—'],
    snapshot: {},
    // emit throttle
    lastEmitMs: 0,
    emitEveryMs: 420,
  };

  function reset(){
    S.shots=0; S.hits=0; S.miss=0;
    S.accEma=0.75; S.missRateEma=0.10;
    S.cadenceEma=0.45; S.ttlPressureEma=0.25;
    S.latePressureEma=0.0; S.jitterEma=0.15;
    S.lastShotAt=0; S.lastShotDt=0;
    S.stage='main';
    S.hazardRisk=0.25;
    S.topFactors=['—','—'];
    S.snapshot={};
    S.lastEmitMs=0;
  }

  // -------------------------
  // Explainability: pick top 2 reasons
  // -------------------------
  function rankFactors(f){
    // f: {key, score, msg}
    return f
      .filter(x=>x && x.score>0.001)
      .sort((a,b)=> (b.score - a.score))
      .slice(0,2)
      .map(x=>x.msg);
  }

  // -------------------------
  // Compute hazard risk (0..1)
  // -------------------------
  function computeRisk(){
    // normalize
    const acc = clamp(S.accEma, 0, 1);
    const missR = clamp(S.missRateEma, 0, 1);
    const cad = clamp(S.cadenceEma, 0, 4.0); // shots/sec
    const ttlP = clamp(S.ttlPressureEma, 0, 1);
    const lateP= clamp(S.latePressureEma, 0, 1);
    const jit  = clamp(S.jitterEma, 0, 1);

    // baseline by diff (slightly higher)
    const base =
      (S.diff === 'easy') ? 0.18 :
      (S.diff === 'hard') ? 0.30 : 0.24;

    // risk components (prediction-only)
    const lowAcc     = clamp((0.78 - acc) / 0.40, 0, 1);  // bad when acc low
    const missSpike  = clamp((missR - 0.10) / 0.35, 0, 1);// bad when miss rising
    const spray      = clamp((cad - 1.2) / 2.0, 0, 1);    // too fast -> worse
    const panicJit   = clamp((jit - 0.18) / 0.55, 0, 1);  // erratic cadence
    const ttlTight   = ttlP;                               // expiry pressure
    const lateGame   = lateP;

    // stage bump
    const stageBump = (S.stage === 'boss') ? 0.12 : (S.stage === 'storm') ? 0.06 : 0.0;

    // weighted sum
    let r =
      base +
      0.38*lowAcc +
      0.40*missSpike +
      0.16*spray +
      0.18*panicJit +
      0.22*ttlTight +
      0.18*lateGame +
      stageBump;

    // tiny deterministic noise for variety (does NOT affect gameplay)
    r += (rng() - 0.5) * 0.03;

    r = clamp(r, 0, 1);

    // factors for explainability
    const factors = [
      { key:'acc',  score: lowAcc,   msg:'ความแม่นต่ำ → โฟกัส “หมู่ที่ถูก” ก่อน' },
      { key:'miss', score: missSpike,msg:'พลาดเริ่มถี่ → ช้าลงนิด แล้วเล็งให้ชัวร์' },
      { key:'spam', score: spray,    msg:'ยิงรัวเกิน → รอจังหวะให้ตรงกลางก่อนยิง' },
      { key:'jit',  score: panicJit, msg:'จังหวะแกว่ง → หยุด 0.3s แล้วคุมคอมโบ' },
      { key:'ttl',  score: ttlTight, msg:'เป้าหมดอายุเร็ว → ยิง “เป้าถูกหมู่” ที่ใกล้สุดก่อน' },
      { key:'late', score: lateGame, msg:'ช่วงท้ายเดือดขึ้น → รักษาคอมโบ มากกว่ายิงเยอะ' },
      { key:'boss', score: (S.stage==='boss')?1:0, msg:'บอสมา → เน้น “หมู่เดียว” ให้แม่น' }
    ];

    S.hazardRisk = r;
    S.topFactors = rankFactors(factors);
    S.snapshot = {
      accPct: Math.round(acc*100),
      missRate: Math.round(missR*100),
      cadence: Number(cad.toFixed(2)),
      ttlPressure: Number(ttlP.toFixed(2)),
      latePressure: Number(lateP.toFixed(2)),
      jitter: Number(jit.toFixed(2)),
      stage: S.stage,
      diff: S.diff,
      view: S.view
    };
  }

  function maybeEmit(){
    const t = nowMs();
    if((t - S.lastEmitMs) < S.emitEveryMs) return;
    S.lastEmitMs = t;

    emit('hha:ai_pred', {
      enabled: S.enabled,
      hazardRisk: S.hazardRisk,
      topFactors: S.topFactors,
      snapshot: S.snapshot
    });
  }

  // -------------------------
  // Hooks called by engine
  // -------------------------
  function onSpawn(kind, payload){
    if(!S.enabled) return;
    // expiry pressure proxy: more spawns -> tighter
    // (engine also calls onExpire which is stronger)
    S.ttlPressureEma = ema(S.ttlPressureEma, 0.30, 0.04);
  }

  function onHit(kind, payload){
    if(!S.enabled) return;

    // kind examples from your engine: groups_ok, groups_wrong
    const ok = (String(kind||'') === 'groups_ok');

    S.shots++;
    if(ok) S.hits++;
    else   S.miss++;

    const acc = (S.shots>0) ? (S.hits / S.shots) : 0.75;
    S.accEma = ema(S.accEma, acc, 0.08);

    const missR = (S.shots>0) ? (S.miss / S.shots) : 0.10;
    S.missRateEma = ema(S.missRateEma, missR, 0.07);

    // cadence + jitter from shot timing
    const t = nowMs();
    if(S.lastShotAt){
      const dt = clamp((t - S.lastShotAt)/1000, 0.05, 2.0);
      const cps = 1 / dt;
      S.cadenceEma = ema(S.cadenceEma, cps, 0.10);

      // jitter = difference between dt and EMA dt (rough)
      const dd = Math.abs(dt - (S.lastShotDt || dt));
      const j = clamp(dd / 0.55, 0, 1);
      S.jitterEma = ema(S.jitterEma, j, 0.08);

      S.lastShotDt = dt;
    }
    S.lastShotAt = t;

    computeRisk();
    maybeEmit();
  }

  function onExpire(kind, payload){
    if(!S.enabled) return;

    // expire of mission target is strong signal of TTL pressure
    const k = String(kind||'');
    if(k === 'groups_target'){
      S.ttlPressureEma = ema(S.ttlPressureEma, 0.92, 0.16);
      S.miss = (S.miss|0) + 1;
    }else{
      S.ttlPressureEma = ema(S.ttlPressureEma, 0.55, 0.10);
    }

    const missR = (S.shots>0) ? (S.miss / S.shots) : 0.10;
    S.missRateEma = ema(S.missRateEma, missR, 0.06);

    computeRisk();
    maybeEmit();
  }

  function onTick(dt, info){
    if(!S.enabled) return;

    // stage from engine info (if provided)
    if(info && info.stage) S.stage = String(info.stage);

    // late pressure: if engine passes elapsed/planned we can use it (optional)
    // (your engine v20260303f passes dt + {miss, combo, acc, stage} only)
    // we approximate latePressure from time-driven vibe: if stage==boss -> late
    const late = (S.stage === 'boss') ? 1 : 0;
    S.latePressureEma = ema(S.latePressureEma, late, 0.04);

    // decay ttl pressure slowly
    S.ttlPressureEma = ema(S.ttlPressureEma, 0.20, 0.015);

    computeRisk();
    maybeEmit();
  }

  function onEnd(summary){
    if(!S.enabled) return;
    // final emit
    computeRisk();
    emit('hha:ai_pred', {
      enabled: S.enabled,
      hazardRisk: S.hazardRisk,
      topFactors: S.topFactors,
      snapshot: { ...S.snapshot, end: true, scoreFinal: summary?.scoreFinal, miss: summary?.miss }
    });
  }

  function getPrediction(){
    return {
      enabled: S.enabled,
      hazardRisk: S.hazardRisk,
      topFactors: S.topFactors,
      snapshot: S.snapshot
    };
  }

  // expose
  WIN.HHA_AI = {
    enabled: S.enabled,
    reset,
    onSpawn,
    onHit,
    onExpire,
    onTick,
    onEnd,
    getPrediction
  };

  // initial emit (even if disabled, for UI)
  emit('hha:ai_pred', {
    enabled: S.enabled,
    hazardRisk: S.hazardRisk,
    topFactors: S.topFactors,
    snapshot: { stage:'main', diff:S.diff, view:S.view }
  });
})();