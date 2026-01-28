// === /fitness/js/aim-assist.js ===
// Explainable Aim Assist (fair):
// - If user clicks/taps near a target within lockPx, it "snaps" to closest target
// - Rate-limited message (so it doesn't spam)
// - Works best on mobile/VR where precision is hard
'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function pickClosestTarget(targetEls, clientX, clientY, lockPx){
  lockPx = clamp(lockPx, 8, 120);

  let best = null;
  let bestD2 = lockPx * lockPx;

  for (const [id, el] of targetEls.entries()){
    if (!el || !el.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    const dx = cx - clientX;
    const dy = cy - clientY;
    const d2 = dx*dx + dy*dy;
    if (d2 <= bestD2){
      bestD2 = d2;
      best = { id, cx, cy, d2 };
    }
  }
  return best;
}

export function makeAssistMessenger(opts={}){
  const coolMs = opts.cooldownMs ?? 1200;
  let lastAt = 0;
  return function maybeTell(setFeedback){
    const now = performance.now();
    if (now - lastAt < coolMs) return;
    lastAt = now;
    if (typeof setFeedback === 'function'){
      setFeedback('AI Assist: ช่วยเล็งให้ในระยะใกล้ (ไม่โกง) 🎯', 'combo');
    }
  };
}