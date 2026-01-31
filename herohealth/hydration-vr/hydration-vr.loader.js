// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (FULL)
// ✅ Auto-detect view (pc/mobile/cvr/cardboard) WITHOUT overriding if ?view= exists
// ✅ Applies body classes: view-pc / view-mobile / view-cvr / cardboard
// ✅ Sets window.HHA_VIEW.layers for Cardboard split: hydration-layerL/R
// ✅ Loads Universal VR UI (../vr/vr-ui.js) -> Enter VR/Exit/Recenter + crosshair/tap-to-shoot => hha:shoot
// ✅ Imports hydration.safe.js after view is ready
// Notes:
// - hydration-vr.html already has its own crosshair + tap-to-shoot helper (safe even if vr-ui also exists)
// - vr-ui.js is safe to load multiple times (guarded by __HHA_VRUI_LOADED__)

'use strict';

const WIN = window;
const DOC = document;

const qs = (k, def = null) => {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function hasExplicitViewParam(){
  const v = String(qs('view','') || '').trim();
  return !!v;
}

function normalizeView(v){
  v = String(v || '').toLowerCase().trim();
  if (v === 'pc' || v === 'desktop') return 'pc';
  if (v === 'mobile' || v === 'm') return 'mobile';
  if (v === 'cvr' || v === 'cardboard-strict' || v === 'crosshair') return 'cvr';
  if (v === 'cardboard' || v === 'vr' || v === 'split') return 'cardboard';
  return '';
}

function detectViewAuto(){
  // Heuristic: coarse pointer => mobile-ish
  const coarse = !!(WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
  const w = Math.max(1, WIN.innerWidth || 0);
  const h = Math.max(1, WIN.innerHeight || 0);
  const landscape = w >= h;

  // If user is likely using Cardboard launcher, they usually pass view=cardboard or view=cvr.
  // If no param, choose:
  // - mobile => mobile
  // - desktop => pc
  if (coarse) return 'mobile';
  // on desktop, keep pc
  return 'pc';
}

function applyBodyClasses(view){
  const b = DOC.body;
  if (!b) return;

  // reset canonical classes
  b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');

  if (view === 'cardboard'){
    b.classList.add('cardboard');
  } else if (view === 'cvr'){
    b.classList.add('view-cvr');
  } else if (view === 'mobile'){
    b.classList.add('view-mobile');
  } else {
    b.classList.add('view-pc');
  }
}

function setLayersConfig(view){
  // hydration.safe.js uses HHA_VIEW.layers to decide L/R targets (Cardboard)
  // hydration-vr.html has:
  // - main: hydration-layer
  // - L/R: hydration-layerL / hydration-layerR
  WIN.HHA_VIEW = WIN.HHA_VIEW || {};
  if (view === 'cardboard'){
    WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
  } else {
    WIN.HHA_VIEW.layers = ['hydration-layer'];
  }
}

function ensureVrUiLoaded(){
  return new Promise((resolve) => {
    try{
      if (WIN.__HHA_VRUI_LOADED__) return resolve(true);

      // If user config exists, keep it; otherwise set sane defaults
      WIN.HHA_VRUI_CONFIG = Object.assign(
        { lockPx: 28, cooldownMs: 90 },
        WIN.HHA_VRUI_CONFIG || {}
      );

      const s = DOC.createElement('script');
      s.src = '../vr/vr-ui.js';
      s.defer = true;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      DOC.head.appendChild(s);
    }catch(_){
      resolve(false);
    }
  });
}

function bindBasicErrorTrap(){
  // lightweight guard: don’t crash silently
  try{
    WIN.addEventListener('error', (ev)=>{
      console.warn('[Hydration Loader] window.error:', ev?.message || ev);
    });
    WIN.addEventListener('unhandledrejection', (ev)=>{
      console.warn('[Hydration Loader] unhandledrejection:', ev?.reason || ev);
    });
  }catch(_){}
}

async function main(){
  bindBasicErrorTrap();

  // 1) Decide view (do NOT override if ?view= exists)
  const vParam = normalizeView(qs('view',''));
  const view = hasExplicitViewParam() ? (vParam || 'pc') : detectViewAuto();

  // 2) Apply classes + layer config
  applyBodyClasses(view);
  setLayersConfig(view);

  // 3) Load vr-ui.js (for ENTER VR/EXIT/RECENTER + crosshair shoot event)
  //    Even if hydration-vr.html already supports cVR shooting, vr-ui adds standard buttons.
  await ensureVrUiLoaded();

  // 4) Import game safe after view is ready
  //    hydration.safe.js will boot itself and wait for hha:start
  await import('./hydration.safe.js');
}

if (DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', main, { once:true });
} else {
  main();
}