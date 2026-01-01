// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (v2)
// ✅ Launcher options: Play (PC/Mobile) / Mobile Fullscreen / Cardboard (cVR)
// ✅ Fullscreen + best-effort landscape lock for Cardboard
// ✅ RotateHint overlay (portrait in cardboard)
// ✅ Emits: hha:start, hha:force_end, hha:shoot
// ✅ Sets window.HHA_VIEW.layers so hydration.safe.js spawns correctly
// ✅ Fix: coming from HUB should always show launcher (unless autostart=1)
// ✅ Safe: works without A-Frame (DOM targets)

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
  window.HHA_VIEW.layers = (isCb && L && R)
    ? ['hydration-layerL','hydration-layerR']
    : ['hydration-layer'];

  // keep references for debugging
  window.HHA_VIEW._nodes = { main, L, R };
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

function ensureLauncherButtons(){
  // If user only has btnStart+btnEnterVR in HTML, we optionally add a "Mobile Fullscreen" choice
  const overlay = DOC.getElementById('startOverlay');
  if (!overlay) return;

  const actions = overlay.querySelector('.hha-overlay-actions');
  if (!actions) return;

  // add only once
  if (DOC.getElementById('btnPlayMobile')) return;

  const btn = DOC.createElement('button');
  btn.id = 'btnPlayMobile';
  btn.className = 'hha-btn';
  btn.textContent = '📱 เล่นมือถือ (Fullscreen)';
  // insert between Start and Cardboard if possible
  actions.insertBefore(btn, actions.children[1] || null);
}

function overlayHidden(overlay){
  if (!overlay) return true;
  return overlay.style.display === 'none'
    || overlay.hidden
    || overlay.classList.contains('hide');
}

function bind(){
  const btnStart = DOC.getElementById('btnStart');
  const btnPlayMobile = DOC.getElementById('btnPlayMobile');
  const btnEnterVR = DOC.getElementById('btnEnterVR');
  const btnCardboard = DOC.getElementById('btnCardboard');
  const btnShoot = DOC.getElementById('btnShoot');
  const btnStop = DOC.getElementById('btnStop');
  const overlay = DOC.getElementById('startOverlay');

  // initial view (but keep launcher visible by default)
  const viewParam = String(qs('view','')).toLowerCase();
  const startCb = (viewParam === 'cvr') || (String(qs('cardboard','0')) === '1');

  // If user explicitly wants cVR, start in cVR; otherwise detect device
  const initialView = startCb ? 'cvr' : (isMobileUA() ? 'mobile' : 'pc');
  setView(initialView);
  showCardboard(startCb);
  applyHHAViewLayers();
  rotateHintUpdate();

  // Optional autostart (for testing only): ?autostart=1
  const autostart = String(qs('autostart','0')) === '1';
  if (autostart && overlay){
    try{ overlay.classList.add('hide'); overlay.style.display='none'; }catch(_){}
    emit('hha:start');
  }

  // Start (PC/Mobile normal)
  btnStart?.addEventListener('click', async ()=>{
    // keep current view; just hide overlay + start
    try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
    emit('hha:start');
  });

  // Mobile Fullscreen (explicit)
  btnPlayMobile?.addEventListener('click', async ()=>{
    setView('mobile');
    showCardboard(false);
    applyHHAViewLayers();
    rotateHintUpdate();

    // fullscreen best effort
    if (!isFullscreen()) await enterFullscreen();

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
    rotateHintUpdate();

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
      rotateHintUpdate();
    } else {
      showCardboard(false);
      setView(isMobileUA() ? 'mobile' : 'pc');
      applyHHAViewLayers();
      rotateHintUpdate();
      // don’t force exit FS
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
    if (overlayHidden(overlay)) emit('hha:shoot', { src:'tap', t: Date.now() });
  }, { passive:true });

  // keep rotate hint correct
  window.addEventListener('resize', rotateHintUpdate, {passive:true});
  window.addEventListener('orientationchange', rotateHintUpdate);
  DOC.addEventListener('fullscreenchange', rotateHintUpdate);

  // ensure layers stay correct if someone toggles class manually
  const obs = new MutationObserver(()=>{
    applyHHAViewLayers();
    rotateHintUpdate();
  });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });

  // If page loads in cVR explicitly, and overlay exists, keep it visible but hint rotate
  // (user still must press a button to enter fullscreen/lock + start)
}

function boot(){
  ensureRotateHintNode();
  ensureLauncherButtons();
  bind();

  // load game logic AFTER loader is ready
  import('./hydration.safe.js').catch(console.error);
}

boot();