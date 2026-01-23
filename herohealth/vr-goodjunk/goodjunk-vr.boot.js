// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Fair Pack)
// ✅ View modes: pc / mobile / vr / cvr (auto allowed from launcher)
// ✅ Sets body classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ Boots safe engine: ./goodjunk.safe.js
// ✅ Starts once DOM ready + small retry (for slow mobile)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function normalizeView(v){
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
  b.classList.add(
    view==='pc' ? 'view-pc' :
    view==='vr' ? 'view-vr' :
    view==='cvr'? 'view-cvr' : 'view-mobile'
  );
}

function safeBoot(){
  // prevent double boot
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const view = normalizeView(qs('view','mobile'));
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = Number(qs('time','80')) || 80;
  const seed = qs('seed', String(Date.now()));

  setBodyView(view);

  // let layout compute safe rect first
  setTimeout(()=>{
    try{
      engineBoot({ view, run, diff, time, seed });
    }catch(e){
      // one retry (rare on slow devices)
      WIN.__GJ_BOOTED__ = false;
      setTimeout(()=>safeBoot(), 120);
      console.warn('[GoodJunkVR] boot retry:', e);
    }
  }, 0);
}

function onReady(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

onReady(()=>{
  // ensure measure-safe runs (in html inline script) then boot
  setTimeout(safeBoot, 30);
});