// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION (AIM-ASSIST PATCH)
// ✅ Crosshair overlay + tap-to-shoot
// ✅ Emits: hha:shoot {x,y,lockPx,eye,source,cooldownMsUsed}
// ✅ Supports view=cvr strict (split 2 eyes) -> chooses eye by tap position
// ✅ Adaptive: lockPx + cooldown varies with tap cadence (prevents spam / improves aim)
//
// Config (optional):
// window.HHA_VRUI_CONFIG = {
//   lockPx: 28,
//   lockMin: 22,
//   lockMax: 54,
//   cooldownMs: 90,
//   cooldownMin: 70,
//   cooldownMax: 140,
//   adaptive: true
// }

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  if(!DOC || WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  const CFG = Object.assign({
    lockPx: 28,
    lockMin: 22,
    lockMax: 54,
    cooldownMs: 90,
    cooldownMin: 70,
    cooldownMax: 140,
    adaptive: true
  }, WIN.HHA_VRUI_CONFIG || {});

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function getView(){
    const v = String(qs('view','')||'').trim().toLowerCase();
    return v || (DOC.body?.classList.contains('view-cvr') ? 'cvr'
             : DOC.body?.classList.contains('view-vr') ? 'vr'
             : DOC.body?.classList.contains('view-mobile') ? 'mobile'
             : 'pc');
  }

  // --- Crosshair layer ---
  function ensureCrosshair(){
    let el = DOC.getElementById('hha-crosshair');
    if(el) return el;

    el = DOC.createElement('div');
    el.id = 'hha-crosshair';
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:9999'
    ].join(';');

    // Single crosshair (pc/mobile/vr) + dual crosshair for cVR
    const c1 = DOC.createElement('div');
    c1.id = 'hha-xhair-1';
    c1.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:50%',
      'width:26px',
      'height:26px',
      'transform:translate(-50%,-50%)',
      'border-radius:999px',
      'border:2px solid rgba(255,255,255,.75)',
      'box-shadow:0 0 0 7px rgba(255,255,255,.08)',
      'opacity:.95'
    ].join(';');

    const c2 = DOC.createElement('div');
    c2.id = 'hha-xhair-2';
    c2.style.cssText = [
      'position:absolute',
      'left:25%',
      'top:50%',
      'width:26px',
      'height:26px',
      'transform:translate(-50%,-50%)',
      'border-radius:999px',
      'border:2px solid rgba(255,255,255,.55)',
      'box-shadow:0 0 0 7px rgba(255,255,255,.06)',
      'opacity:0'
    ].join(';');

    const c3 = DOC.createElement('div');
    c3.id = 'hha-xhair-3';
    c3.style.cssText = [
      'position:absolute',
      'left:75%',
      'top:50%',
      'width:26px',
      'height:26px',
      'transform:translate(-50%,-50%)',
      'border-radius:999px',
      'border:2px solid rgba(255,255,255,.55)',
      'box-shadow:0 0 0 7px rgba(255,255,255,.06)',
      'opacity:0'
    ].join(';');

    el.appendChild(c1);
    el.appendChild(c2);
    el.appendChild(c3);
    DOC.body.appendChild(el);

    return el;
  }

  function syncCrosshairMode(){
    const view = getView();
    const c1 = DOC.getElementById('hha-xhair-1');
    const c2 = DOC.getElementById('hha-xhair-2');
    const c3 = DOC.getElementById('hha-xhair-3');
    if(!c1 || !c2 || !c3) return;

    if(view === 'cvr'){
      c1.style.opacity = '0';
      c2.style.opacity = '.95';
      c3.style.opacity = '.95';
    }else{
      c1.style.opacity = '.95';
      c2.style.opacity = '0';
      c3.style.opacity = '0';
    }
  }

  // --- Adaptive lock/cooldown by cadence ---
  const T = {
    lastShotMs: 0,
    lastTapMs: 0,
    emaTapHz: 0,
    lockPx: CFG.lockPx,
    cooldownMs: CFG.cooldownMs
  };

  function updateCadence(t){
    const dt = T.lastTapMs ? (t - T.lastTapMs) : 0;
    T.lastTapMs = t;
    if(dt > 0 && dt < 1600){
      const hz = 1000 / dt;
      T.emaTapHz = (T.emaTapHz === 0) ? hz : (T.emaTapHz + 0.22 * (hz - T.emaTapHz));
    }
  }

  function computeAdaptiveParams(){
    if(!CFG.adaptive){
      return {
        lockPx: clamp(CFG.lockPx, CFG.lockMin, CFG.lockMax),
        cooldownMs: clamp(CFG.cooldownMs, CFG.cooldownMin, CFG.cooldownMax)
      };
    }

    const view = getView();
    const hz = clamp(T.emaTapHz, 0, 8);

    let cd = CFG.cooldownMs + (hz > 3 ? (hz - 3) * 10 : 0);
    cd = clamp(cd, CFG.cooldownMin, CFG.cooldownMax);

    let lock = CFG.lockPx + (hz < 1.6 ? 8 : hz > 4.5 ? -4 : 0);
    if(view === 'cvr') lock += 10;
    else if(view === 'vr') lock += 6;
    else if(view === 'mobile') lock += 2;

    lock = clamp(lock, CFG.lockMin, CFG.lockMax);

    T.lockPx = lock;
    T.cooldownMs = cd;

    return { lockPx: lock, cooldownMs: cd };
  }

  function emitShoot(detail){
    try{ WIN.dispatchEvent(new CustomEvent('hha:shoot', { detail })); }catch(_){}
  }

  function handleShootFromTap(ev){
    const t = nowMs();
    updateCadence(t);
    const P = computeAdaptiveParams();

    if(T.lastShotMs && (t - T.lastShotMs) < P.cooldownMs) return;
    T.lastShotMs = t;

    const view = getView();
    const r = DOC.documentElement.getBoundingClientRect();
    const tapX = (ev && typeof ev.clientX === 'number') ? ev.clientX : (r.left + r.width/2);
    const tapY = (ev && typeof ev.clientY === 'number') ? ev.clientY : (r.top  + r.height/2);

    let aimX = r.left + r.width/2;
    let aimY = r.top  + r.height/2;
    let eye = null;

    if(view === 'cvr'){
      const mid = r.left + r.width/2;
      eye = (tapX <= mid) ? 'left' : 'right';
      aimX = (eye === 'left') ? (r.left + r.width*0.25) : (r.left + r.width*0.75);
      aimY = (r.top + r.height*0.50);
    }

    emitShoot({
      x: aimX,
      y: aimY,
      eye,
      lockPx: P.lockPx,
      cooldownMsUsed: P.cooldownMs,
      source: 'vr-ui'
    });
  }

  // Init
  ensureCrosshair();
  syncCrosshairMode();

  DOC.addEventListener('pointerdown', (ev)=>{
    if(ev && ev.isPrimary === false) return;
    handleShootFromTap(ev);
  }, { passive:true });

  WIN.addEventListener('resize', ()=>syncCrosshairMode(), { passive:true });
  WIN.addEventListener('orientationchange', ()=>syncCrosshairMode(), { passive:true });

})();