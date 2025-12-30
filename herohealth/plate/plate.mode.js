// === /herohealth/plate/plate.mode.js ===
// PlateMode — playRect + exclusion rects (global)
// Provides window.GAME_MODULES.PlateMode

(function (root) {
  'use strict';
  const W = root;

  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

  function rectOf(el){
    if(!el) return null;
    const r = el.getBoundingClientRect();
    if(!r || !isFinite(r.width)) return null;
    return { x:r.left, y:r.top, w:r.width, h:r.height };
  }

  function intersects(a,b){
    return !(a.x+a.w < b.x || b.x+b.w < a.x || a.y+a.h < b.y || b.y+b.h < a.y);
  }

  function buildNoSpawnRects(ids){
    const out = [];
    (ids||[]).forEach(id=>{
      const el = document.getElementById(id);
      const rr = rectOf(el);
      if(rr) out.push(rr);
    });
    return out;
  }

  function getPlayRect(opts){
    opts = opts || {};
    const Ww = root.innerWidth || 360;
    const Hh = root.innerHeight || 640;
    const pad = Number(opts.pad)||10;

    const hudTop = document.getElementById(opts.hudTopId || 'hudTop');
    const miniPanel = document.getElementById(opts.miniPanelId || 'miniPanel');
    const coachPanel = document.getElementById(opts.coachPanelId || 'coachPanel');
    const hudBtns = document.getElementById(opts.hudBtnsId || 'hudBtns');

    const topR = rectOf(hudTop);
    const miniR = rectOf(miniPanel);
    const btnR = rectOf(hudBtns);
    const coachR = rectOf(coachPanel);

    let top = pad, bottom = Hh - pad, left = pad, right = Ww - pad;

    if(topR)  top = Math.max(top, topR.y + topR.h + 10);
    if(miniR) top = Math.max(top, miniR.y + miniR.h + 10);
    if(btnR)  bottom = Math.min(bottom, btnR.y - 10);
    if(coachR) left = Math.max(left, coachR.x + coachR.w + 10);

    top = clamp(top, 0, Hh-40);
    bottom = clamp(bottom, top+40, Hh);
    left = clamp(left, 0, Ww-40);
    right = clamp(right, left+40, Ww);

    return { x:left, y:top, w:(right-left), h:(bottom-top) };
  }

  W.GAME_MODULES = W.GAME_MODULES || {};
  W.GAME_MODULES.PlateMode = { clamp, rectOf, intersects, buildNoSpawnRects, getPlayRect };

})(window);