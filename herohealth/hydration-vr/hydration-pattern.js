// === /herohealth/hydration-vr/hydration.pattern.js ===
// Hydration Pattern Generator — PRODUCTION
// ✅ Seeded (deterministic) using URL seed/sessionId/ts
// ✅ HUD-safe spawn points from window.HHA_SAFE.playRect
// ✅ Provides: window.HHA_PATTERN.pickPoint(mode) -> {x,y,xPct,yPct,tag}
// ✅ Modes: 'normal' | 'storm' | 'boss'
// ✅ Avoids repeating same cell, adds "rhythm" (rings / sweeps / bursts)
// ✅ Cardboard-safe: points are normalized in playfield %, safe for L/R layers
// ✅ Debug: ?patDebug=1 draws tiny dots

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_PATTERN__) return;
  WIN.__HHA_HYDRATION_PATTERN__ = true;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const patDebug = String(qs('patDebug','0')) === '1';

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // ------- deterministic RNG (same as safe.js style) -------
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

  const sessionId = String(qs('sessionId', qs('studentKey','')) || '');
  const ts = String(qs('ts', Date.now()));
  const seed = String(qs('seed', sessionId ? (sessionId + '|' + ts) : ts));
  const rng = makeRng(seed + '|pattern');

  function getPlayfieldEl(){
    const body = DOC.body;
    if (body && body.classList.contains('cardboard')) return DOC.getElementById('cbPlayfield');
    return DOC.getElementById('playfield');
  }

  function getPfRect(){
    const pf = getPlayfieldEl();
    const r = pf?.getBoundingClientRect?.();
    return r || { left:0, top:0, width:1, height:1 };
  }

  function getPlayRect(){
    // from safezone
    const R = WIN.HHA_SAFE?.playRect;
    if (R && R.width > 80 && R.height > 80) return R;

    // fallback: playfield inner rect
    const pf = getPfRect();
    const pad = 20;
    return {
      left: pf.left + pad,
      top: pf.top + pad,
      right: pf.left + pf.width - pad,
      bottom: pf.top + pf.height - pad,
      width: Math.max(1, pf.width - pad*2),
      height: Math.max(1, pf.height - pad*2),
    };
  }

  // ------- grid + memory (avoid same cell repeats) -------
  const MEM = {
    lastIdx: -1,
    last2Idx: -1,
    ringPhase: 0,
    sweepPhase: 0,
    burstK: 0
  };

  function grid9Points(rect){
    const xs = [0.17, 0.50, 0.83];
    const ys = [0.18, 0.50, 0.82];
    const pts=[];
    for (let j=0;j<3;j++){
      for (let i=0;i<3;i++){
        pts.push({
          x: rect.left + rect.width * xs[i],
          y: rect.top  + rect.height* ys[j],
          tag:`g${i}${j}`,
          idx: j*3+i
        });
      }
    }
    return pts;
  }

  function toPct(x,y){
    const pf = getPfRect();
    const xPct = ((x - pf.left)/Math.max(1,pf.width))*100;
    const yPct = ((y - pf.top )/Math.max(1,pf.height))*100;
    return { xPct, yPct };
  }

  // ------- choreography patterns -------
  function pickGrid9(rect, biasCenter=0.10){
    const pts = grid9Points(rect);

    // weights: base uniform, optional center bias
    const w = new Array(9).fill(1);
    if (biasCenter > 0) w[4] += biasCenter*9;

    // discourage repeats
    if (MEM.lastIdx >= 0) w[MEM.lastIdx] *= 0.18;
    if (MEM.last2Idx >= 0) w[MEM.last2Idx] *= 0.45;

    // roulette
    let sum = 0;
    for (let i=0;i<9;i++) sum += w[i];
    let r = rng()*sum;
    let pick = 4;
    for (let i=0;i<9;i++){
      r -= w[i];
      if (r <= 0){ pick=i; break; }
    }

    MEM.last2Idx = MEM.lastIdx;
    MEM.lastIdx = pick;

    const p = pts[pick];
    return { x:p.x, y:p.y, tag:p.tag, idx:pick };
  }

  function ring(rect){
    // 8 points around center (like a ring), rotates phase
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;
    const rad = Math.min(rect.width, rect.height) * (0.28 + rng()*0.06);
    const n = 8;
    MEM.ringPhase = (MEM.ringPhase + 1) % n;
    const k = MEM.ringPhase;

    const ang = (Math.PI*2)*(k/n) + (rng()*0.08 - 0.04);
    const x = cx + Math.cos(ang)*rad;
    const y = cy + Math.sin(ang)*rad;

    return { x, y, tag:'ring', idx:-1 };
  }

  function sweep(rect){
    // left->right or right->left sweep, with slight jitter
    const dir = (Math.floor(rng()*2)===0) ? 1 : -1;
    const steps = 6;
    MEM.sweepPhase = (MEM.sweepPhase + 1) % steps;

    const t = MEM.sweepPhase/(steps-1);
    const x = dir>0
      ? rect.left + rect.width*(0.10 + 0.80*t)
      : rect.left + rect.width*(0.90 - 0.80*t);

    const y = rect.top + rect.height*(0.25 + rng()*0.55);
    return { x, y, tag:'sweep', idx:-1 };
  }

  function burst(rect){
    // 3 quick picks near a chosen anchor cell (feels like "combo chance")
    // burstK cycles within 0..2
    MEM.burstK = (MEM.burstK + 1) % 3;

    const anchor = pickGrid9(rect, 0.18);
    const jx = (rng()*2-1) * rect.width * (0.035 + 0.02*MEM.burstK);
    const jy = (rng()*2-1) * rect.height* (0.035 + 0.02*MEM.burstK);
    return { x: anchor.x + jx, y: anchor.y + jy, tag:'burst', idx:anchor.idx };
  }

  function jitter(rect, p){
    // clamp inside playRect
    const x = clamp(p.x, rect.left+6, rect.left+rect.width-6);
    const y = clamp(p.y, rect.top +6, rect.top +rect.height-6);
    return { x, y };
  }

  function pickPoint(mode='normal'){
    const rect = getPlayRect();

    let p;
    if (mode === 'boss'){
      // boss: ring + tighter center bias (dramatic)
      p = (rng()<0.55) ? ring(rect) : pickGrid9(rect, 0.35);
    } else if (mode === 'storm'){
      // storm: sweep + burst mix (pressure)
      const r = rng();
      if (r < 0.35) p = sweep(rect);
      else if (r < 0.70) p = burst(rect);
      else p = pickGrid9(rect, 0.12);
    } else {
      // normal: grid + occasional ring
      p = (rng()<0.18) ? ring(rect) : pickGrid9(rect, 0.16);
    }

    const pj = jitter(rect, p);
    const pct = toPct(pj.x, pj.y);

    if (patDebug){
      try{
        let layer = DOC.getElementById('hha-pat-debug');
        if (!layer){
          layer = DOC.createElement('div');
          layer.id = 'hha-pat-debug';
          layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99997;';
          DOC.body.appendChild(layer);
        }
        const dot = DOC.createElement('div');
        dot.style.cssText = `
          position:fixed;left:${pj.x}px;top:${pj.y}px;
          width:6px;height:6px;border-radius:99px;
          background:rgba(34,211,238,.95);
          transform:translate(-50%,-50%);
          box-shadow:0 8px 18px rgba(0,0,0,.35);
          opacity:.9;
        `;
        layer.appendChild(dot);
        setTimeout(()=>{ try{ dot.remove(); }catch(_){ } }, 600);
      }catch(_){}
    }

    return {
      x: pj.x, y: pj.y,
      xPct: pct.xPct, yPct: pct.yPct,
      tag: p.tag || 'grid'
    };
  }

  // Public API
  WIN.HHA_PATTERN = WIN.HHA_PATTERN || {};
  WIN.HHA_PATTERN.seed = seed;
  WIN.HHA_PATTERN.pickPoint = pickPoint;
  WIN.HHA_PATTERN.getPlayRect = getPlayRect;
})();