// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (CLEAN + STRICT AUTO)
// ✅ No launcher required
// ✅ STRICT AUTO VIEW: ignores ?view= entirely (ตามที่สั่ง: ห้าม override)
// ✅ Base view: pc (desktop) / mobile (phone/tablet)
// ✅ If WebXR available -> auto load ../vr/vr-ui.js (for ENTER VR / EXIT / RECENTER + crosshair)
// ✅ Auto-switch view on hha:enter-vr / hha:exit-vr
//    - mobile => cvr
//    - desktop => vr
// ✅ Measures HUD + controls -> sets CSS vars --gj-top-safe / --gj-bottom-safe for spawn safe-rect
// ✅ Debug: Space/Enter fires hha:shoot (useful on desktop)
// ✅ Boots engine: ./goodjunk.safe.js

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

  b.dataset.view = view;

  // right eye layer visible only in cVR
  const r = DOC.getElementById('gj-layer-r');
  if(r) r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');
}

function baseAutoView(){
  // STRICT: never read ?view=
  return isMobileUA() ? 'mobile' : 'pc';
}

function ensureVrUiLoaded(){
  // only if WebXR exists -> then ENTER VR UI makes sense
  if(!navigator.xr) return;

  // prevent duplicate loads
  if(WIN.__HHA_VR_UI_LOADED__) return;
  WIN.__HHA_VR_UI_LOADED__ = true;

  // if already included in html, skip
  const exists = Array.from(DOC.scripts || []).some(s => String(s.src||'').includes('/vr/vr-ui.js'));
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

  WIN.addEventListener('hha:enter-vr', onEnter, { passive:true });
  WIN.addEventListener('hha:exit-vr',  onExit,  { passive:true });

  // expose optional manual reset
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

      // allow both html variants
      const topHud   = DOC.getElementById('hud') || DOC.getElementById('gjHudTop');
      const botHud   = DOC.getElementById('feverBox') || DOC.getElementById('gjHudBot') || DOC.querySelector('.gj-hud-bot');
      const topbar   = DOC.querySelector('.gj-topbar');
      const miniHud  = DOC.getElementById('vrMiniHud');
      const controls = DOC.querySelector('.hha-controls');

      let topSafe = 0;
      topSafe = Math.max(topSafe, h(topbar));
      topSafe = Math.max(topSafe, h(miniHud));
      topSafe = Math.max(topSafe, h(topHud) * 0.58);
      topSafe += (14 + sat);

      let bottomSafe = 0;
      bottomSafe = Math.max(bottomSafe, h(botHud));
      bottomSafe = Math.max(bottomSafe, h(controls));
      bottomSafe += (16 + sab);

      // if HUD hidden -> smaller safe but still avoid topbar
      const hudHidden = DOC.body.classList.contains('hud-hidden');
      if(hudHidden){
        topSafe = Math.max(72 + sat, h(topbar) + 10 + sat);
        bottomSafe = Math.max(76 + sab, h(botHud) + 10 + sab);
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    }catch(_){}
  }

  WIN.addEventListener('resize', update, { passive:true });
  WIN.addEventListener('orientationchange', update, { passive:true });

  // when HUD toggles (both button ids supported)
  WIN.addEventListener('click', (e)=>{
    const id = e?.target?.id || '';
    if(id === 'btnHideHud' || id === 'btnHideHud2'){
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

  // initial burst + periodic
  setTimeout(update, 0);
  setTimeout(update, 120);
  setTimeout(update, 350);
  setInterval(update, 1200);
}

function bindEndOverlayFallback(){
  // IMPORTANT:
  // - safe.js may inject its own end overlay (in-code)
  // - html variant may have #endOverlay
  // We only "mirror" aria-hidden if #endOverlay exists. No extra DOM creation here.

  const endOverlay = DOC.getElementById('endOverlay');
  if(!endOverlay) return;

  function byId(id){ return DOC.getElementById(id); }

  function showEnd(d){
    try{
      byId('endTitle') && (byId('endTitle').textContent = (d?.reason === 'miss-limit' || d?.reason === 'missLimit') ? 'Game Over' : 'Completed');
      byId('endSub') && (byId('endSub').textContent = `reason=${d?.reason||'-'} | mode=${d?.runMode||'-'} | view=${d?.device||d?.view||'-'}`);
      byId('endGrade') && (byId('endGrade').textContent = d?.grade || '—');
      byId('endScore') && (byId('endScore').textContent = String(d?.scoreFinal ?? 0));
      byId('endMiss')  && (byId('endMiss').textContent  = String(d?.misses ?? 0));
      byId('endTime')  && (byId('endTime').textContent  = String(Math.round(Number(d?.durationPlayedSec||0))));
      endOverlay.setAttribute('aria-hidden','false');
    }catch(_){}
  }

  // bind once
  if(WIN.__GJ_END_BIND__) return;
  WIN.__GJ_END_BIND__ = true;

  WIN.addEventListener('hha:end', (ev)=> showEnd(ev?.detail || null), { passive:true });

  // buttons (support multiple ids)
  const hub = qs('hub', './hub.html') || './hub.html';
  byId('btnBackHub')?.addEventListener('click', ()=>{ location.href = hub; });
  byId('endBackHub')?.addEventListener('click', ()=>{ location.href = hub; });

  byId('btnRestartEnd')?.addEventListener('click', ()=> location.reload());
  byId('endReplay')?.addEventListener('click', ()=> location.reload());
}

function start(){
  // 1) STRICT AUTO base view
  const view = baseAutoView();
  setBodyView(view);

  // 2) VR UI if possible
  ensureVrUiLoaded();

  // 3) View auto-switch
  bindVrAutoSwitch();

  // 4) Debug shoot keys
  bindDebugKeys();

  // 5) Safe spawn measure
  hudSafeMeasure();

  // 6) Optional html end overlay (no duplication)
  bindEndOverlayFallback();

  // 7) Boot engine
  engineBoot({
    view, // base view; may become cvr/vr after enter-vr events
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