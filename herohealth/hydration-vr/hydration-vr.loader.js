// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (FULL)
// ✅ Auto-detect view (ONLY if no ?view= provided) — never override explicit view
// ✅ Sets body classes: view-pc / view-mobile / view-cvr / view-vr / cardboard
// ✅ Sets window.HHA_VIEW.layers for SAFE to mount targets:
//    - normal: ['hydration-layer']
//    - cardboard split: ['hydration-layerL','hydration-layerR']
// ✅ Supports: ?view=pc|mobile|cvr|vr|cardboard  (+ optional cb=1 for split)
// ✅ Keeps HHA Standard passthrough params intact (hub/run/diff/time/seed/...)
// ✅ Best-effort fullscreen + landscape for cVR/cardboard (gesture is in hydration-vr.html start button)

'use strict';

const WIN = window;
const DOC = document;

const qs = (k, def=null) => {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};
const hasQS = (k) => {
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
};

const log = (...args) => {
  try {
    if (qs('debug','0') === '1') console.log('[HydrationLoader]', ...args);
  } catch(_) {}
};

function normView(v){
  v = String(v||'').toLowerCase().trim();
  if (!v) return '';
  if (v === 'pc') return 'pc';
  if (v === 'desktop') return 'pc';
  if (v === 'mobile') return 'mobile';
  if (v === 'phone') return 'mobile';
  if (v === 'vr') return 'vr';
  if (v === 'webxr') return 'vr';
  if (v === 'cvr') return 'cvr';
  if (v === 'cardboard') return 'cardboard';
  if (v === 'cb') return 'cardboard';
  return v;
}

function isCoarsePointer(){
  try { return !!(WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches); }
  catch(_) { return false; }
}

async function supportsImmersiveVR(){
  try{
    if (!navigator.xr || typeof navigator.xr.isSessionSupported !== 'function') return false;
    return await navigator.xr.isSessionSupported('immersive-vr');
  }catch(_){
    return false;
  }
}

function clearViewClasses(){
  DOC.body.classList.remove(
    'view-pc','view-mobile','view-cvr','view-vr','cardboard'
  );
}

function applyView(view){
  clearViewClasses();

  // base
  if (view === 'mobile') DOC.body.classList.add('view-mobile');
  else DOC.body.classList.add('view-pc');

  // cVR / VR / Cardboard split
  if (view === 'cvr') DOC.body.classList.add('view-cvr');
  if (view === 'vr'){
    // IMPORTANT:
    // Hydration targets are DOM-based; to make gameplay work in VR-ish contexts,
    // we keep crosshair shooting mode enabled via view-cvr.
    DOC.body.classList.add('view-vr','view-cvr');
  }
  if (view === 'cardboard'){
    DOC.body.classList.add('cardboard');
    // (cardboard split uses L/R layers; aim mode is handled via vr-ui crosshair in "view-cvr" normally,
    // but split mode relies on target taps or future upgrades — we keep it pure cardboard class here)
  }
}

function resolveLayers(view){
  // Allow SAFE to find layers consistently
  if (view === 'cardboard'){
    return ['hydration-layerL','hydration-layerR'];
  }
  return ['hydration-layer'];
}

function setHHAView(view){
  const layers = resolveLayers(view);
  WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
    game: 'hydration',
    view,
    // SAFE will read this array and mount into these layer ids
    layers,
    // helpful IDs (optional)
    playfieldId: (view === 'cardboard') ? 'cbPlayfield' : 'playfield'
  });
}

function resolveViewByRules(explicitView){
  // 1) If user explicitly sets ?view=... => never override
  if (explicitView) return explicitView;

  // 2) If cb=1 (or split=1) and no explicit view: treat as cardboard split intent
  const cb = String(qs('cb', qs('split','0')) || '0');
  if (cb === '1') return 'cardboard';

  // 3) Default heuristic: coarse pointer => mobile, else pc
  return isCoarsePointer() ? 'mobile' : 'pc';
}

async function finalizeDetect(){
  const explicit = hasQS('view') ? normView(qs('view','')) : '';
  let view = resolveViewByRules(explicit);

  // If no explicit view, we may upgrade to VR/cVR based on WebXR support
  // (still not overriding explicit view)
  if (!explicit){
    const wantsXR = (qs('xr','0') === '1'); // optional hint, but not required
    const hasXR = await supportsImmersiveVR();

    // If XR is available and user hinted xr=1, pick 'vr'
    if (hasXR && wantsXR){
      view = 'vr';
    }
  }

  // Normalize any unknown to safe defaults
  if (!['pc','mobile','cvr','vr','cardboard'].includes(view)){
    view = isCoarsePointer() ? 'mobile' : 'pc';
  }

  applyView(view);
  setHHAView(view);

  log('view=', view, 'layers=', WIN.HHA_VIEW?.layers);
  return view;
}

// Import SAFE game module (after view set)
async function loadSafe(){
  try{
    await import('./hydration.safe.js');
    log('hydration.safe.js loaded');
  }catch(err){
    console.error('[HydrationLoader] Failed to import hydration.safe.js', err);
    // show minimal fallback message (non-blocking)
    try{
      const sub = DOC.getElementById('start-sub');
      if (sub) sub.textContent = 'โหลดเกมไม่สำเร็จ (safe.js) — ตรวจสอบไฟล์/พาธอีกครั้ง';
    }catch(_){}
  }
}

// Optional: status text
function updateStartOverlayText(view){
  try{
    const sub = DOC.getElementById('start-sub');
    if (!sub) return;

    let label = 'PC';
    if (DOC.body.classList.contains('cardboard')) label = 'VR Cardboard (Split)';
    else if (DOC.body.classList.contains('view-vr')) label = 'VR (WebXR)';
    else if (DOC.body.classList.contains('view-cvr')) label = 'cVR (Crosshair ยิงกลางจอ)';
    else if (DOC.body.classList.contains('view-mobile')) label = 'Mobile';

    sub.textContent = `โหมดตรวจจับแล้ว: ${label}  •  แตะเพื่อเริ่ม`;
  }catch(_){}
}

// Global error trap (debug)
function bindGlobalErrorTrap(){
  if (WIN.__HHA_HYDRATION_ERR_TRAP__) return;
  WIN.__HHA_HYDRATION_ERR_TRAP__ = true;

  WIN.addEventListener('error', (ev)=>{
    try{
      if (qs('debug','0') !== '1') return;
      console.warn('[HydrationLoader] window.error', ev?.message || ev);
    }catch(_){}
  });

  WIN.addEventListener('unhandledrejection', (ev)=>{
    try{
      if (qs('debug','0') !== '1') return;
      console.warn('[HydrationLoader] unhandledrejection', ev?.reason || ev);
    }catch(_){}
  });
}

(async function boot(){
  try{
    bindGlobalErrorTrap();
    const view = await finalizeDetect();
    updateStartOverlayText(view);

    // Configure vr-ui if desired (optional)
    // WIN.HHA_VRUI_CONFIG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});

    await loadSafe();

    // If overlay already hidden (e.g., auto-start flow), SAFE boot will auto-dispatch hha:start after 600ms
    // (hydration.safe.js already has that auto-start fallback)
  }catch(err){
    console.error('[HydrationLoader] boot failed', err);
  }
})();