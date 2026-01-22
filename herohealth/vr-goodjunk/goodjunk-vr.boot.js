// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — PRODUCTION (FAIR PACK)
// ✅ Imports: ./goodjunk.safe.js (fair pack)
// ✅ Reads query: view/run/diff/time/seed
// ✅ Sets body classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ Starts engine once DOM is ready
// ✅ Safety: prevent double boot

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function normView(v){
  v = String(v||'').toLowerCase();
  if(v === 'cardboard') return 'vr';
  if(v === 'view-cvr') return 'cvr';
  if(v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'pc') return 'pc';
  if(v === 'mobile') return 'mobile';
  if(v === 'auto' || !v) return 'mobile';
  return v;
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

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
    setTimeout(fn, 0);
  }else{
    DOC.addEventListener('DOMContentLoaded', fn, { once:true });
  }
}

function bootOnce(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const view = normView(qs('view','mobile'));
  const run  = String(qs('run','play') || 'play').toLowerCase();
  const diff = String(qs('diff','normal') || 'normal').toLowerCase();
  const time = Number(qs('time','80')) || 80;
  const seed = String(qs('seed', Date.now()));

  setBodyView(view);

  // expose (optional) for debugging
  WIN.GJ_CTX = { view, run, diff, time, seed };

  // start engine
  try{
    engineBoot({ view, run, diff, time, seed });
  }catch(err){
    console.error('[GoodJunkVR] boot failed:', err);
    // allow retry once if something loads late
    WIN.__GJ_BOOTED__ = false;
    setTimeout(()=>{
      if(!WIN.__GJ_BOOTED__) bootOnce();
    }, 300);
  }
}

ready(bootOnce);