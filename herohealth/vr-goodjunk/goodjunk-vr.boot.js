// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ Detect view class (pc/mobile/vr/cvr) without fighting launcher
// ✅ Boots goodjunk.safe.js exactly once
// ✅ Starts after DOM ready + after safe-zone is measured (best-effort)
// ✅ Flush-hardened: flush log on visibilitychange / pagehide before leaving
// NOTE: SAFE emits hha:start/time/score/judge/end already.

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}

function normalizeView(v){
  v = String(v || '').toLowerCase();
  if(v === 'cardboard') return 'vr';
  if(v === 'view-cvr') return 'cvr';
  if(v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'pc') return 'pc';
  if(v === 'mobile') return 'mobile';
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add('view-' + view);
}

function safeCall(fn){
  try{ fn(); }catch(_){}
}

/* ---------------------------------------------
 * Flush-hardened helpers
 * (works with hha-cloud-logger.js if present)
 * ------------------------------------------- */
function flushCloud(reason='flush'){
  // hha-cloud-logger.js (your standard) may expose one of these
  const L = WIN.HHA_LOGGER || WIN.HHA_CLOUD_LOGGER || WIN.HHA_CloudLogger;
  if(!L) return;

  // try common names
  if(typeof L.flush === 'function') safeCall(()=>L.flush({ reason }));
  else if(typeof L.flushNow === 'function') safeCall(()=>L.flushNow({ reason }));
  else if(typeof L.sendNow === 'function') safeCall(()=>L.sendNow({ reason }));
}

function setupFlushHardened(){
  // on tab hide / close
  WIN.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flushCloud('visibility:hidden');
  }, { passive:true });

  WIN.addEventListener('pagehide', ()=>{
    flushCloud('pagehide');
  }, { passive:true });

  // if user clicks back hub button, run html will navigate directly
  // (we still attempt flush just in case)
  WIN.addEventListener('beforeunload', ()=>{
    flushCloud('beforeunload');
  }, { passive:true });
}

/* ---------------------------------------------
 * Boot once
 * ------------------------------------------- */
function wait(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function bootOnce(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const view = normalizeView(qs('view','mobile'));
  setBodyView(view);

  // best-effort: allow the inline "updateSafe()" in goodjunk-vr.html
  // to measure HUD sizes and set --gj-top-safe/--gj-bottom-safe
  await wait(60);
  await wait(120);

  const opts = {
    view,
    run:  qs('run','play'),
    diff: qs('diff','normal'),
    time: qs('time','80'),
    seed: qs('seed', Date.now())
  };

  setupFlushHardened();

  // Start SAFE engine
  engineBoot(opts);
}

function onReady(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

onReady(()=>{ bootOnce(); });