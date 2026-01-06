// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (ULTRA + AUTO DETECT)
// ✅ View class from URL: pc/mobile/vr/cvr (if provided)
// ✅ AUTO: if no ?view= -> detect pc/mobile; prefer vr if WebXR immersive-vr supported & not mobile
// ✅ Loads ../vr/vr-ui.js when (view=vr/cvr) OR (AUTO mode && WebXR available)
// ✅ Auto-switch view on Enter/Exit VR (mobile->cvr, desktop->vr) without showing any option
// ✅ HUD-safe measure -> sets CSS vars --gj-top-safe / --gj-bottom-safe
// ✅ Debug keys: Space/Enter => hha:shoot
// ✅ Boots engine: goodjunk.safe.js (this folder)

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const WIN = window;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function isMobileUA(){
  const ua = String(navigator.userAgent || '').toLowerCase();
  return /android|iphone|ipad|ipod/.test(ua);
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.add('gj');
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');

  // aria for right eye (only meaningful in cVR split)
  const r = DOC.getElementById('gj-layer-r');
  if(r){
    r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');
  }

  DOC.body.dataset.view = view;
}

function normalizeView(v){
  v = String(v || '').toLowerCase();
  return (v === 'pc' || v === 'vr' || v === 'cvr' || v === 'mobile') ? v : null;
}

async function supportsImmersiveVR(){
  try{
    if(!navigator.xr || !navigator.xr.isSessionSupported) return false;
    return await navigator.xr.isSessionSupported('immersive-vr');
  }catch(_){
    return false;
  }
}

// If ?view is provided => honor it.
// Else AUTO:
// - mobile UA => mobile (but we still load vr-ui if WebXR exists so user can Enter VR -> cVR)
// - non-mobile + immersive-vr supported => vr
// - otherwise => pc
async function inferViewAuto(){
  const forced = normalizeView(qs('view', null));
  if(forced) return { view: forced, auto: false };

  const mobile = isMobileUA();
  if(!mobile){
    const vrOK = await supportsImmersiveVR();
    if(vrOK) return { view: 'vr', auto: true };
    return { view: 'pc', auto: true };
  }

  return { view: 'mobile', auto: true };
}

// Runtime view switcher (used when entering/exiting VR)
let BASE_VIEW = 'mobile';
function setViewRuntime(view){
  const v = normalizeView(view) || 'mobile';
  setBodyView(v);
  // After switching view, re-measure HUD safe
  try{
    WIN.dispatchEvent(new CustomEvent('hha:view', { detail:{ view:v } }));
  }catch(_){}
}

function ensureVrUiLoaded(shouldLoad){
  if(!shouldLoad) return;

  if(WIN.__HHA_VR_UI_LOADED__) return;
  WIN.__HHA_VR_UI_LOADED__ = true;

  const exists = Array.from(DOC.scripts || []).some(s => (s.src || '').includes('/vr/vr-ui.js'));
  if(exists) return;

  const s = DOC.createElement('script');
  s.src = '../vr/vr-ui.js';
  s.defer = true;
  s.onerror = ()=> console.warn('[GoodJunkVR] vr-ui.js failed to load');
  DOC.head.appendChild(s);
}

// Listen for Enter/Exit VR signals (we accept multiple event names for robustness)
function bindVrAutoSwitch(){
  const mobile = isMobileUA();

  function onEnterVR(){
    // When user enters VR: mobile -> cvr, else -> vr
    setViewRuntime(mobile ? 'cvr' : 'vr');
  }
  function onExitVR(){
    setViewRuntime(BASE_VIEW);
  }

  // Common / custom events (vr-ui.js or aframe-like hooks)
  WIN.addEventListener('enter-vr', onEnterVR, { passive:true });
  WIN.addEventListener('exit-vr', onExitVR, { passive:true });

  WIN.addEventListener('hha:enter-vr', onEnterVR, { passive:true });
  WIN.addEventListener('hha:exit-vr', onExitVR, { passive:true });

  WIN.addEventListener('vrdisplaypresentchange', ()=>{
    // legacy WebVR fallback
    const presenting = !!(navigator.getVRDisplays);
    if(presenting) onEnterVR();
    else onExitVR();
  }, { passive:true });

  // If vr-ui.js dispatches a generic "hha:vr" state event, support it too
  WIN.addEventListener('hha:vr', (e)=>{
    const state = String(e?.detail?.state || '').toLowerCase();
    if(state === 'enter' || state === 'on' || state === 'start') onEnterVR();
    if(state === 'exit'  || state === 'off' || state === 'end') onExitVR();
  }, { passive:true });

  // Expose a direct hook (in case vr-ui wants to call explicitly)
  WIN.HHA_GJ_setView = setViewRuntime;
}

