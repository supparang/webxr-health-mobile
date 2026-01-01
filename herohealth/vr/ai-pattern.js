// === /herohealth/vr/ai-pattern.js ===
// HHA AI Pattern Generator — Hydration-ready (seeded + deterministic)
// ✅ Pattern packs: scatter / ring / spiral / cross / edges / squeeze
// ✅ Storm phases (1..3) with deterministic schedule
// ✅ Boss window helper: can bias spawns to center / edges, etc.
// Returns next spawn XY in percent for a given playRect.
//
// Usage in hydration.safe.js:
//  import { createAIPatternGenerator } from '../vr/ai-pattern.js';
//  const PAT = createAIPatternGenerator({ seed, diff, mode: run });
//  const { xPct, yPct } = PAT.nextXY({ rect, inStorm:S.stormActive, stormLeft:S.stormLeftSec, endWindow:S.inEndWindow, boss:S.bossActive });

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function lerp(a,b,t){ return a + (b-a)*clamp(t,0,1); }

// seeded rng
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

export function createAIPatternGenerator(opts={}){
  const seed = String(opts.seed || 'hha');
  const diff = String(opts.diff || 'normal').toLowerCase();
  const mode = String(opts.mode || 'play').toLowerCase(); // play/research
  const locked = (mode === 'research');
  const rng = makeRng(seed + '|pattern');

  // internal phase schedule
  // Each storm has phases: early/mid/late. We expose phase by time left ratio.
  function phaseFromStorm(stormLeft, stormDur){
    if (!stormDur || stormDur <= 0) return 1;
    const r = clamp(stormLeft / stormDur, 0, 1);
    // r: 1 -> start, 0 -> end
    if (r > 0.66) return 1;
    if (r > 0.33) return 2;
    return 3;
  }

  // We keep a current pattern that changes occasionally.
  let curPattern = 'scatter';
  let step = 0;

  // deterministic pattern switch clock
  let switchEvery = (diff==='hard'? 9 : diff==='easy'? 12 : 10); // in spawns
  let untilSwitch = switchEvery;

  function pickPattern(ctx){
    // ctx: { inStorm, endWindow, boss, phase }
    // Weighted choices; during storm prefer structured patterns.
    const inStorm = !!ctx.inStorm;
    const endW = !!ctx.endWindow;
    const boss = !!ctx.boss;
    const ph = ctx.phase|0;

    // End window: tighter / more dramatic
    if (endW){
      return boss ? 'squeeze' : (ph>=3 ? 'cross' : 'ring');
    }
    // Boss window: center/edge emphasis
    if (boss){
      return (rng() < 0.5) ? 'squeeze' : 'edges';
    }
    // Storm: more structure
    if (inStorm){
      const r = rng();
      if (ph===1){
        if (r < 0.32) return 'ring';
        if (r < 0.60) return 'scatter';
        if (r < 0.80) return 'edges';
        return 'cross';
      } else if (ph===2){
        if (r < 0.36) return 'spiral';
        if (r < 0.62) return 'ring';
        if (r < 0.82) return 'cross';
        return 'edges';
      } else {
        if (r < 0.42) return 'squeeze';
        if (r < 0.70) return 'spiral';
        if (r < 0.86) return 'cross';
        return 'ring';
      }
    }
    // Normal play: mostly scatter with occasional shapes
    const r = rng();
    if (r < 0.60) return 'scatter';
    if (r < 0.74) return 'ring';
    if (r < 0.86) return 'cross';
    if (r < 0.94) return 'edges';
    return 'spiral';
  }

  function advancePattern(ctx){
    untilSwitch--;
    if (untilSwitch > 0) return;
    untilSwitch = switchEvery;

    // In research locked mode, pattern schedule is deterministic anyway by rng+counter.
    // In play mode, still deterministic given seed, so reproducible if seed fixed.
    curPattern = pickPattern(ctx);
    step = 0;
  }

  function rectPad(rect, pad){
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    return {
      left: rect.left + pad,
      top: rect.top + pad,
      width: Math.max(1, w - pad*2),
      height: Math.max(1, h - pad*2)
    };
  }

  // --- pattern primitives (return px inside padded rect) ---
  function pScatter(r){
    // triangular-ish distribution for nicer spread
    const rx=(rng()+rng())/2;
    const ry=(rng()+rng())/2;
    return {
      x: r.left + rx*r.width,
      y: r.top  + ry*r.height
    };
  }

  function pRing(r){
    const cx = r.left + r.width*0.5;
    const cy = r.top  + r.height*0.5;
    const rad = Math.min(r.width, r.height) * (0.22 + 0.10*rng());
    const a = (step * (Math.PI/5)) + rng()*0.35;
    step++;
    return {
      x: cx + Math.cos(a)*rad,
      y: cy + Math.sin(a)*rad
    };
  }

  function pSpiral(r){
    const cx = r.left + r.width*0.5;
    const cy = r.top  + r.height*0.5;
    const t = step / 18;
    const rad = Math.min(r.width, r.height) * clamp(0.08 + t*0.05, 0.08, 0.40);
    const a = step*0.62 + rng()*0.25;
    step++;
    return {
      x: cx + Math.cos(a)*rad,
      y: cy + Math.sin(a)*rad
    };
  }

  function pCross(r){
    // alternate horizontal / vertical arms around center
    const cx = r.left + r.width*0.5;
    const cy = r.top  + r.height*0.5;
    const arm = (step % 4);
    step++;
    const spanX = r.width * (0.30 + 0.12*rng());
    const spanY = r.height* (0.30 + 0.12*rng());
    if (arm === 0) return { x: cx - spanX, y: cy + (rng()*2-1)*spanY*0.10 };
    if (arm === 1) return { x: cx + spanX, y: cy + (rng()*2-1)*spanY*0.10 };
    if (arm === 2) return { x: cx + (rng()*2-1)*spanX*0.10, y: cy - spanY };
    return { x: cx + (rng()*2-1)*spanX*0.10, y: cy + spanY };
  }

  function pEdges(r){
    // pick an edge segment, slide along it
    const edge = (rng()*4)|0; // 0 top,1 right,2 bottom,3 left
    const t = (rng()+rng())/2;
    const inset = Math.min(r.width, r.height) * (0.06 + 0.03*rng());
    if (edge === 0) return { x: r.left + t*r.width, y: r.top + inset };
    if (edge === 1) return { x: r.left + r.width - inset, y: r.top + t*r.height };
    if (edge === 2) return { x: r.left + t*r.width, y: r.top + r.height - inset };
    return { x: r.left + inset, y: r.top + t*r.height };
  }

  function pSqueeze(r){
    // squeeze to center corridor (hard / boss feel)
    const cx = r.left + r.width*0.5;
    const cy = r.top  + r.height*0.5;
    const spread = Math.min(r.width, r.height) * (diff==='hard'?0.10:0.14);
    const rx = (rng()*2-1);
    const ry = (rng()*2-1);
    step++;
    return { x: cx + rx*spread, y: cy + ry*spread };
  }

  function pickPointPx(ctx){
    const rect = ctx.rect || { left:0, top:0, width:1, height:1 };
    const pad = clamp(ctx.pad ?? 22, 10, 48);
    const r = rectPad(rect, pad);

    const inStorm = !!ctx.inStorm;
    const endWindow = !!ctx.endWindow;
    const boss = !!ctx.boss;
    const stormLeft = Number(ctx.stormLeft||0);
    const stormDur = Number(ctx.stormDur||0);
    const phase = ctx.phase || phaseFromStorm(stormLeft, stormDur);

    const pctx = { inStorm, endWindow, boss, phase };

    advancePattern(pctx);

    // force “dramatic” pattern in end window even if currently scatter
    const pat = endWindow ? (boss ? 'squeeze' : 'cross') : curPattern;

    if (pat === 'ring') return pRing(r);
    if (pat === 'spiral') return pSpiral(r);
    if (pat === 'cross') return pCross(r);
    if (pat === 'edges') return pEdges(r);
    if (pat === 'squeeze') return pSqueeze(r);
    return pScatter(r);
  }

  function toPct(px, rect){
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const x = clamp(px.x - rect.left, 0, w);
    const y = clamp(px.y - rect.top, 0, h);
    return {
      xPct: (x / w) * 100,
      yPct: (y / h) * 100
    };
  }

  function nextXY(ctx={}){
    const rect = ctx.rect || { left:0, top:0, width:1, height:1 };
    // allow caller to pass stormDur so phases behave exactly like game
    const stormDur = Number(ctx.stormDur || 6.0);

    const px = pickPointPx({
      rect,
      pad: ctx.pad,
      inStorm: ctx.inStorm,
      endWindow: ctx.endWindow,
      boss: ctx.boss,
      stormLeft: ctx.stormLeft,
      stormDur,
      phase: ctx.phase
    });

    const pct = toPct(px, rect);

    // safety clamp to 4..96 to avoid edges / HUD overlap if any
    return {
      xPct: clamp(pct.xPct, 4, 96),
      yPct: clamp(pct.yPct, 4, 96),
      pattern: curPattern
    };
  }

  function getState(){
    return { seed, diff, mode, locked, curPattern, untilSwitch, switchEvery, step };
  }

  return { nextXY, getState };
}