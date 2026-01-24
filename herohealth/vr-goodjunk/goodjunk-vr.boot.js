// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Fair Pack + Food5 + Missions)
// ✅ Sets body view classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ Passes opts -> goodjunk.safe.js
// ✅ Works with vr-ui.js (ENTER VR/EXIT/RECENTER + crosshair shoot hha:shoot)
// ✅ DOM-ready + single init guard

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch(_){ return def; }
}
function clamp(v,min,max){
  v = Number(v); if(!Number.isFinite(v)) v = min;
  return Math.max(min, Math.min(max, v));
}
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
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add('view-' + view);
}
function initOnce(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  // view/run/diff/time/seed
  const view = normalizeView(qs('view','mobile'));
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = clamp(qs('time','80'), 20, 300);
  const seed = String(qs('seed', Date.now()));

  // set body view classes (CSS depends on this)
  setBodyView(view);

  // VR UI config (crosshair lock window)
  WIN.HHA_VRUI_CONFIG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG||{});

  // start engine
  engineBoot({ view, run, diff, time, seed });

  // best-effort flush on exit
  WIN.addEventListener('beforeunload', ()=>{
    try{ WIN.HHACloudLogger?.flush?.(); }catch(_){}
  }, { passive:true });
}

// DOM ready
if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', initOnce, { once:true });
}else{
  initOnce();
}