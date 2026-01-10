/* === /herohealth/vr/ui-safezones.js ===
HHA UI Safe Zones — DOM-based exclusion rects (PRODUCTION)
- Computes playRect and exclusion rects from real DOM boxes
- Use with any DOM target spawner to avoid HUD overlap 100%
*/

(function(root){
  'use strict';

  const DOC = document;
  if (!DOC) return;

  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));

  function rectOf(el){
    if (!el || !el.getBoundingClientRect) return null;
    const r = el.getBoundingClientRect();
    if (!r || r.width <= 2 || r.height <= 2) return null;
    return { x:r.left, y:r.top, w:r.width, h:r.height, r:r.right, b:r.bottom };
  }

  function inflate(rc, pad){
    if (!rc) return null;
    pad = Number(pad)||0;
    return { x: rc.x - pad, y: rc.y - pad, w: rc.w + pad*2, h: rc.h + pad*2,
             r: (rc.x - pad) + (rc.w + pad*2),
             b: (rc.y - pad) + (rc.h + pad*2) };
  }

  function intersects(a,b){
    if (!a || !b) return false;
    return !(a.r <= b.x || a.x >= b.r || a.b <= b.y || a.y >= b.b);
  }

  function insidePoint(rc, x, y){
    return (x >= rc.x && x <= rc.r && y >= rc.y && y <= rc.b);
  }

  function mergeIfOverlap(rects){
    // light merge (optional): merges overlapping rects into bigger blocks
    const out = [];
    rects.forEach(rc=>{
      let merged = false;
      for (let i=0;i<out.length;i++){
        if (intersects(out[i], rc)){
          const a = out[i];
          const x1 = Math.min(a.x, rc.x);
          const y1 = Math.min(a.y, rc.y);
          const x2 = Math.max(a.r, rc.r);
          const y2 = Math.max(a.b, rc.b);
          out[i] = { x:x1, y:y1, w:(x2-x1), h:(y2-y1), r:x2, b:y2 };
          merged = true;
          break;
        }
      }
      if (!merged) out.push(rc);
    });
    return out;
  }

  function compute(opts){
    opts = Object.assign({
      // margin added around UI so targets never “kiss” the HUD edge
      uiPad: 14,
      // keep targets inside screen (extra)
      edgePad: 12,
      // selectors to exclude
      selectors: [
        '.hud', '.questTop', '.powerWrap', '.coachWrap',
        '.hha-vr-ui', '.hha-crosshair',
        '.overlay' // when visible
      ],
      // if you want to exclude only visible overlays:
      overlayVisibleOnly: true
    }, opts || {});

    const vw = Math.max(320, root.innerWidth || 0);
    const vh = Math.max(320, root.innerHeight || 0);

    // Base playRect = viewport with edge pad
    const playRect = {
      x: opts.edgePad,
      y: opts.edgePad,
      w: vw - opts.edgePad*2,
      h: vh - opts.edgePad*2
    };
    playRect.r = playRect.x + playRect.w;
    playRect.b = playRect.y + playRect.h;

    // Collect exclusions
    const rects = [];
    for (const sel of opts.selectors){
      const list = DOC.querySelectorAll(sel);
      list.forEach(el=>{
        if (opts.overlayVisibleOnly && sel === '.overlay'){
          if (el.classList.contains('hidden') || el.getAttribute('aria-hidden') === 'true') return;
        }
        const rc = rectOf(el);
        if (!rc) return;
        rects.push(inflate(rc, opts.uiPad));
      });
    }

    const merged = mergeIfOverlap(rects).filter(Boolean);

    return { playRect, excludeRects: merged, viewport: { w:vw, h:vh } };
  }

  // Pick a safe point (center) for a target (size aware)
  function pickSafePoint(cfg){
    cfg = Object.assign({
      playRect: null,
      excludeRects: [],
      rng: Math.random,
      tries: 80,
      // target radius (half size) to keep its circle fully visible
      radius: 40
    }, cfg || {});

    const pr = cfg.playRect;
    if (!pr) return null;

    const r = Math.max(8, Number(cfg.radius)||40);
    const xMin = pr.x + r;
    const xMax = pr.r - r;
    const yMin = pr.y + r;
    const yMax = pr.b - r;

    for (let i=0;i<cfg.tries;i++){
      const x = xMin + (xMax - xMin) * cfg.rng();
      const y = yMin + (yMax - yMin) * cfg.rng();

      // reject if point falls inside any exclusion rect
      let bad = false;
      for (const ex of (cfg.excludeRects||[])){
        if (insidePoint(ex, x, y)){ bad = true; break; }
      }
      if (!bad) return { x, y };
    }

    // fallback: center-ish but still within playRect
    return {
      x: clamp((pr.x + pr.r)/2, xMin, xMax),
      y: clamp((pr.y + pr.b)/2, yMin, yMax)
    };
  }

  root.HHA_SafeZones = { compute, pickSafePoint };

})(typeof window !== 'undefined' ? window : globalThis);