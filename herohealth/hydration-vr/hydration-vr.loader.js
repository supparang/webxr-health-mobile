// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (v2: Mode Picker)
// ✅ View: PC / Mobile / Cardboard
// ✅ Fullscreen + best-effort landscape lock for Cardboard
// ✅ Overlay has explicit mode selection (PC/Mobile/Cardboard)
// ✅ Emits: hha:start, hha:force_end, hha:shoot
// ✅ Sets window.HHA_VIEW.layers so hydration.safe.js spawns correctly
// ✅ Rotate hint overlay when Cardboard + portrait

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
    if (window.matchMedia) return window.matchMedia('(orientation: portrait)').matches;
  }catch(_){}
  return false;
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
  el.className = 'hha-rotateHint';
  el.innerHTML = `
    <div class="card">
      <div class="big">หมุนเครื่องเป็นแนวนอน (Landscape) 📱↔️</div>
      <div class="small">โหมด Cardboard ต้องใช้แนวนอนเพื่อให้ภาพซ้าย–ขวาถูกต้อง</div>
    </div>
  `;
  DOC.body.appendChild(el);
}

function ensureModePicker(){
  const overlay = DOC.getElementById('startOverlay');
  if (!overlay) return;

  // If already exists, skip
  if (overlay.querySelector('.hha-modePicker')) return;

  const card = overlay.querySelector('.hha-overlay-card');
  if (!card) return;

  const view = (DOC.body.classList.contains('cardboard'))
    ? 'cvr'
    : (isMobileUA() ? 'mobile' : 'pc');

  const mp = DOC.createElement('div');
  mp.className = 'hha-modePicker';
  mp.innerHTML = `
    <div class="mp-title">เลือกโหมดเล่น</div>
    <div class="mp-grid">
      <button class="mp-card ${view==='pc'?'primary':''}" data-mode="pc" type="button">
        <div class="mp-top"><span class="mp-ico">🖥️</span><span>PC / Laptop</span></div>
        <div class="mp-desc">เล่นบนจอปกติ • คลิกเป้าเพื่อยิง</div>
      </button>
      <button class="mp-card ${view==='mobile'?'primary':''}" data-mode="mobile" type="button">
        <div class="mp-top"><span class="mp-ico">📱</span><span>Mobile</span></div>
        <div class="mp-desc">แตะจอเพื่อยิง • ปุ่ม SHOOT ช่วยยิง</div>
      </button>
      <button class="mp-card ${view==='cvr'?'primary':''}" data-mode="cvr" type="button">
        <div class="mp-top"><span class="mp-ico">📦</span><span>VR Cardboard</span></div>
        <div class="mp-desc">จอแยกซ้าย–ขวา • ต้อง “แนวนอน”</div>
      </button>
    </div>
    <div class="mp-mini">Tip: ถ้าเข้าจาก HUB แล้วงง ให้กดเลือกโหมดก่อนเริ่มเล่น 👆</div>
  `;

  // Insert BEFORE existing action buttons (or at end)
  const actions = card.querySelector('.hha-overlay-actions');
  if (actions) card.insertBefore(mp, actions);
  else card.appendChild(mp);
}

async function enterCardboardFlow({ autostart=true }={}){
  setView('cvr');
  showCardboard(true);
  applyHHAViewLayers();
  rotateHintUpdate();

  await enterFullscreen();
  await lockLandscape();
  rotateHintUpdate();

  const overlay = DOC.getElementById('startOverlay');
  if (autostart){
    try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
    emit('hha:start');
  }
}

function enterPCFlow(){
  showCardboard(false);
  setView('pc');
  applyHHAViewLayers();
  rotateHintUpdate();
}

function enterMobileFlow(){
  showCardboard(false);
  setView('mobile');
  applyHHAViewLayers();
  rotateHintUpdate();
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

  // ensure picker exists
  ensureModePicker();

  // Mode Picker click
  overlay?.addEventListener('click', async (ev)=>{
    const btn = ev.target?.closest?.('.mp-card');
    if (!btn) return;
    const mode = String(btn.getAttribute('data-mode')||'').toLowerCase();
    if (mode === 'cvr') await enterCardboardFlow({ autostart:false });
    else if (mode === 'mobile') enterMobileFlow();
    else enterPCFlow();
  }, { passive:true });

  // Start
  btnStart?.addEventListener('click', async ()=>{
    try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
    emit('hha:start');
  });

  // Cardboard enter (from overlay)
  btnEnterVR?.addEventListener('click', async ()=>{
    await enterCardboardFlow({ autostart:true });
  });

  // Cardboard toggle (bottom)
  btnCardboard?.addEventListener('click', async ()=>{
    const on = !DOC.body.classList.contains('cardboard');
    if (on){
      await enterCardboardFlow({ autostart:false });
    } else {
      showCardboard(false);
      setView(isMobileUA() ? 'mobile' : 'pc');
      applyHHAViewLayers();
      rotateHintUpdate();
      // keep fullscreen if user wants
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

  // Tap anywhere to shoot (after start)
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

  // rotate hint updates
  window.addEventListener('resize', rotateHintUpdate, {passive:true});
  window.addEventListener('orientationchange', rotateHintUpdate);
  DOC.addEventListener('fullscreenchange', rotateHintUpdate);

  // keep layers correct if classes change
  const obs = new MutationObserver(()=>{
    applyHHAViewLayers();
    rotateHintUpdate();
  });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });
}

function boot(){
  ensureRotateHintNode();
  bind();

  // load game logic AFTER loader is ready
  // hydration.safe.js is module, so import it here
  import('./hydration.safe.js').catch(console.error);
}

boot();