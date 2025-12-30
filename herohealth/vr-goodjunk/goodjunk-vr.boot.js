// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard (PRODUCTION)
// ✅ sets view mode (pc/mobile/vr/cvr) + dual-eye handling
// ✅ Enter Fullscreen + "Enter VR" helper
// ✅ FIX: vrHint respects hidden + OK closes correctly
// ✅ SAFE start: engine boots after pressing "เริ่มเล่น"

import { boot as safeBoot } from './goodjunk.safe.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function qs(name, def){
  try{ return (new URL(ROOT.location.href)).searchParams.get(name) ?? def; }
  catch(_){ return def; }
}

function clamp(v,a,b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

function isMobileLike(){
  const w = ROOT.innerWidth || 360;
  const h = ROOT.innerHeight || 640;
  const coarse = (ROOT.matchMedia && ROOT.matchMedia('(pointer: coarse)').matches);
  return coarse || (Math.min(w,h) < 520);
}

function setHidden(el, yes){
  if (!el) return;
  if (yes) el.setAttribute('hidden','');
  else el.removeAttribute('hidden');
}

function setView(mode){
  mode = String(mode||'').toLowerCase();

  DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  if (mode === 'vr') DOC.body.classList.add('view-vr');
  else if (mode === 'cvr') DOC.body.classList.add('view-cvr');
  else if (mode === 'pc') DOC.body.classList.add('view-pc');
  else DOC.body.classList.add('view-mobile');

  // for accessibility
  const eyeR = DOC.getElementById('eyeR');
  if (eyeR){
    const dual = (mode === 'vr' || mode === 'cvr');
    eyeR.setAttribute('aria-hidden', dual ? 'false' : 'true');
  }

  // active pill styling
  const setActive = (id, on)=>{
    const b = DOC.getElementById(id);
    if (!b) return;
    if (on) b.style.background = 'rgba(34,197,94,.18)';
    else b.style.background = 'rgba(2,6,23,.60)';
  };

  setActive('btnViewPC', mode === 'pc');
  setActive('btnViewMobile', mode === 'mobile');
  setActive('btnViewVR', mode === 'vr');
  setActive('btnViewCVR', mode === 'cvr');

  return mode;
}

async function requestFS(){
  const el = DOC.documentElement;
  try{
    if (DOC.fullscreenElement) return;
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI:'hide' });
  }catch(_){}
}

