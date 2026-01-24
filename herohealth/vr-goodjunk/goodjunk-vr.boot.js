// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (works with FAIR PACK safe.js v2.3)
// ✅ Sets body view class: view-pc / view-mobile / view-vr / view-cvr
// ✅ Does NOT override if ?view= already set (launcher handles it anyway)
// ✅ Starts engine (goodjunk.safe.js) with passthrough opts
// ✅ Keeps UI layers ready for cVR (right-eye layer exists; CSS handles pointer-events)
// ✅ Minimal, robust, no GameEngine dependency

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));

function normalizeView(v){
  v = String(v||'').toLowerCase();
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

  b.classList.add('gj');
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function ensureLayers(){
  // ensure right-eye layer exists (for cVR UI layering; optional)
  const main = DOC.getElementById('gj-layer');
  const r = DOC.getElementById('gj-layer-r');
  if(main && !r){
    const rr = DOC.createElement('div');
    rr.id = 'gj-layer-r';
    rr.className = 'gj-layer gj-layer-r';
    rr.setAttribute('aria-hidden','true');
    main.parentElement?.appendChild(rr);
  }
}

function waitDOM(){
  return new Promise((res)=>{
    if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') return res();
    DOC.addEventListener('DOMContentLoaded', ()=>res(), { once:true });
  });
}

async function boot(){
  await waitDOM();

  const view = normalizeView(qs('view','mobile'));
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = clamp(qs('time','80'), 20, 300);
  const seed = String(qs('seed', Date.now()));

  setBodyView(view);
  ensureLayers();

  // If run.html has safe-zone measurer, it will update CSS vars itself.
  // We'll just call a best-effort resize tick to help first frame.
  try{
    WIN.dispatchEvent(new Event('resize'));
    setTimeout(()=>WIN.dispatchEvent(new Event('resize')), 120);
  }catch(_){}

  // Start engine
  engineBoot({
    view,
    run,
    diff,
    time,
    seed,
  });
}

boot();