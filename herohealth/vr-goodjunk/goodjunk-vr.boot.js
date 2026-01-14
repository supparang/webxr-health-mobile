// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (A+B+C)
// ✅ Auto-detect view WITHOUT overriding explicit ?view=
// ✅ Sets body classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ Toggles right-eye layer (#gj-layer-r) for cVR
// ✅ Passes payload -> goodjunk.safe.js boot(payload)
// ✅ Safe: start once, DOM-ready guarded

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function clamp(n,min,max){
  n = Number(n);
  if(!Number.isFinite(n)) n = min;
  return n < min ? min : (n > max ? max : n);
}

function detectViewNoOverride(){
  const explicit = String(qs('view','')).toLowerCase().trim();
  if(explicit) return explicit;

  const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
  const w = Math.max(1, WIN.innerWidth||1);
  const h = Math.max(1, WIN.innerHeight||1);
  const landscape = w >= h;

  // Heuristic:
  // - Touch + big landscape => cVR (Cardboard view) feels best
  // - Touch otherwise => mobile
  // - Non-touch => pc
  if(isTouch){
    if(landscape && w >= 740) return 'cvr';
    return 'mobile';
  }
  return 'pc';
}

function normalizeView(v){
  v = String(v||'').toLowerCase().trim();
  if(v === 'vr') return 'vr';
  if(v === 'cvr') return 'cvr';
  if(v === 'pc') return 'pc';
  if(v === 'mobile') return 'mobile';
  if(v === 'auto') return detectViewNoOverride();
  // allow some aliases
  if(v === 'cardboard') return 'cvr';
  return detectViewNoOverride();
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');

  // toggle right eye layer (only meaningful for cvr)
  const r = DOC.getElementById('gj-layer-r');
  if(r){
    r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');
  }
}

function buildPayload(){
  const view = normalizeView(qs('view','auto'));
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();

  const time = clamp(qs('time','80'), 20, 300);

  const hub  = (qs('hub','')||'').trim() || null;

  // seed handling:
  // - research: prefer seed param or ts
  // - play: if user passes seed use it, else safe.js may choose Date.now()
  const seed = qs('seed', null) ?? null;

  // optional study params
  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  return { view, run, diff, time, hub, seed, studyId, phase, conditionGroup };
}

function startOnce(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const payload = buildPayload();
  setBodyView(payload.view);

  // If user is in VR mode, keep it as vr (no forced)
  // If they pass view=vr explicitly: let vr-ui handle Enter VR flow.

  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR boot] engineBoot failed:', err);
  }
}

function onReady(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
    fn();
  }else{
    DOC.addEventListener('DOMContentLoaded', fn, { once:true });
  }
}

// If page is restored from BFCache, re-run safely
WIN.addEventListener('pageshow', (ev)=>{
  try{
    if(ev && ev.persisted){
      // allow a fresh boot when coming back from bfcache
      WIN.__GJ_BOOTED__ = false;
      startOnce();
    }
  }catch(_){}
}, { passive:true });

onReady(startOnce);