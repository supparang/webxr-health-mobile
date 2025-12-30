// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (DOM Engine)
// ✅ Boot gate: starts engine AFTER pressing "เริ่มเล่น" (fix "flash then gone")
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Enter VR = Fullscreen + cVR + try lock landscape + show hint
// ✅ Fullscreen handling + body.is-fs
// ✅ Meta + start meta

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

async function lockLandscape(){
  try{
    if (screen?.orientation?.lock) await screen.orientation.lock('landscape');
  }catch(_){}
}

function mobileLike(){
  const w = ROOT.innerWidth || 360;
  const h = ROOT.innerHeight || 640;
  const coarse = (ROOT.matchMedia && ROOT.matchMedia('(pointer: coarse)').matches);
  return coarse || (Math.min(w,h) < 520);
}

function pickInitialView(){
  const v = String(qs('view','') || '').toLowerCase();
  if (v === 'vr') return 'vr';
  if (v === 'cvr') return 'cvr';
  return mobileLike() ? 'mobile' : 'pc';
}

function syncMeta(){
  const hudMeta = DOC.getElementById('hudMeta');
  if (!hudMeta) return;
  const dual = !!DOC.getElementById('gj-layer-r');
  const v = qs('v','');
  const diff = qs('diff','normal');
  const run  = qs('run', qs('runMode','play')) || 'play';
  const time = qs('time', qs('duration','70'));
  hudMeta.textContent = `diff=${diff} • run=${run} • time=${time}s • dual=${dual}${v?` • v=${v}`:''}`;
}

function syncStartMeta(){
  const el = DOC.getElementById('startMeta');
  if (!el) return;
  const diff = qs('diff','normal');
  const run  = qs('run', qs('runMode','play')) || 'play';
  const time = qs('time', qs('duration','70'));
  const end  = qs('end','time');
  el.textContent = `โหมด: ${run} • ระดับ: ${diff} • เวลา: ${time}s • end=${end}`;
}

function showStartOverlay(){
  const ov = DOC.getElementById('startOverlay');
  if (!ov) return;
  ov.hidden = false;
  // make sure it renders even if CSS toggles display
  ov.style.display = 'flex';
}

function hideStartOverlay(){
  const ov = DOC.getElementById('startOverlay');
  if (!ov) return;
  ov.hidden = true;
  ov.style.display = 'none';
}

function showVrHint(){
  const vrHint = DOC.getElementById('vrHint');
  if (!vrHint) return;
  vrHint.hidden = false;
}
function hideVrHint(){
  const vrHint = DOC.getElementById('vrHint');
  if (!vrHint) return;
  vrHint.hidden = true;
}

function getSafeMargins(){
  // IMPORTANT: our targets are inside #gj-stage already (HUD/controls excluded by layout),
  // so margins should be "small" and tuned per view.
  const b = DOC.body;
  const isVR = b.classList.contains('view-vr') || b.classList.contains('view-cvr');
  if (isVR){
    return { top: 18, bottom: 18, left: 14, right: 14 };
  }
  if (b.classList.contains('view-mobile')){
    return { top: 18, bottom: 20, left: 14, right: 14 };
  }
  return { top: 16, bottom: 18, left: 16, right: 16 };
}

let started = false;

function bootEngineOnce(){
  if (started) return;
  started = true;

  const layerL = DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  const crossL = DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair');
  const crossR = DOC.getElementById('gj-crosshair-r');

  const shootEl = DOC.getElementById('btnShoot');

  const diff = qs('diff','normal');
  const run  = qs('run', qs('runMode','play')) || 'play';
  const time = Number(qs('time', qs('duration','70'))) || 70;

  // end policies: time | all | miss
  const endPolicy = qs('end','time');
  const challenge = qs('challenge','rush');

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
    safeMargins: getSafeMargins(),
    context: {
      projectTag: qs('projectTag','HeroHealth')
    }
  });
}

function hookViewButtons(){
  const btnPC = DOC.getElementById('btnViewPC');
  const btnM  = DOC.getElementById('btnViewMobile');
  const btnV  = DOC.getElementById('btnViewVR');
  const btnC  = DOC.getElementById('btnViewCVR');
  const btnFS = DOC.getElementById('btnEnterFS');
  const btnVR = DOC.getElementById('btnEnterVR');

  const vrOk = DOC.getElementById('btnVrOk');
  vrOk && vrOk.addEventListener('click', ()=> hideVrHint());

  btnPC && btnPC.addEventListener('click', ()=>{ setBodyView('pc'); hideVrHint(); });
  btnM  && btnM.addEventListener('click',  ()=>{ setBodyView('mobile'); hideVrHint(); });
  btnV  && btnV.addEventListener('click',  ()=>{ setBodyView('vr'); showVrHint(); });
  btnC  && btnC.addEventListener('click',  ()=>{ setBodyView('cvr'); showVrHint(); });

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });

  // ✅ ENTER VR (A-mode): Fullscreen + cVR + landscape lock + hint
  btnVR && btnVR.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
    setBodyView('cvr');
    await lockLandscape();
    showVrHint();
  });
}

function hookStartButton(){
  const btnStart = DOC.getElementById('btnStart');
  if (!btnStart) return;

  btnStart.addEventListener('click', async ()=>{
    hideStartOverlay();
    // if user is going VR, try make it stable
    const isVR = DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr');
    if (isVR){
      await enterFs();
      syncFsClass();
      await lockLandscape();
    }
    bootEngineOnce();
  });
}

function main(){
  hookViewButtons();
  hookStartButton();

  setBodyView(pickInitialView());
  syncMeta();
  syncStartMeta();
  syncFsClass();

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  // ✅ show start overlay ALWAYS and do NOT auto-start engine
  showStartOverlay();
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();