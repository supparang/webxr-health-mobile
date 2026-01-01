// === /herohealth/vr/ai-director.js ===
// HHA AI Difficulty Director — UNIVERSAL (deterministic + fair)
// ✅ Play: adaptive (smooth) based on skill/frustration/fatigue
// ✅ Research: locked (diff only) for experiment control
// ✅ Deterministic: optional seeded noise (very small) for natural feel, still repeatable
// Returns tuning multipliers you can apply in each game:
//   { spawnMul, sizeMul, badBias, shieldBias, stormMul, hintAggro }
//
// Usage (in game loop):
//  const DD = createAIDifficultyDirector({ mode: run, diff, seed, adaptive: run!=='research' });
//  const tune = DD.update({ acc, combo, missesRate, timeNorm, inStorm });
//  // then apply:
//  // spawnDelay *= (1 / tune.spawnMul)
//  // targetSize *= tune.sizeMul
//  // badProb += tune.badBias; shieldProb += tune.shieldBias

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function lerp(a,b,t){ return a + (b-a)*clamp(t,0,1); }

// tiny deterministic rng (optional)
function hashStr(s){
  s=String(s||''); let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0);
}
function makeRng(seedStr){
  let x = hashStr(seedStr) || 123456789;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x>>>0) / 4294967296;
  };
}

export function createAIDifficultyDirector(opts={}){
  const mode = String(opts.mode || 'play').toLowerCase();   // play/research
  const diff = String(opts.diff || 'normal').toLowerCase(); // easy/normal/hard
  const adaptive = !!(opts.adaptive ?? (mode !== 'research'));
  const seed = String(opts.seed || 'hha');
  const rng = makeRng(seed + '|dd');

  // Base difficulty target (0..1)
  const baseK =
    diff === 'easy' ? 0.30 :
    diff === 'hard' ? 0.72 :
    0.50;

  // Internal smooth state
  let k = baseK;             // difficulty state 0..1
  let skillEMA = 0.50;
  let frustEMA = 0.20;
  let fatEMA   = 0.10;

  // helper: smooth EMA
  function ema(prev, cur, a){
    return prev*(1-a) + cur*a;
  }

  function update(metrics={}){
    // metrics (suggested):
    //  acc: 0..1
    //  combo: integer
    //  missesRate: 0..1 (misses per sec normalized)
    //  timeNorm: 0..1 (progress through session)
    //  inStorm: bool
    const acc = clamp(metrics.acc ?? 0.6, 0, 1);
    const combo = clamp(metrics.combo ?? 0, 0, 99);
    const missesRate = clamp(metrics.missesRate ?? 0.10, 0, 1);
    const timeNorm = clamp(metrics.timeNorm ?? 0.0, 0, 1);
    const inStorm = !!metrics.inStorm;

    // estimate skill/frustration/fatigue
    const skill = clamp(acc*0.75 + clamp(combo/18,0,1)*0.25, 0, 1);
    const frustration = clamp(missesRate*0.70 + (1-acc)*0.30, 0, 1);
    const fatigue = clamp(timeNorm, 0, 1);

    // smooth
    skillEMA = ema(skillEMA, skill, 0.08);
    frustEMA = ema(frustEMA, frustration, 0.10);
    fatEMA   = ema(fatEMA, fatigue, 0.04);

    // Research mode: locked difficulty, still provide consistent multipliers
    if (!adaptive){
      const fixed = baseK;
      return deriveTune(fixed, { skill:skillEMA, frust:frustEMA, fat:fatEMA, inStorm, locked:true });
    }

    // Adaptive: “fair” rule set
    // - if skill high and frustration low => increase difficulty slowly
    // - if frustration high => decrease difficulty faster
    // - during storm, reduce adaptation speed (avoid feeling random)
    const wantUp   = clamp((skillEMA - 0.60) * 1.3, 0, 1);  // only when skill > 0.60
    const wantDown = clamp((frustEMA - 0.55) * 1.6, 0, 1);  // only when frust > 0.55

    let delta = 0;
    delta += +0.020 * wantUp;
    delta += -0.045 * wantDown;

    // fatigue softly reduces difficulty over time (micro relief)
    delta += -0.010 * clamp((fatEMA - 0.70) * 2.0, 0, 1);

    // damp in storm (keep consistent)
    if (inStorm) delta *= 0.55;

    // tiny deterministic “breathing” noise (optional), super small and repeatable
    const noise = (rng()*2-1) * 0.002;
    delta += noise;

    // clamp k, but keep around base by spring
    const spring = (baseK - k) * 0.006;  // pulls back gently toward base for fairness
    k = clamp(k + delta + spring, 0.08, 0.92);

    return deriveTune(k, { skill:skillEMA, frust:frustEMA, fat:fatEMA, inStorm, locked:false });
  }

  function deriveTune(k01, ctx){
    // Convert difficulty state to multipliers and probability biases
    // Higher k => faster spawns, smaller targets, more bad, fewer shields

    // spawnMul: 0.85..1.30
    const spawnMul = lerp(0.90, 1.26, k01);

    // sizeMul: 1.10..0.78
    const sizeMul  = lerp(1.06, 0.80, k01);

    // badBias: -0.04..+0.10  (add to bad probability)
    const badBias  = lerp(-0.03, 0.095, k01);

    // shieldBias: +0.06..-0.04 (add to shield probability)
    const shieldBias = lerp(0.050, -0.035, k01);

    // stormMul: 0.92..1.10 (harder => slightly longer storm / more pressure)
    const stormMul = lerp(0.95, 1.08, k01);

    // hintAggro: 0..1 (when frustration high, coach can speak more often)
    const hintAggro = clamp(ctx.frust*1.10 + (ctx.locked?0.0:0.10), 0, 1);

    // safety rails (don’t punish too hard if very frustrated)
    const relief = clamp((ctx.frust - 0.70) * 2.0, 0, 1);
    const spawnMulSafe = spawnMul * (1 - 0.22*relief);
    const sizeMulSafe  = sizeMul  * (1 + 0.18*relief);
    const badBiasSafe  = badBias  * (1 - 0.45*relief);
    const shieldBiasSafe = shieldBias + (0.03*relief);

    return {
      k: k01,
      locked: !!ctx.locked,
      spawnMul: clamp(spawnMulSafe, 0.80, 1.35),
      sizeMul:  clamp(sizeMulSafe, 0.75, 1.20),
      badBias:  clamp(badBiasSafe, -0.06, 0.12),
      shieldBias: clamp(shieldBiasSafe, -0.06, 0.10),
      stormMul: clamp(stormMul, 0.90, 1.15),
      hintAggro
    };
  }

  function getState(){
    return { mode, diff, adaptive, baseK, k, skillEMA, frustEMA, fatEMA };
  }

  return { update, getState };
}