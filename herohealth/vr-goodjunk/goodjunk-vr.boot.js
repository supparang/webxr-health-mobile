// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (AUTO VIEW + NO OVERRIDE)
// ✅ Auto-detect view: pc | mobile | vr | cvr (only if ?view is NOT set)
// ✅ Sets body classes: view-pc/view-mobile/view-vr/view-cvr + is-vr/is-cvr
// ✅ Ensures vr-ui.js is available (already loaded by HTML via defer)
// ✅ Boots engine once DOM is ready (no double start)
// ✅ Pass-through params to safe.js: view/diff/run/time/seed/hub/studyId/phase/conditionGroup

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function hasQs(k){
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}
function clamp(v, a, b){ v = Number(v); if(!isFinite(v)) v = a; return v < a ? a : (v > b ? b : v); }

function detectPlatform(){
  // Heuristic: if WebXR immersive-vr available -> "vr" (Cardboard/VR)
  // If dual-eye overlay mode is used by your system -> "cvr" (strict crosshair)
  // Otherwise pc/mobile by pointer & screen size
  const W = Math.max(1, DOC.documentElement.clientWidth || 1);
  const H = Math.max(1, DOC.documentElement.clientHeight || 1);
  const isCoarse = WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches;
  const isSmall = Math.min(W, H) <= 820;

  // If user has your loader setting (optional)
  const hinted = (WIN.HHA_VIEW && WIN.HHA_VIEW.view) ? String(WIN.HHA_VIEW.view).toLowerCase() : null;
  if(hinted === 'cvr' || hinted === 'vr' || hinted === 'pc' || hinted === 'mobile') return hinted;

  // If query param style is present (optional)
  const style = String(qs('style','')||'').toLowerCase();
  if(style === 'cvr') return 'cvr';

  // WebXR availability (best effort; do not await)
  const xr = WIN.navigator && WIN.navigator.xr;
  if(xr && typeof xr.isSessionSupported === 'function'){
    // If this is a VR-capable device/browser, prefer "vr" unless it looks like phone-only
    // (We won't await promise; we only use immediate heuristics)
    // Keep it simple and deterministic: choose vr on large screens or when not coarse pointer.
    if(!isSmall || !isCoarse) return 'vr';
  }

  // Fallback: mobile vs pc
  if(isCoarse || isSmall) return 'mobile';
  return 'pc';
}

function resolveView(){
  // IMPORTANT: do NOT override if user explicitly set ?view=
  if(hasQs('view')){
    const v = String(qs('view','mobile') || 'mobile').toLowerCase();
    if(v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return v;
  }
  return detectPlatform();
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr','is-vr','is-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr','is-vr');
  else if(view === 'cvr') b.classList.add('view-cvr','is-vr','is-cvr');
  else b.classList.add('view-mobile');

  // also set a data attr (handy for debugging)
  b.dataset.view = view;
}

function bootOnce(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const view = resolveView();
  setBodyView(view);

  // Params
  const payload = {
    view,
    run: String(qs('run','play') || 'play').toLowerCase(),
    diff: String(qs('diff','normal') || 'normal').toLowerCase(),
    time: clamp(qs('time','80') ?? 80, 20, 300),
    seed: qs('seed', null) ?? qs('ts', null),
    hub: qs('hub', null),

    // research passthrough
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };

  // Optional: tighten cVR lockPx if config exists
  // (vr-ui.js reads window.HHA_VRUI_CONFIG)
  if(view === 'cvr'){
    WIN.HHA_VRUI_CONFIG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});
  }

  // Safety: if vr-ui.js wasn't loaded for some reason, don't crash—just run tap mode
  // (But your HTML loads it via defer)
  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR] boot failed:', err);
    // basic fallback: show an alert once
    try{ alert('GoodJunkVR boot error: ' + (err?.message || err)); }catch(_){}
  }
}

// DOM ready
if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
  bootOnce();
} else {
  DOC.addEventListener('DOMContentLoaded', bootOnce, { once:true });
}