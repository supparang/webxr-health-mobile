// === /fitness/js/ai-pattern.js ===
// Seeded Pattern Generator (deterministic, fair)

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function fnv1a32(str){
  let h = 0x811c9dc5;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))) >>> 0;
  }
  return h >>> 0;
}
function makeRng(seedStr){
  let x = fnv1a32(seedStr) || 1234567;
  return function(){
    x ^= x<<13; x >>>= 0;
    x ^= x>>17; x >>>= 0;
    x ^= x<<5;  x >>>= 0;
    return (x>>>0)/4294967296;
  };
}

export function createPatternGenerator(opts){
  const o = Object.assign({
    seed:'0',
    pid:'anon',
    game:'unknown',
    totalSec: 60,
    boss: false
  }, opts||{});

  const rng = makeRng(`${o.seed}|${o.pid}|${o.game}|pattern`);

  // fairness: prevent consecutive spikes too often
  let lastTag = '';

  function pickTag(pool){
    // avoid repeating same tag
    const list = pool.filter(t=>t!==lastTag);
    const use = list.length ? list : pool;
    const t = use[Math.floor(rng()*use.length)];
    lastTag = t;
    return t;
  }

  function block(type, dur, intensity, tag){
    return {
      type,
      dur: Math.round(dur),
      intensity: Number(clamp(intensity,0,1).toFixed(3)),
      tag: tag || ''
    };
  }

  function generate(){
    const out = [];
    let left = o.totalSec;

    // opener
    const opener = clamp(8 + rng()*6, 8, 14);
    out.push(block('warm', opener, 0.15 + rng()*0.15, pickTag(['steady','wide','center'])));
    left -= opener;

    // mid blocks
    while(left > 18){
      const r = rng();
      if(r < 0.15){
        // relief/bonus
        const d = clamp(6 + rng()*6, 6, 12);
        out.push(block('relief', d, 0.10 + rng()*0.10, pickTag(['bonus','slow','big'])));
        left -= d;
      } else if(r < 0.45){
        // spike
        const d = clamp(6 + rng()*6, 6, 12);
        out.push(block('spike', d, 0.65 + rng()*0.25, pickTag(['zigzag','rush','feint'])));
        left -= d;
      } else {
        // flow
        const d = clamp(10 + rng()*10, 10, 20);
        out.push(block('flow', d, 0.30 + rng()*0.25, pickTag(['left','right','alt','mix'])));
        left -= d;
      }
    }

    // finale
    if(o.boss){
      const bossDur = clamp(10 + rng()*6, 10, 16);
      out.push(block('boss', bossDur, 0.85 + rng()*0.12, pickTag(['phase','storm','burst'])));
      left -= bossDur;
    }

    if(left > 0){
      out.push(block('flow', left, 0.35, pickTag(['mix','alt'])));
    }

    // timeline (startSec/endSec)
    let t = 0;
    for(const b of out){
      b.startSec = Math.round(t);
      t += b.dur;
      b.endSec = Math.round(t);
    }
    return out;
  }

  return { generate };
}