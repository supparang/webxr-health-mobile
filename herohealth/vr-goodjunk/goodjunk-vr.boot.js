// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (AUTO + STRICT)
// ✅ NO MENU by default
// ✅ Default: ignore ?view= (unless ?allowView=1)
// ✅ Auto base view: pc / mobile
// ✅ If WebXR exists => ensure ../vr/vr-ui.js is loaded (if not already)
// ✅ Auto-switch on hha:enter-vr / hha:exit-vr:
//    - mobile => cvr
//    - desktop => vr
// ✅ Sets CSS vars --gj-top-safe / --gj-bottom-safe (HUD-safe spawn)
// ✅ Debug keys: Space/Enter => hha:shoot
// ✅ Boots engine: goodjunk.safe.js

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const WIN = window;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function boolQ(k, defBool=false){
  const v = String(qs(k, '') || '').trim().toLowerCase();
  if(!v) return !!defBool;
  if(v==='1'||v==='true'||v==='yes'||v==='y') return true;
  if(v==='0'||v==='false'||v==='no'||v==='n') return false;
  return !!defBool;
}

function isMobileUA(){
  const ua = String(navigator.userAgent || '').toLowerCase();
  const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
  return touch && /android|iphone|ipad|ipod/.test(ua);
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.add('gj');
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');

  // Right-eye layer only meaningful in cVR split
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
  // Load only if WebXR exists (so ENTER VR UI makes sense)
  if(!navigator.xr) return;

  if(WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  // already included in HTML?
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
    // Enter VR: mobile => cvr, desktop => vr
    setBodyView(isMobileUA() ? 'cvr' : 'vr');
    try{ WIN.dispatchEvent(new CustomEvent('hha:view', { detail:{ view: DOC.body.dataset.view }})); }catch(_){}
  }
  function onExit(){
    setBodyView(base);
    try{ WIN.dispatchEvent(new CustomEvent('hha:view', { detail:{ view: DOC.body.dataset.view }})); }catch(_){}
  }

  // STRICT: only listen to HHA events (emitted by vr-ui.js bridge)
  WIN.addEventListener('hha:enter-vr', onEnter, { passive:true });
  WIN.addEventListener('hha:exit-vr',  onExit,  { passive:true });

  // Expose hook if needed
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

      const topbar  = DOC.querySelector('.gj-topbar');
      const hudTop  = DOC.getElementById('gjHudTop') || DOC.getElementById('hud');
      const miniHud = DOC.getElementById('vrMiniHud');
      const fever   = DOC.getElementById('feverBox') || DOC.getElementById('gjHudFever');
      const hudBot  = DOC.getElementById('gjHudBot');
      const controls= DOC.querySelector('.hha-controls');

      let topSafe = 0;
      topSafe = Math.max(topSafe, h(topbar));
      topSafe = Math.max(topSafe, h(hudTop) * 0.85);
      topSafe = Math.max(topSafe, h(miniHud));
      topSafe += (14 + sat);

      let bottomSafe = 0;
      bottomSafe = Math.max(bottomSafe, h(hudBot));
      bottomSafe = Math.max(bottomSafe, h(fever));
      bottomSafe = Math.max(bottomSafe, h(controls));
      bottomSafe += (16 + sab);

      const hudHidden = DOC.body.classList.contains('hud-hidden');
      if(hudHidden){
        topSafe = Math.max(72 + sat, h(topbar) + 10 + sat);
        bottomSafe = Math.max(84 + sab, 84 + sab);
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    }catch(_){}
  }

  WIN.addEventListener('resize', update, { passive:true });
  WIN.addEventListener('orientationchange', update, { passive:true });

  // when HUD toggles
  WIN.addEventListener('click', (e)=>{
    if(e?.target?.id === 'btnHideHud'){
      setTimeout(update, 30);
      setTimeout(update, 180);
      setTimeout(update, 420);
    }
  }, { passive:true });

  // when view switches (enter/exit vr)
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
  // STRICT AUTO BASE VIEW — never read ?view= unless allowView=1
  const allowOverride = boolQ('allowView', false);
  const viewParam = String(qs('view','')||'').toLowerCase();
  const auto = baseAutoView();
  const view = (allowOverride && ['pc','mobile','vr','cvr'].includes(viewParam)) ? viewParam : auto;

  setBodyView(view);

  // Configure VR UI defaults (kid-friendly)
  WIN.HHA_VRUI_CONFIG = Object.assign(
    { lockPx: 30, cooldownMs: 90 },
    WIN.HHA_VRUI_CONFIG || {}
  );

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