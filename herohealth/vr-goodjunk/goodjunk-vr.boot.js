// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ Detect view from ?view= (pc/mobile/vr/cvr) (no override here)
// ✅ Sets body class: view-pc/view-mobile/view-vr/view-cvr
// ✅ Boots engine once DOM ready
// ✅ Safe-guard: no double boot

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}

function normView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='view-cvr' || v==='cvr') return 'cvr';
  if(v==='vr') return 'vr';
  if(v==='pc') return 'pc';
  if(v==='mobile') return 'mobile';
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  if(view==='pc') b.classList.add('view-pc');
  else if(view==='vr') b.classList.add('view-vr');
  else if(view==='cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function bootOnce(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const view = normView(qs('view','mobile'));
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = Number(qs('time','80')||80);
  const seed = String(qs('seed', Date.now()));

  setBodyView(view);

  // Let layout measure settle a beat (safe vars from HTML updateSafe())
  setTimeout(()=>{
    try{
      engineBoot({ view, run, diff, time, seed });
    }catch(e){
      console.error('[GoodJunkVR] boot failed', e);
      // allow retry if something was too early
      WIN.__GJ_BOOTED__ = false;
    }
  }, 60);
}

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

ready(bootOnce);

// safety: if the page resumes from bfcache / visibility
WIN.addEventListener('pageshow', (ev)=>{
  if(ev && ev.persisted) bootOnce();
}, { passive:true });

WIN.addEventListener('visibilitychange', ()=>{
  if(!DOC.hidden) bootOnce();
}, { passive:true });