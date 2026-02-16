// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (LOCKED + FX SAFE + VR AUTO)
// ✅ Auto base view: pc/mobile (ignores ?view= to prevent layout bugs)
// ✅ Auto load ../vr/vr-ui.js only if WebXR exists (navigator.xr)
// ✅ Auto switch view on hha:enter-vr / hha:exit-vr (mobile=>cvr, desktop=>vr)
// ✅ Prevent duplicate FX script loads (particles / fx-director / vr-ui)
// ✅ HUD-safe measurement -> sets --gj-top-safe / --gj-bottom-safe (spawn safe)
// ✅ Debug: Space/Enter -> hha:shoot
// ✅ Boot engine: goodjunk.safe.js (module boot(payload))

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const WIN = window;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function num(v, d){
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function isMobileUA(){
  const ua = String(navigator.userAgent || '').toLowerCase();
  return /android|iphone|ipad|ipod/.test(ua);
}
function hasScriptSrc(part){
  try{
    return Array.from(DOC.scripts || []).some(s => String(s.src||'').includes(part));
  }catch(_){ return false; }
}
function injectScriptOnce(src){
  if(hasScriptSrc(src)) return;
  const s = DOC.createElement('script');
  s.src = src;
  s.defer = true;
  s.onerror = ()=> console.warn('[GoodJunkVR] failed to load', src);
  DOC.head.appendChild(s);
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.add('gj');
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');

  // aria for right eye in cVR
  const r = DOC.getElementById('gj-layer-r');
  if(r) r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');

  DOC.body.dataset.view = view;
}

function baseAutoView(){
  return isMobileUA() ? 'mobile' : 'pc';
}

function ensureFxLoaded(){
  // prevent double-load (duplicate tags in HTML can break FX)
  // particles.js is required; fx-director is optional but recommended
  try{
    if(!hasScriptSrc('/vr/particles.js') && !hasScriptSrc('vr/particles.js')){
      injectScriptOnce('../vr/particles.js');
    }
    if(!hasScriptSrc('/vr/hha-fx-director.js') && !hasScriptSrc('vr/hha-fx-director.js')){
      injectScriptOnce('../vr/hha-fx-director.js');
    }
  }catch(_){}
}

function ensureVrUiLoaded(){
  // Only if WebXR exists (so Enter VR UI makes sense)
  if(!navigator.xr) return;

  // Prevent duplicates
  if(WIN.__HHA_VR_UI_LOADED__) return;
  WIN.__HHA_VR_UI_LOADED__ = true;

  if(!hasScriptSrc('/vr/vr-ui.js') && !hasScriptSrc('vr/vr-ui.js')){
    injectScriptOnce('../vr/vr-ui.js');
  }
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

function cssLoadedSanity(){
  // if CSS fails to load, many effects "disappear" because classes have no styles.
  // We'll do a tiny sanity check: if gj-topbar exists but computed position is 'static', warn.
  try{
    const tb = DOC.querySelector('.gj-topbar');
    if(!tb) return;
    const pos = getComputedStyle(tb).position;
    if(pos === 'static'){
      console.warn('[GoodJunkVR] CSS may not be applied (gj-topbar position=static). Check <link href="./goodjunk-vr.css"> path.');
      DOC.body.classList.add('css-missing');
    }
  }catch(_){}
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
      const hudTop  = DOC.getElementById('hud') || DOC.getElementById('gjHudTop');
      const miniHud = DOC.getElementById('vrMiniHud');
      const fever   = DOC.getElementById('feverBox') || DOC.getElementById('gjHudBot');
      const controls= DOC.querySelector('.hha-controls');

      let topSafe = 0;
      topSafe = Math.max(topSafe, h(topbar));
      topSafe = Math.max(topSafe, h(miniHud));
      topSafe = Math.max(topSafe, h(hudTop) * 0.55);
      topSafe += (14 + sat);

      let bottomSafe = 0;
      bottomSafe = Math.max(bottomSafe, h(fever));
      bottomSafe = Math.max(bottomSafe, h(controls));
      bottomSafe += (16 + sab);

      const hudHidden = DOC.body.classList.contains('hud-hidden');
      if(hudHidden){
        topSafe = Math.max(72 + sat, h(topbar) + 10 + sat);
        bottomSafe = Math.max(76 + sab, h(fever) + 10 + sab);
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    }catch(_){}
  }

  WIN.addEventListener('resize', update, { passive:true });
  WIN.addEventListener('orientationchange', update, { passive:true });

  // when HUD toggles
  WIN.addEventListener('click', (e)=>{
    if(e?.target?.id === 'btnHideHud' || e?.target?.id === 'btnHideHud2'){
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
  // STRICT AUTO BASE VIEW (pc/mobile) — never trust ?view= (prevents broken layout)
  const view = baseAutoView();
  setBodyView(view);

  ensureFxLoaded();
  ensureVrUiLoaded();

  bindVrAutoSwitch();
  bindDebugKeys();
  hudSafeMeasure();

  setTimeout(cssLoadedSanity, 60);
  setTimeout(cssLoadedSanity, 240);

  engineBoot({
    view, // base view; will become cvr/vr after enter
    diff: qs('diff','normal'),
    run: qs('run','play'),
    time: qs('time','80'),
    seed: qs('seed', qs('ts', null)),
    hub: qs('hub', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  });
}

if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', start);
else start();