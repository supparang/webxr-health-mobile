// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (AUTO VIEW + VR SWITCH + SAFE MEASURE)
// ✅ Auto base view: pc / mobile (never forces ?view=)
// ✅ When Enter VR / Exit VR via vr-ui.js events:
//    - mobile => cvr
//    - desktop => vr
// ✅ Sets body classes: view-pc/view-mobile/view-vr/view-cvr + data-view
// ✅ Measures HUD to set CSS vars: --gj-top-safe / --gj-bottom-safe (for safe spawn)
// ✅ Boots engine: ./goodjunk.safe.js (export boot)

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const WIN = window;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function isMobileUA(){
  const ua = String(navigator.userAgent || '').toLowerCase();
  return /android|iphone|ipad|ipod/.test(ua);
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.add('gj');
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');

  // right-eye layer used only in cVR
  const r = DOC.getElementById('gj-layer-r');
  if(r){
    r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');
  }

  b.dataset.view = view;
  try{ WIN.dispatchEvent(new CustomEvent('hha:view', { detail:{ view } })); }catch(_){}
}

function baseAutoView(){
  return isMobileUA() ? 'mobile' : 'pc';
}

function bindVrAutoSwitch(){
  const base = baseAutoView();

  function onEnter(){
    // Enter VR: mobile => cvr, desktop => vr
    setBodyView(isMobileUA() ? 'cvr' : 'vr');
  }
  function onExit(){
    setBodyView(base);
  }

  // listen from vr-ui.js (Universal VR UI)
  WIN.addEventListener('hha:enter-vr', onEnter, { passive:true });
  WIN.addEventListener('hha:exit-vr',  onExit,  { passive:true });

  // expose manual reset (debug)
  WIN.HHA_GJ_resetView = onExit;
}

function bindDebugKeys(){
  WIN.addEventListener('keydown', (e)=>{
    const k = e.key || '';
    if(k === ' ' || k === 'Enter'){
      try{ WIN.dispatchEvent(new CustomEvent('hha:shoot', { detail:{ source:'key' } })); }catch(_){}
    }
  }, { passive:true });
}

/**
 * Measure visible HUD => set safe vars used by goodjunk.safe.js getSafeRect()
 * Strategy:
 * - Top safe: topbar + hudTop (if not hidden) + padding + safe-area-top
 * - Bottom safe: hudBot (if not hidden) + padding + safe-area-bottom
 * - If HUD hidden => keep small minimum safety
 */
function hudSafeMeasure(){
  const root = DOC.documentElement;

  const px = (n)=> Math.max(0, Math.round(Number(n)||0)) + 'px';
  const h  = (el)=> { try{ return el ? el.getBoundingClientRect().height : 0; }catch{return 0;} };

  function update(){
    try{
      const cs = getComputedStyle(root);
      const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
      const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;

      const topbar = DOC.getElementById('gjTopbar') || DOC.querySelector('.gj-topbar');
      const hudTop = DOC.getElementById('gjHudTop') || DOC.querySelector('.gj-hud-top');
      const hudBot = DOC.getElementById('gjHudBot') || DOC.querySelector('.gj-hud-bot');

      const hudHidden = DOC.body.classList.contains('hud-hidden');

      let topSafe = 0;
      topSafe = Math.max(topSafe, h(topbar));
      if(!hudHidden) topSafe += h(hudTop);
      topSafe += (14 + sat);

      let bottomSafe = 0;
      if(!hudHidden) bottomSafe += h(hudBot);
      bottomSafe = Math.max(bottomSafe, 96); // minimum so targets don't clip bottom
      bottomSafe += (14 + sab);

      // If missions overlay shows, keep a bit more top spacing (avoid peek overlaps)
      if(DOC.body.classList.contains('show-missions')){
        topSafe = Math.max(topSafe, 110 + sat);
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    }catch(_){}
  }

  // update hooks
  WIN.addEventListener('resize', update, { passive:true });
  WIN.addEventListener('orientationchange', update, { passive:true });

  // when HUD toggles
  WIN.addEventListener('click', (e)=>{
    const id = e?.target?.id || '';
    if(id === 'btnHideHud' || id === 'btnHideHud2'){
      setTimeout(update, 0);
      setTimeout(update, 120);
      setTimeout(update, 350);
    }
    if(id === 'btnMissions' || id === 'btnMissions2'){
      setTimeout(update, 0);
      setTimeout(update, 120);
    }
  }, { passive:true });

  // when view switches
  WIN.addEventListener('hha:view', ()=>{
    setTimeout(update, 0);
    setTimeout(update, 120);
    setTimeout(update, 350);
  }, { passive:true });

  // periodic (helps on mobile browser UI bars)
  setTimeout(update, 0);
  setTimeout(update, 120);
  setTimeout(update, 350);
  setInterval(update, 1200);
}

function start(){
  // base view: pc/mobile only (do NOT force ?view=)
  const view = baseAutoView();
  setBodyView(view);

  bindVrAutoSwitch();
  bindDebugKeys();
  hudSafeMeasure();

  // boot engine
  engineBoot({
    view,
    diff: qs('diff','normal'),
    run: qs('run','play'),
    time: qs('time','80'),
    seed: qs('seed', null),
    hub: qs('hub', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  });
}

if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', start);
else start();