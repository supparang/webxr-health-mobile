// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Fair Pack)
// ✅ Calls: ./goodjunk.safe.js (FAIR pack)
// ✅ Sets body view class: view-pc / view-mobile / view-vr / view-cvr
// ✅ Supports view=auto (best-effort) but DOES NOT override explicit ?view=
// ✅ Starts only when DOM ready
// ✅ Safe: error-guard + console diagnostics

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch(_){ return def; }
}
function has(k){
  try{ return new URL(location.href).searchParams.has(k); }
  catch(_){ return false; }
}
function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v === 'cardboard') return 'vr';
  if(v === 'view-cvr') return 'cvr';
  if(v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'pc') return 'pc';
  if(v === 'mobile') return 'mobile';
  return 'auto';
}
function isLikelyMobileUA(){
  const ua = (navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

async function detectViewAuto(){
  // If user explicitly passed view=..., keep it. (DO NOT override)
  if(has('view')) return normalizeView(qs('view','auto'));

  // best guess by UA
  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // WebXR hint: if immersive-vr is supported on mobile => likely vr
  try{
    if(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok && isLikelyMobileUA()) guess = 'vr';
    }
  }catch(_){}

  return normalizeView(guess);
}

function setBodyViewClass(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  const v = normalizeView(view);
  if(v === 'pc') b.classList.add('view-pc');
  else if(v === 'vr') b.classList.add('view-vr');
  else if(v === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function safeNumber(v, def){
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function readOpts(){
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = safeNumber(qs('time','80'), 80);
  const seed = String(qs('seed', Date.now()));
  return { run, diff, time, seed };
}

function startEngine(view){
  const { run, diff, time, seed } = readOpts();

  // For cVR, you can tune lock window a bit (optional)
  // (vr-ui.js reads window.HHA_VRUI_CONFIG if set)
  if(view === 'cvr'){
    WIN.HHA_VRUI_CONFIG = Object.assign({ lockPx: 30, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});
  }

  try{
    engineBoot({
      view,
      run,
      diff,
      time,
      seed
    });
  }catch(err){
    console.error('[GoodJunkVR] engine boot failed:', err);
    try{ alert('Boot error: ตรวจ console'); }catch(_){}
  }
}

async function main(){
  // ensure DOM
  if(!DOC || !DOC.body){
    await new Promise(res => DOC.addEventListener('DOMContentLoaded', res, { once:true }));
  }

  // Resolve view (auto or explicit)
  const view = await detectViewAuto();
  setBodyViewClass(view);

  // One more tick so that:
  // - inline script in goodjunk-vr.html has time to measure HUD and set --gj-top-safe/--gj-bottom-safe
  // - layout settles (important for spawn safe rect)
  setTimeout(()=> startEngine(view), 0);
}

main();