// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION v2 (Launcher + VR landscape)
// ✅ Launcher: PC / Mobile / VR Cardboard (3 buttons)
// ✅ Quick Settings (diff/time/run/seed) -> update URL and reload
// ✅ Fullscreen + best-effort landscape lock for Cardboard
// ✅ Emits: hha:start, hha:force_end, hha:shoot
// ✅ Sets window.HHA_VIEW.layers so hydration.safe.js spawns correctly

'use strict';

const DOC = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function qset(url, k, v){
  try{
    if (v == null || v === '') url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  }catch(_){}
}
function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function isMobileUA(){
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

/* ---------------- View state ---------------- */
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

/* ---------------- Fullscreen + Orientation ---------------- */
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
  // works best after user gesture + fullscreen (not guaranteed on iOS)
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

/* ---------------- Rotate hint ---------------- */
function ensureRotateHintNode(){
  if (DOC.getElementById('rotateHint')) return;
  const el = DOC.createElement('div');
  el.id = 'rotateHint';
  el.className = 'hha-rotateHint';
  el.hidden = true;
  el.innerHTML = `
    <div class="card">
      <div class="big">กรุณาหมุนเครื่องเป็นแนวนอน</div>
      <div class="small">Landscape เพื่อเล่นโหมด VR 📱↔️</div>
      <div style="margin-top:12px; opacity:.9; font-weight:900;">* ถ้าไม่หมุน เป้าจะเพี้ยน/เล็งยาก</div>
    </div>
  `;
  DOC.body.appendChild(el);
}
function rotateHintUpdate(){
  const el = DOC.getElementById('rotateHint');
  if (!el) return;
  const on = DOC.body.classList.contains('cardboard') && isPortrait();
  el.hidden = !on;
}

/* ---------------- Launcher helpers ---------------- */
function hideOverlay(){
  const overlay = DOC.getElementById('startOverlay');
  try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
}
function showOverlay(){
  const overlay = DOC.getElementById('startOverlay');
  try{ overlay?.classList.remove('hide'); overlay && (overlay.style.display=''); }catch(_){}
}

function hydrateQuickSettingsUI(){
  // (Optional) these nodes exist in updated hydration-vr.html (launcher)
  const selDiff = DOC.getElementById('selDiff');
  const selRun  = DOC.getElementById('selRun');
  const selTime = DOC.getElementById('selTime');
  const inpSeed = DOC.getElementById('inpSeed');

  if (selDiff) selDiff.value = String(qs('diff','normal')).toLowerCase();
  if (selRun)  selRun.value  = String(qs('run', qs('runMode','play'))).toLowerCase();
  if (selTime) selTime.value = String(qs('time', qs('durationPlannedSec', 70)));
  if (inpSeed) inpSeed.value = String(qs('seed', qs('sessionId','')) || '');
}

function bindQuickSettings(){
  const selDiff = DOC.getElementById('selDiff');
  const selRun  = DOC.getElementById('selRun');
  const selTime = DOC.getElementById('selTime');
  const inpSeed = DOC.getElementById('inpSeed');
  const btnApply = DOC.getElementById('btnApplySettings');

  if (!selDiff && !selRun && !selTime && !inpSeed && !btnApply) return;

  function apply(){
    const u = new URL(location.href);
    if (selDiff) qset(u, 'diff', selDiff.value);
    if (selRun)  qset(u, 'run',  selRun.value);
    if (selTime) qset(u, 'time', selTime.value);
    if (inpSeed) qset(u, 'seed', inpSeed.value.trim());

    // keep hub param untouched if present
    // add fresh ts to avoid caching
    qset(u, 'ts', Date.now());
    location.href = u.toString();
  }

  btnApply?.addEventListener('click', apply);

  // small convenience: change selects auto-apply on mobile
  const auto = (el)=> el?.addEventListener('change', ()=>{ /* do nothing until apply */ }, {passive:true});
  auto(selDiff); auto(selRun); auto(selTime);
}

/* ---------------- Mode switching ---------------- */
async function enterPC(){
  setView('pc');
  showCardboard(false);
  applyHHAViewLayers();
  rotateHintUpdate();
}
async function enterMobile(){
  setView('mobile');
  showCardboard(false);
  applyHHAViewLayers();
  rotateHintUpdate();
}
async function enterCardboard(){
  setView('cvr');
  showCardboard(true);
  applyHHAViewLayers();
  rotateHintUpdate();

  // best effort VR: fullscreen + landscape lock
  await enterFullscreen();
  await lockLandscape();
  rotateHintUpdate();
}

function bindLauncherButtons(){
  // NEW launcher buttons (preferred)
  const btnPC = DOC.getElementById('btnPlayPC');
  const btnMB = DOC.getElementById('btnPlayMobile');
  const btnVR = DOC.getElementById('btnPlayVR');

  // Backward compat (older ids)
  const btnStart = DOC.getElementById('btnStart');
  const btnEnterVR = DOC.getElementById('btnEnterVR');

  const overlay = DOC.getElementById('startOverlay');

  function startGame(){
    hideOverlay();
    emit('hha:start');
  }

  // PC
  btnPC?.addEventListener('click', async ()=>{
    await enterPC();
    startGame();
  });

  // Mobile
  btnMB?.addEventListener('click', async ()=>{
    await enterMobile();
    startGame();
  });

  // VR Cardboard
  btnVR?.addEventListener('click', async ()=>{
    await enterCardboard();
    startGame();
  });

  // Backward compat:
  btnStart?.addEventListener('click', async ()=>{
    // choose best default view
    if (isMobileUA()) await enterMobile();
    else await enterPC();
    startGame();
  });

  btnEnterVR?.addEventListener('click', async ()=>{
    await enterCardboard();
    startGame();
  });

  // If overlay is missing, autostart (dev mode)
  if (!overlay){
    // choose view by UA
    (isMobileUA() ? enterMobile() : enterPC()).then(()=> emit('hha:start'));
  }
}

/* ---------------- In-game controls ---------------- */
function bindIngameButtons(){
  const btnCardboard = DOC.getElementById('btnCardboard');
  const btnShoot = DOC.getElementById('btnShoot');
  const btnStop = DOC.getElementById('btnStop');
  const overlay = DOC.getElementById('startOverlay');

  btnCardboard?.addEventListener('click', async ()=>{
    const on = !DOC.body.classList.contains('cardboard');
    if (on){
      await enterCardboard();
    } else {
      showCardboard(false);
      setView(isMobileUA() ? 'mobile' : 'pc');
      applyHHAViewLayers();
      rotateHintUpdate();
      // don’t force exit fullscreen (user may want it)
    }
  });

  btnShoot?.addEventListener('click', ()=>{
    emit('hha:shoot', { src:'btn', t: Date.now() });
  });

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

    const ovHidden =
      !overlay ||
      overlay.style.display === 'none' ||
      overlay.hidden ||
      overlay.classList.contains('hide');

    if (ovHidden) emit('hha:shoot', { src:'tap', t: Date.now() });
  }, { passive:true });

  // Keyboard support (PC)
  window.addEventListener('keydown', (e)=>{
    const key = (e.key||'').toLowerCase();
    if (key === ' ' || key === 'spacebar' || key === 'enter'){
      const overlayShown = overlay && overlay.style.display !== 'none' && !overlay.classList.contains('hide');
      if (!overlayShown){
        emit('hha:shoot', { src:'key', t: Date.now() });
        e.preventDefault();
      }
    }
    if (key === 'escape'){
      // don’t auto-stop; just a convenience to exit fullscreen
      if (isFullscreen()) exitFullscreen();
    }
  }, { passive:false });

  // keep rotate hint correct
  window.addEventListener('resize', rotateHintUpdate, { passive:true });
  window.addEventListener('orientationchange', rotateHintUpdate, { passive:true });
  DOC.addEventListener('fullscreenchange', rotateHintUpdate, { passive:true });

  // if someone toggles body class externally
  const obs = new MutationObserver(()=>{
    applyHHAViewLayers();
    rotateHintUpdate();
  });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });
}

/* ---------------- Initial view decision ---------------- */
function applyInitialView(){
  const viewParam = String(qs('view','')).toLowerCase();
  const startCb = (viewParam === 'cvr') || (String(qs('cardboard','0')) === '1');

  if (startCb){
    setView('cvr');
    showCardboard(true);
  } else {
    // don’t force auto-start; just pick a reasonable initial view for preview
    setView(isMobileUA() ? 'mobile' : 'pc');
    showCardboard(false);
  }

  applyHHAViewLayers();
  rotateHintUpdate();
}

/* ---------------- Boot ---------------- */
function boot(){
  ensureRotateHintNode();
  applyInitialView();

  hydrateQuickSettingsUI();
  bindQuickSettings();
  bindLauncherButtons();
  bindIngameButtons();

  // load game logic AFTER loader is ready
  import('./hydration.safe.js').catch(console.error);
}

boot();