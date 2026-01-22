// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ Boots ./goodjunk.safe.js
// ✅ Sets body view class from ?view= (pc/mobile/vr/cvr)
// ✅ Emits nothing extra (safe.js emits hha:start/time/score/judge/end)
// ✅ Minimal fullscreen helper (mobile) without forcing override

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='view-cvr') return 'cvr';
  if(v==='cvr') return 'cvr';
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
    view==='cvr'? 'view-cvr' :
    'view-mobile'
  );
}

async function bestEffortFullscreen(){
  // do not hard-force; only try if user taps
  try{
    const el = DOC.documentElement;
    if(!el) return;
    if(DOC.fullscreenElement) return;

    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if(typeof req === 'function'){
      await req.call(el);
      DOC.body?.classList.add('is-fs');
    }
  }catch(_){}
}

function wireTapToStart(){
  // In case autoplay redirect happened too fast, we keep a gentle tap to fullscreen
  const onFirstTap = async ()=>{
    try{ await bestEffortFullscreen(); }catch(_){}
    WIN.removeEventListener('pointerdown', onFirstTap, true);
    WIN.removeEventListener('touchstart', onFirstTap, true);
  };
  WIN.addEventListener('pointerdown', onFirstTap, true);
  WIN.addEventListener('touchstart', onFirstTap, true);
}

function boot(){
  const view = normalizeView(qs('view','mobile'));
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = Number(qs('time','80')) || 80;
  const seed = qs('seed', String(Date.now()));

  setBodyView(view);
  wireTapToStart();

  // Boot engine
  engineBoot({ view, run, diff, time, seed });
}

function domReady(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
    setTimeout(fn, 0);
  }else{
    DOC.addEventListener('DOMContentLoaded', fn, { once:true });
  }
}

domReady(boot);