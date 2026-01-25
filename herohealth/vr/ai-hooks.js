// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (shared)
// ✅ Deterministic (seeded) when needed
// ✅ Lightweight "ML-lite" predictors (EMA + logistic-ish score)
// ✅ Rate-limited coach tips
// ✅ Exports: createAIHooks(cfg)

'use strict';

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return performance?.now ? performance.now() : Date.now(); }

function sigmoid(x){ return 1/(1+Math.exp(-x)); }

/**
 * createAIHooks(cfg)
 * cfg:
 *  - enabled: boolean
 *  - seed: number
 *  - difficulty: 'easy'|'normal'|'hard'
 *  - coachEmit(fn(msg,tag,meta))
 *  - emit(fn(name,detail))   // event bridge
 */
export function createAIHooks(cfg){
  const enabled = !!cfg?.enabled;
  const seed = Number(cfg?.seed||Date.now());
  const rng = seededRng(seed ^ 0xA11C0DE);

  const emit = typeof cfg?.emit === 'function' ? cfg.emit : ()=>{};
  const coachEmit = typeof cfg?.coachEmit === 'function' ? cfg.coachEmit : ()=>{};

  // ML-lite state (EMA)
  const s = {
    t0: now(),
    emaAcc: 0.92,
    emaMissRate: 0.05,
    emaJunkRate: 0.10,
    emaSpeed: 0.55,     // hits/sec (rough)
    lastHitAt: 0,
    lastCoachAt: 0,
    coachCooldownMs: 2200,
    lastTuneAt: 0,
    tuneCooldownMs: 900,
    lastStormAt: 0,
    stormCooldownMs: 12000,
    bossIssued: false
  };

  function updateAfterEvent(metrics){
    if(!enabled) return;

    const acc = clamp(metrics?.accuracy ?? 0.9, 0, 1);
    const missRate = clamp(metrics?.missRate ?? 0.05, 0, 1);
    const junkRate = clamp(metrics?.junkRate ?? 0.10, 0, 1);

    // EMA smoothing
    const a = 0.12;
    s.emaAcc = (1-a)*s.emaAcc + a*acc;
    s.emaMissRate = (1-a)*s.emaMissRate + a*missRate;
    s.emaJunkRate = (1-a)*s.emaJunkRate + a*junkRate;

    // speed proxy
    const t = now();
    if(metrics?.justHit){
      if(s.lastHitAt > 0){
        const dt = Math.max(0.2, (t - s.lastHitAt)/1000);
        const instSpeed = clamp(1/dt, 0, 4);
        const b = 0.10;
        s.emaSpeed = (1-b)*s.emaSpeed + b*instSpeed;
      }
      s.lastHitAt = t;
    }

    // prediction (prob miss next 3s)
    const x =
      (+2.2)*(0.75 - s.emaAcc) +
      (+2.0)*(s.emaMissRate) +
      (+1.2)*(s.emaJunkRate) +
      (+0.8)*(0.35 - s.emaSpeed);

    const pMissSoon = clamp(sigmoid(x), 0, 1);

    emit('hha:ai', {
      pMissSoon,
      emaAcc: s.emaAcc,
      emaMissRate: s.emaMissRate,
      emaJunkRate: s.emaJunkRate,
      emaSpeed: s.emaSpeed
    });

    maybeCoach(metrics, pMissSoon);
  }

  function maybeCoach(metrics, pMissSoon){
    const t = now();
    if(t - s.lastCoachAt < s.coachCooldownMs) return;

    const leftSec = Number(metrics?.leftSec ?? 0);
    const combo = Number(metrics?.combo ?? 0);

    // explainable micro-tips
    if(pMissSoon > 0.72){
      s.lastCoachAt = t;
      coachEmit('โฟกัสกลางจอ! เล็งให้ชัวร์ก่อนกด ✨', 'AI Coach', { reason:'pMissSoon_high' });
      return;
    }
    if(s.emaJunkRate > 0.22){
      s.lastCoachAt = t;
      coachEmit('ระวังเป้าแดง 🍟 เจอแล้วให้หลบ!', 'AI Coach', { reason:'junk_high' });
      return;
    }
    if(s.emaAcc < 0.72 && leftSec > 10){
      s.lastCoachAt = t;
      coachEmit('ลองช้าลงนิดนึงแล้วเก็บเป็นชุด ๆ จะตรงขึ้นนะ 👍', 'AI Coach', { reason:'acc_low' });
      return;
    }
    if(combo >= 8){
      s.lastCoachAt = t;
      coachEmit('คอมโบสวยมาก! รักษาจังหวะนี้ไว้ 🔥', 'AI Coach', { reason:'combo_good' });
      return;
    }
  }

  /**
   * difficulty director
   * returns tuning: { spawnRateMul, ttlMul, junkWeightMul }
   * - deterministic: depends only on EMA state (seeded init + events)
   */
  function tuneDifficulty(){
    if(!enabled) return null;

    const t = now();
    if(t - s.lastTuneAt < s.tuneCooldownMs) return null;
    s.lastTuneAt = t;

    // target comfort zone
    const acc = s.emaAcc;
    const miss = s.emaMissRate;
    const junk = s.emaJunkRate;

    // If player struggles -> ease; if strong -> harder
    const struggle = clamp((0.78 - acc) + miss*0.7 + junk*0.6, 0, 1);
    const mastery  = clamp((acc - 0.88) + (0.10 - miss) + (0.14 - junk), 0, 1);

    // DeepLearning-style "policy output" (but still lightweight)
    let spawnRateMul = 1.0;
    let ttlMul = 1.0;
    let junkWeightMul = 1.0;

    spawnRateMul *= (1.0 + mastery*0.22) * (1.0 - struggle*0.25);
    ttlMul      *= (1.0 - mastery*0.10) * (1.0 + struggle*0.18);
    junkWeightMul *= (1.0 + mastery*0.25) * (1.0 - struggle*0.15);

    // clamp
    spawnRateMul = clamp(spawnRateMul, 0.75, 1.28);
    ttlMul = clamp(ttlMul, 0.82, 1.25);
    junkWeightMul = clamp(junkWeightMul, 0.75, 1.35);

    return { spawnRateMul, ttlMul, junkWeightMul, struggle, mastery };
  }

  /**
   * Pattern Generator (storm/boss triggers)
   * deterministic schedule bucketed by time
   * returns: { stormOn:boolean, bossOn:boolean, stormMs:number }
   */
  function patternTick(metrics){
    if(!enabled) return null;

    const t = now();
    const elapsed = (t - s.t0)/1000;
    const leftSec = Number(metrics?.leftSec ?? 0);
    const totalSec = Number(metrics?.totalSec ?? 90);

    // boss once at ~60% progress if doing well
    let bossOn = false;
    const progress = clamp(1 - (leftSec/Math.max(1,totalSec)), 0, 1);
    if(!s.bossIssued && progress >= 0.55 && s.emaAcc >= 0.83){
      s.bossIssued = true;
      bossOn = true;
    }

    // storm burst every ~12s if player too comfy
    let stormOn = false;
    let stormMs = 0;

    const comfy = (s.emaAcc > 0.90 && s.emaMissRate < 0.10);
    if(comfy && (t - s.lastStormAt > s.stormCooldownMs)){
      s.lastStormAt = t;
      stormOn = true;
      // deterministic duration from rng but stable
      stormMs = 2200 + Math.floor(rng()*1200);
    }

    // emit hooks
    if(bossOn) emit('hha:boss', { on:true, atSec: elapsed });
    if(stormOn) emit('hha:storm', { on:true, ms: stormMs, atSec: elapsed });

    return { bossOn, stormOn, stormMs };
  }

  return {
    enabled,
    updateAfterEvent,
    tuneDifficulty,
    patternTick
  };
}