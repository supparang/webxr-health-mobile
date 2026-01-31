// === /fitness/js/pattern-gen.js ===
// A-63 Pattern Generator: arc/zigzag/corners + storm burst patterns
'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b,v));

function lerp(a,b,t){ return a + (b-a)*t; }

function jitter(v, j){
  return v + (Math.random()*2-1)*j;
}

export function pickPatternPos(state){
  const phase = state?.bossPhase ?? 1;
  // baseline safe margins (percent)
  const m = phase === 3 ? 13 : (phase === 2 ? 14 : 15);

  const x = Math.random() * (100 - 2*m) + m;
  const y = Math.random() * (100 - 2*m) + m;
  return { xPct:x, yPct:y };
}

// สร้าง “ชุดตำแหน่ง” สำหรับ storm  (k จุด)
export function buildStormPattern(k, state){
  const phase = state?.bossPhase ?? 1;
  const typeRoll = Math.random();

  // safe margins
  const m = phase === 3 ? 12 : 14;
  const left = m, right = 100 - m, top = m, bottom = 100 - m;

  const pts = [];

  if (typeRoll < 0.34) {
    // ARC (ครึ่งวงกลม)
    const cx = 50, cy = 54;
    const r = phase === 3 ? 28 : 30;
    const a0 = Math.PI * (0.15 + Math.random()*0.05);
    const a1 = Math.PI * (0.85 - Math.random()*0.05);
    for (let i=0;i<k;i++){
      const t = (k===1) ? 0.5 : i/(k-1);
      const a = lerp(a0, a1, t);
      const x = clamp(cx + Math.cos(a)*r + jitter(0, 2.2), left, right);
      const y = clamp(cy - Math.sin(a)*r + jitter(0, 2.2), top, bottom);
      pts.push({ xPct:x, yPct:y });
    }
    return pts;
  }

  if (typeRoll < 0.67) {
    // ZIGZAG
    const rows = Math.max(2, Math.min(4, Math.round(k/2)));
    for (let i=0;i<k;i++){
      const t = (k===1) ? 0.5 : i/(k-1);
      const y = lerp(top+6, bottom-6, t);
      const flip = (i % 2 === 0);
      const x = flip ? left+8 : right-8;
      pts.push({ xPct: clamp(x + jitter(0,3.0), left, right), yPct: clamp(y + jitter(0,2.0), top, bottom) });
    }
    return pts;
  }

  // CORNERS → CENTER
  const corners = [
    {xPct:left+6, yPct:top+6},
    {xPct:right-6, yPct:top+6},
    {xPct:left+6, yPct:bottom-6},
    {xPct:right-6, yPct:bottom-6},
    {xPct:50, yPct:50}
  ];
  for (let i=0;i<k;i++){
    const c = corners[i % corners.length];
    pts.push({ xPct: clamp(c.xPct + jitter(0,2.5), left, right), yPct: clamp(c.yPct + jitter(0,2.5), top, bottom) });
  }
  return pts;
}