// === /herohealth/ai/director-goodjunk.js ===
// Convert estimator output -> spawnMs / probabilities adjustments (explainable)
// Works in play mode; in research/study you typically disable adaptive.

'use strict';
import { clamp } from './skill-estimator.js';

export function makeDirectorGoodJunk(opts={}){
  const cfg = {
    // safe bounds
    spawnMin: 520,
    spawnMax: 1080,
    // probability bounds
    pJunkMin: 0.18,
    pJunkMax: 0.55,
    pGoodMin: 0.35,
    pGoodMax: 0.80,
    // smoothing
    lerpA: 0.18,
    ...opts
  };

  const S = { last:null };

  function lerp(a,b,t){ return a + (b-a)*t; }

  function apply(base, est, ctx){
    // base: {spawnMs,pGood,pJunk,pStar,pShield}
    // est: {skillScore,riskMiss5s,tier,reasons}
    // ctx: {playedSec, diff, bossActive?}
    const risk = clamp(est?.riskMiss5s ?? 0.25, 0, 1);
    const skill = clamp(est?.skillScore ?? 0.55, 0, 1);

    // Intuition:
    // - risk high -> slow down + reduce junk + increase shield/star a bit
    // - skill high -> speed up + increase junk slightly + reward star less
    const tEase = clamp((risk*0.80 + (1-skill)*0.35), 0, 1);
    const tHard = clamp((skill*0.70 + (1-risk)*0.20), 0, 1);

    let spawnMs = base.spawnMs;
    // move spawn toward easier/harder target
    const targetSpawn =
      lerp(cfg.spawnMin, cfg.spawnMax, tEase); // higher tEase => slower (larger ms)
    // invert for hard
    const hardSpawn =
      lerp(cfg.spawnMax, cfg.spawnMin, tHard); // higher tHard => faster (smaller ms)
    // blend both (ease wins if risk high)
    spawnMs = lerp(hardSpawn, targetSpawn, clamp(risk*0.85, 0, 1));

    let pJunk = clamp(base.pJunk + lerp(+0.06, -0.10, tEase) + lerp(0.00, +0.06, tHard), cfg.pJunkMin, cfg.pJunkMax);
    let pGood = clamp(base.pGood + lerp(+0.10, -0.08, tHard) + lerp(0.00, +0.08, (1-tEase)), cfg.pGoodMin, cfg.pGoodMax);

    // increase help items when risk high
    let pStar   = clamp(base.pStar   + 0.02*(risk), 0.01, 0.10);
    let pShield = clamp(base.pShield + 0.03*(risk), 0.01, 0.12);

    // If boss active: keep it spicy but not unfair
    if(ctx?.bossActive){
      spawnMs = Math.max(cfg.spawnMin, spawnMs - 120);
      pShield = clamp(pShield + 0.01, 0.01, 0.14);
      pStar   = clamp(pStar   + 0.01, 0.01, 0.12);
      pJunk   = clamp(pJunk   + 0.02, cfg.pJunkMin, cfg.pJunkMax);
    }

    // normalize
    let s = pGood + pJunk + pStar + pShield;
    if(s <= 0) s = 1;
    pGood/=s; pJunk/=s; pStar/=s; pShield/=s;

    const out = { spawnMs, pGood, pJunk, pStar, pShield };

    // smooth output
    if(S.last){
      const a = cfg.lerpA;
      for(const k of Object.keys(out)){
        out[k] = (1-a)*S.last[k] + a*out[k];
      }
    }
    S.last = { ...out };
    return out;
  }

  return { apply };
}