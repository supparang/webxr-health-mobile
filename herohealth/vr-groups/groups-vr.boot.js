// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Folder-run, auto-detect view)
// ✅ Sets body class: view-pc / view-mobile / view-vr / view-cvr
// ✅ Sets body.dataset.view
// ✅ Passes params to goodjunk.safe.js boot()
// ✅ Wires basic UI buttons + endOverlay buttons (if present)

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function clamp(n, a, b){
  n = Number(n) || 0;
  return n < a ? a : (n > b ? b : n);
}

function pickView(){
  // explicit param wins (except 'auto')
  const v = String(qs('view','auto') || 'auto').toLowerCase();
  if(v && v !== 'auto') return v;

  // heuristic auto:
  // - If WebXR immersive-vr supported => 'vr' (Cardboard/VR)
  // - If view=cvr requested by user agent patterns? (manual param still best)
  // - Else if mobile UA => mobile, else pc
  const ua = (navigator.userAgent || '').toLowerCase();
  const isMobileUA = /android|iphone|ipad|ipod|mobile/.test(ua);

  // If inside an active XR session => vr
  try{
    if(navigator.xr && ROOT.__HHA_XR_ACTIVE__) return 'vr';
  }catch(_){}

  // Attempt quick support check (non-blocking): default now, may upgrade later
  // We'll set initial view now, but if XR supported we keep view=vr for better Enter VR UX
  if(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
    // fire & forget: if supported, mark hint class (optional)
    navigator.xr.isSessionSupported('immersive-vr').then((ok)=>{
      if(ok){
        DOC.body.classList.add('xr-supported');
      }
    }).catch(()=>{});
  }

  return isMobileUA ? 'mobile' : 'pc';
}

function applyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view==='pc') b.classList.add('view-pc');
  else if(view==='vr') b.classList.add('view-vr');
  else if(view==='cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');

  b.dataset.view = view;
}

function wireUi(){
  const hub = qs('hub', null);

  const btnBack = DOC.getElementById('btnBackHub');
  const btnHide = DOC.getElementById('btnHideHud');
  const btnMis  = DOC.getElementById('btnMissions');

  const peek = DOC.getElementById('missionsPeek');
  const peekGoal = DOC.getElementById('peekGoal');
  const peekMini = DOC.getElementById('peekMini');

  const chipMeta = DOC.getElementById('gjChipMeta');

  // end overlay fields (if your HTML has them)
  const endOverlay = DOC.getElementById('endOverlay');
  const btnReplay  = DOC.getElementById('btnReplay');
  const btnHub     = DOC.getElementById('btnToHub') || DOC.getElementById('btnBackHub2') || DOC.getElementById('btnHub');

  const run  = qs('run','play');
  const diff = qs('diff','normal');
  const time = qs('time','80');
  const view = DOC.body.dataset.view || qs('view','auto');

  if(chipMeta){
    chipMeta.textContent = `view=${view} · run=${run} · diff=${diff} · time=${time}`;
  }

  btnBack?.addEventListener('click', ()=>{
    if(hub) location.href = hub;
    else alert('ยังไม่ได้ใส่ hub url');
  });

  btnHide?.addEventListener('click', ()=>{
    DOC.body.classList.toggle('hud-hidden');
    // let your html safe-measure script recalc safe rect
    setTimeout(()=>ROOT.dispatchEvent(new Event('resize')), 0);
  });

  function toggleMissions(){
    DOC.body.classList.toggle('show-missions');
    const shown = DOC.body.classList.contains('show-missions');
    peek?.setAttribute('aria-hidden', shown ? 'false' : 'true');
    if(shown){
      if(peekGoal) peekGoal.textContent = (DOC.getElementById('hud-goal')?.textContent || '—');
      if(peekMini) peekMini.textContent = (DOC.getElementById('hud-mini')?.textContent || '—');
    }
  }
  btnMis?.addEventListener('click', toggleMissions);
  peek?.addEventListener('click', toggleMissions);

  // close end overlay by click outside (optional)
  endOverlay?.addEventListener('click', (ev)=>{
    // if click on overlay background, close (not on inner card)
    if(ev.target === endOverlay){
      endOverlay.setAttribute('aria-hidden','true');
    }
  });

  btnReplay?.addEventListener('click', ()=>{
    try{ location.reload(); }catch(_){}
  });

  btnHub?.addEventListener('click', ()=>{
    try{
      if(hub) location.href = hub;
      else alert('ยังไม่ได้ใส่ hub url');
    }catch(_){}
  });
}

function normalizeParams(view){
  const runMode = String(qs('run','play')).toLowerCase(); // play | research
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = clamp(qs('time','80'), 20, 300);

  const seed = qs('seed', null);
  const hub  = qs('hub', null);

  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  return {
    view,
    run: runMode,
    diff,
    time,
    seed,
    hub,
    studyId,
    phase,
    conditionGroup
  };
}

function bootOnce(){
  if(ROOT.__GJ_BOOTED__) return;
  ROOT.__GJ_BOOTED__ = true;

  const view = pickView();
  applyView(view);
  wireUi();

  const payload = normalizeParams(view);

  // give html safe-measure script a tick to set --gj-top-safe / --gj-bottom-safe
  setTimeout(()=>{
    try{
      engineBoot(payload);
    }catch(err){
      console.error('[GoodJunkVR boot] engineBoot failed', err);
      alert('Engine error: ดู console');
    }
  }, 0);
}

// DOM ready
if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', bootOnce, { once:true });
}else{
  bootOnce();
}