// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (ULTRA + STRICT AUTO + STAGE DIRECTOR)
// ✅ NO MENU, NO OVERRIDE: ignores ?view= entirely
// ✅ Auto base view: pc / mobile
// ✅ Injects ../vr/vr-ui.js only when WebXR is available (navigator.xr)
// ✅ Auto-switch on Enter/Exit VR via hha:enter-vr / hha:exit-vr:
//    - mobile -> cvr
//    - desktop -> vr
// ✅ HUD-safe measure -> sets CSS vars --gj-top-safe / --gj-bottom-safe
// ✅ Stage director:
//    - t<=30 => stage-storm
//    - miss>=4 => stage-boss
//    - miss>=5 => stage-rage
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

  // right eye only meaningful in cVR split
  const r = DOC.getElementById('gj-layer-r');
  if(r){
    r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');
  }

  DOC.body.dataset.view = view;

  // tell others (measure, etc.)
  try{ WIN.dispatchEvent(new CustomEvent('hha:view', { detail:{ view } })); }catch(_){}
}

function baseAutoView(){
  return isMobileUA() ? 'mobile' : 'pc';
}

function ensureVrUiLoaded(){
  // only when WebXR exists
  if(!navigator.xr) return;

  // prevent double inject
  if(WIN.__HHA_VRUI_INJECTED__) return;
  WIN.__HHA_VRUI_INJECTED__ = true;

  // already exists?
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
  }
  function onExit(){
    setBodyView(base);
  }

  WIN.addEventListener('hha:enter-vr', onEnter, { passive:true });
  WIN.addEventListener('hha:exit-vr',  onExit,  { passive:true });

  // expose for emergencies
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

      // matched to your HTML
      const topbar = DOC.querySelector('.gj-topbar');
      const hudTop = DOC.getElementById('gjHudTop'); // header.gj-hud-top
      const hudBot = DOC.getElementById('gjHudBot'); // footer.gj-hud-bot

      let topSafe = 0;
      topSafe = Math.max(topSafe, h(topbar));
      topSafe = Math.max(topSafe, h(hudTop));
      topSafe += (10 + sat);

      let bottomSafe = 0;
      bottomSafe = Math.max(bottomSafe, h(hudBot));
      bottomSafe += (10 + sab);

      // if HUD hidden => keep safe smaller (more play space)
      const hudHidden = DOC.body.classList.contains('hud-hidden');
      if(hudHidden){
        topSafe = Math.max(60 + sat, h(topbar) + 8 + sat);
        bottomSafe = Math.max(70 + sab, 10 + sab);
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    }catch(_){}
  }

  WIN.addEventListener('resize', update, { passive:true });
  WIN.addEventListener('orientationchange', update, { passive:true });

  // when HUD toggles (your HTML has btnHideHud)
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

function stageDirector(){
  const b = DOC.body;

  function setStage(stage){
    b.classList.remove('stage-normal','stage-storm','stage-boss','stage-rage');
    b.classList.add(stage);
  }
  setStage('stage-normal');

  let lastT = null;
  let lastMiss = null;

  function recompute(){
    const t = (typeof lastT === 'number') ? lastT : null;
    const m = (typeof lastMiss === 'number') ? lastMiss : null;

    // precedence: rage > boss > storm > normal
    if(m != null && m >= 5){ setStage('stage-rage'); return; }
    if(m != null && m >= 4){ setStage('stage-boss'); return; }
    if(t != null && t <= 30){ setStage('stage-storm'); return; }
    setStage('stage-normal');
  }

  // engine emits hha:time {t}
  function onTime(ev){
    const t = Number(ev?.detail?.t);
    if(Number.isFinite(t)){ lastT = t; recompute(); }
  }

  // engine will emit hha:miss after we patch goodjunk.safe.js (ข้อ 2)
  function onMiss(ev){
    const m = Number(ev?.detail?.misses ?? ev?.detail?.miss ?? ev?.detail?.m);
    if(Number.isFinite(m)){ lastMiss = m; recompute(); }
  }

  WIN.addEventListener('hha:time', onTime, { passive:true });
  WIN.addEventListener('hha:miss', onMiss, { passive:true });

  // also accept document events just in case
  DOC.addEventListener('hha:time', onTime, { passive:true });
  DOC.addEventListener('hha:miss', onMiss, { passive:true });
}

function start(){
  // STRICT AUTO BASE VIEW (pc/mobile) — never read ?view=
  const view = baseAutoView();
  setBodyView(view);

  ensureVrUiLoaded();
  bindVrAutoSwitch();
  bindDebugKeys();
  hudSafeMeasure();
  stageDirector();

  engineBoot({
    view, // base view; will become cvr/vr after enter
    diff: qs('diff','normal'),
    run:  qs('run','play'),
    time: qs('time','80'),
    seed: qs('seed', null),
    hub:  qs('hub', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  });
}

if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', start);
else start();