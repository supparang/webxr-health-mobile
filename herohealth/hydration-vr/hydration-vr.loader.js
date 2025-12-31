// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (Mode Select)
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
function setQS(key, value){
  try{
    const u = new URL(location.href);
    u.searchParams.set(key, value);
    history.replaceState({}, '', u.toString());
  }catch(_){}
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

function hideOverlay(){
  const overlay = DOC.getElementById('startOverlay');
  try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
}
function overlayHidden(){
  const overlay = DOC.getElementById('startOverlay');
  return !overlay || overlay.style.display === 'none' || overlay.hidden || overlay.classList.contains('hide');
}

function pickInitialMode(){
  const v = String(qs('view','')).toLowerCase();
  if (v === 'pc') return {view:'pc', cardboard:false};
  if (v === 'mobile') return {view:'mobile', cardboard:false};
  if (v === 'cvr') return {view:'cvr', cardboard:true};

  // fallback
  const startCb = (String(qs('cardboard','0')) === '1');
  if (startCb) return {view:'cvr', cardboard:true};
  return {view: isMobileUA() ? 'mobile' : 'pc', cardboard:false};
}

async function goMode(mode){
  // mode: 'pc' | 'mobile' | 'cvr'
  if (mode === 'cvr'){
    setQS('view','cvr');
    setView('cvr');
    showCardboard(true);
    applyHHAViewLayers();
    rotateHintUpdate();
    await enterFullscreen();
    await lockLandscape();
  } else if (mode === 'mobile'){
    setQS('view','mobile');
    showCardboard(false);
    setView('mobile');
    applyHHAViewLayers();
    rotateHintUpdate();
  } else {
    setQS('view','pc');
    showCardboard(false);
    setView('pc');
    applyHHAViewLayers();
    rotateHintUpdate();
  }
}

function bind(){
  const btnStartQuick = DOC.getElementById('btnStartQuick');
  const btnHowTo = DOC.getElementById('btnHowTo');
  const howToBox = DOC.getElementById('howToBox');

  const btnPlayPC = DOC.getElementById('btnPlayPC');
  const btnPlayMobile = DOC.getElementById('btnPlayMobile');
  const btnEnterVR = DOC.getElementById('btnEnterVR');

  const btnCardboard = DOC.getElementById('btnCardboard');
  const btnShoot = DOC.getElementById('btnShoot');
  const btnStop = DOC.getElementById('btnStop');

  // initial mode
  const init = pickInitialMode();
  goMode(init.view === 'cvr' ? 'cvr' : (init.view === 'mobile' ? 'mobile' : 'pc'));

  // Howto toggle
  btnHowTo?.addEventListener('click', ()=>{
    if (!howToBox) return;
    howToBox.hidden = !howToBox.hidden;
  });

  // Mode select buttons (overlay)
  btnPlayPC?.addEventListener('click', async ()=>{
    await goMode('pc');
    hideOverlay();
    emit('hha:start');
  });

  btnPlayMobile?.addEventListener('click', async ()=>{
    await goMode('mobile');
    hideOverlay();
    emit('hha:start');
  });

  btnEnterVR?.addEventListener('click', async ()=>{
    await goMode('cvr');
    hideOverlay();
    emit('hha:start');
  });

  // Start quick: start with current mode (whatever set)
  btnStartQuick?.addEventListener('click', ()=>{
    hideOverlay();
    emit('hha:start');
  });

  // Cardboard toggle (bottom)
  btnCardboard?.addEventListener('click', async ()=>{
    const on = !DOC.body.classList.contains('cardboard');
    if (on){
      await goMode('cvr');
    } else {
      await goMode(isMobileUA() ? 'mobile' : 'pc');
    }
  });

  // SHOOT (button)
  btnShoot?.addEventListener('click', ()=>{
    if (overlayHidden()) emit('hha:shoot', { src:'btn', t: Date.now() });
  });

  // STOP
  btnStop?.addEventListener('click', ()=>{
    emit('hha:force_end', { reason:'stop' });
  });

  // Tap anywhere to shoot
  let lastTap=0;
  DOC.addEventListener('pointerdown', (ev)=>{
    const t = ev.target;
    if (t && (t.closest?.('.hha-btn') || t.id === 'btnShoot')) return;

    const now = performance.now();
    if (now - lastTap < 80) return;
    lastTap = now;

    if (overlayHidden()) emit('hha:shoot', { src:'tap', t: Date.now() });
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
  el.textContent = 'กรุณาหมุนเครื่องเป็นแนวนอน (Landscape) เพื่อเล่นโหมด VR / Cardboard 📱↔️';
  DOC.body.appendChild(el);
}

function boot(){
  ensureRotateHintNode();
  bind();
  import('./hydration.safe.js').catch(console.error);
}
boot();