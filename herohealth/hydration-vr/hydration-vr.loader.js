// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (MODE CHOOSER + EXIT VR FROM ROTATEHINT)
// ✅ View: PC / Mobile / Cardboard
// ✅ Fullscreen + best-effort landscape lock for Cardboard
// ✅ Emits: hha:start, hha:force_end, hha:shoot
// ✅ Sets window.HHA_VIEW.layers so hydration.safe.js spawns correctly
// ✅ NEW: explicit mode buttons + rotateHint has Exit VR button

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
  const L = DOC.getElementById('hydration-layerL');
  const R = DOC.getElementById('hydration-layerR');
  const main = DOC.getElementById('hydration-layer');
  const isCb = DOC.body.classList.contains('cardboard');
  window.HHA_VIEW = window.HHA_VIEW || {};
  window.HHA_VIEW.layers = (isCb && L && R) ? ['hydration-layerL','hydration-layerR'] : ['hydration-layer'];
  window.HHA_VIEW._nodes = { main, L, R };
}

function setMode(mode){
  // mode: 'pc' | 'mobile' | 'cvr'
  if (mode === 'cvr'){
    setView('cvr');
    showCardboard(true);
    applyHHAViewLayers();
    rotateHintUpdate();
    return;
  }
  // pc/mobile
  showCardboard(false);
  setView(mode === 'pc' ? 'pc' : 'mobile');
  applyHHAViewLayers();
  rotateHintUpdate();
}

async function enterVRFlow(){
  setMode('cvr');
  await enterFullscreen();
  await lockLandscape();
}

function ensureRotateHintNode(){
  if (DOC.getElementById('rotateHint')) return;

  const wrap = DOC.createElement('div');
  wrap.id = 'rotateHint';
  wrap.hidden = true;
  wrap.className = 'hha-rotateHint';
  wrap.innerHTML = `
    <div class="card">
      <div class="big">กรุณาหมุนจอเป็นแนวนอน</div>
      <div class="small">เพื่อเล่นโหมด VR / Cardboard 📱↔️</div>
      <div style="display:flex; gap:10px; justify-content:center; margin-top:14px; flex-wrap:wrap">
        <button id="btnExitVR" class="hha-btn danger">⏏ ออก VR</button>
        <button id="btnIHaveRotated" class="hha-btn primary">✅ หมุนแล้ว</button>
      </div>
      <div class="small" style="margin-top:10px">* ถ้ายังไม่อยากเล่น VR กด “ออก VR” เพื่อกลับโหมดปกติ</div>
    </div>
  `;
  DOC.body.appendChild(wrap);

  wrap.querySelector('#btnExitVR')?.addEventListener('click', async ()=>{
    // Exit cardboard mode safely
    setMode(isMobileUA() ? 'mobile' : 'pc');
    if (isFullscreen()) {
      // best effort; don't force if browser blocks
      try{ await exitFullscreen(); }catch(_){}
    }
    rotateHintUpdate();
  });

  wrap.querySelector('#btnIHaveRotated')?.addEventListener('click', ()=>{
    // just re-check orientation
    rotateHintUpdate();
  });
}

function bind(){
  const overlay = DOC.getElementById('startOverlay');

  const btnStart = DOC.getElementById('btnStart');
  const btnStop  = DOC.getElementById('btnStop');
  const btnShoot = DOC.getElementById('btnShoot');
  const btnCardboard = DOC.getElementById('btnCardboard');

  // NEW: mode buttons on overlay
  const btnModePC = DOC.getElementById('btnModePC');
  const btnModeMobile = DOC.getElementById('btnModeMobile');
  const btnModeVR = DOC.getElementById('btnModeVR');

  // initial view: DO NOT force cvr unless query says so
  const viewParam = String(qs('view','')).toLowerCase();
  const startCb = (viewParam === 'cvr') || (String(qs('cardboard','0')) === '1');
  setMode(startCb ? 'cvr' : (isMobileUA() ? 'mobile' : 'pc'));

  // MODE choose (no reload)
  btnModePC?.addEventListener('click', ()=> setMode('pc'));
  btnModeMobile?.addEventListener('click', ()=> setMode('mobile'));
  btnModeVR?.addEventListener('click', ()=> enterVRFlow());

  // Start game
  btnStart?.addEventListener('click', ()=>{
    try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
    emit('hha:start');
  });

  // Bottom cardboard toggle
  btnCardboard?.addEventListener('click', async ()=>{
    const on = !DOC.body.classList.contains('cardboard');
    if (on) await enterVRFlow();
    else setMode(isMobileUA() ? 'mobile' : 'pc');
  });

  // SHOOT
  btnShoot?.addEventListener('click', ()=>{
    emit('hha:shoot', { src:'btn', t: Date.now() });
  });

  // STOP
  btnStop?.addEventListener('click', ()=>{
    emit('hha:force_end', { reason:'stop' });
  });

  // Tap anywhere to shoot (after overlay hidden)
  let lastTap=0;
  DOC.addEventListener('pointerdown', (ev)=>{
    const t = ev.target;
    if (t && (t.closest?.('.hha-btn') || t.id === 'btnShoot')) return;

    const now = performance.now();
    if (now - lastTap < 80) return;
    lastTap = now;

    const ovHidden = !overlay || overlay.style.display === 'none' || overlay.hidden || overlay.classList.contains('hide');
    if (ovHidden) emit('hha:shoot', { src:'tap', t: Date.now() });
  }, { passive:true });

  window.addEventListener('resize', rotateHintUpdate, {passive:true});
  window.addEventListener('orientationchange', rotateHintUpdate);
  DOC.addEventListener('fullscreenchange', rotateHintUpdate);

  const obs = new MutationObserver(()=>{
    applyHHAViewLayers();
    rotateHintUpdate();
  });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });
}

function boot(){
  ensureRotateHintNode();
  bind();
  import('./hydration.safe.js').catch(console.error);
}

boot();