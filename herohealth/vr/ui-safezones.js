/* === /herohealth/vr/ui-safezones.js ===
HHA UI SafeZones — PRODUCTION
✅ Computes "playRect" = usable spawn area (screen minus UI)
✅ Extracts exclude rects from selectors (HUD/Quest/Power/Coach/VR-UI/Overlays)
✅ Picks safe spawn point avoiding overlaps (circle-vs-rect)
✅ API:
   - window.HHA_SafeZones.compute({selectors, uiPad, edgePad})
   - window.HHA_SafeZones.pickSafePoint({playRect, excludeRects, rng, tries, radius})
Returns:
   { W,H, playRect:{xMin,xMax,yMin,yMax}, excludeRects:[{xMin,xMax,yMin,yMax}] }
*/

(function(root){
  'use strict';
  const WIN = root;
  const DOC = root.document;
  if (!DOC) return;

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function rectNormalize(r){
    const x1 = Math.min(r.xMin, r.xMax);
    const x2 = Math.max(r.xMin, r.xMax);
    const y1 = Math.min(r.yMin, r.yMax);
    const y2 = Math.max(r.yMin, r.yMax);
    return { xMin:x1, xMax:x2, yMin:y1, yMax:y2 };
  }

  function rectInflate(r, pad){
    pad = Number(pad)||0;
    return rectNormalize({
      xMin: r.xMin - pad,
      xMax: r.xMax + pad,
      yMin: r.yMin - pad,
      yMax: r.yMax + pad
    });
  }

  function rectClampToScreen(r, W, H){
    return rectNormalize({
      xMin: clamp(r.xMin, 0, W),
      xMax: clamp(r.xMax, 0, W),
      yMin: clamp(r.yMin, 0, H),
      yMax: clamp(r.yMax, 0, H),
    });
  }

  function rectArea(r){
    const w = Math.max(0, r.xMax - r.xMin);
    const h = Math.max(0, r.yMax - r.yMin);
    return w*h;
  }

  function rectIntersects(a,b){
    return !(a.xMax <= b.xMin || a.xMin >= b.xMax || a.yMax <= b.yMin || a.yMin >= b.yMax);
  }

  function mergeRects(rects){
    // simple iterative union merging for overlaps (keeps list short)
    const out = [];
    for (let i=0;i<rects.length;i++){
      let r = rects[i];
      let merged = false;

      for (let j=0;j<out.length;j++){
        const o = out[j];
        if (rectIntersects(r, o)){
          out[j] = rectNormalize({
            xMin: Math.min(o.xMin, r.xMin),
            xMax: Math.max(o.xMax, r.xMax),
            yMin: Math.min(o.yMin, r.yMin),
            yMax: Math.max(o.yMax, r.yMax),
          });
          merged = true;
          break;
        }
      }

      if (!merged) out.push(r);
    }

    // second pass in case unions created new overlaps
    let changed = true;
    while (changed){
      changed = false;
      for (let i=0;i<out.length;i++){
        for (let j=i+1;j<out.length;j++){
          if (rectIntersects(out[i], out[j])){
            out[i] = rectNormalize({
              xMin: Math.min(out[i].xMin, out[j].xMin),
              xMax: Math.max(out[i].xMax, out[j].xMax),
              yMin: Math.min(out[i].yMin, out[j].yMin),
              yMax: Math.max(out[i].yMax, out[j].yMax),
            });
            out.splice(j,1);
            changed = true;
            j--;
          }
        }
      }
    }

    return out;
  }

  // circle-rect overlap test
  function circleHitsRect(cx, cy, radius, r){
    const x = clamp(cx, r.xMin, r.xMax);
    const y = clamp(cy, r.yMin, r.yMax);
    const dx = cx - x;
    const dy = cy - y;
    return (dx*dx + dy*dy) <= (radius*radius);
  }

  function compute(opts){
    opts = opts || {};
    const W = Math.max(320, WIN.innerWidth  || 360);
    const H = Math.max(420, WIN.innerHeight || 640);

    const uiPad  = clamp(opts.uiPad  ?? 12, 0, 64);
    const edgePad= clamp(opts.edgePad?? 12, 0, 64);

    const selectors = Array.isArray(opts.selectors) && opts.selectors.length
      ? opts.selectors
      : ['.hud','.questTop','.powerWrap','.coachWrap','.hha-vr-ui','.overlay'];

    // base playRect: inset from edges a bit
    let playRect = rectNormalize({
      xMin: edgePad,
      xMax: W - edgePad,
      yMin: edgePad,
      yMax: H - edgePad
    });

    // collect exclude rects from visible UI elements
    const ex = [];
    for (let s of selectors){
      try{
        const els = DOC.querySelectorAll(s);
        els.forEach(el=>{
          const st = WIN.getComputedStyle(el);
          if (!st) return;
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity||'1') === 0) return;

          const rect = el.getBoundingClientRect();
          if (!rect || rect.width <= 1 || rect.height <= 1) return;

          // ignore if fully offscreen
          if (rect.right <= 0 || rect.left >= W || rect.bottom <= 0 || rect.top >= H) return;

          const r = rectClampToScreen(rectInflate({
            xMin: rect.left,
            xMax: rect.right,
            yMin: rect.top,
            yMax: rect.bottom
          }, uiPad), W, H);

          if (rectArea(r) >= 40) ex.push(r);
        });
      }catch(_){}
    }

    const excludeRects = mergeRects(ex);

    // shrink playRect by "hard bars" that likely occupy full width/height near edges
    // heuristic: if a rect touches an edge and is thick enough -> carve it out
    for (const r of excludeRects){
      const touchTop = r.yMin <= edgePad + 2;
      const touchBot = r.yMax >= H - (edgePad + 2);
      const touchLeft= r.xMin <= edgePad + 2;
      const touchRight=r.xMax >= W - (edgePad + 2);

      const w = r.xMax - r.xMin;
      const h = r.yMax - r.yMin;

      if (touchTop && w >= W*0.55 && h >= 36){
        playRect.yMin = Math.max(playRect.yMin, r.yMax + 6);
      }
      if (touchBot && w >= W*0.55 && h >= 36){
        playRect.yMax = Math.min(playRect.yMax, r.yMin - 6);
      }
      if (touchLeft && h >= H*0.40 && w >= 60){
        playRect.xMin = Math.max(playRect.xMin, r.xMax + 6);
      }
      if (touchRight && h >= H*0.40 && w >= 60){
        playRect.xMax = Math.min(playRect.xMax, r.xMin - 6);
      }
    }

    // minimum sanity size (avoid dead tiny playfield)
    const minW = Math.max(120, Math.round(W * 0.34));
    const minH = Math.max(140, Math.round(H * 0.34));

    if ((playRect.xMax - playRect.xMin) < minW){
      const mid = (playRect.xMin + playRect.xMax) * 0.5;
      playRect.xMin = clamp(mid - minW*0.5, edgePad, W-edgePad-minW);
      playRect.xMax = playRect.xMin + minW;
    }
    if ((playRect.yMax - playRect.yMin) < minH){
      const mid = (playRect.yMin + playRect.yMax) * 0.5;
      playRect.yMin = clamp(mid - minH*0.5, edgePad, H-edgePad-minH);
      playRect.yMax = playRect.yMin + minH;
    }

    playRect = rectClampToScreen(playRect, W, H);

    return { W, H, playRect, excludeRects };
  }

  function pickSafePoint(opts){
    opts = opts || {};
    const playRect = opts.playRect || {xMin:12,xMax:(WIN.innerWidth||360)-12,yMin:12,yMax:(WIN.innerHeight||640)-12};
    const excludeRects = Array.isArray(opts.excludeRects) ? opts.excludeRects : [];
    const rng = (typeof opts.rng === 'function') ? opts.rng : Math.random;
    const tries = Math.max(10, Number(opts.tries ?? 80) || 80);
    const radius = clamp(opts.radius ?? 34, 8, 140);

    // valid area with radius margin
    const xMin = playRect.xMin + radius;
    const xMax = playRect.xMax - radius;
    const yMin = playRect.yMin + radius;
    const yMax = playRect.yMax - radius;

    // if too tight, relax radius a bit
    let rxMin=xMin, rxMax=xMax, ryMin=yMin, ryMax=yMax;
    if (rxMax <= rxMin + 4){
      const mid = (playRect.xMin + playRect.xMax)*0.5;
      rxMin = clamp(mid - 40, playRect.xMin+6, playRect.xMax-86);
      rxMax = rxMin + 80;
    }
    if (ryMax <= ryMin + 4){
      const mid = (playRect.yMin + playRect.yMax)*0.5;
      ryMin = clamp(mid - 50, playRect.yMin+6, playRect.yMax-106);
      ryMax = ryMin + 100;
    }

    // try random samples
    for (let i=0;i<tries;i++){
      const x = rxMin + (rxMax - rxMin) * rng();
      const y = ryMin + (ryMax - ryMin) * rng();

      let ok = true;
      for (const r of excludeRects){
        if (circleHitsRect(x, y, radius, r)){ ok = false; break; }
      }
      if (ok) return { x, y };
    }

    // fallback: center-ish scan grid
    const steps = 8;
    let best = { x:(rxMin+rxMax)/2, y:(ryMin+ryMax)/2, bad:1e9 };
    for (let gy=0; gy<=steps; gy++){
      for (let gx=0; gx<=steps; gx++){
        const x = rxMin + (rxMax-rxMin) * (gx/steps);
        const y = ryMin + (ryMax-ryMin) * (gy/steps);
        let bad = 0;
        for (const r of excludeRects){
          if (circleHitsRect(x,y,radius,r)) bad += 1;
        }
        if (bad < best.bad){
          best = { x, y, bad };
          if (bad === 0) return { x, y };
        }
      }
    }

    return { x: best.x, y: best.y };
  }

  WIN.HHA_SafeZones = WIN.HHA_SafeZones || {};
  WIN.HHA_SafeZones.compute = compute;
  WIN.HHA_SafeZones.pickSafePoint = pickSafePoint;

})(typeof window !== 'undefined' ? window : globalThis);