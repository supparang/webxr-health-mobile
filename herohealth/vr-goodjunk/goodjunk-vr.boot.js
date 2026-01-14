// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (A+B+C compatible)
// ✅ Auto-detect view WITHOUT overriding explicit ?view=
// ✅ Sets body classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ Ensures right-eye layer for cVR (aria + body class)
// ✅ Best-effort fullscreen/orientation for cVR
// ✅ Calls goodjunk.safe.js boot(payload)
// ✅ Pass-through study params + hub + seed

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def = null) => {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function isTouchDevice(){
  return ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
}

function detectViewNoOverride(){
  const explicit = String(qs('view', '') || '').toLowerCase();
  if (explicit) return explicit;

  const touch = isTouchDevice();
  const w = Math.max(1, WIN.innerWidth || 1);
  const h = Math.max(1, WIN.innerHeight || 1);
  const landscape = w >= h;

  // heuristic:
  // - touch + landscape + wide => cVR (cardboard-like)
  // - touch => mobile
  // - no touch => pc
  if (touch){
    if (landscape && w >= 740) return 'cvr';
    return 'mobile';
  }
  return 'pc';
}

function setBodyViewClass(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else if (view === 'pc') b.classList.add('view-pc');
  else b.classList.add('view-mobile');
}

function setCVRLayerState(view){
  const r = DOC.getElementById('gj-layer-r');
  if (!r) return;

  if (view === 'cvr'){
    r.setAttribute('aria-hidden','false');
    // (CSS will show it via body.view-cvr)
  } else {
    r.setAttribute('aria-hidden','true');
  }
}

async function requestFullscreenIfAllowed(){
  // Best-effort fullscreen: only when user likely tapped "Enter VR" later,
  // but for cVR it helps if user already interacted.
  try{
    const el = DOC.documentElement;
    if (!DOC.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen();
    }
  }catch(_){}
}

async function bestEffortLandscapeLock(){
  try{
    if (screen?.orientation?.lock){
      await screen.orientation.lock('landscape');
    }
  }catch(_){}
}

function ensureClickWake(){
  // Some Android browsers require a user gesture before audio/FS/orientation.
  // We keep it minimal: once pointerdown, we try FS/lock if cVR.
  let armed = true;
  const onFirst = async ()=>{
    if (!armed) return;
    armed = false;
    const view = String(WIN.__HHA_VIEW__ || '').toLowerCase();
    if (view === 'cvr'){
      await requestFullscreenIfAllowed();
      await bestEffortLandscapeLock();
    }
    try{ DOC.removeEventListener('pointerdown', onFirst, true); }catch(_){}
  };
  DOC.addEventListener('pointerdown', onFirst, true);
}

function buildPayload(view){
  const diff = String(qs('diff','normal') || 'normal').toLowerCase();
  const run  = String(qs('run','play') || 'play').toLowerCase();
  const time = Number(qs('time','80') || 80);
  const hub  = qs('hub', null);
  const seed = qs('seed', null) ?? qs('ts', null); // allow research to use ts
  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  return {
    view,
    diff,
    run,
    time,
    hub,
    seed,
    studyId,
    phase,
    conditionGroup,
  };
}

function boot(){
  const view = detectViewNoOverride();
  WIN.__HHA_VIEW__ = view;

  // Keep HTML class .gj, add view-* classes
  setBodyViewClass(view);
  setCVRLayerState(view);

  // Minimal helper (gesture wake)
  ensureClickWake();

  // Start engine
  const payload = buildPayload(view);

  // If someone uses ?view=vr we keep it as "vr" for safe.js.
  // Note: true WebXR headset session still enters via Enter VR button (vr-ui.js).
  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR Boot] engineBoot failed', err);
  }
}

// Run when DOM ready
if (DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', boot, { once:true });
} else {
  boot();
}