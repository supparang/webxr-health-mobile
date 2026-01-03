/* === /herohealth/vr-groups/lockon.js ===
PACK 46: Crosshair Lock-On — PRODUCTION
✅ Works best for cVR (shoot from crosshair)
✅ Adds class to .hha-crosshair when a target is in-lock radius
✅ Optional micro vibrate on lock acquire (rate-limited)
Requires: GroupsVR.GameEngine with targets[] containing {x,y,r}
*/

(function(root){
  'use strict';
  const DOC = root.document; if(!DOC) return;
  const NS = root.GroupsVR = root.GroupsVR || {};

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function getView(){
    const b = DOC.body.className || '';
    if (b.includes('view-cvr')) return 'cvr';
    if (b.includes('view-vr')) return 'vr';
    if (b.includes('view-pc')) return 'pc';
    return 'mobile';
  }

  function ensureRing(){
    let r = DOC.querySelector('.hha-lockring');
    if (r) return r;
    r = DOC.createElement('div');
    r.className = 'hha-lockring';
    DOC.body.appendChild(r);
    return r;
  }

  let lastId = 0;
  let lockOn = false;
  let vibT = 0;

  function tick(){
    const view = getView();
    if (view !== 'cvr') { requestAnimationFrame(tick); return; }

    const cross = DOC.querySelector('.hha-crosshair');
    if (!cross) { requestAnimationFrame(tick); return; }

    const E = NS.GameEngine;
    const arr = (E && E.targets) ? E.targets : null;
    if (!arr || !arr.length) {
      cross.classList.remove('hha-lock');
      DOC.body.classList.remove('hha-lock-on');
      lockOn = false;
      lastId = 0;
      requestAnimationFrame(tick);
      return;
    }

    const cx = innerWidth * 0.5;
    const cy = innerHeight * 0.5;

    let best = null, bestD = 1e9;
    for (let i=0;i<arr.length;i++){
      const t = arr[i];
      if (!t || !isFinite(t.x) || !isFinite(t.y) || !isFinite(t.r)) continue;
      const dx = t.x - cx, dy = t.y - cy;
      const d  = Math.hypot(dx,dy);

      // lock radius: use target.r but add small buffer
      const lockR = (t.r || 44) + 10;
      if (d <= lockR && d < bestD){
        bestD = d;
        best = t;
      }
    }

    const ring = ensureRing();

    if (best){
      cross.classList.add('hha-lock');
      DOC.body.classList.add('hha-lock-on');

      // ring center stays on crosshair; we just scale intensity by distance
      const pct = Math.max(0, Math.min(1, 1 - (bestD / ((best.r||44)+10))));
      ring.style.setProperty('--lock', pct.toFixed(3));

      const id = best.id || 0;
      if (!lockOn || (id && id !== lastId)){
        // acquired
        lockOn = true;
        lastId = id;

        const tnow = Date.now();
        if (tnow - vibT > 260){
          vibT = tnow;
          try{ navigator.vibrate && navigator.vibrate(10); }catch{}
        }

        // optional: tiny tick sound if GroupsVR.Audio.tick exists
        try{
          const A = NS.Audio;
          if (A && typeof A.tick==='function') A.tick();
        }catch(_){}
      }
    } else {
      cross.classList.remove('hha-lock');
      DOC.body.classList.remove('hha-lock-on');
      ring.style.setProperty('--lock', '0');
      lockOn = false;
      lastId = 0;
    }

    requestAnimationFrame(tick);
  }

  // start after a bit (vr-ui inserts crosshair)
  setTimeout(()=>requestAnimationFrame(tick), 450);

})();