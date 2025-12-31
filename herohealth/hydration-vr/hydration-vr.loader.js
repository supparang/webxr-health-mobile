// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ View: PC / Mobile / Cardboard
// ✅ Mode select: เล่นปกติ vs Cardboard (แก้ปัญหา "ไม่มี option")
// ✅ Fullscreen + best-effort landscape lock for Cardboard
// ✅ Emits: hha:start, hha:force_end, hha:shoot
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
  try{
    if (screen?.orientation?.lock) await screen.orientation.lock('landscape');
  }catch(_){}
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

function ensureRotateHintNode(){
  if (DOC.getElementById('rotateHint')) return;
  const wrap = DOC.createElement('div');
  wrap.id = 'rotateHint';
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="card">
      <div class="big">กรุณาหมุนจอเป็นแนวนอน</div>
      <div class="small">เพื่อเล่นโหมด VR / Cardboard 📱↔️</div>
      <div class="actions">
        <button class="hha-btn" id="rhExit">เล่นแบบปกติ</button>
        <button class="hha-btn primary" id="rhEnter">เข้า Cardboard</button>
      </div>
      <div class="tiny">Tip: ถ้าไม่อยากหมุนจอ ให้กด “เล่นแบบปกติ” ได้ทันที</div>
    </div>
  `;
  DOC.body.appendChild(wrap);
}

function rotateHintUpdate(){
  const el = DOC.getElementById('rotateHint');
  if (!el) return;
  const portrait = window.matchMedia && window.matchMedia('(orientation: portrait)').matches;
  const on = DOC.body.classList.contains('cardboard') && portrait;
  el.hidden = !on;
}

async function goCardboard(){
  setView('cvr');
  showCardboard(true);
  applyHHAViewLayers();
  rotateHintUpdate();

  // best effort fs+lock
  await enterFullscreen();
  await lockLandscape();
}
function goNormal(){
  showCardboard(false);
  setView(isMobileUA() ? 'mobile' : 'pc');
  applyHHAViewLayers();
  rotateHintUpdate();
}

function bindRotateHintButtons(){
  const el = DOC.getElementById('rotateHint');
  if (!el) return;
  const rhExit = el.querySelector('#rhExit');
  const rhEnter = el.querySelector('#rhEnter');

  rhExit?.addEventListener('click', ()=>{
    goNormal();
  });

  rhEnter?.addEventListener('click', async ()=>{
    await goCardboard();
  });
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

  // Start (normal)
  btnStart?.addEventListener('click', ()=>{
    try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
    emit('hha:start');
  });

  // Cardboard enter (from overlay)
  btnEnterVR?.addEventListener('click', async ()=>{
    await goCardboard();
    try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
    emit('hha:start');
  });

  // Cardboard toggle (bottom)
  btnCardboard?.addEventListener('click', async ()=>{
    const on = !DOC.body.classList.contains('cardboard');
    if (on) await goCardboard();
    else goNormal();
  });

  // SHOOT (button)
  btnShoot?.addEventListener('click', ()=>{
    emit('hha:shoot', { src:'btn', t: Date.now() });
  });

  // STOP
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

    const ovHidden = !overlay || overlay.style.display === 'none' || overlay.hidden || overlay.classList.contains('hide');
    if (ovHidden) emit('hha:shoot', { src:'tap', t: Date.now() });
  }, { passive:true });

  // keep rotate hint correct
  window.addEventListener('resize', rotateHintUpdate, {passive:true});
  window.addEventListener('orientationchange', rotateHintUpdate);
  DOC.addEventListener('fullscreenchange', rotateHintUpdate);

  // observe class changes (robust)
  const obs = new MutationObserver(()=>{
    applyHHAViewLayers();
    rotateHintUpdate();
  });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });
}

function boot(){
  ensureRotateHintNode();
  bindRotateHintButtons();
  bind();

  // load game logic AFTER loader is ready
  import('./hydration.safe.js').catch(console.error);
}

boot();