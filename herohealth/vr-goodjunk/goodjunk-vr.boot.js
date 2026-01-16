// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (A+B+V)
// ✅ Auto-detect view (pc/mobile/vr/cvr) unless ?view= provided
// ✅ Sets body classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ Enables dual-layer for VR/cVR (#gj-layer-r) safely
// ✅ Configures vr-ui.js (crosshair + tap-to-shoot) => emits hha:shoot
// ✅ Calls engine: goodjunk.safe.js boot(payload)
// ✅ Safe: no hard dependency on launcher; works standalone via URL params

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function qsn(k, def=null){
  const v = qs(k, null);
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function clamp(v,min,max){
  v = Number(v)||0;
  return (v<min?min:(v>max?max:v));
}
function hasWebXR(){
  return !!(navigator && navigator.xr && typeof navigator.xr.isSessionSupported === 'function');
}

function detectView(){
  // honor explicit view
  const forced = String(qs('view','')||'').toLowerCase().trim();
  if(forced) return forced;

  // heuristic:
  // - if ?cvr=1 => cvr
  // - if screen looks like mobile + has touch => mobile
  // - if WebXR available => vr (but still allow pc)
  // We keep it simple and safe.
  const cvr = qs('cvr', null);
  if(cvr === '1' || cvr === 'true') return 'cvr';

  const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints>0);
  const W = DOC.documentElement.clientWidth || innerWidth || 360;

  if(isTouch && W <= 980) return 'mobile';

  // if desktop but WebXR exists, still default pc (user can hit ENTER VR)
  return 'pc';
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view==='vr') b.classList.add('view-vr');
  else if(view==='cvr') b.classList.add('view-cvr');
  else if(view==='pc') b.classList.add('view-pc');
  else b.classList.add('view-mobile');
}

function enableDualLayerFor(view){
  // In your HTML you have:
  //  #gj-layer  (left)
  //  #gj-layer-r (right, aria-hidden=true)
  const r = DOC.getElementById('gj-layer-r');
  if(!r) return;

  // Only enable right layer for vr/cvr
  const on = (view==='vr' || view==='cvr');
  r.setAttribute('aria-hidden', on ? 'false' : 'true');
}

function setChipMeta(view){
  const el = DOC.getElementById('gjChipMeta');
  if(!el) return;
  const run  = qs('run','play');
  const diff = qs('diff','normal');
  const time = qs('time','80');
  el.textContent = `view=${view} · run=${run} · diff=${diff} · time=${time}`;
}

function waitForVRScripts(cb){
  // vr-ui.js is loaded as defer script in HTML; ensure it exists before config
  const t0 = performance.now();
  const timeoutMs = 2000;

  (function poll(){
    const ok = !!WIN.__HHA_VRUI_LOADED__ || !!WIN.HHA_VRUI_CONFIG || !!DOC.querySelector('script[src*="vr-ui.js"]');
    if(ok) return cb();
    if(performance.now() - t0 > timeoutMs) return cb(); // don't block boot
    setTimeout(poll, 30);
  })();
}

function configureVrUi(view){
  // vr-ui.js reads window.HHA_VRUI_CONFIG at load time, but also uses defaults.
  // We'll set it anyway.
  WIN.HHA_VRUI_CONFIG = Object.assign({}, WIN.HHA_VRUI_CONFIG || {}, {
    // lockPx controls aim assist size; for cVR use smaller lock for precision
    lockPx: (view==='cvr') ? 26 : (view==='vr') ? 30 : 28,
    // cooldown for shoot events to prevent spam
    cooldownMs: (view==='cvr') ? 90 : 100
  });

  // If you want strict cVR (always shoot from crosshair), your vr-ui.js already supports view=cvr
  // No extra needed beyond view class + URL param view=cvr.
}

function buildPayload(view){
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = clamp(qsn('time', 80) ?? 80, 20, 300);

  // Seed policy:
  // - research: deterministic; prefer ?seed= or ?ts= ; fallback "RESEARCH-SEED"
  // - play: seed = ?seed= else Date.now in engine
  const seed = qs('seed', null) ?? qs('ts', null);

  return {
    view,
    run,
    diff,
    time,
    seed,

    // research meta passthrough
    hub: qs('hub', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };
}

function start(){
  const view = String(detectView()||'mobile').toLowerCase();

  setBodyView(view);
  enableDualLayerFor(view);
  setChipMeta(view);

  // Make sure safe-zone vars are computed (your HTML has updateSafe() already)
  try { WIN.dispatchEvent(new Event('resize')); } catch(_){}

  // Ensure vr-ui config is set before user enters VR/cVR gameplay
  waitForVRScripts(()=>{
    configureVrUi(view);

    // Boot engine
    const payload = buildPayload(view);
    try{
      engineBoot(payload);
    }catch(err){
      console.error('[GoodJunkVR boot] engine error:', err);
      // lightweight fallback banner
      try{
        const msg = DOC.createElement('div');
        msg.textContent = 'Engine error — check console';
        msg.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;background:#000a;color:#fff;padding:10px 12px;border-radius:12px;font:700 13px/1 system-ui;';
        DOC.body.appendChild(msg);
      }catch(_){}
    }
  });
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', start, { once:true });
}else{
  start();
}