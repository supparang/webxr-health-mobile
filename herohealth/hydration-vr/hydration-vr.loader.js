// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION
// ✅ View: PC / Mobile / Cardboard
// ✅ Fullscreen + best-effort landscape lock for Cardboard
// ✅ Emits: hha:start, hha:force_end, hha:shoot
// ✅ Sets window.HHA_VIEW.layers so hydration.safe.js spawns correctly

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
async function exitFullscreen(){
  try{
    if (DOC.exitFullscreen) await DOC.exitFullscreen();
    else if (DOC.webkitExitFullscreen) await DOC.webkitExitFullscreen();
  }catch(_){}
}

async function lockLandscape(){
  // works best after a user gesture + fullscreen
  try{
    if (screen?.orientation?.lock){
      await screen.orientation.lock('landscape');
    }
  }catch(_){}
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
  window.HHA_VIEW.layers = (isCb && L && R) ? ['hydration-layerL','hydration-layerR'] : ['hydration-layer'];
  // also keep references for debugging
  window.HHA_VIEW._nodes = { main, L, R };
}

function bind(){
  const btnStart = DOC.getElementById('btnStart');
  const btnEnterVR = DOC.getElementById('btnEnterVR');
  const btnCardboard = DOC.getElementById('btnCardboard');
  const btnShoot = DOC.getElementById('btnShoot');
  const btnStop = DOC.getElementById('btnStop');
  const overlay = DOC.getElementById('startOverlay');

  // initial view
  const viewParam = String(qs('view','')).toLowerCase();
  const startCb = (viewParam === 'cvr') || (String(qs('cardboard','0')) === '1');
  const view = startCb ? 'cvr' : (isMobileUA() ? 'mobile' : 'pc');
  setView(view);
  showCardboard(startCb);
  applyHHAViewLayers();
  rotateHintUpdate();

  // Start
  btnStart?.addEventListener('click', async ()=>{
    try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
    emit('hha:start');
  });

  // Cardboard enter (from overlay)
  btnEnterVR?.addEventListener('click', async ()=>{
    setView('cvr');
    showCardboard(true);
    applyHHAViewLayers();
    rotateHintUpdate();

    await enterFullscreen();
    await lockLandscape();

    // auto-start if not started
    try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
    emit('hha:start');
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
      // ไม่บังคับออก fullscreen เพราะบางคนอยากเล่น fullscreen ต่อ
    }
  });

  // SHOOT (button)
  btnShoot?.addEventListener('click', ()=>{
    emit('hha:shoot', { src:'btn', t: Date.now() });
  });

  // STOP (end game)
  btnStop?.addEventListener('click', ()=>{
    emit('hha:force_end', { reason:'stop' });
  });

  // Tap anywhere to shoot (mobile convenience)
  let lastTap=0;
  DOC.addEventListener('pointerdown', (ev)=>{
    // ignore taps on buttons
    const t = ev.target;
    if (t && (t.closest?.('.hha-btn') || t.id === 'btnShoot')) return;

    const now = performance.now();
    if (now - lastTap < 80) return;
    lastTap = now;

    // only when game started (overlay hidden)
    const ovHidden = !overlay || overlay.style.display === 'none' || overlay.hidden || overlay.classList.contains('hide');
    if (ovHidden) emit('hha:shoot', { src:'tap', t: Date.now() });
  }, { passive:true });

  // keep rotate hint correct
  window.addEventListener('resize', rotateHintUpdate, {passive:true});
  window.addEventListener('orientationchange', rotateHintUpdate);

  // optional: if user exits fullscreen, still keep cvr mode but update hint
  DOC.addEventListener('fullscreenchange', rotateHintUpdate);

  // also ensure layers stay correct if someone toggles class manually
  const obs = new MutationObserver(()=>{
    applyHHAViewLayers();
    rotateHintUpdate();
  });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });
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

function boot(){
  ensureRotateHintNode();
  bind();

  // load game logic AFTER loader is ready
  // hydration.safe.js is module, so import it here
  import('./hydration.safe.js').catch(console.error);
}

boot();