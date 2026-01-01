// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION v2
// ✅ View chooser: PC / Mobile / Cardboard (cVR)
// ✅ Fullscreen + best-effort landscape lock for Cardboard
// ✅ RotateHint shows when cVR + portrait
// ✅ Emits: hha:start, hha:force_end, hha:shoot
// ✅ Also center-hit simulate click for tap-to-shoot convenience
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
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI:'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  }catch(_){}
}

async function lockLandscape(){
  // Best-effort; works best after user gesture + fullscreen
  try{
    if (screen?.orientation?.lock){
      await screen.orientation.lock('landscape');
    }
  }catch(_){}
}

function isPortrait(){
  try{
    return window.matchMedia && window.matchMedia('(orientation: portrait)').matches;
  }catch(_){
    return false;
  }
}

function rotateHintUpdate(){
  const el = DOC.getElementById('rotateHint');
  if (!el) return;
  const on = DOC.body.classList.contains('cardboard') && isPortrait();
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

  // keep references for debugging
  window.HHA_VIEW._nodes = { main, L, R };
}

function hideOverlay(){
  const overlay = DOC.getElementById('startOverlay');
  if (!overlay) return;
  try{ overlay.classList.add('hide'); overlay.style.display='none'; }catch(_){}
}

function overlayHidden(){
  const overlay = DOC.getElementById('startOverlay');
  if (!overlay) return true;
  if (overlay.hidden) return true;
  if (overlay.style.display === 'none') return true;
  if (overlay.classList.contains('hide')) return true;
  return false;
}

// --- tap-to-shoot: simulate clicking at center of active playfield ---
function activePlayfieldRect(){
  const pf = DOC.body.classList.contains('cardboard')
    ? DOC.getElementById('cbPlayfield')
    : DOC.getElementById('playfield');
  const r = pf?.getBoundingClientRect();
  return r || { left:0, top:0, width:1, height:1 };
}

function simulateCenterHit(){
  // Click at center of playfield; if a target is there, it will receive pointerdown/click.
  try{
    const r = activePlayfieldRect();
    const cx = r.left + r.width * 0.5;
    const cy = r.top  + r.height * 0.5;

    const el = DOC.elementFromPoint(cx, cy);
    if (!el) return false;

    // dispatch pointerdown then click
    const pd = new PointerEvent('pointerdown', { bubbles:true, cancelable:true, clientX:cx, clientY:cy, pointerType:'touch' });
    el.dispatchEvent(pd);

    const ck = new MouseEvent('click', { bubbles:true, cancelable:true, clientX:cx, clientY:cy });
    el.dispatchEvent(ck);
    return true;
  }catch(_){}
  return false;
}

async function enterCVR(){
  setView('cvr');
  showCardboard(true);
  applyHHAViewLayers();
  rotateHintUpdate();

  await enterFullscreen();
  await lockLandscape();
  rotateHintUpdate();
}

function enterPC(){
  showCardboard(false);
  setView('pc');
  applyHHAViewLayers();
  rotateHintUpdate();
}

function enterMobile(){
  showCardboard(false);
  setView('mobile');
  applyHHAViewLayers();
  rotateHintUpdate();
}

