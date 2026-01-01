// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (hooks only; AI default OFF)
// ✅ Collects rolling metrics (accuracy/miss/rt/streak/fatigue proxy)
// ✅ Deterministic-friendly (seed input, no randomness inside)
// ✅ Provides hooks for: Difficulty Director / Coach / Pattern Generator
// ✅ Safe defaults: disabled in research unless explicitly enabled

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ return (typeof performance!=='undefined' ? performance.now() : Date.now()); }

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function qsBool(k, def=false){
  const v = qs(k, null);
  if(v==null) return def;
  return (v==='1'||v==='true'||v==='yes');
}

export function createAIHooks(opts={}){
  const run = (opts.runMode || qs('run','play')).toLowerCase();
  const isResearch = (run==='research' || run==='study');

  // ✅ AI is OFF by default, especially in research
  const enabled = (() => {
    if (isResearch) return qsBool('ai', false); // research must opt-in
    return qsBool('ai', false) || !!opts.enabled; // play can opt-in too
  })();

  const seed = (opts.seed ?? Number(qs('seed', 0)) ?? 0) || 0;

  // Rolling metrics (simple, deterministic)
  const M = {
    enabled,
    runMode: run,
    isResearch,
    seed,

    // counts
    hit: 0,
    miss: 0,
    hitGood: 0,
    hitBad: 0,
    streak: 0,
    streakMax: 0,

    // RT
    rtN: 0,
    rtSum: 0,
    rtAvg: 0,

    // time windows
    t0: nowMs(),
    lastEventMs: 0,

    // fatigue/frustration proxy
    missBurst: 0,
    missBurstMax: 0,
    fatigue: 0,        // 0..1
    frustration: 0,    // 0..1

    // difficulty suggestion output (hooks)
    diffHint: {
      // director can write suggestions; engine may choose to read them
      spawnRateMul: 1,
      sizeMul: 1,
      speedMul: 1,
      pattern: null, // e.g., 'grid9', 'ring', 'wave'
    },

    // coach output (micro tips)
    coach: {
      lastTipMs: 0,
      lastTip: '',
    }
  };

  // subscribers
  const subs = new Map(); // event -> Set(fn)
  function on(evt, fn){
    if(!subs.has(evt)) subs.set(evt, new Set());
    subs.get(evt).add(fn);
    return ()=> subs.get(evt)?.delete(fn);
  }
  function emit(evt, payload){
    const set = subs.get(evt);
    if(!set || set.size===0) return;
    for(const fn of set){
      try{ fn(payload); }catch(e){ /* never break game */ }
    }
  }

  function resetSession(){
    M.hit = M.miss = M.hitGood = M.hitBad = 0;
    M.streak = M.streakMax = 0;
    M.rtN = M.rtSum = M.rtAvg = 0;
    M.missBurst = M.missBurstMax = 0;
    M.fatigue = 0;
    M.frustration = 0;
    M.diffHint.spawnRateMul = 1;
    M.diffHint.sizeMul = 1;
    M.diffHint.speedMul = 1;
    M.diffHint.pattern = null;
    M.coach.lastTipMs = 0;
    M.coach.lastTip = '';
    M.t0 = nowMs();
    emit('session:reset', { ...M });
  }

  // ---- core recorders (call from game engine) ----
  function recordHit({good=true, rtMs=null}={}){
    M.hit++;
    if(good) M.hitGood++; else M.hitBad++;
    M.streak++;
    M.streakMax = Math.max(M.streakMax, M.streak);
    M.missBurst = 0;

    if(rtMs!=null){
      const r = clamp(rtMs, 60, 5000);
      M.rtN++; M.rtSum += r;
      M.rtAvg = (M.rtSum / Math.max(1, M.rtN));
    }

    updateFatigueFrustration();
    M.lastEventMs = nowMs();
    emit('event:hit', { good, rtMs, metrics: snapshot() });
  }

  function recordMiss({reason='miss'}={}){
    M.miss++;
    M.streak = 0;
    M.missBurst++;
    M.missBurstMax = Math.max(M.missBurstMax, M.missBurst);

    updateFatigueFrustration();
    M.lastEventMs = nowMs();
    emit('event:miss', { reason, metrics: snapshot() });
  }

  function recordTick({timeLeftSec=null}={}){
    // optional: engine calls every ~1s or per HUD tick
    updateFatigueFrustration();
    emit('event:tick', { timeLeftSec, metrics: snapshot() });
  }

  function recordGoal({done=false, id='goal'}={}){
    emit('quest:goal', { id, done, metrics: snapshot() });
  }
  function recordMini({done=false, id='mini', reason=''}={}){
    emit('quest:mini', { id, done, reason, metrics: snapshot() });
  }

  function updateFatigueFrustration(){
    // deterministic proxy:
    // - frustration rises with missBurst
    // - fatigue rises slowly with session time and low accuracy
    const total = M.hit + M.miss;
    const acc = total>0 ? (M.hit / total) : 1;
    const t = (nowMs() - M.t0) / 1000; // sec
    const f1 = clamp(M.missBurst / 6, 0, 1);
    const f2 = clamp((t / 180), 0, 1) * clamp((1 - acc), 0, 1);
    M.frustration = clamp(0.55*f1 + 0.45*f2, 0, 1);
    M.fatigue = clamp(0.25*clamp(t/240,0,1) + 0.75*f2, 0, 1);
  }

  function accuracy(){
    const total = M.hit + M.miss;
    return total>0 ? (M.hit / total) : 1;
  }

  function snapshot(){
    // return lightweight snapshot for logs/UI
    return {
      enabled: M.enabled,
      runMode: M.runMode,
      isResearch: M.isResearch,
      seed: M.seed,
      hit: M.hit,
      miss: M.miss,
      hitGood: M.hitGood,
      hitBad: M.hitBad,
      streak: M.streak,
      streakMax: M.streakMax,
      rtAvg: Math.round(M.rtAvg||0),
      accuracy: Number(accuracy().toFixed(4)),
      missBurst: M.missBurst,
      fatigue: Number(M.fatigue.toFixed(4)),
      frustration: Number(M.frustration.toFixed(4)),
      diffHint: { ...M.diffHint },
      coach: { ...M.coach },
    };
  }

  // ---- coach helper (rate-limited micro tips) ----
  function canTip(minGapMs=12000){
    const t = nowMs();
    return (t - M.coach.lastTipMs) >= minGapMs;
  }
  function pushTip(text, minGapMs=12000){
    if(!text) return false;
    if(!canTip(minGapMs)) return false;
    M.coach.lastTipMs = nowMs();
    M.coach.lastTip = String(text);
    emit('coach:tip', { text: M.coach.lastTip, metrics: snapshot() });
    return true;
  }

  // ---- director hint setters (AI can write; engine may read) ----
  function setDiffHint(patch={}){
    if(patch.spawnRateMul!=null) M.diffHint.spawnRateMul = clamp(patch.spawnRateMul, 0.4, 2.5);
    if(patch.sizeMul!=null)      M.diffHint.sizeMul      = clamp(patch.sizeMul, 0.6, 1.8);
    if(patch.speedMul!=null)     M.diffHint.speedMul     = clamp(patch.speedMul, 0.6, 1.8);
    if(patch.pattern!==undefined) M.diffHint.pattern = patch.pattern;
    emit('director:hint', { hint: { ...M.diffHint }, metrics: snapshot() });
  }

  const api = {
    enabled: ()=> M.enabled,
    runMode: ()=> M.runMode,
    isResearch: ()=> M.isResearch,
    seed: ()=> M.seed,
    metrics: ()=> snapshot(),

    on, emit,
    resetSession,

    recordHit,
    recordMiss,
    recordTick,
    recordGoal,
    recordMini,

    // helpers for AI modules later
    pushTip,
    setDiffHint,
  };

  return api;
}