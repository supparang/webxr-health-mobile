// === /herohealth/vr/pattern-gen.js ===
// HHA Pattern Generator — PRODUCTION
// ✅ Seeded deterministic patterns for storm / boss / rage
// ✅ Returns "spawn directives" you can blend with your base probabilities
//
// Usage:
//   const PG = makePatternGen({ seed, mode:'hydration' });
//   const step = PG.step({ t, inStorm, bossActive, rageOn });
//   step = { bias: {good:+0.0, bad:+0.1, shield:+0.05}, shape:'ring|cross|grid9|spray', speedMul:1.0 }

'use strict';

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
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function makePatternGen(opts={}){
  const seed = String(opts.seed || 'seed');
  const mode = String(opts.mode || 'generic');
  const rng = makeRng(seed + '|' + mode);

  // pattern timeline (sec) deterministic: repeats nicely
  const baseSeq = [
    { name:'calm',   dur:6.0, shape:'spray', bias:{ good:+0.08, bad:-0.06, shield:+0.02 }, speedMul:1.00 },
    { name:'mix',    dur:7.0, shape:'grid9', bias:{ good:+0.00, bad:+0.04, shield:+0.00 }, speedMul:0.96 },
    { name:'pressure',dur:7.0,shape:'ring',  bias:{ good:-0.04, bad:+0.08, shield:+0.02 }, speedMul:0.90 },
    { name:'focus',  dur:6.0, shape:'cross', bias:{ good:+0.02, bad:+0.06, shield:+0.00 }, speedMul:0.92 },
  ];

  const stormSeq = [
    { name:'storm-open', dur:2.2, shape:'ring',  bias:{ good:-0.10, bad:+0.12, shield:+0.06 }, speedMul:0.74 },
    { name:'storm-mid',  dur:2.2, shape:'grid9', bias:{ good:-0.06, bad:+0.10, shield:+0.04 }, speedMul:0.70 },
    { name:'storm-end',  dur:2.0, shape:'cross', bias:{ good:-0.02, bad:+0.12, shield:+0.06 }, speedMul:0.66 },
  ];

  const bossSeq = [
    { name:'boss-w1', dur:1.2, shape:'cross', bias:{ good:-0.12, bad:+0.18, shield:+0.06 }, speedMul:0.60 },
    { name:'boss-w2', dur:1.2, shape:'ring',  bias:{ good:-0.10, bad:+0.20, shield:+0.05 }, speedMul:0.58 },
  ];

  const rageSeq = [
    { name:'rage-1', dur:1.0, shape:'spray', bias:{ good:-0.12, bad:+0.22, shield:+0.04 }, speedMul:0.55 },
    { name:'rage-2', dur:1.0, shape:'grid9', bias:{ good:-0.10, bad:+0.24, shield:+0.04 }, speedMul:0.53 },
    { name:'rage-3', dur:1.0, shape:'cross', bias:{ good:-0.08, bad:+0.24, shield:+0.05 }, speedMul:0.52 },
  ];

  function pickSequence(ctx){
    if (ctx.rageOn) return rageSeq;
    if (ctx.bossActive) return bossSeq;
    if (ctx.inStorm) return stormSeq;
    return baseSeq;
  }

  // deterministic phase offset
  const phaseOffset = rng() * 3.5;

  function step(ctx){
    const t = Number(ctx.t || 0) + phaseOffset;

    const seq = pickSequence(ctx);
    let sum = 0;
    let pick = seq[0];
    const total = seq.reduce((a,b)=>a+b.dur,0);

    const tt = ((t % total) + total) % total;
    for (const p of seq){
      sum += p.dur;
      if (tt <= sum){ pick = p; break; }
    }

    // tiny deterministic noise per step (keeps it alive but stable)
    const n = (rng()*2-1) * 0.02;
    const bias = {
      good: clamp((pick.bias.good||0) + n, -0.25, +0.25),
      bad:  clamp((pick.bias.bad||0)  - n, -0.25, +0.35),
      shield: clamp((pick.bias.shield||0) + (rng()*0.02), -0.10, +0.20),
    };

    return {
      name: pick.name,
      shape: pick.shape,
      bias,
      speedMul: clamp(pick.speedMul * (1 + n*0.5), 0.45, 1.05)
    };
  }

  // spawn shape helper (optional): gives normalized target positions
  function shapePoints(shape, count){
    count = clamp(count, 1, 12)|0;
    const pts = [];
    if (shape === 'grid9'){
      const grid = [
        [0.2,0.2],[0.5,0.2],[0.8,0.2],
        [0.2,0.5],[0.5,0.5],[0.8,0.5],
        [0.2,0.8],[0.5,0.8],[0.8,0.8],
      ];
      for (let i=0;i<count;i++) pts.push(grid[i%grid.length]);
      return pts;
    }
    if (shape === 'cross'){
      const cross = [[0.5,0.2],[0.5,0.8],[0.2,0.5],[0.8,0.5],[0.5,0.5]];
      for (let i=0;i<count;i++) pts.push(cross[i%cross.length]);
      return pts;
    }
    if (shape === 'ring'){
      const k = count;
      const R = 0.28;
      for (let i=0;i<k;i++){
        const a = (i/k)*Math.PI*2;
        pts.push([0.5 + Math.cos(a)*R, 0.5 + Math.sin(a)*R]);
      }
      return pts;
    }
    // spray
    for (let i=0;i<count;i++){
      const x = 0.15 + rng()*0.70;
      const y = 0.15 + rng()*0.70;
      pts.push([x,y]);
    }
    return pts;
  }

  return { step, shapePoints };
}