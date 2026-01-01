// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION v2 (Launcher + cVR aim shoot)
// ✅ Launcher: choose PC / Mobile / VR Cardboard
// ✅ Fullscreen + best-effort landscape lock for Cardboard
// ✅ Emits: hha:start, hha:force_end, hha:shoot
// ✅ Sets window.HHA_VIEW.layers so hydration.safe.js spawns correctly
// ✅ Rotate hint overlay if Cardboard but portrait
// ✅ In cVR, shoot uses center aim (crosshair) so user can "tap to shoot" reliably

'use strict';

const DOC = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function setQS(k, v){
  try{
    const u = new URL(location.href);
    if (v == null) u.searchParams.delete(k);
    else u.searchParams.set(k, String(v));
    history.replaceState(null, '', u.toString());
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
    return !!(window.matchMedia && window.matchMedia('(orientation: portrait)').matches);
  }catch(_){ return false; }
}

function ensureRotateHintNode(){
  // loader also works if CSS has .hha-rotateHint, but we keep this as hard fallback
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

function overlayHide(){
  const overlay = DOC.getElementById('startOverlay');
  try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
}
function overlayShow(){
  const overlay = DOC.getElementById('startOverlay');
  try{
    overlay?.classList.remove('hide');
    overlay && (overlay.style.display='flex');
  }catch(_){}
}

function getOverlayHidden(){
  const overlay = DOC.getElementById('startOverlay');
  if (!overlay) return true;
  try{
    return overlay.style.display === 'none' || overlay.hidden || overlay.classList.contains('hide');
  }catch(_){ return false; }
}

/* ---------------- Launcher labels (optional) ----------------
   We can reuse existing buttons:
   - #btnStart     => "PC / Desktop"
   - #btnEnterVR   => "VR Cardboard"
   And we add (optional) #btnStartMobile if not exists.
*/
function ensureMobileStartButton(){
  const actions = DOC.querySelector('.hha-overlay-actions');
  if (!actions) return null;
  let b = DOC.getElementById('btnStartMobile');
  if (b) return b;
  b = DOC.createElement('button');
  b.id = 'btnStartMobile';
  b.className = 'hha-btn';
  b.textContent = '📱 เล่นบนมือถือ';
  actions.insertBefore(b, actions.firstChild?.nextSibling || null);
  return b;
}

function setLauncherText(){
  // Make launcher clearly "choose mode"
  const title = DOC.querySelector('#startOverlay .hha-title');
  const sub = DOC.querySelector('#startOverlay .hha-sub');
  const hint = DOC.querySelector('#startOverlay .hha-hint');
  const btnStart = DOC.getElementById('btnStart');
  const btnEnterVR = DOC.getElementById('btnEnterVR');
  const btnMobile = ensureMobileStartButton();

  if (title) title.textContent = 'Hydration VR 💧 — เลือกโหมดเล่น';
  if (sub) sub.innerHTML =
    'เป้าหมาย: คุม WATER ให้เข้าโซน <b>GREEN</b> และเก็บ 🛡️ ไว้ <b>BLOCK</b> ตอนท้ายพายุ <br>' +
    '<span class="muted">แนะนำ: มือถือใช้ “แตะจอยิง” • Cardboard ใช้ “เล็งกลางจอแล้วแตะยิง”</span>';

  if (btnStart) btnStart.textContent = '🖥 เล่นบนคอม/จอใหญ่';
  if (btnMobile) btnMobile.textContent = '📱 เล่นบนมือถือ';
  if (btnEnterVR) btnEnterVR.textContent = '🕶 VR Cardboard';

  if (hint) hint.textContent = 'Tip: โหมด VR ต้องหมุนจอ “แนวนอน” ก่อน (Landscape)';
}

function setBottomButtonsVisibility(){
  // bottom buttons exist for convenience in mobile/cvr
  const view = DOC.body.classList.contains('cardboard') ? 'cvr'
            : DOC.body.classList.contains('view-mobile') ? 'mobile'
            : 'pc';
  const bottom = DOC.getElementById('hudBtns');
  if (!bottom) return;
  bottom.style.display = (view === 'pc') ? 'flex' : 'flex';
}

function setMode(mode){
  // mode: 'pc' | 'mobile' | 'cvr'
  if (mode === 'cvr'){
    setView('cvr');
    showCardboard(true);
    setQS('view', 'cvr');
  } else if (mode === 'mobile'){
    setView('mobile');
    showCardboard(false);
    setQS('view', 'mobile');
  } else {
    setView('pc');
    showCardboard(false);
    setQS('view', 'pc');
  }
  applyHHAViewLayers();
  rotateHintUpdate();
  setBottomButtonsVisibility();
}

async function enterCardboardFlow(){
  setMode('cvr');
  // gesture -> fullscreen/lock landscape best effort
  await enterFullscreen();
  await lockLandscape();
  rotateHintUpdate();
}

function bind(){
  ensureRotateHintNode();
  setLauncherText();

  const btnPC = DOC.getElementById('btnStart');
  const btnVR = DOC.getElementById('btnEnterVR');
  const btnMobile = ensureMobileStartButton();

  const btnCardboard = DOC.getElementById('btnCardboard');
  const btnShoot = DOC.getElementById('btnShoot');
  const btnStop = DOC.getElementById('btnStop');

  // Decide initial mode BUT DO NOT auto-start game.
  // If query says view=cvr/mobile/pc => set mode, still show launcher.
  // If query says cardboard=1 => set cvr mode, still show launcher.
  const viewParam = String(qs('view','')).toLowerCase();
  const startCb = (viewParam === 'cvr') || (String(qs('cardboard','0')) === '1');
  const startMobile = (viewParam === 'mobile');
  const startPC = (viewParam === 'pc');

  if (startCb) setMode('cvr');
  else if (startMobile) setMode('mobile');
  else if (startPC) setMode('pc');
  else {
    // default based on UA (BUT still show launcher)
    setMode(isMobileUA() ? 'mobile' : 'pc');
  }

  // Make sure launcher is visible on load (fix "from HUB open comes to this page")
  overlayShow();

  // --- Launcher buttons ---
  btnPC?.addEventListener('click', async ()=>{
    setMode('pc');
    overlayHide();
    emit('hha:start');
  });

  btnMobile?.addEventListener('click', async ()=>{
    setMode('mobile');
    overlayHide();
    emit('hha:start');
  });

  btnVR?.addEventListener('click', async ()=>{
    await enterCardboardFlow();
    overlayHide();
    emit('hha:start');
  });

  // --- Bottom toggle to cardboard (during play) ---
  btnCardboard?.addEventListener('click', async ()=>{
    const on = !DOC.body.classList.contains('cardboard');
    if (on){
      await enterCardboardFlow();
    } else {
      // back to non-cardboard view, keep fullscreen if user wants
      showCardboard(false);
      setView(isMobileUA() ? 'mobile' : 'pc');
      setQS('view', isMobileUA() ? 'mobile' : 'pc');
      applyHHAViewLayers();
      rotateHintUpdate();
    }
  });

  // --- SHOOT (button) ---
  btnShoot?.addEventListener('click', ()=>{
    // In cVR, use center aim for deterministic shooting
    const isCb = DOC.body.classList.contains('cardboard');
    emit('hha:shoot', isCb ? { src:'btn', aim:{ x:0.5, y:0.5 }, t: Date.now() } : { src:'btn', t: Date.now() });
  });

  // --- STOP (end game) ---
  btnStop?.addEventListener('click', ()=>{
    emit('hha:force_end', { reason:'stop' });
  });

  // Tap anywhere to shoot (mobile/cvr convenience)
  let lastTap=0;
  DOC.addEventListener('pointerdown', (ev)=>{
    // ignore taps on buttons
    const t = ev.target;
    if (t && (t.closest?.('.hha-btn') || t.id === 'btnShoot')) return;

    const now = performance.now();
    if (now - lastTap < 80) return;
    lastTap = now;

    // only when game started (overlay hidden)
    if (!getOverlayHidden()) return;

    const isCb = DOC.body.classList.contains('cardboard');
    emit('hha:shoot', isCb ? { src:'tap', aim:{ x:0.5, y:0.5 }, t: Date.now() } : { src:'tap', t: Date.now() });
  }, { passive:true });

  // rotate hint
  window.addEventListener('resize', rotateHintUpdate, {passive:true});
  window.addEventListener('orientationchange', rotateHintUpdate);
  DOC.addEventListener('fullscreenchange', rotateHintUpdate);

  // layers correct even if class toggled
  const obs = new MutationObserver(()=>{
    applyHHAViewLayers();
    rotateHintUpdate();
  });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });

  // keep layers correct at start
  applyHHAViewLayers();
  rotateHintUpdate();
}

function boot(){
  bind();

  // load game logic AFTER loader is ready
  // hydration.safe.js is module, so import it here
  import('./hydration.safe.js').catch(console.error);
}

boot();