function bind(){
  // Existing buttons
  const btnStart     = DOC.getElementById('btnStart');      // start (current mode)
  const btnEnterVR   = DOC.getElementById('btnEnterVR');    // enter cVR
  const btnCardboard = DOC.getElementById('btnCardboard');  // toggle cVR
  const btnShoot     = DOC.getElementById('btnShoot');
  const btnStop      = DOC.getElementById('btnStop');

  // Optional new buttons (if you add them in HTML overlay)
  const btnPlayPC     = DOC.getElementById('btnPlayPC');
  const btnPlayMobile = DOC.getElementById('btnPlayMobile');

  // initial view param
  const viewParam = String(qs('view','')).toLowerCase();
  const startCb = (viewParam === 'cvr') || (String(qs('cardboard','0')) === '1');
  const forced = viewParam === 'pc' || viewParam === 'mobile' || viewParam === 'cvr';

  // choose initial view
  if (startCb){
    setView('cvr');
    showCardboard(true);
  } else if (viewParam === 'mobile'){
    setView('mobile');
    showCardboard(false);
  } else if (viewParam === 'pc'){
    setView('pc');
    showCardboard(false);
  } else {
    // auto by UA (still keep overlay for choosing)
    setView(isMobileUA() ? 'mobile' : 'pc');
    showCardboard(false);
  }

  applyHHAViewLayers();
  rotateHintUpdate();

  // --- MODE buttons (overlay) ---
  btnPlayPC?.addEventListener('click', ()=>{
    enterPC();
  });

  btnPlayMobile?.addEventListener('click', ()=>{
    enterMobile();
  });

  // Start (in selected mode)
  btnStart?.addEventListener('click', ()=>{
    // If in cVR but still portrait, do not start yet
    if (DOC.body.classList.contains('cardboard') && isPortrait()){
      rotateHintUpdate();
      return;
    }
    hideOverlay();
    emit('hha:start');
  });

  // Enter cVR from overlay
  btnEnterVR?.addEventListener('click', async ()=>{
    await enterCVR();

    // if still portrait => keep overlay visible (player must rotate)
    rotateHintUpdate();
    if (DOC.body.classList.contains('cardboard') && isPortrait()){
      // do not hide overlay yet; let rotate hint guide
      return;
    }

    hideOverlay();
    emit('hha:start');
  });

  // Bottom toggle cVR
  btnCardboard?.addEventListener('click', async ()=>{
    const on = !DOC.body.classList.contains('cardboard');
    if (on){
      await enterCVR();
    } else {
      // back to UA mode
      showCardboard(false);
      setView(isMobileUA() ? 'mobile' : 'pc');
      applyHHAViewLayers();
    }
    rotateHintUpdate();
  });

  // SHOOT (button) -> also attempt center hit
  btnShoot?.addEventListener('click', ()=>{
    emit('hha:shoot', { src:'btn', t: Date.now() });
    simulateCenterHit();
  });

  // STOP (end game)
  btnStop?.addEventListener('click', ()=>{
    emit('hha:force_end', { reason:'stop' });
  });

  // Tap anywhere to shoot (mobile convenience)
  let lastTap=0;
  DOC.addEventListener('pointerdown', (ev)=>{
    const t = ev.target;
    if (t && (t.closest?.('.hha-btn') || t.id === 'btnShoot')) return;

    const now = performance.now();
    if (now - lastTap < 80) return;
    lastTap = now;

    if (!overlayHidden()) return;

    emit('hha:shoot', { src:'tap', t: Date.now() });
    simulateCenterHit();
  }, { passive:true });

  // keep rotate hint correct
  window.addEventListener('resize', rotateHintUpdate, {passive:true});
  window.addEventListener('orientationchange', rotateHintUpdate);
  DOC.addEventListener('fullscreenchange', rotateHintUpdate);

  // Keep layers correct
  const obs = new MutationObserver(()=>{
    applyHHAViewLayers();
    rotateHintUpdate();
  });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });

  // If user rotated to landscape while in cVR and overlay still visible -> auto allow start
  window.addEventListener('orientationchange', ()=>{
    rotateHintUpdate();
  });
}

function ensureRotateHintNode(){
  if (DOC.getElementById('rotateHint')) return;
  const el = DOC.createElement('div');
  el.id = 'rotateHint';
  el.hidden = true;
  el.className = 'hha-rotateHint';
  el.innerHTML = `
    <div class="card">
      <div class="big">กรุณาหมุนเครื่องเป็นแนวนอน (Landscape) 📱↔️</div>
      <div class="small">โหมด Cardboard/VR ต้องใช้แนวนอนเพื่อให้เห็น 2 ตาเต็มจอ</div>
    </div>
  `;
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