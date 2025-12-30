// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (v4)
// ✅ Start GATE: engine starts ONLY after pressing "เริ่มเล่น" (fix targets flash behind overlay)
// ✅ Overlay-safe: body.booting / body.overlay-open
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
}

function isFs(){
  return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
}
async function enterFs(){
  try{
    const el = DOC.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  }catch(_){}
}
function syncFsClass(){
  DOC.body.classList.toggle('is-fs', isFs());
}

function syncMeta(){
  const hudMeta = DOC.getElementById('hudMeta');
  const startMeta = DOC.getElementById('startMeta');
  const dual = !!DOC.getElementById('gj-layer-r');
  const v = String(qs('view','') || '');
  const diff = String(qs('diff','normal'));
  const run  = String(qs('run','play'));
  const time = String(qs('time', qs('duration','80')));
  const end  = String(qs('end','miss'));
  const challenge = String(qs('challenge','hell'));
  const txt = `[READY] dual=${dual} • view=${v||'-'} • diff=${diff} • run=${run} • time=${time}s • end=${end} • challenge=${challenge}`;
  if (hudMeta) hudMeta.textContent = txt;
  if (startMeta) startMeta.textContent = txt;
}

function setOverlayOpen(on){
  DOC.body.classList.toggle('overlay-open', !!on);
}

function hookViewButtons(){
  const btnPC = DOC.getElementById('btnViewPC');
  const btnM  = DOC.getElementById('btnViewMobile');
  const btnV  = DOC.getElementById('btnViewVR');
  const btnC  = DOC.getElementById('btnViewCVR');
  const btnFS = DOC.getElementById('btnEnterFS');
  const btnVR = DOC.getElementById('btnEnterVR');

  const vrHint = DOC.getElementById('vrHint');
  const vrOk   = DOC.getElementById('btnVrOk');

  function showVrHint(){
    if (!vrHint) return;
    vrHint.hidden = false;
    setOverlayOpen(true);
  }
  function hideVrHint(){
    if (!vrHint) return;
    vrHint.hidden = true;
    setOverlayOpen(false);
  }

  btnPC && btnPC.addEventListener('click', ()=>{ setBodyView('pc'); hideVrHint(); });
  btnM  && btnM.addEventListener('click',  ()=>{ setBodyView('mobile'); hideVrHint(); });
  btnV  && btnV.addEventListener('click',  ()=>{ setBodyView('vr'); showVrHint(); });
  btnC  && btnC.addEventListener('click',  ()=>{ setBodyView('cvr'); showVrHint(); });

  vrOk && vrOk.addEventListener('click', ()=> hideVrHint());

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });

  // optional placeholder
  btnVR && btnVR.addEventListener('click', ()=>{
    // reserved for future WebXR/A-Frame enter-vr hook
  });
}

function pickInitialView(){
  const v = String(qs('view','') || '').toLowerCase();
  if (v === 'vr') return 'vr';
  if (v === 'cvr') return 'cvr';

  const coarse = matchMedia && matchMedia('(pointer: coarse)').matches;
  const w = innerWidth || 360;
  const h = innerHeight || 640;
  const mobileLike = coarse || Math.min(w,h) < 520;
  return mobileLike ? 'mobile' : 'pc';
}

function bootEngine(){
  const layerL = DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  const crossL = DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair');
  const crossR = DOC.getElementById('gj-crosshair-r');

  const shootEl = DOC.getElementById('btnShoot');

  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = Number(qs('time', qs('duration','80'))) || 80;

  const endPolicy = qs('end','miss');            // time | all | miss
  const challenge = qs('challenge','hell');      // hell | hardpp | rush | etc

  engineBoot({
    layerEl: layerL,
    layerElR: layerR,
    crosshairEl: crossL,
    crosshairElR: crossR,
    shootEl,
    diff,
    run,
    time,
    endPolicy,
    challenge,
    context: {
      projectTag: qs('projectTag','HeroHealth')
    }
  });
}

function gateStartOverlay(){
  const startOverlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  if (!startOverlay || !btnStart) return;

  // show overlay + hard-hide playfield until start
  DOC.body.classList.add('booting');
  setOverlayOpen(true);
  startOverlay.hidden = false;

  let started = false;
  btnStart.addEventListener('click', ()=>{
    if (started) return;
    started = true;

    // close overlay
    startOverlay.hidden = true;
    setOverlayOpen(false);
    DOC.body.classList.remove('booting');

    // start engine now
    bootEngine();
  }, { passive:true });

  // optional autostart for debugging
  const autostart = String(qs('autostart','0')) === '1';
  if (autostart){
    setTimeout(()=> btnStart.click(), 120);
  }
}

function main(){
  hookViewButtons();
  setBodyView(pickInitialView());
  syncMeta();
  syncFsClass();

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  // gate start (fix target flash)
  gateStartOverlay();
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();