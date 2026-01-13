// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (ULTRA + STRICT AUTO)
// ✅ NO MENU, NO OVERRIDE: ignores ?view= entirely
// ✅ Auto base view: pc / mobile
// ✅ Loads ../vr/vr-ui.js automatically when WebXR is available (navigator.xr)
// ✅ Auto-switch on Enter/Exit VR via hha:enter-vr / hha:exit-vr:
//    - mobile -> cvr
//    - desktop -> vr
// ✅ HUD-safe measure -> sets CSS vars --gj-top-safe / --gj-bottom-safe
// ✅ Debug keys: Space/Enter => hha:shoot
// ✅ Boots engine: goodjunk.safe.js

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

  const r = DOC.getElementById('gj-layer-r');
  if(r){
    r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');
  }
  DOC.body.dataset.view = view;
}

function baseAutoView(){
  return isMobileUA() ? 'mobile' : 'pc';
}

function ensureVrUiLoaded(){
  if(!navigator.xr) return;
  if(WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  const exists = Array.from(DOC.scripts || []).some(s => (s.src || '').includes('/vr/vr-ui.js'));
  if(exists) return;

  const s = DOC.createElement('script');
  s.src = '../vr/vr-ui.js';
  s.defer = true;
  s.onerror = ()=> console.warn('[GoodJunkVR] vr-ui.js failed to load');
  DOC.head.appendChild(s);
}

function bindVrAutoSwitch(){
  const base = baseAutoView();

  function onEnter(){
    setBodyView(isMobileUA() ? 'cvr' : 'vr');
    try{ WIN.dispatchEvent(new CustomEvent('hha:view', { detail:{ view: DOC.body.dataset.view }})); }catch(_){}
  }
  function onExit(){
    setBodyView(base);
    try{ WIN.dispatchEvent(new CustomEvent('hha:view', { detail:{ view: DOC.body.dataset.view }})); }catch(_){}
  }

  WIN.addEventListener('hha:enter-vr', onEnter, { passive:true });
  WIN.addEventListener('hha:exit-vr',  onExit,  { passive:true });

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

function hudSafeMeasure(){
  const root = DOC.documentElement;
  const px = (n)=> Math.max(0, Math.round(Number(n)||0)) + 'px';
  const h  = (el)=> { try{ return el ? el.getBoundingClientRect().height : 0; }catch{return 0;} };

  function update(){
    try{
      const cs = getComputedStyle(root);
      const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
      const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;

      const topbar  = DOC.getElementById('gjTopbar') || DOC.querySelector('.gj-topbar');
      const hudTop   = DOC.getElementById('gjHudTop');
      const hudBot   = DOC.getElementById('gjHudBot');
      const controls = DOC.querySelector('.hha-controls'); // optional

      let topSafe = 0;
      topSafe = Math.max(topSafe, h(topbar));
      topSafe = Math.max(topSafe, h(hudTop));
      topSafe += (14 + sat);

      let bottomSafe = 0;
      bottomSafe = Math.max(bottomSafe, h(hudBot));
      bottomSafe = Math.max(bottomSafe, h(controls));
      bottomSafe += (16 + sab);

      const hudHidden = DOC.body.classList.contains('hud-hidden');
      if(hudHidden){
        topSafe = Math.max(72 + sat, h(topbar) + 10 + sat);
        bottomSafe = Math.max(76 + sab, h(hudBot) + 10 + sab);
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    }catch(_){}
  }

  WIN.addEventListener('resize', update, { passive:true });
  WIN.addEventListener('orientationchange', update, { passive:true });

  WIN.addEventListener('hha:view', ()=>{
    setTimeout(update, 0);
    setTimeout(update, 120);
    setTimeout(update, 350);
  }, { passive:true });

  setTimeout(update, 0);
  setTimeout(update, 120);
  setTimeout(update, 350);
  setInterval(update, 1200);
}

function start(){
  // STRICT AUTO BASE VIEW — never read ?view=
  const view = baseAutoView();
  setBodyView(view);

  ensureVrUiLoaded();
  bindVrAutoSwitch();
  bindDebugKeys();
  hudSafeMeasure();

  engineBoot({
    view, // base view; becomes cvr/vr after enter
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