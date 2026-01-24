// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ Uses: ./goodjunk.safe.js (FAIR PACK)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ DOES NOT override if URL already has ?view=...
// ✅ Pass-through + ctx build (hub/run/diff/time/seed/log/style)
// ✅ Sets body classes: view-pc/view-mobile/view-vr/view-cvr
// ✅ Config vr-ui.js: crosshair shoot emits hha:shoot
// ✅ Best-effort logger flush (if hha-cloud-logger exposes API)

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v === 'cardboard') return 'vr';
  if(v === 'view-cvr') return 'cvr';
  if(v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'mobile') return 'mobile';
  if(v === 'pc') return 'pc';
  return 'auto';
}

function isLikelyMobileUA(){
  const ua = String(navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

async function detectView(){
  // ✅ Never override if user passed view=
  if(has('view')) return normalizeView(qs('view','auto'));

  // Soft default: UA
  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // If WebXR VR supported, and on mobile -> lean to 'vr' (cardboard path)
  try{
    if(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok && isLikelyMobileUA()) guess = 'vr';
    }
  }catch(_){}

  return normalizeView(guess);
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.add('gj'); // ensure base skin

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile'); // default
}

function buildCtx(v){
  const ctx = {
    game: 'GoodJunkVR',
    pack: 'fair',
    view: v,
    run: String(qs('run','play')||'play').toLowerCase(),
    diff: String(qs('diff','normal')||'normal').toLowerCase(),
    time: Number(qs('time','80')||80) || 80,
    seed: String(qs('seed', Date.now())),
    hub: qs('hub', null),
    log: qs('log', null),
    style: qs('style', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
    ts: qs('ts', null),
  };
  return ctx;
}

// vr-ui config (crosshair shoot)
function configureVRUI(ctx){
  // This is read by ../vr/vr-ui.js
  WIN.HHA_VRUI_CONFIG = Object.assign(
    { lockPx: 28, cooldownMs: 90 },
    WIN.HHA_VRUI_CONFIG || {}
  );

  // In strict cVR we want shooting only (targets pointer-events already disabled by CSS)
  if(ctx.view === 'cvr'){
    WIN.HHA_VRUI_CONFIG.lockPx = Math.max(22, Number(WIN.HHA_VRUI_CONFIG.lockPx)||28);
  }
}

// Best-effort logger integration (doesn't assume specific API)
function tryInitLogger(ctx){
  if(!ctx.log) return;

  // Try a couple of likely shapes; if none exist, it silently does nothing.
  try{
    if(WIN.HHACloudLogger && typeof WIN.HHACloudLogger.init === 'function'){
      WIN.HHACloudLogger.init({ endpoint: ctx.log, ctx });
    }
  }catch(_){}

  try{
    if(WIN.hhaCloudLogger && typeof WIN.hhaCloudLogger.init === 'function'){
      WIN.hhaCloudLogger.init({ endpoint: ctx.log, ctx });
    }
  }catch(_){}
}

function tryFlushLogger(){
  try{
    if(WIN.HHACloudLogger && typeof WIN.HHACloudLogger.flush === 'function') WIN.HHACloudLogger.flush();
  }catch(_){}
  try{
    if(WIN.hhaCloudLogger && typeof WIN.hhaCloudLogger.flush === 'function') WIN.hhaCloudLogger.flush();
  }catch(_){}
}

// Back HUB helper (flush-hardened)
function installBackGuard(ctx){
  // If page is leaving, try flush first
  WIN.addEventListener('pagehide', tryFlushLogger, { passive:true });
  WIN.addEventListener('beforeunload', tryFlushLogger, { passive:true });

  // If someone else dispatches "hha:backhub" we honor it
  WIN.addEventListener('hha:backhub', ()=>{
    tryFlushLogger();
    if(ctx.hub) location.href = ctx.hub;
  }, { passive:true });
}

async function start(){
  const view = await detectView();
  const ctx = buildCtx(view);

  setBodyView(view);
  configureVRUI(ctx);
  tryInitLogger(ctx);
  installBackGuard(ctx);

  // Boot engine (FAIR PACK)
  engineBoot({
    view: ctx.view,
    run: ctx.run,
    diff: ctx.diff,
    time: ctx.time,
    seed: ctx.seed,
  });

  // Optional: reflect to chip (if present)
  try{
    const chip = DOC.getElementById('gjChipMeta');
    if(chip){
      chip.textContent = `view=${ctx.view} · run=${ctx.run} · diff=${ctx.diff} · time=${ctx.time}`;
    }
  }catch(_){}
}

// Start once DOM is ready
if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', start, { once:true });
}else{
  start();
}