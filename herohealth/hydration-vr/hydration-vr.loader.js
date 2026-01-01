// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (v2)
// ✅ View: PC / Mobile / Cardboard
// ✅ NEW: Mode chooser (PC/Mobile/VR Cardboard) in overlay (cards)
// ✅ Fullscreen + best-effort landscape lock for Cardboard
// ✅ Emits: hha:start, hha:force_end, hha:shoot
// ✅ Sets window.HHA_VIEW.layers so hydration.safe.js spawns correctly
// ✅ Works when launched from HUB (query params already set)

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
  // works best after a user gesture + fullscreen (Android)
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
  // ensure hydration.safe.js sees the correct layers
  const L = DOC.getElementById('hydration-layerL');
  const R = DOC.getElementById('hydration-layerR');
  const main = DOC.getElementById('hydration-layer');
  const isCb = DOC.body.classList.contains('cardboard');

  window.HHA_VIEW = window.HHA_VIEW || {};
  window.HHA_VIEW.layers = (isCb && L && R)
    ? ['hydration-layerL','hydration-layerR']
    : ['hydration-layer'];

  // keep refs for debug
  window.HHA_VIEW._nodes = { main, L, R };
}

/* ---------------- Mode chooser UI injection (safe) ---------------- */
function ensureModeChooser(){
  const overlay = DOC.getElementById('startOverlay');
  if (!overlay) return;

  // already injected?
  if (overlay.querySelector('[data-hha-modegrid="1"]')) return;

  const card = overlay.querySelector('.hha-overlay-card') || overlay.firstElementChild;
  if (!card) return;

  // Create mode section
  const title = DOC.createElement('div');
  title.className = 'hha-modeTitle';
  title.textContent = 'เลือกโหมดการเล่น';

  const grid = DOC.createElement('div');
  grid.className = 'hha-modeGrid';
  grid.setAttribute('data-hha-modegrid','1');

  function mkCard(mode, ico, t, d, isVr=false){
    const b = DOC.createElement('button');
    b.type = 'button';
    b.className = 'hha-modeCard' + (isVr ? ' vr' : '');
    b.dataset.mode = mode;
    b.innerHTML = `
      <div class="ico">${ico}</div>
      <div class="t">${t}</div>
      <div class="d">${d}</div>
    `;
    return b;
  }

  const cPC = mkCard(
    'pc','🖥️','PC / Laptop',
    'คลิก/แตะที่เป้าเพื่อยิง • จอปกติ • เหมาะสอนในห้อง',
    false
  );
  const cMB = mkCard(
    'mobile','📱','Mobile',
    'แตะที่เป้า/แตะจอเพื่อยิง • เล่นแนวตั้งได้',
    false
  );
  const cVR = mkCard(
    'cvr','📦','VR Cardboard',
    'จอแยก 2 ตา • แนะนำแนวนอน • เข้าเต็มจอ + พยายามล็อกแนวนอน',
    true
  );

  grid.appendChild(cPC);
  grid.appendChild(cMB);
  grid.appendChild(cVR);

  // Insert before action buttons (so it's prominent)
  const actions = card.querySelector('.hha-overlay-actions');
  if (actions) card.insertBefore(grid, actions);
  card.insertBefore(title, grid);
}

/* ---------------- Helpers ---------------- */
function hideOverlay(){
  const overlay = DOC.getElementById('startOverlay');
  try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
}

async function enterCardboardFlow(){
  setView('cvr');
  showCardboard(true);
  applyHHAViewLayers();
  rotateHintUpdate();

  // user gesture required for fullscreen/lock
  await enterFullscreen();
  await lockLandscape();

  hideOverlay();
  emit('hha:start');
}

function enterNormalFlow(forceView=null){
  const v = forceView || (isMobileUA() ? 'mobile' : 'pc');
  setView(v);
  showCardboard(false);
  applyHHAViewLayers();
  rotateHintUpdate();

  hideOverlay();
  emit('hha:start');
}

function bind(){
  const btnStart = DOC.getElementById('btnStart');
  const btnEnterVR = DOC.getElementById('btnEnterVR');
  const btnCardboard = DOC.getElementById('btnCardboard');
  const btnShoot = DOC.getElementById('btnShoot');
  const btnStop = DOC.getElementById('btnStop');
  const overlay = DOC.getElementById('startOverlay');

  // inject mode chooser cards
  ensureModeChooser();

  // initial view (respect query)
  const viewParam = String(qs('view','')).toLowerCase();
  const startCb = (viewParam === 'cvr') || (String(qs('cardboard','0')) === '1');
  const view = startCb ? 'cvr' : (isMobileUA() ? 'mobile' : 'pc');

  setView(view);
  showCardboard(startCb);
  applyHHAViewLayers();
  rotateHintUpdate();

  // click mode cards (event delegation)
  overlay?.addEventListener('click', async (ev)=>{
    const t = ev.target;
    const card = t?.closest?.('.hha-modeCard');
    if (!card) return;
    const mode = String(card.dataset.mode||'').toLowerCase();
    if (mode === 'cvr') await enterCardboardFlow();
    else if (mode === 'mobile') enterNormalFlow('mobile');
    else enterNormalFlow('pc');
  });

  // Start (simple)
  btnStart?.addEventListener('click', async ()=>{
    // If user is already in cardboard, honor it
    const isCb = DOC.body.classList.contains('cardboard');
    if (isCb) await enterCardboardFlow();
    else enterNormalFlow(null);
  });

  // Cardboard enter (from overlay)
  btnEnterVR?.addEventListener('click', async ()=>{
    await enterCardboardFlow();
  });

  // Cardboard toggle (bottom)
  btnCardboard?.addEventListener('click', async ()=>{
    const on = !DOC.body.classList.contains('cardboard');
    if (on){
      await enterCardboardFlow();
    } else {
      // back to normal view (do NOT force exit fullscreen)
      showCardboard(false);
      setView(isMobileUA() ? 'mobile' : 'pc');
      applyHHAViewLayers();
      rotateHintUpdate();
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

  // Tap anywhere to shoot (mobile convenience)
  let lastTap=0;
  DOC.addEventListener('pointerdown', (ev)=>{
    // ignore taps on buttons / overlay cards
    const t = ev.target;
    if (t && (t.closest?.('.hha-btn') || t.closest?.('.hha-modeCard'))) return;

    const now = performance.now();
    if (now - lastTap < 80) return;
    lastTap = now;

    // only when game started (overlay hidden)
    const ovHidden = !overlay || overlay.style.display === 'none' || overlay.hidden || overlay.classList.contains('hide');
    if (ovHidden) emit('hha:shoot', { src:'tap', t: Date.now() });
  }, { passive:true });

  // rotate hint
  window.addEventListener('resize', rotateHintUpdate, {passive:true});
  window.addEventListener('orientationchange', rotateHintUpdate);
  DOC.addEventListener('fullscreenchange', rotateHintUpdate);

  // keep layers correct
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
  el.className = 'hha-rotateHint';
  el.innerHTML = `
    <div class="card">
      <div class="big">กรุณาหมุนเครื่องเป็นแนวนอน (Landscape) 📱↔️</div>
      <div class="small">โหมด VR Cardboard ต้องเล่นแนวนอนเพื่อแยก 2 ตา</div>
    </div>
  `;
  DOC.body.appendChild(el);
}

function boot(){
  ensureRotateHintNode();
  bind();

  // load game logic AFTER loader is ready
  import('./hydrration.safe.js'); // safety wrong? -> we will not do this mistake

  // NOTE: correct module path:
  import('./hydration.safe.js').catch(console.error);
}

boot();