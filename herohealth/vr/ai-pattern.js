// === /herohealth/vr/ai-pattern.js ===
// HHA AI Pattern Generator — Universal (seeded)
// ✅ spawn positions patterns: uniform / grid9 / ring / stormSwirl / bossBurst
// ✅ deterministic via seed + step counter
// ✅ returns {xPct,yPct} per spawn

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
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
    return (x>>>0)/4294967296;
  };
}

export function createAIPatternGenerator(cfg = {}){
  const seed = String(cfg.seed || 'hha-seed');
  const rng = cfg.rng || makeRng(seed);

  const st = {
    step: 0,
    mode: 'uniform',     // uniform | grid9 | ring | stormSwirl | bossBurst
    ringPhase: 0,
    swirlPhase: 0
  };

  function setMode(m){
    st.mode = String(m || 'uniform');
  }

  function uniform(){
    const rx=(rng()+rng())/2;
    const ry=(rng()+rng())/2;
    return { xPct: rx*100, yPct: ry*100 };
  }

  function grid9(){
    // 3x3 cells, jitter inside
    const k = st.step % 9;
    const gx = k % 3;
    const gy = Math.floor(k / 3);
    const cellW = 1/3;
    const cellH = 1/3;
    const jx = (rng()*0.58 + 0.21) * cellW;
    const jy = (rng()*0.58 + 0.21) * cellH;
    const x = (gx*cellW + jx);
    const y = (gy*cellH + jy);
    return { xPct: x*100, yPct: y*100 };
  }

  function ring(){
    // around center
    const a = (st.ringPhase += (0.55 + rng()*0.45));
    const rad = 0.18 + rng()*0.22;
    const x = 0.5 + Math.cos(a)*rad;
    const y = 0.5 + Math.sin(a)*rad;
    return { xPct: clamp(x,0.08,0.92)*100, yPct: clamp(y,0.10,0.90)*100 };
  }

  function stormSwirl(){
    // spiral tighter, feels like storm
    const a = (st.swirlPhase += (0.9 + rng()*0.5));
    const t = (st.step % 40)/40;
    const rad = 0.35 - 0.22*t;
    const x = 0.5 + Math.cos(a)*rad;
    const y = 0.5 + Math.sin(a)*rad;
    return { xPct: clamp(x,0.06,0.94)*100, yPct: clamp(y,0.10,0.90)*100 };
  }

  function bossBurst(){
    // burst near center crosshair with jitter (boss window)
    const rx = (rng()*2-1);
    const ry = (rng()*2-1);
    const s = 0.18 + rng()*0.10;
    const x = 0.5 + rx*s*0.5;
    const y = 0.5 + ry*s*0.5;
    return { xPct: clamp(x,0.12,0.88)*100, yPct: clamp(y,0.14,0.86)*100 };
  }

  function next(meta = {}){
    // meta: { inStorm, inBoss, strategy }
    st.step++;

    const strategy = String(meta.strategy || '').trim();
    if (strategy) st.mode = strategy;

    if (meta.inBoss) return bossBurst();
    if (meta.inStorm){
      // mix swirl + ring
      return (st.step % 3 === 0) ? ring() : stormSwirl();
    }

    if (st.mode === 'grid9') return grid9();
    if (st.mode === 'ring') return ring();
    if (st.mode === 'stormSwirl') return stormSwirl();
    if (st.mode === 'bossBurst') return bossBurst();
    return uniform();
  }

  return { setMode, next };
}