function bindDebugKeys(){
  WIN.addEventListener('keydown', (e)=>{
    const k = e.key || '';
    if(k === ' ' || k === 'Enter'){
      try{ WIN.dispatchEvent(new CustomEvent('hha:shoot', { detail:{ source:'key' } })); }catch(_){}
    }
  }, { passive:true });
}

function hudSafeMeasure(){
  const root = DOC.documentElement;
  const px = (n)=> Math.max(0, Math.round(Number(n)||0)) + 'px';
  const h  = (el)=> { try{ return el ? el.getBoundingClientRect().height : 0; }catch{return 0;} };

  function update(){
    try{
      const cs = getComputedStyle(root);
      const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
      const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;

      const topbar  = DOC.querySelector('.gj-topbar');
      const hud     = DOC.getElementById('hud');
      const miniHud = DOC.getElementById('vrMiniHud');
      const fever   = DOC.getElementById('feverBox');
      const controls= DOC.querySelector('.hha-controls');

      let topSafe = 0;
      topSafe = Math.max(topSafe, h(topbar));
      topSafe = Math.max(topSafe, h(miniHud));
      topSafe = Math.max(topSafe, h(hud) * 0.55);
      topSafe += (14 + sat);

      let bottomSafe = 0;
      bottomSafe = Math.max(bottomSafe, h(fever));
      bottomSafe = Math.max(bottomSafe, h(controls));
      bottomSafe += (16 + sab);

      const hudHidden = DOC.body.classList.contains('hud-hidden');
      if(hudHidden){
        topSafe = Math.max(72 + sat, h(topbar) + 10 + sat);
        bottomSafe = Math.max(76 + sab, h(fever) + 10 + sab);
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    }catch(_){}
  }

  WIN.addEventListener('resize', update, { passive:true });
  WIN.addEventListener('orientationchange', update, { passive:true });

  // when HUD toggles
  WIN.addEventListener('click', (e)=>{
    if(e?.target?.id === 'btnHideHud'){
      setTimeout(update, 30);
      setTimeout(update, 180);
      setTimeout(update, 420);
    }
  }, { passive:true });

  // when view switches (enter/exit vr)
  WIN.addEventListener('hha:view', ()=>{
    setTimeout(update, 0);
    setTimeout(update, 120);
    setTimeout(update, 350);
  }, { passive:true });

  setTimeout(update, 0);
  setTimeout(update, 120);
  setTimeout(update, 350);
  setInterval(update, 1200);
}

async function start(){
  const { view, auto } = await inferViewAuto();

  // remember base view for Exit VR
  BASE_VIEW = (view === 'vr' || view === 'cvr') ? (isMobileUA() ? 'mobile' : 'pc') : view;

  setBodyView(view);

  // Load VR UI if:
  // - forced/selected view is vr/cvr
  // - OR auto mode and WebXR exists (so user can press Enter VR even when base view is mobile/pc)
  const shouldLoadVrUi = (view === 'vr' || view === 'cvr') || (auto && !!navigator.xr);
  ensureVrUiLoaded(shouldLoadVrUi);

  bindVrAutoSwitch();
  bindDebugKeys();
  hudSafeMeasure();

  engineBoot({
    view,
    diff: qs('diff','normal'),
    run: qs('run','play'),
    time: qs('time','80'),
    seed: qs('seed', null),
    hub: qs('hub', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  });
}

if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', start);
else start();