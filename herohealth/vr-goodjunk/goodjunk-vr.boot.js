// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK compatible)
// ✅ Sets body view classes (pc/mobile/vr/cvr) + data-view
// ✅ Default: no-quests (auto-hide quest row) until quest:update arrives
// ✅ Starts engine after DOM ready (wait a beat for safe-zone measure)
// ✅ Works with vr-ui.js (hha:shoot) -> handled in goodjunk.safe.js

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch(_){ return def; }
}
function has(k){
  try{ return new URL(location.href).searchParams.has(k); }
  catch(_){ return false; }
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
  if(v === 'pc') return 'pc';
  if(v === 'mobile') return 'mobile';
  return 'auto';
}

async function detectView(){
  // DO NOT override if user already set ?view=
  if(has('view')) return normalizeView(qs('view','auto'));

  // best-effort: prefer mobile vs pc
  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // If WebXR immersive-vr supported -> treat mobile as 'vr' (Cardboard / headset)
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

  // reset
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.removeAttribute('data-view');

  // apply
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'mobile') b.classList.add('view-mobile');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr'){ b.classList.add('view-vr','view-cvr'); }
  else {
    // auto: still pick something for CSS hooks
    const auto = isLikelyMobileUA() ? 'mobile' : 'pc';
    b.classList.add(auto === 'mobile' ? 'view-mobile' : 'view-pc');
    view = auto;
  }

  b.dataset.view = view;
}

function setupQuestAutoCollapse(){
  const b = DOC.body;
  if(!b) return;

  // start as "no quest" -> more gameplay area
  b.classList.add('no-quests');

  // if game emits quest:update at least once -> show quest area
  let gotQuest = false;

  function onQuestUpdate(){
    gotQuest = true;
    b.classList.remove('no-quests');
    try{ WIN.removeEventListener('quest:update', onQuestUpdate); }catch(_){}
  }
  WIN.addEventListener('quest:update', onQuestUpdate, { passive:true });

  // safety: if no quest events in 2s, keep collapsed (do nothing)
  setTimeout(()=>{ if(!gotQuest) b.classList.add('no-quests'); }, 2000);
}

function start(){
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = Number(qs('time','80')) || 80;
  const seed = String(qs('seed', Date.now()));

  // start with spacious gameplay unless quest system is active
  setupQuestAutoCollapse();

  // let the safe-zone measurer in goodjunk-vr.html run first
  setTimeout(()=>{
    try{
      engineBoot({
        view: DOC.body?.dataset?.view || normalizeView(qs('view','mobile')),
        run, diff, time, seed
      });
    }catch(err){
      console.error('[GoodJunkVR] boot failed', err);
      alert('Boot error: ' + (err?.message || err));
    }
  }, 80);
}

(async function main(){
  try{
    const view = await detectView();
    setBodyView(view);
  }catch(_){
    setBodyView(normalizeView(qs('view','mobile')));
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', start, { once:true });
  }else{
    start();
  }
})();