// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (HHA Standard)
// ✅ Auto-detect view (PC / Mobile) — respects ?view= if provided (no override)
// ✅ Supports: view=pc | mobile | cvr | cardboard
// ✅ Sets body classes: view-pc / view-mobile / view-cvr / cardboard
// ✅ Exposes window.HHA_VIEW.layers for SAFE (Cardboard split L/R)
// ✅ Imports hydration.safe.js (game logic)
// Notes:
// - Tap-to-start gesture + fullscreen/orientation handled in hydration-vr.html overlay
// - Universal VR UI loaded via ../vr/vr-ui.js (defer) in hydration-vr.html

'use strict';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{
  try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
};

function setOverlayText(msg){
  const el = DOC.getElementById('start-sub');
  if (el) el.textContent = String(msg || '');
}

function normalizeView(v){
  v = String(v||'').toLowerCase().trim();
  if (v==='pc' || v==='desktop') return 'pc';
  if (v==='m' || v==='mob' || v==='phone' || v==='mobile') return 'mobile';
  if (v==='cvr' || v==='cardboard-vr' || v==='viewer') return 'cvr';
  if (v==='cardboard' || v==='cb' || v==='vr') return 'cardboard';
  return '';
}

function isCoarsePointer(){
  try{ return !!(matchMedia && matchMedia('(pointer:coarse)').matches); }catch(_){ return false; }
}
function isTouch(){
  try{ return ('ontouchstart' in WIN) || (navigator.maxTouchPoints>0); }catch(_){ return false; }
}

function autoDetectView(){
  // ✅ do not override ?view= if provided — handled outside
  // Heuristic only (safe + predictable)
  const coarse = isCoarsePointer();
  const touch  = isTouch();

  // Default: mobile if coarse/touch, else pc
  if (coarse || touch) return 'mobile';
  return 'pc';
}

function applyBodyClasses(view){
  const b = DOC.body;
  if (!b) return;

  // clear known classes
  b.classList.remove('view-pc','view-mobile','view-cvr','cardboard','view-vr');

  if (view === 'cardboard'){
    b.classList.add('cardboard','view-vr'); // split L/R
  } else if (view === 'cvr'){
    b.classList.add('view-cvr','view-vr');  // strict crosshair mode (targets unclickable in html)
  } else if (view === 'mobile'){
    b.classList.add('view-mobile');
  } else {
    b.classList.add('view-pc');
  }
}

function computeLayers(view){
  // Provide ids for SAFE to mount targets to correct layers
  if (view === 'cardboard'){
    return ['hydration-layerL','hydration-layerR'];
  }
  return ['hydration-layer'];
}

function viewLabel(){
  const b = DOC.body;
  if (b?.classList.contains('cardboard')) return 'VR Cardboard (Split)';
  if (b?.classList.contains('view-cvr')) return 'cVR (Crosshair ยิงกลางจอ)';
  if (b?.classList.contains('view-mobile')) return 'Mobile';
  return 'PC';
}

async function boot(){
  try{
    // 1) Decide view (respect ?view=)
    const forced = normalizeView(qs('view',''));
    const view = forced || autoDetectView();

    // 2) Apply body classes
    applyBodyClasses(view);

    // 3) Expose HHA_VIEW for SAFE
    const layers = computeLayers(view);

    WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
      game: 'hydration',
      view,
      layers,
      // helpful flags
      isCardboard: (view === 'cardboard'),
      isCVR: (view === 'cvr'),
      // ids used by html
      playfieldId: (view === 'cardboard') ? 'cbPlayfield' : 'playfield'
    });

    // 4) Update overlay text
    setOverlayText(`โหมดตรวจจับแล้ว: ${viewLabel()}  •  แตะเพื่อเริ่ม`);

    // 5) Import SAFE game logic (listens to hha:start)
    //    (SAFE will read window.HHA_VIEW.layers)
    await import('./hydration.safe.js');

    // 6) Optional: tell others we're ready
    try{ WIN.dispatchEvent(new CustomEvent('hha:ready', { detail:{ game:'hydration', view, layers } })); }catch(_){}
  }catch(err){
    console.error('[Hydration Loader] boot failed:', err);
    setOverlayText('โหลดเกมไม่สำเร็จ — เปิด Console เพื่อดู error');
  }
}

if (DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', boot, { once:true });
} else {
  boot();
}