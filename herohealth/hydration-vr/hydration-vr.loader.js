// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION FINAL
// ✅ Mode select (PC/Mobile/Cardboard) from overlay
// ✅ Remembers choice in localStorage (HHA_HYDRATION_VIEW)
// ✅ Fullscreen + landscape lock for Cardboard (on user gesture)
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

function applyHHAViewLayers(){
  const L = DOC.getElementById('hydration-layerL');
  const R = DOC.getElementById('hydration-layerR');
  const main = DOC.getElementById('hydration-layer');
  const isCb = DOC.body.classList.contains('cardboard');
  window.HHA_VIEW = window.HHA_VIEW || {};
  window.HHA_VIEW.layers = (isCb && L && R) ? ['hydration-layerL','hydration-layerR'] : ['hydration-layer'];
  window.HHA_VIEW._nodes = { main, L, R };
}

function markModeButtons(mode){
  const pc = DOC.getElementById('btnModePC');
  const mb = DOC.getElementById('btnModeMobile');
  const vr = DOC.getElementById('btnModeVR');
  const label = DOC.getElementById('modeLabel');

  pc?.classList.toggle('active', mode==='pc');
  mb?.classList.toggle('active', mode==='mobile');
  vr?.classList.toggle('active', mode==='cvr');

  if (label) label.textContent = (mode==='cvr'?'Cardboard VR': mode==='mobile'?'Mobile':'PC');
}

function applyMode(mode){
  if (mode === 'cvr'){
    setView('cvr');
    showCardboard(true);
  } else if (mode === 'mobile'){
    setView('mobile');
    showCardboard(false);
  } else {
    setView('pc');
    showCardboard(false);
  }
  markModeButtons(mode);
  applyHHAViewLayers();
  try{ localStorage.setItem('HHA_HYDRATION_VIEW', mode); }catch(_){}
}

function resolveInitialMode(){
  const viewParam = String(qs('view','')).toLowerCase();
  const startCb = (viewParam === 'cvr') || (String(qs('cardboard','0')) === '1');
  if (startCb) return 'cvr';

  const saved = (()=>{ try{ return localStorage.getItem('HHA_HYDRATION_VIEW') || ''; }catch(_){ return ''; }})();
  if (saved === 'pc' || saved === 'mobile' || saved === 'cvr') return saved;

  return isMobileUA() ? 'mobile' : 'pc';
}

function bind(){
  const overlay = DOC.getElementById('startOverlay');

  const btnStart = DOC.getElementById('btnStart');
  const btnEnterVR = DOC.getElementById('btnEnterVR');

  const btnModePC = DOC.getElementById('btnModePC');
  const btnModeMobile = DOC.getElementById('btnModeMobile');
  const btnModeVR = DOC.getElementById('btnModeVR');

  const btnCardboard = DOC.getElementById('btnCardboard');
  const btnShoot = DOC.getElementById('btnShoot');
  const btnStop = DOC.getElementById('btnStop');

  let mode = resolveInitialMode();
  let pendingEnterVR = (mode === 'cvr');

  applyMode(mode);

  btnModePC?.addEventListener('click', ()=>{
    mode = 'pc';
    pendingEnterVR = false;
    applyMode(mode);
  });

  btnModeMobile?.addEventListener('click', ()=>{
    mode = 'mobile';
    pendingEnterVR = false;
    applyMode(mode);
  });

  btnModeVR?.addEventListener('click', ()=>{
    mode = 'cvr';
    pendingEnterVR = true; // will do fullscreen on Start
    applyMode(mode);
  });

  // Start (respect selected mode)
  btnStart?.addEventListener('click', async ()=>{
    try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
    if (pendingEnterVR){
      await enterFullscreen();
      await lockLandscape();
    }
    emit('hha:start');
  });

  // Enter VR now (select VR + fullscreen + start)
  btnEnterVR?.addEventListener('click', async ()=>{
    mode = 'cvr';
    pendingEnterVR = true;
    applyMode(mode);

    await enterFullscreen();
    await lockLandscape();

    try{ overlay?.classList.add('hide'); overlay && (overlay.style.display='none'); }catch(_){}
    emit('hha:start');
  });

  // Cardboard toggle (bottom)
  btnCardboard?.addEventListener('click', async ()=>{
    const on = !DOC.body.classList.contains('cardboard');
    if (on){
      mode = 'cvr';
      pendingEnterVR = true;
      applyMode(mode);
      await enterFullscreen();
      await lockLandscape();
    } else {
      mode = isMobileUA() ? 'mobile' : 'pc';
      pendingEnterVR = false;
      applyMode(mode);
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

  // Tap anywhere to shoot (when started)
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

  // keep layers correct
  const obs = new MutationObserver(()=>{ applyHHAViewLayers(); });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });
}

function boot(){
  bind();
  import('./hydration.safe.js').catch(console.error);
}

boot();