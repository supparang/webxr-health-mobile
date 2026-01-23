// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ Detect view -> set body classes (pc/mobile/vr/cvr)
// ✅ Starts engine once DOM ready
// ✅ Works with vr-ui.js (hha:shoot event)
// ✅ No override: if ?view= exists already, respect it

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function has(k){
  try{ return new URL(location.href).searchParams.has(k); }
  catch{ return false; }
}

function isLikelyMobileUA(){
  const ua = (navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

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

async function detectView(){
  // respect user param: do NOT override
  if(has('view')) return normalizeView(qs('view','auto'));

  // soft memory (optional)
  try{
    const last = localStorage.getItem('HHA_LAST_VIEW');
    if(last) return normalizeView(last);
  }catch(_){}

  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // best-effort webxr check
  try{
    if(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok){
        guess = isLikelyMobileUA() ? 'vr' : 'pc';
      }
    }
  }catch(_){}

  return normalizeView(guess);
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile'); // default
}

function safeRunBoot(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const view = normalizeView(qs('view','auto'));
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = Number(qs('time','80')) || 80;
  const seed = qs('seed', Date.now());

  engineBoot({ view, run, diff, time, seed });
}

async function main(){
  const v = await detectView();
  // if no param, apply detected view as class only (do not rewrite URL)
  setBodyView(v === 'auto' ? (isLikelyMobileUA() ? 'mobile':'pc') : v);

  // boot after DOM ready
  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', safeRunBoot, { once:true });
  }else{
    safeRunBoot();
  }
}

main();