// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ View modes: pc / mobile / vr / cvr (auto via URL param)
// ✅ Adds body classes: view-pc, view-mobile, view-vr, view-cvr
// ✅ Starts engine once DOM ready (timeout-safe)
// ✅ Keeps silent if boot already ran
// ✅ Pairs with: ./goodjunk.safe.js (export boot())

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
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
  return 'mobile'; // default safe
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
}

function waitDomReady(timeoutMs=4000){
  return new Promise((resolve)=>{
    const done = ()=>resolve(true);
    if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
      return done();
    }
    const t = setTimeout(()=>resolve(false), timeoutMs);
    DOC.addEventListener('DOMContentLoaded', ()=>{
      clearTimeout(t);
      done();
    }, { once:true });
  });
}

async function bootOnce(){
  if(WIN.__HHA_GJ_BOOTED__) return;
  WIN.__HHA_GJ_BOOTED__ = true;

  // Determine view/diff/time/run/seed (pass-through already done by launcher)
  const view = normView(qs('view','mobile'));
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = Number(qs('time','80')) || 80;
  const seed = qs('seed', String(Date.now()));

  setBodyView(view);

  // Ensure DOM exists
  await waitDomReady(4500);

  // Give HUD safe-zone measurer a moment (it runs in goodjunk-vr.html)
  // but don't block too long
  setTimeout(()=>{
    try{
      engineBoot({ view, run, diff, time, seed });
    }catch(err){
      console.error('[GoodJunkVR boot] engineBoot failed:', err);
      // allow retry once if something loaded late
      setTimeout(()=>{
        try{ engineBoot({ view, run, diff, time, seed }); }catch(e2){ console.error(e2); }
      }, 250);
    }
  }, 60);
}

// Start
bootOnce();