// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION v2
// ✅ View chooser overlay: PC / Mobile / Cardboard (cVR)
// ✅ Fullscreen + best-effort landscape lock for Cardboard
// ✅ RotateHint card when portrait in Cardboard
// ✅ Emits: hha:start, hha:force_end, hha:shoot
// ✅ Sets window.HHA_VIEW.layers so hydration.safe.js spawns correctly
// ✅ Imports hydration.safe.js after loader ready

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
async function exitFullscreen(){
  try{
    if (DOC.exitFullscreen) await DOC.exitFullscreen();
    else if (DOC.webkitExitFullscreen) await DOC.webkitExitFullscreen();
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
async function unlockOrientation(){
  try{ screen?.orientation?.unlock?.(); }catch(_){}
}

function isPortrait(){
  try{
    if (window.matchMedia) return window.matchMedia('(orientation: portrait)').matches;
  }catch(_){}
  // fallback
  return (window.innerHeight > window.innerWidth);
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
  window.HHA_VIEW._nodes = { main, L, R };
}

function ensureRotateHintNode(){
  if (DOC.getElementById('rotateHint')) return;
  const el = DOC.createElement('div');
  el.id = 'rotateHint';
  el.hidden = true;
  // CSS is handled by hydration-vr.css (#rotateHint)
  // but keep a fallback content here:
  el.innerHTML = `<span>กรุณาหมุนเครื่องเป็นแนวนอน (Landscape) เพื่อเล่นโหมด VR 📱↔️</span>`;
  DOC.body.appendChild(el);
}

function ensureModeChooserOverlay(){
  // If your HTML already has #startOverlay with buttons, we enhance it.
  // If not, we create one to prevent "no option to choose" issue.
  let ov = DOC.getElementById('startOverlay');
  if (ov) return ov;

  ov = DOC.createElement('div');
  ov.id = 'startOverlay';
  ov.className = 'hha-overlay';
  ov.innerHTML = `
    <div class="hha-overlay-card">
      <div class="hha-title">Hydration VR 💧</div>
      <div class="hha-sub">
        เลือกโหมดการเล่น: <b>PC</b> / <b>Mobile</b> / <b>Cardboard (VR)</b>
      </div>
      <div class="hha-overlay-actions">
        <button id="btnStart" class="hha-btn primary">🖥️ เล่นโหมดปกติ</button>
        <button id="btnMobile" class="hha-btn">📱 โหมดมือถือ</button>
        <button id="btnEnterVR" class="hha-btn">📦 Cardboard</button>
      </div>
      <div class="hha-hint">* โหมด Cardboard แนะนำ “แนวนอน” + Fullscreen</div>
    </div>
  `;
  DOC.body.appendChild(ov);
  return ov;
}

function setOverlayHidden(overlay, hidden){
  if (!overlay) return;
  if (hidden){
    overlay.classList.add('hide');
    overlay.style.display = 'none';
  } else {
    overlay.classList.remove('hide');
    overlay.style.display = '';
  }
}

function bind(){
  ensureRotateHintNode();
  const overlay = ensureModeChooserOverlay();

  const btnStart = DOC.getElementById('btnStart');       // normal start (pc/mobile auto)
  const btnEnterVR = DOC.getElementById('btnEnterVR');   // cardboard
  const btnMobile = DOC.getElementById('btnMobile');     // optional (created if missing)

  const btnCardboard = DOC.getElementById('btnCardboard'); // bottom
  const btnShoot = DOC.getElementById('btnShoot');
  const btnStop = DOC.getElementById('btnStop');

  // ---- initial view from URL or UA ----
  const viewParam = String(qs('view','')).toLowerCase(); // pc/mobile/cvr
  const startCb = (viewParam === 'cvr') || (String(qs('cardboard','0')) === '1');
  const viewDefault = isMobileUA() ? 'mobile' : 'pc';
  const view = startCb ? 'cvr' : (viewParam || viewDefault);

  setView(view === 'pc' ? 'pc' : view === 'mobile' ? 'mobile' : 'cvr');
  showCardboard(startCb);
  applyHHAViewLayers();
  rotateHintUpdate();

  // autostart support
  const autostart = String(qs('autostart','0')) === '1';
  if (autostart){
    setOverlayHidden(overlay, true);
    emit('hha:start');
  }

  // ---- start normal (keep current view pc/mobile) ----
  btnStart?.addEventListener('click', async ()=>{
    // if someone is in cvr already, keep it
    setOverlayHidden(overlay, true);
    emit('hha:start');
  });

  // ---- explicit mobile mode ----
  btnMobile?.addEventListener('click', async ()=>{
    setView('mobile');
    showCardboard(false);
    applyHHAViewLayers();
    rotateHintUpdate();
    setOverlayHidden(overlay, true);
    emit('hha:start');
  });

  // ---- enter cardboard from overlay ----
  btnEnterVR?.addEventListener('click', async ()=>{
    setView('cvr');
    showCardboard(true);
    applyHHAViewLayers();
    rotateHintUpdate();

    await enterFullscreen();
    await lockLandscape();

    // keep hint accurate after lock attempt
    rotateHintUpdate();

    setOverlayHidden(overlay, true);
    emit('hha:start');
  });

  // ---- bottom cardboard toggle ----
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
      // do not force exit fullscreen; user may keep it
      await unlockOrientation();
    }
  });

  // ---- shoot ----
  btnShoot?.addEventListener('click', ()=>{
    emit('hha:shoot', { src:'btn', t: Date.now() });
  });

  // ---- stop/end ----
  btnStop?.addEventListener('click', ()=>{
    emit('hha:force_end', { reason:'stop' });
  });

  // Tap anywhere to shoot (only after start)
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

  // keep rotate hint correct
  window.addEventListener('resize', rotateHintUpdate, {passive:true});
  window.addEventListener('orientationchange', rotateHintUpdate);
  DOC.addEventListener('fullscreenchange', rotateHintUpdate);

  // keep layers correct if class changes
  const obs = new MutationObserver(()=>{
    applyHHAViewLayers();
    rotateHintUpdate();
  });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });

  // If user opens from HUB and wants overlay always visible first:
  // (default behavior unless autostart=1)
  // Ensure overlay shown initially:
  setOverlayHidden(overlay, false);
}

function boot(){
  bind();

  // load game logic AFTER loader is ready
  import('./hydration.safe.js').catch(console.error);
}

boot();