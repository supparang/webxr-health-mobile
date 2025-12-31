// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Mode picker: PC / Mobile / Cardboard VR
// ✅ Fullscreen + best-effort landscape lock for Cardboard
// ✅ RotateHint when Cardboard in portrait
// ✅ Emits: hha:start, hha:force_end, hha:shoot
// ✅ Sets window.HHA_VIEW.layers + window.HHA_VIEW.aim for hydration.safe.js

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
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI:'hide' });
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

function isPortrait(){
  try{
    return window.matchMedia && window.matchMedia('(orientation: portrait)').matches;
  }catch(_){ return false; }
}

function rotateHintUpdate(){
  const el = DOC.getElementById('rotateHint');
  if (!el) return;
  const on = DOC.body.classList.contains('cardboard') && isPortrait();
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

function applyAimConfig(){
  // ?lock=90 (px) ระยะล็อกช่วยยิง
  // ?aimx=0 (px) offset X
  // ?aimy=6 (px) offset Y (แนะนำ 6-12 ใน Cardboard)
  const lockPx = Number(qs('lock', qs('lockPx', 90))) || 90;
  const offsetX = Number(qs('aimx', qs('aimOffsetX', 0))) || 0;
  const offsetY = Number(qs('aimy', qs('aimOffsetY', 6))) || 6;

  window.HHA_VIEW = window.HHA_VIEW || {};
  window.HHA_VIEW.aim = { lockPx, offsetX, offsetY };
}

function hideOverlay(){
  const overlay = DOC.getElementById('startOverlay');
  try{
    overlay?.classList.add('hide');
    if (overlay) overlay.style.display = 'none';
  }catch(_){}
}

async function enterCardboardFlow(){
  setView('cvr');
  showCardboard(true);
  applyHHAViewLayers();
  rotateHintUpdate();

  // ต้องเป็น gesture จากปุ่ม ถึงจะ lock ได้ดี
  await enterFullscreen();
  await lockLandscape();
  rotateHintUpdate();

  // ถ้ายัง portrait ให้แสดง hint แต่ยังเริ่มเกมได้ (ผู้ใช้หมุนแล้วจะหาย)
  hideOverlay();
  emit('hha:start');
}

function bind(){
  const btnStartPC = DOC.getElementById('btnStartPC');
  const btnStartMobile = DOC.getElementById('btnStartMobile');
  const btnEnterVR = DOC.getElementById('btnEnterVR');

  const btnCardboard = DOC.getElementById('btnCardboard');
  const btnShoot = DOC.getElementById('btnShoot');
  const btnStop = DOC.getElementById('btnStop');

  const btnRotateOk = DOC.getElementById('btnRotateOk');
  btnRotateOk?.addEventListener('click', ()=>{ rotateHintUpdate(); });

  // initial view (if URL says view=cvr)
  const viewParam = String(qs('view','')).toLowerCase();
  const startCb = (viewParam === 'cvr') || (String(qs('cardboard','0')) === '1');
  const view = startCb ? 'cvr' : (isMobileUA() ? 'mobile' : 'pc');

  setView(view);
  showCardboard(startCb);
  applyHHAViewLayers();
  rotateHintUpdate();

  // Mode: PC
  btnStartPC?.addEventListener('click', ()=>{
    setView('pc');
    showCardboard(false);
    applyHHAViewLayers();
    rotateHintUpdate();
    hideOverlay();
    emit('hha:start');
  });

  // Mode: Mobile
  btnStartMobile?.addEventListener('click', ()=>{
    setView('mobile');
    showCardboard(false);
    applyHHAViewLayers();
    rotateHintUpdate();
    hideOverlay();
    emit('hha:start');
  });

  // Mode: Cardboard
  btnEnterVR?.addEventListener('click', enterCardboardFlow);

  // Bottom toggle Cardboard
  btnCardboard?.addEventListener('click', async ()=>{
    const on = !DOC.body.classList.contains('cardboard');
    if (on){
      await enterCardboardFlow();
    } else {
      showCardboard(false);
      setView(isMobileUA() ? 'mobile' : 'pc');
      applyHHAViewLayers();
      rotateHintUpdate();
    }
  });

  // SHOOT button
  btnShoot?.addEventListener('click', ()=>{
    emit('hha:shoot', { src:'btn', t: Date.now() });
  });

  // STOP
  btnStop?.addEventListener('click', ()=>{
    emit('hha:force_end', { reason:'stop' });
  });

  // Tap-to-shoot convenience (ignore button taps)
  let lastTap=0;
  DOC.addEventListener('pointerdown', (ev)=>{
    const t = ev.target;
    if (t && (t.closest?.('.hha-btn') || t.classList?.contains('modeCard'))) return;

    const now = performance.now();
    if (now - lastTap < 80) return;
    lastTap = now;

    const ov = DOC.getElementById('startOverlay');
    const ovHidden = !ov || ov.style.display === 'none' || ov.hidden || ov.classList.contains('hide');
    if (ovHidden) emit('hha:shoot', { src:'tap', t: Date.now() });
  }, { passive:true });

  // keep rotate hint accurate
  window.addEventListener('resize', rotateHintUpdate, {passive:true});
  window.addEventListener('orientationchange', rotateHintUpdate);
  DOC.addEventListener('fullscreenchange', rotateHintUpdate);

  // maintain layers
  const obs = new MutationObserver(()=>{
    applyHHAViewLayers();
    rotateHintUpdate();
  });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });
}

function boot(){
  applyAimConfig();
  bind();

  // load game logic AFTER loader ready
  import('./hydration.safe.js').catch(console.error);
}

boot();