function boot(){
  const btnPC = DOC.getElementById('btnViewPC');
  const btnMobile = DOC.getElementById('btnViewMobile');
  const btnVR = DOC.getElementById('btnViewVR');
  const btnCVR = DOC.getElementById('btnViewCVR');
  const btnFS = DOC.getElementById('btnEnterFS');
  const btnEnterVR = DOC.getElementById('btnEnterVR');

  const hudMeta = DOC.getElementById('hudMeta');
  const startOverlay = DOC.getElementById('startOverlay');
  const startMeta = DOC.getElementById('startMeta');
  const btnStart = DOC.getElementById('btnStart');

  const vrHint = DOC.getElementById('vrHint');
  const btnVrOk = DOC.getElementById('btnVrOk');

  const layerL = DOC.getElementById('gj-layer-l');
  const layerR = DOC.getElementById('gj-layer-r');
  const crossL = DOC.getElementById('gj-crosshair-l');
  const crossR = DOC.getElementById('gj-crosshair-r');
  const shootEl = DOC.getElementById('btnShoot');

  // params
  const diff = String(qs('diff','normal')).toLowerCase();
  const run = String(qs('run', qs('runMode','play'))).toLowerCase(); // play/research
  const timeSec = clamp(Number(qs('time', qs('duration','80'))), 30, 600) | 0;
  const endPolicy = String(qs('end','time')).toLowerCase();         // time/all
  const challenge = String(qs('challenge','rush')).toLowerCase();
  const v = String(qs('v', Date.now()));
  const view = String(qs('view','')).toLowerCase();                 // pc/mobile/vr/cvr

  // default view
  let mode = view;
  if (!mode){
    mode = isMobileLike() ? 'mobile' : 'pc';
  }
  mode = setView(mode);

  // overlays
  setHidden(startOverlay, false);
  setHidden(vrHint, true);

  // meta text
  const dual = (mode === 'vr' || mode === 'cvr');
  const metaText = `[BOOT] ready · dual=${dual} · diff=${diff} · run=${run} · t=${timeSec}s · v=${v}`;
  if (hudMeta) hudMeta.textContent = metaText;
  if (startMeta) startMeta.textContent = metaText;

  // view switching
  btnPC && btnPC.addEventListener('click', ()=>{
    mode = setView('pc');
    const dualNow = false;
    if (hudMeta) hudMeta.textContent = `[BOOT] ready · dual=${dualNow} · diff=${diff} · run=${run} · t=${timeSec}s · v=${v}`;
  });

  btnMobile && btnMobile.addEventListener('click', ()=>{
    mode = setView('mobile');
    const dualNow = false;
    if (hudMeta) hudMeta.textContent = `[BOOT] ready · dual=${dualNow} · diff=${diff} · run=${run} · t=${timeSec}s · v=${v}`;
  });

  btnVR && btnVR.addEventListener('click', ()=>{
    mode = setView('vr');
    setHidden(vrHint, false); // show hint
    if (hudMeta) hudMeta.textContent = `[BOOT] ready · dual=true · diff=${diff} · run=${run} · t=${timeSec}s · v=${v}`;
  });

  btnCVR && btnCVR.addEventListener('click', ()=>{
    mode = setView('cvr');
    setHidden(vrHint, false);
    if (hudMeta) hudMeta.textContent = `[BOOT] ready · dual=true · diff=${diff} · run=${run} · t=${timeSec}s · v=${v}`;
  });

  // fullscreen
  btnFS && btnFS.addEventListener('click', async ()=>{
    await requestFS();
  });

  // enter VR helper (for this DOM game: we treat as VR/cVR layout + fullscreen)
  btnEnterVR && btnEnterVR.addEventListener('click', async ()=>{
    if (mode !== 'vr' && mode !== 'cvr'){
      mode = setView('vr');
      setHidden(vrHint, false);
    }
    await requestFS();
  });

  // VR hint OK
  btnVrOk && btnVrOk.addEventListener('click', ()=>{
    setHidden(vrHint, true);
  });

  let started = false;

  function startGame(){
    if (started) return;
    started = true;

    setHidden(startOverlay, true);

    const dualNow = (DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr'));
    if (hudMeta) hudMeta.textContent = `[BOOT] running · dual=${dualNow} · v=${v}`;

    // context (for logger)
    const ctx = {
      projectTag: String(qs('projectTag','HeroHealth'))
    };

    // start engine
    safeBoot({
      layerEl: layerL,
      layerElR: dualNow ? layerR : null,
      crosshairEl: crossL,
      crosshairElR: dualNow ? crossR : null,
      shootEl,

      diff,
      run,                 // play/research
      time: timeSec,
      endPolicy,
      challenge,
      context: ctx,

      // safeMargins optional; engine also avoids HUD by rects
      safeMargins: { top: 110, bottom: 150, left: 14, right: 14 }
    });
  }

  btnStart && btnStart.addEventListener('click', startGame);

  // also allow tap anywhere to start (nice on mobile)
  startOverlay && startOverlay.addEventListener('click', (e)=>{
    const t = e.target;
    if (t && (t.id === 'btnStart')) return;
    // tap on overlay background -> start
    startGame();
  });

  // keyboard start
  DOC.addEventListener('keydown', (e)=>{
    if (started) return;
    const k = String(e.key||'').toLowerCase();
    if (k === 'enter' || k === ' ' || k === 'spacebar'){
      e.preventDefault?.();
      startGame();
    }
  });
}

if (DOC && DOC.readyState !== 'loading') boot();
else DOC.addEventListener('DOMContentLoaded', boot);