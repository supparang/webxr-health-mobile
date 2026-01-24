// === /herohealth/vr/ai-director.js ===
// HHA AI Director — PACK 15 (PRODUCTION)
// ✅ Pattern Generator (seeded): spawn cadence + kind weights + position policy (anti-clump)
// ✅ Difficulty Director (fair): nudges difficulty within guardrails (play only)
// ✅ research/practice: deterministic pattern, difficulty adapt OFF
//
// API:
//   const dir = HHA_AIDirector.create({ game:'groups', runMode, seed });
//   dir.tick1s(features, ctxRect?) -> { spawnMul, weights, pos, stormAdvanceMs, lifeMul, sizeMul, bossHpAdj }
//   dir.onSpawnCommitted({x,y})  // update anti-clump memory
//   dir.destroy()

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;

  function clamp(v,a,b){ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }
  function hashSeed(str){
    str = String(str ?? '');
    let h=2166136261>>>0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h,16777619);
    }
    return h>>>0;
  }
  function makeRng(seedU32){
    let s=(seedU32>>>0)||1;
    return function(){
      s=(Math.imul(1664525,s)+1013904223)>>>0;
      return s/4294967296;
    };
  }

  function pickWeighted(rng, items){
    // items: [{k, w}]
    let sum=0;
    for(const it of items) sum += Math.max(0, Number(it.w)||0);
    if(sum<=0) return items[0]?.k;
    let r = rng()*sum;
    for(const it of items){
      r -= Math.max(0, Number(it.w)||0);
      if(r<=0) return it.k;
    }
    return items[items.length-1]?.k;
  }

  function dist2(ax,ay,bx,by){
    const dx=ax-bx, dy=ay-by;
    return dx*dx+dy*dy;
  }

  function create(cfg){
    cfg = cfg||{};
    const runMode = String(cfg.runMode||'play').toLowerCase();
    const game = String(cfg.game||'hha');
    const seed = String(cfg.seed ?? '0');

    const isResearch = (runMode==='research' || runMode==='practice');

    // Two RNGs: pattern and variation (both seeded)
    const rngP = makeRng(hashSeed(seed+'::aid::pattern::'+game));
    const rngV = makeRng(hashSeed(seed+'::aid::var::'+game));

    // Anti-clump memory
    const mem = {
      last: [], // [{x,y,t}]
      max: 7
    };

    // Target “flow” baseline
    let spawnMul = 1.0;
    let lifeMul  = 1.0;
    let sizeMul  = 1.0;
    let bossHpAdj= 0;
    let stormAdvanceMs = 0;

    // weights for kinds (good/wrong/junk) - nudged each second
    let wGood = 0.70;
    let wWrong= 0.18;
    let wJunk = 0.12;

    // Difficulty director state (play only)
    let skill = 0.55;     // 0..1 (inferred)
    let stress= 0.0;      // 0..1 (from misses/pressure)
    let lastBand = 'low';
    let lastTuneAt = 0;

    function inferSkill(f){
      // combine accuracy & combo stability
      const acc = clamp(f.accuracyGoodPct ?? f.accuracy ?? 0, 0, 100)/100;
      const combo = clamp(f.combo ?? 0, 0, 30)/30;
      const miss = clamp(f.misses ?? 0, 0, 40)/40;
      // prefer accuracy, penalize miss
      const s = clamp(0.62*acc + 0.28*combo + 0.10*(1-miss), 0, 1);
      return s;
    }

    function inferStress(f){
      const p = clamp(f.pressureLevel ?? 0, 0, 3)/3;
      const miss = clamp(f.misses ?? 0, 0, 18)/18;
      const left = clamp(f.timeLeft ?? f.leftSec ?? 0, 0, 180);
      const clutch = clamp((12-left)/12, 0, 1);
      return clamp(0.55*p + 0.35*miss + 0.10*clutch, 0, 1);
    }

    function tuneFairness(f){
      // research/practice: fixed pattern, no tuning
      if(isResearch) return;

      const now = (root.performance && performance.now) ? performance.now() : Date.now();
      if(now - lastTuneAt < 900) return; // tune at most ~1s
      lastTuneAt = now;

      // Update skill/stress with smoothing
      const s = inferSkill(f);
      const st= inferStress(f);
      skill = clamp(skill*0.72 + s*0.28, 0, 1);
      stress= clamp(stress*0.70 + st*0.30, 0, 1);

      // Guardrails (เด็ก ป.5): อย่าให้โหดเกิน
      // Flow: faster when skill high AND stress low; slower when stress high
      const wantFast = (skill>0.72 && stress<0.35);
      const wantSlow = (stress>0.62);

      if(wantFast){
        spawnMul = clamp(spawnMul*0.985, 0.80, 1.12);
        lifeMul  = clamp(lifeMul*0.985, 0.82, 1.05);
        sizeMul  = clamp(sizeMul*0.995, 0.90, 1.06);
        wWrong   = clamp(wWrong + 0.004, 0.12, 0.26);
        wJunk    = clamp(wJunk  + 0.003, 0.08, 0.22);
      }else if(wantSlow){
        spawnMul = clamp(spawnMul*1.020, 0.86, 1.22);
        lifeMul  = clamp(lifeMul*1.020, 0.90, 1.18);
        sizeMul  = clamp(sizeMul*1.010, 0.92, 1.12);
        wWrong   = clamp(wWrong - 0.006, 0.10, 0.24);
        wJunk    = clamp(wJunk  - 0.004, 0.06, 0.20);
      }else{
        // gentle drift to baseline
        spawnMul = clamp(spawnMul*0.998 + 1.0*0.002, 0.84, 1.18);
        lifeMul  = clamp(lifeMul*0.998 + 1.0*0.002, 0.86, 1.12);
        sizeMul  = clamp(sizeMul*0.998 + 1.0*0.002, 0.90, 1.10);
      }

      // normalize weights
      wGood = clamp(1 - (wWrong+wJunk), 0.55, 0.82);
      const sum = wGood+wWrong+wJunk;
      wGood/=sum; wWrong/=sum; wJunk/=sum;

      // bossHP nudge: only when doing really well
      bossHpAdj = (skill>0.80 && stress<0.38) ? 1 : 0;

      // storm advance: only for play excitement, but bounded
      stormAdvanceMs = (stress<0.40 && skill>0.68) ? 1200 : 0;
    }

    function pickKind(){
      // deterministic pick for research too (still uses rngP)
      return pickWeighted(rngP, [
        {k:'good', w:wGood},
        {k:'wrong',w:wWrong},
        {k:'junk', w:wJunk},
      ]);
    }

    function pickPos(rect){
      // rect: {xMin,xMax,yMin,yMax,W,H}
      // Use “anchor grid” + jitter, reject if too close to recent
      const R = rect;
      const cols = 3, rows = 3;
      const ax = [];
      for(let ry=0; ry<rows; ry++){
        for(let cx=0; cx<cols; cx++){
          const px = R.xMin + (cx+0.5)*(R.xMax-R.xMin)/cols;
          const py = R.yMin + (ry+0.5)*(R.yMax-R.yMin)/rows;
          ax.push({x:px,y:py});
        }
      }

      const minD = Math.max(86, Math.min(140, (R.W||360)*0.22)); // anti-clump threshold
      const minD2 = minD*minD;

      for(let attempt=0; attempt<10; attempt++){
        const a = ax[(rngP()*ax.length)|0];
        const jx = (rngV()*2-1) * Math.max(18, (R.W||360)*0.06);
        const jy = (rngV()*2-1) * Math.max(18, (R.H||640)*0.06);
        const x = clamp(a.x + jx, R.xMin, R.xMax);
        const y = clamp(a.y + jy, R.yMin, R.yMax);

        let ok=true;
        for(const it of mem.last){
          if(dist2(x,y,it.x,it.y) < minD2){ ok=false; break; }
        }
        if(ok) return {x,y};
      }

      // fallback random
      return {
        x: R.xMin + rngP()*(R.xMax-R.xMin),
        y: R.yMin + rngP()*(R.yMax-R.yMin),
      };
    }

    function onSpawnCommitted(pt){
      if(!pt) return;
      mem.last.push({x:pt.x,y:pt.y,t:Date.now()});
      if(mem.last.length>mem.max) mem.last.shift();
    }

    function tick1s(features, rect){
      // update fairness tuning
      tuneFairness(features||{});

      // If we have AI risk band from PACK14, we can “cool down” if band high
      const band = String(features?.aiBand || '').toLowerCase();
      if(!isResearch){
        if(band==='high'){
          spawnMul = clamp(spawnMul*1.018, 0.88, 1.22);
          wWrong   = clamp(wWrong - 0.006, 0.10, 0.24);
          wJunk    = clamp(wJunk  - 0.005, 0.06, 0.20);
          wGood = clamp(1-(wWrong+wJunk), 0.58, 0.84);
          lastBand='high';
        }else if(band==='mid'){
          // small nudge only
          lastBand='mid';
        }else if(band==='low'){
          lastBand='low';
        }
      }

      // produce a deterministic position hint if rect passed
      const pos = rect ? pickPos(rect) : null;

      return {
        spawnMul,
        lifeMul,
        sizeMul,
        bossHpAdj,
        stormAdvanceMs,
        weights: { good:wGood, wrong:wWrong, junk:wJunk },
        pickKind,
        pos
      };
    }

    function destroy(){ /* nothing heavy */ }

    return { tick1s, onSpawnCommitted, destroy, isResearch, seed, runMode };
  }

  root.HHA_AIDirector = { create };

})(typeof window!=='undefined' ? window : globalThis);