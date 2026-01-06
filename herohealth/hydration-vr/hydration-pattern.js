// === /herohealth/hydration-vr/hydration.pattern.js ===
// Hydration Pattern Generator — PRODUCTION (D)
// ✅ Seeded pattern RNG (optional pass-in rng)
// ✅ Anti-repeat: remembers recent cells + repels last positions
// ✅ Patterns: grid9 / grid16 / ring / mix
// ✅ Works with safe margins: window.HHA_SAFE (from hydration.safezone.js)
// ✅ Expose: window.HHA_PATTERN.pickPoint(playRect, opts) -> {xPct,yPct}

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_PATTERN__) return;
  WIN.__HHA_HYDRATION_PATTERN__ = true;

  const clamp=(v,a,b)=>v<a?a:(v>b?b:v);

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

  // internal state
  const ST = {
    rng: null,
    lastPts: [],       // recent points [{x,y}]
    lastCells: [],     // recent cell ids
    step: 0
  };

  function ensureRng(seed){
    if (!ST.rng) ST.rng = makeRng(seed || String(Date.now()));
    return ST.rng;
  }

  function safeMargins(playRect){
    const s = WIN.HHA_SAFE || { top:14,right:14,bottom:14,left:14 };
    const base=22;
    const top = Math.max(base, s.top|0);
    const right = Math.max(base, s.right|0);
    const bottom = Math.max(base, s.bottom|0);
    const left = Math.max(base, s.left|0);
    // cap so never kill play space
    return {
      top: clamp(top, base, playRect.h*0.48),
      right: clamp(right, base, playRect.w*0.48),
      bottom: clamp(bottom, base, playRect.h*0.48),
      left: clamp(left, base, playRect.w*0.48),
    };
  }

  function playInnerRect(playRect){
    const m = safeMargins(playRect);
    const x0 = playRect.x + m.left;
    const y0 = playRect.y + m.top;
    const w  = Math.max(1, playRect.w - m.left - m.right);
    const h  = Math.max(1, playRect.h - m.top - m.bottom);
    return { x:x0, y:y0, w, h, m };
  }

  function dist(ax,ay,bx,by){
    const dx=ax-bx, dy=ay-by;
    return Math.hypot(dx,dy);
  }

  // repel from last points (soft)
  function repelScore(x,y){
    let score=0;
    const pts = ST.lastPts;
    for (let i=0;i<pts.length;i++){
      const p=pts[i];
      const d = dist(x,y,p.x,p.y);
      // strong penalty if very near
      score += (d < 90 ? (90-d) : 0);
    }
    return score;
  }

  function remember(x,y, cellId){
    ST.lastPts.unshift({x,y});
    if (ST.lastPts.length > 7) ST.lastPts.pop();
    ST.lastCells.unshift(cellId);
    if (ST.lastCells.length > 10) ST.lastCells.pop();
  }

  function pickFromGrid(inner, gx, gy, rng){
    const cellW = inner.w / gx;
    const cellH = inner.h / gy;

    // try some candidates, avoid recent cells
    let best=null, bestScore=1e9;

    for (let t=0; t<18; t++){
      const cx = Math.floor(rng()*gx);
      const cy = Math.floor(rng()*gy);
      const id = `${gx}x${gy}:${cx},${cy}`;

      // avoid repetition
      if (ST.lastCells.includes(id) && t < 12) continue;

      // within cell with jitter
      const jx = (rng()*0.70 + 0.15);
      const jy = (rng()*0.70 + 0.15);
      const x = inner.x + cx*cellW + jx*cellW;
      const y = inner.y + cy*cellH + jy*cellH;

      const score = repelScore(x,y);
      if (score < bestScore){
        bestScore = score;
        best = { x, y, cellId:id };
      }
    }

    // fallback: any
    if (!best){
      const cx = Math.floor(rng()*gx);
      const cy = Math.floor(rng()*gy);
      const id = `${gx}x${gy}:${cx},${cy}`;
      const x = inner.x + (cx + 0.5)*cellW;
      const y = inner.y + (cy + 0.5)*cellH;
      best = { x, y, cellId:id };
    }
    return best;
  }

  function pickFromRing(inner, rng){
    // ring around center with jitter
    const cx = inner.x + inner.w/2;
    const cy = inner.y + inner.h/2;

    const Rmin = Math.min(inner.w, inner.h) * 0.18;
    const Rmax = Math.min(inner.w, inner.h) * 0.46;

    let best=null, bestScore=1e9;

    for (let t=0; t<16; t++){
      const ang = (rng()*Math.PI*2);
      const rr = Rmin + (Rmax-Rmin)*(rng()*0.9 + 0.1);
      let x = cx + Math.cos(ang)*rr;
      let y = cy + Math.sin(ang)*rr;

      // clamp inside
      x = clamp(x, inner.x, inner.x + inner.w);
      y = clamp(y, inner.y, inner.y + inner.h);

      const score = repelScore(x,y);
      if (score < bestScore){
        bestScore = score;
        best = { x, y, cellId: `ring:${(ang*100)|0}:${(rr)|0}` };
      }
    }
    return best;
  }

  function pickMix(inner, rng){
    // deterministic-ish cycling: grid9 -> ring -> grid16 -> grid9 ...
    const k = ST.step++ % 4;
    if (k === 1) return pickFromRing(inner, rng);
    if (k === 2) return pickFromGrid(inner, 4, 4, rng);
    return pickFromGrid(inner, 3, 3, rng);
  }

  function toPct(playRect, x, y){
    const xPct = ((x - playRect.x) / Math.max(1, playRect.w)) * 100;
    const yPct = ((y - playRect.y) / Math.max(1, playRect.h)) * 100;
    return { xPct, yPct };
  }

  // Public API
  WIN.HHA_PATTERN = {
    setSeed(seedStr){
      ST.rng = makeRng(seedStr || String(Date.now()));
      ST.lastPts.length = 0;
      ST.lastCells.length = 0;
      ST.step = 0;
    },
    pickPoint(playRect, opts){
      // playRect: {x,y,w,h} in px
      const rng = (opts && opts.rng) ? opts.rng : ensureRng((opts && opts.seed) || 'hydration');
      const inner = playInnerRect(playRect);

      const mode = String((opts && opts.mode) || 'mix').toLowerCase();
      let pick=null;

      if (mode === 'grid9') pick = pickFromGrid(inner, 3, 3, rng);
      else if (mode === 'grid16') pick = pickFromGrid(inner, 4, 4, rng);
      else if (mode === 'ring') pick = pickFromRing(inner, rng);
      else pick = pickMix(inner, rng);

      const pct = toPct(playRect, pick.x, pick.y);
      remember(pick.x, pick.y, pick.cellId);
      return pct;
    }
  };
})();