// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (PATCH v3)
// ✅ View: PC / Mobile / Cardboard (cVR)
// ✅ Fullscreen + best-effort landscape lock
// ✅ STRICT landscape in Cardboard: portrait => show rotateHint + optionally force-exit VR
// ✅ Emits: hha:start, hha:force_end, hha:shoot
// ✅ Sets window.HHA_VIEW.layers so hydration.safe.js spawns correctly
// ✅ Adds body classes: portrait / landscape (for CSS rules)

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

function isPortrait(){
  try{
    return window.matchMedia && window.matchMedia('(orientation: portrait)').matches;
  }catch(_){
    return (window.innerHeight > window.innerWidth);
  }
}
function syncOrientationClasses(){
  const p = isPortrait();
  DOC.body.classList.toggle('portrait', p);
  DOC.body.classList.toggle('landscape', !p);
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

/* -------- STRICT landscape behavior --------
   - If in Cardboard + portrait: show rotateHint
   - Optional: auto-retry lockLandscape
   - Optional: if user stays portrait too long, exit cardboard (prevent weird VR)
*/
let portraitWarnAt = 0;
async function enforceLandscapeTick(){
  syncOrientationClasses();
  rotateHintUpdate();

  const inCb = DOC.body.classList.contains('cardboard');
  if (!inCb) { portraitWarnAt = 0; return; }

  if (isPortrait()){
    // keep trying to lock on Android/Chromium
    if (isFullscreen()) await lockLandscape();

    if (!portraitWarnAt) portraitWarnAt = performance.now();
    const waited = performance.now() - portraitWarnAt;

    // If portrait persists, we keep hint. (Do NOT force exit too aggressively.)
    // If you want "hard force", uncomment below:
    // if (waited > 6000){
    //   showCardboard(false);
    //   setView(isMobileUA() ? 'mobile' : 'pc');
    //   applyHHAViewLayers();
    //   rotateHintUpdate();
    // }
  } else {
    portraitWarnAt = 0;
  }
}

function ensureRotateHintNode(){
  if (DOC.getElementById('rotateHint')) return;
  const el = DOC.createElement('div');
  el.id = 'rotateHint';
  el.hidden = true;
  el.className = 'hha-rotateHint';
  el.innerHTML = `
    <div class="card">
      <div class="big">กรุณาหมุนเครื่องเป็น “แนวนอน” เพื่อเล่นโหมด VR 📱↔️</div>
      <div class="small">Tip: กด Fullscreen แล้วค่อยหมุน • บางรุ่นต้องปิด “ล็อกหมุนจอ” ก่อน</div>
    </div>
  `;
  DOC.body.appendChild(el);
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

  // orientation classes + hint
  syncOrientationClasses();
  rotateHintUpdate();

  // Start
  btnStart?.addEventListener('click', async ()=>{
    try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
    emit('hha:start');
  });

  // Enter Cardboard (from overlay)
  btnEnterVR?.addEventListener('click', async ()=>{
    setView('cvr');
    showCardboard(true);
    applyHHAViewLayers();

    await enterFullscreen();
    await lockLandscape();
    await enforceLandscapeTick();

    try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
    emit('hha:start');
  });

  // Toggle Cardboard (bottom)
  btnCardboard?.addEventListener('click', async ()=>{
    const on = !DOC.body.classList.contains('cardboard');
    if (on){
      setView('cvr');
      showCardboard(true);
      applyHHAViewLayers();

      await enterFullscreen();
      await lockLandscape();
      await enforceLandscapeTick();
    } else {
      showCardboard(false);
      setView(isMobileUA() ? 'mobile' : 'pc');
      applyHHAViewLayers();

      // keep fullscreen if user wants (no force exit)
      syncOrientationClasses();
      rotateHintUpdate();
    }
  });

  // SHOOT button -> fire center shot
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
    const t = ev.target;
    if (t && (t.closest?.('.hha-btn') || t.id === 'btnShoot')) return;

    const now = performance.now();
    if (now - lastTap < 80) return;
    lastTap = now;

    // only when overlay hidden
    const ovHidden = !overlay || overlay.style.display === 'none' || overlay.hidden || overlay.classList.contains('hide');
    if (ovHidden) emit('hha:shoot', { src:'tap', t: Date.now() });
  }, { passive:true });

  // keep hint correct (and keep trying to lock landscape)
  const onResize = ()=>{ enforceLandscapeTick().catch(()=>{}); };
  window.addEventListener('resize', onResize, { passive:true });
  window.addEventListener('orientationchange', onResize, { passive:true });
  DOC.addEventListener('fullscreenchange', onResize);

  // observe body class changes
  const obs = new MutationObserver(()=>{
    applyHHAViewLayers();
    enforceLandscapeTick().catch(()=>{});
  });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });

  // periodic tick while in cardboard (helps on Android where lock is flaky)
  setInterval(()=>{ enforceLandscapeTick().catch(()=>{}); }, 700);
}

function boot(){
  ensureRotateHintNode();
  bind();

  // load game logic AFTER loader is ready
  import('./hydration.safe.js').catch(console.error);
}

boot();