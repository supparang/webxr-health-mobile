// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Fair Pack)
// ✅ DO NOT override if ?view= exists
// ✅ Auto-detect view if missing (pc/mobile/vr)
// ✅ Applies body classes: view-pc/mobile/vr/cvr
// ✅ Boots ./goodjunk.safe.js (fair pack)
// ✅ Pass-through ctx: hub/run/diff/time/seed/studyId/phase/conditionGroup/log/style/ts

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function has(k){
  try{ return new URL(location.href).searchParams.has(k); }
  catch{ return false; }
}

function isLikelyMobileUA(){
  const ua = String(navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v === 'cardboard') return 'vr';
  if(v === 'view-cvr' || v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'pc') return 'pc';
  if(v === 'mobile') return 'mobile';
  return 'auto';
}

async function detectView(){
  // ✅ must respect explicit view
  if(has('view')) return normalizeView(qs('view','auto'));

  // soft remember
  try{
    const last = localStorage.getItem('HHA_LAST_VIEW');
    if(last) return normalizeView(last);
  }catch(_){}

  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // best-effort: WebXR support -> allow 'vr' (esp. mobile)
  try{
    if(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok){
        // if mobile + xr -> likely cardboard flow
        guess = isLikelyMobileUA() ? 'vr' : 'pc';
      }
    }
  }catch(_){}

  return normalizeView(guess);
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function safeNum(v, fallback){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bootOnce(opts){
  try{
    if(WIN.__GJ_BOOTED__) return;
    WIN.__GJ_BOOTED__ = true;
    engineBoot(opts);
  }catch(e){
    console.error('[GoodJunkVR] boot failed', e);
    alert('Boot error: ' + (e?.message || e));
  }
}

// wait DOM (avoid missing HUD elements)
function onReady(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

onReady(async ()=>{
  const view = await detectView();

  // remember only if not explicitly forced
  if(!has('view') && view && view !== 'auto'){
    try{ localStorage.setItem('HHA_LAST_VIEW', view); }catch(_){}
  }

  setBodyView(view);

  // gather ctx
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = safeNum(qs('time','80'), 80);
  const seed = String(qs('seed', Date.now()));

  // (optional) expose chip meta already handled in HTML

  // ✅ start engine
  bootOnce({ view, run, diff, time, seed });
});