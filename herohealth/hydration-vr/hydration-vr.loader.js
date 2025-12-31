// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (HARDEN vNext)
// ✅ View: PC / Mobile / Cardboard
// ✅ Fullscreen + best-effort landscape lock for Cardboard
// ✅ Emits: hha:start, hha:force_end, hha:shoot
// ✅ Sets window.HHA_VIEW.layers so hydration.safe.js spawns correctly
// ✅ HARDEN: prevent "summary 0" / prevent force_end before start / no double start

'use strict';

const DOC = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function isMobileUA(){
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

function setView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-cvr');
  b.classList.add(`view-${view}`);
}

function showCardboard(on){
  const pf = DOC.getElementById('playfield');
  const cb = DOC.getElementById('cbPlayfield');
  if (pf) pf.style.display = on ? 'none' : '';
  if (cb) cb.style.display = on ? '' : 'none';
  DOC.body.classList.toggle('cardboard', !!on);
}

function isFullscreen(){
  return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
}
async function enterFullscreen(){
  try{
    const el = DOC.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  }catch(_){}
}
async function lockLandscape(){
  // Works best after a user gesture + fullscreen
  try{
    if (screen?.orientation?.lock){
      await screen.orientation.lock('landscape');
    }
  }catch(_){}
}

function ensureRotateHintNode(){
  if (DOC.getElementById('rotateHint')) return;
  const el = DOC.createElement('div');
  el.id = 'rotateHint';
  el.hidden = true;
  el.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    display:flex; align-items:center; justify-content:center;
    background:rgba(0,0,0,.72);
    color:#fff; text-align:center; padding:24px;
    font:900 18px/1.35 system-ui;
  `;
  el.textContent = 'กรุณาหมุนเครื่องเป็นแนวนอน (Landscape) เพื่อเล่นโหมด VR 📱↔️';
  DOC.body.appendChild(el);
}

function rotateHintUpdate(){
  const el = DOC.getElementById('rotateHint');
  if (!el) return;
  const portrait = window.matchMedia && window.matchMedia('(orientation: portrait)').matches;
  const on = DOC.body.classList.contains('cardboard') && portrait;
  el.hidden = !on;
}

function applyHHAViewLayers(){
  // ensure hydration.safe.js sees the correct layers
  const L = DOC.getElementById('hydration-layerL');
  const R = DOC.getElementById('hydration-layerR');
  const main = DOC.getElementById('hydration-layer');

  const isCb = DOC.body.classList.contains('cardboard');

  window.HHA_VIEW = window.HHA_VIEW || {};
  window.HHA_VIEW.layers = (isCb && L && R)
    ? ['hydration-layerL','hydration-layerR']
    : ['hydration-layer'];

  // keep refs for debugging
  window.HHA_VIEW._nodes = { main, L, R };
}

function forceHideSummary(){
  try{
    const bd = DOC.getElementById('resultBackdrop');
    if (bd) bd.hidden = true;
  }catch(_){}
}

function bind(){
  const btnStart     = DOC.getElementById('btnStart');
  const btnEnterVR   = DOC.getElementById('btnEnterVR');
  const btnCardboard = DOC.getElementById('btnCardboard');
  const btnShoot     = DOC.getElementById('btnShoot');
  const btnStop      = DOC.getElementById('btnStop');
  const overlay      = DOC.getElementById('startOverlay');

  // HARDEN flags
  let started = false;   // local guard (prevents double start)
  let overlayHidden = false;

  function hideOverlay(){
    if (overlayHidden) return;
    overlayHidden = true;
    try{
      overlay.classList.add('hide');
      overlay.style.display = 'none';
      overlay.hidden = true;
    }catch(_){}
  }

  function startOnce(){
    if (started) return;
    started = true;
    hideOverlay();
    // also ensure summary isn't visible
    forceHideSummary();
    emit('hha:start');
  }

  // initial view selection
  // Supported:
  // - ?view=cvr  or ?cardboard=1  => start in cardboard view (but still requires user gesture to fullscreen/lock)
  // - ?view=pc / ?view=mobile => force view
  const viewParam = String(qs('view','')).toLowerCase();
  const startCb = (viewParam === 'cvr') || (String(qs('cardboard','0')) === '1');

  let view = 'pc';
  if (viewParam === 'pc' || viewParam === 'mobile' || viewParam === 'cvr'){
    view = viewParam;
  } else {
    view = isMobileUA() ? 'mobile' : 'pc';
    if (startCb) view = 'cvr';
  }

  setView(view);
  showCardboard(!!startCb);
  applyHHAViewLayers();
  rotateHintUpdate();
  forceHideSummary();

  // --- Buttons ---
  // Start (PC/Mobile)
  btnStart?.addEventListener('click', ()=>{
    startOnce();
  });

  // Enter Cardboard (from overlay)
  btnEnterVR?.addEventListener('click', async ()=>{
    setView('cvr');
    showCardboard(true);
    applyHHAViewLayers();
    rotateHintUpdate();

    await enterFullscreen();
    await lockLandscape();
    startOnce();
  });

  // Cardboard toggle (bottom)
  btnCardboard?.addEventListener('click', async ()=>{
    const on = !DOC.body.classList.contains('cardboard');
    if (on){
      setView('cvr');
      showCardboard(true);
      applyHHAViewLayers();
      rotateHintUpdate();

      await enterFullscreen();
      await lockLandscape();
    } else {
      showCardboard(false);
      setView(isMobileUA() ? 'mobile' : 'pc');
      applyHHAViewLayers();
      rotateHintUpdate();
      // do not force exit fullscreen
    }
  });

  // SHOOT (button)
  btnShoot?.addEventListener('click', ()=>{
    if (!started) return; // HARDEN
    emit('hha:shoot', { src:'btn', t: Date.now() });
  });

  // STOP (end game)
  btnStop?.addEventListener('click', ()=>{
    if (!started) return; // HARDEN: prevent "summary 0" before start
    emit('hha:force_end', { reason:'stop' });
  });

  // Tap anywhere to shoot (mobile convenience)
  let lastTap=0;
  DOC.addEventListener('pointerdown', (ev)=>{
    const t = ev.target;
    // ignore taps on buttons
    if (t && (t.closest?.('.hha-btn') || t.id === 'btnShoot')) return;

    // only after started + overlay hidden
    if (!started) return;

    const now = performance.now();
    if (now - lastTap < 80) return;
    lastTap = now;

    emit('hha:shoot', { src:'tap', t: Date.now() });
  }, { passive:true });

  // Keep rotate hint correct
  window.addEventListener('resize', rotateHintUpdate, {passive:true});
  window.addEventListener('orientationchange', rotateHintUpdate);

  DOC.addEventListener('fullscreenchange', rotateHintUpdate);

  // ensure layers stay correct if class changes
  const obs = new MutationObserver(()=>{
    applyHHAViewLayers();
    rotateHintUpdate();
  });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });

  // If user navigates back/forward from hub cache, keep things sane
  window.addEventListener('pageshow', ()=>{
    forceHideSummary();
    applyHHAViewLayers();
    rotateHintUpdate();
  });
}

function boot(){
  ensureRotateHintNode();
  bind();

  // Load game logic AFTER loader is ready
  import('./hydration.safe.js').catch(console.error);
}

boot();