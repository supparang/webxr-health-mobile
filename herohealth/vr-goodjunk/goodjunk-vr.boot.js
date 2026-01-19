// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (HHA Standard)
// ✅ View modes: pc / mobile / vr / cvr (from ?view=...)
// ✅ Fullscreen handling (mobile / vr) + body.is-fs
// ✅ Starts engine once DOM ready
// ✅ Does NOT override ?view=
// ✅ Emits: hha:boot (debug)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function has(k){
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}

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

function isLikelyMobileUA(){
  const ua = (navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

async function autoDetectView(){
  // ✅ Never override if ?view= exists
  if(has('view')) return normalizeView(qs('view','mobile'));

  // soft remember
  try{
    const last = localStorage.getItem('HHA_LAST_VIEW');
    if(last) return normalizeView(last);
  }catch(_){}

  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // best-effort XR support check => mobile may prefer vr
  try{
    if(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok) guess = isLikelyMobileUA() ? 'vr' : 'pc';
    }
  }catch(_){}

  return normalizeView(guess);
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

function setFsFlag(on){
  try{
    DOC.body.classList.toggle('is-fs', !!on);
  }catch(_){}
}

function isFullscreen(){
  return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
}

async function requestFullscreenBestEffort(){
  const el = DOC.documentElement;
  if(!el) return false;

  // only attempt on mobile-ish
  if(!isLikelyMobileUA()) return false;

  try{
    if(el.requestFullscreen) { await el.requestFullscreen(); return true; }
    if(el.webkitRequestFullscreen) { await el.webkitRequestFullscreen(); return true; }
  }catch(_){}
  return false;
}

function attachFsListeners(){
  const on = ()=>{
    setFsFlag(isFullscreen());
  };
  DOC.addEventListener('fullscreenchange', on, { passive:true });
  DOC.addEventListener('webkitfullscreenchange', on, { passive:true });
  on();
}

function payloadFromQuery(view){
  return {
    view,

    run:  qs('run','play'),
    diff: qs('diff','normal'),
    time: qs('time','80'),

    seed: qs('seed', null),
    ts:   qs('ts', null),

    hub: qs('hub', null),

    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };
}

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

async function boot(){
  attachFsListeners();

  const view = await autoDetectView();
  setBodyView(view);

  // remember soft
  try{ localStorage.setItem('HHA_LAST_VIEW', view); }catch(_){}

  // best effort fullscreen for mobile/cvr
  if(view==='mobile' || view==='cvr'){
    // don't force if already fullscreen
    if(!isFullscreen()){
      // must be user-gesture in many browsers; we do best effort
      requestFullscreenBestEffort();
    }
  }

  const payload = payloadFromQuery(view);

  // debug boot event
  emit('hha:boot', { view, payload });

  // start engine when DOM ready
  engineBoot(payload);
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', boot, { once:true });
}else{
  boot();
}