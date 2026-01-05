// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (LATEST)
// ✅ View class from URL: pc/mobile/vr/cvr
// ✅ Loads vr-ui.js ONLY when view=vr/cvr (EnterVR/Exit/Recenter + crosshair + tap-to-shoot => hha:shoot)
// ✅ HUD-safe measure -> sets CSS vars: --gj-top-safe / --gj-bottom-safe (auto, resize/orientation)
// ✅ Debug keys: Space/Enter => hha:shoot
// ✅ Boots engine: goodjunk.safe.js

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const WIN = window;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.add('gj');
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function inferView(){
  const v = String(qs('view','mobile') || 'mobile').toLowerCase();
  return (v === 'pc' || v === 'vr' || v === 'cvr' || v === 'mobile') ? v : 'mobile';
}

function applyView(){
  const view = inferView();
  setBodyView(view);

  // toggle R layer aria for accessibility
  const r = DOC.getElementById('gj-layer-r');
  if(r){
    r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');
  }
  return view;
}

function ensureVrUiLoaded(view){
  // Load ../vr/vr-ui.js only for VR/cVR
  if(view !== 'vr' && view !== 'cvr') return;

  // already loaded?
  if(WIN.__HHA_VR_UI_LOADED__) return;
  WIN.__HHA_VR_UI_LOADED__ = true;

  // if script tag already exists, do nothing
  const exists = Array.from(DOC.scripts || []).some(s => (s.src || '').includes('/vr/vr-ui.js'));
  if(exists) return;

  const s = DOC.createElement('script');
  s.src = '../vr/vr-ui.js';
  s.defer = true;
  s.onload = ()=>{};
  s.onerror = ()=>{ console.warn('[GoodJunkVR] vr-ui.js failed to load'); };
  DOC.head.appendChild(s);
}

function bindDebugKeys(){
  // Useful for PC test in VR-like mode: press Space/Enter to shoot
  WIN.addEventListener('keydown', (e)=>{
    const k = e.key || '';
    if(k === ' ' || k === 'Enter'){
      try{ WIN.dispatchEvent(new CustomEvent('hha:shoot', { detail:{ source:'key' } })); }catch(_){}
    }
  }, { passive:true });
}

function hudSafeMeasure(){
  // Set CSS vars: --gj-top-safe / --gj-bottom-safe
  // so spawns never overlap HUD/fever/controls/topbar
  const root = DOC.documentElement;

  function px(n){ return Math.max(0, Math.round(Number(n)||0)) + 'px'; }

  function safeGetH(el){
    try { return el ? el.getBoundingClientRect().height : 0; } catch { return 0; }
  }

  function update(){
    try{
      const cs = getComputedStyle(root);
      const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
      const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;

      const topbar = DOC.querySelector('.gj-topbar');
      const hud     = DOC.getElementById('hud');        // .hha-hud
      const fever   = DOC.getElementById('feverBox');   // .hha-fever
      const miniHud = DOC.getElementById('vrMiniHud');  // VR mini HUD
      const controls= DOC.querySelector('.hha-controls');

      // TOP safe: include topbar + hud-top zone + miniHud (if visible)
      let topSafe = 0;
      topSafe = Math.max(topSafe, safeGetH(topbar));
      // hud has top + mid; but we treat whole hud as "top overlay" in mobile/pc
      // in VR/cVR we show vrMiniHud; hud might be hidden
      topSafe = Math.max(topSafe, safeGetH(hud) * 0.55); // conservative: ~top half
      topSafe = Math.max(topSafe, safeGetH(miniHud));

      // BOTTOM safe: include fever box + controls button area
      let bottomSafe = 0;
      bottomSafe = Math.max(bottomSafe, safeGetH(fever));
      bottomSafe = Math.max(bottomSafe, safeGetH(controls));

      // extra margin
      topSafe += (14 + sat);
      bottomSafe += (16 + sab);

      // If user hid HUD -> make safe smaller so playfield grows
      const hudHidden = DOC.body.classList.contains('hud-hidden');
      if(hudHidden){
        topSafe = Math.max(72 + sat, safeGetH(topbar) + 10 + sat);
        bottomSafe = Math.max(76 + sab, safeGetH(fever) + 8 + sab); // keep fever safe
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    }catch(_){}
  }

  WIN.addEventListener('resize', update, { passive:true });
  WIN.addEventListener('orientationchange', update, { passive:true });

  // also refresh when HUD hidden toggled
  WIN.addEventListener('click', (e)=>{
    const t = e.target;
    if(!t) return;
    // if clicking hide-hud button, update shortly after
    if(t.id === 'btnHideHud'){
      setTimeout(update, 30);
      setTimeout(update, 180);
    }
  }, { passive:true });

  setTimeout(update, 0);
  setTimeout(update, 120);
  setTimeout(update, 350);
  setInterval(update, 1200); // safety net (cheap)
}

function start(){
  const view = applyView();

  // ✅ load vr-ui only for VR/cVR
  ensureVrUiLoaded(view);

  bindDebugKeys();
  hudSafeMeasure();

  // Boot engine with payload
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

  // gentle VR hint
  if(view === 'vr' || view === 'cvr'){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{
        kind:'tip',
        msg:'โหมด VR: เล็งกลางจอแล้วแตะ/คลิกเพื่อยิง (crosshair) — ระบบจะกันเป้าไม่ให้ขึ้นทับ HUD ให้เอง',
      }}));
    }catch(_){}
  }
}

if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', start);
else start();
