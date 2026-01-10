/* === C: /herohealth/vr/ui-safezones.js ===
HHA UI SafeZones — PRODUCTION
✅ compute({selectors, uiPad, edgePad}) => {W,H, playRect, excludeRects}
✅ pickSafePoint({playRect, excludeRects, rng, tries, radius}) => {x,y}
✅ ใช้ DOMRects จาก element จริงเพื่อกันเป้าไปทับ HUD/Quest/Coach/Power/VR UI
Notes:
- uiPad: กันห่างขอบ UI เพิ่มอีกเล็กน้อย
- edgePad: กันชิดขอบจอ
- radius: กันเป้าทับ UI (เผื่อวง hit radius)
*/

(function(root){
  'use strict';
  const WIN = root || window;
  const DOC = WIN.document;
  if (!DOC) return;

  if (WIN.HHA_SafeZones && WIN.HHA_SafeZones.compute) return;

  function clamp(n,a,b){
    n = Number(n); if(!isFinite(n)) n = a;
    return n<a?a:(n>b?b:n);
  }

  function rectIntersect(a,b){
    return !(a.x2 <= b.x1 || a.x1 >= b.x2 || a.y2 <= b.y1 || a.y1 >= b.y2);
  }

  function inflateRect(r, pad){
    pad = Number(pad)||0;
    return { x1:r.x1-pad, y1:r.y1-pad, x2:r.x2+pad, y2:r.y2+pad };
  }

  function normRectFromDOMRect(dr){
    const x1 = dr.left;
    const y1 = dr.top;
    const x2 = dr.right;
    const y2 = dr.bottom;
    return { x1, y1, x2, y2 };
  }

  function inRect(x,y,r){
    return x>=r.x1 && x<=r.x2 && y>=r.y1 && y<=r.y2;
  }

  function compute(opts){
    opts = opts || {};
    const selectors = Array.isArray(opts.selectors) ? opts.selectors : [];
    const uiPad = clamp(opts.uiPad ?? 10, 0, 48);
    const edgePad = clamp(opts.edgePad ?? 12, 0, 64);

    const W = Math.max(320, WIN.innerWidth  || 360);
    const H = Math.max(420, WIN.innerHeight || 640);

    const playRect = {
      x1: edgePad,
      y1: edgePad,
      x2: W - edgePad,
      y2: H - edgePad
    };

    const excludeRects = [];

    for (const sel of selectors){
      try{
        const list = DOC.querySelectorAll(sel);
        if (!list || !list.length) continue;
        for (const el of list){
          // ignore hidden
          const st = WIN.getComputedStyle(el);
          if (!st || st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) continue;

          const dr = el.getBoundingClientRect();
          // ignore tiny
          if (!dr || (dr.width < 2 && dr.height < 2)) continue;

          let r = normRectFromDOMRect(dr);
          r = inflateRect(r, uiPad);

          // clamp to viewport
          r.x1 = clamp(r.x1, 0, W);
          r.x2 = clamp(r.x2, 0, W);
          r.y1 = clamp(r.y1, 0, H);
          r.y2 = clamp(r.y2, 0, H);

          // ignore if outside
          if (r.x2 <= 0 || r.y2 <= 0 || r.x1 >= W || r.y1 >= H) continue;

          excludeRects.push(r);
        }
      }catch(_){}
    }

    return { W, H, playRect, excludeRects };
  }

  function pickSafePoint(opts){
    opts = opts || {};
    const playRect = opts.playRect || {x1:12,y1:12,x2:(WIN.innerWidth||360)-12,y2:(WIN.innerHeight||640)-12};
    const excludeRects = Array.isArray(opts.excludeRects) ? opts.excludeRects : [];
    const rng = (typeof opts.rng === 'function') ? opts.rng : Math.random;
    const tries = clamp(opts.tries ?? 80, 10, 240);
    const radius = clamp(opts.radius ?? 40, 0, 140);

    // shrink playRect by radius so target circle stays inside
    const pr = {
      x1: playRect.x1 + radius,
      y1: playRect.y1 + radius,
      x2: playRect.x2 - radius,
      y2: playRect.y2 - radius
    };

    // fallback if too small
    if ((pr.x2 - pr.x1) < 60 || (pr.y2 - pr.y1) < 60){
      const cx = (playRect.x1 + playRect.x2) * 0.5;
      const cy = (playRect.y1 + playRect.y2) * 0.5;
      return { x: cx, y: cy };
    }

    function bad(x,y){
      for (const r0 of excludeRects){
        const r = inflateRect(r0, radius); // กันวงกลมชน UI
        if (inRect(x,y,r)) return true;
      }
      return false;
    }

    for (let i=0;i<tries;i++){
      const x = pr.x1 + rng() * (pr.x2 - pr.x1);
      const y = pr.y1 + rng() * (pr.y2 - pr.y1);
      if (!bad(x,y)) return { x, y };
    }

    // fail-safe: หา “มุมที่ปลอดภัยที่สุด” แบบง่าย
    let best = { x:(pr.x1+pr.x2)/2, y:(pr.y1+pr.y2)/2, score:-1e9 };
    for (let k=0;k<18;k++){
      const x = pr.x1 + rng() * (pr.x2 - pr.x1);
      const y = pr.y1 + rng() * (pr.y2 - pr.y1);
      let s = 0;
      for (const r0 of excludeRects){
        const r = inflateRect(r0, radius);
        // ให้คะแนนสูงเมื่อไกลจาก UI
        const dx = (x < r.x1) ? (r.x1 - x) : (x > r.x2 ? (x - r.x2) : 0);
        const dy = (y < r.y1) ? (r.y1 - y) : (y > r.y2 ? (y - r.y2) : 0);
        const d = Math.sqrt(dx*dx + dy*dy);
        s += d;
      }
      if (s > best.score) best = { x, y, score:s };
    }
    return { x: best.x, y: best.y };
  }

  WIN.HHA_SafeZones = { compute, pickSafePoint };

})(typeof window !== 'undefined' ? window : globalThis);