// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Start Gate + HUD Peek)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs
// ✅ VR hint overlay OK -> hide (does NOT start game)
// ✅ Engine starts ONLY after pressing "เริ่มเล่น"

import { boot as engineBoot } from './goodjunk.safe.js';

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

function syncMeta(stateText){
  const hudMeta = DOC.getElementById('hudMeta');
  if (!hudMeta) return;
  const dual = !!DOC.getElementById('gj-layer-r');
  const v = qs('v','');
  hudMeta.textContent = `[BOOT] ${stateText||'ready'} • dual=${dual} • diff=${qs('diff','normal')} • time=${qs('time','70')} • v=${v}`;
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

function setHudHidden(on){
  DOC.body.classList.toggle('hud-hidden', !!on);
}

function autoHideHudAfterStart(){
  // VR/cVR or fullscreen: show HUD for 2.3s then hide (Peek stays)
  const isVR = DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr');
  const fs = DOC.body.classList.contains('is-fs');

  if (!(isVR || fs)) { setHudHidden(false); return; }

  setHudHidden(false);
  setTimeout(()=> setHudHidden(true), 2300);
}

function hookPeekToggle(){
  const peek = DOC.getElementById('hudPeek');
  if (!peek) return;
  peek.addEventListener('click', ()=>{
    // toggle HUD
    const hidden = DOC.body.classList.contains('hud-hidden');
    setHudHidden(!hidden ? true : false);
  });
}

function hookViewButtons(){
  const btnPC = DOC.getElementById('btnViewPC');
  const btnM  = DOC.getElementById('btnViewMobile');
  const btnV  = DOC.getElementById('btnViewVR');
  const btnC  = DOC.getElementById('btnViewCVR');
  const btnFS = DOC.getElementById('btnEnterFS');

  const vrHint = DOC.getElementById('vrHint');
  const vrOk   = DOC.getElementById('btnVrOk');

  function showVrHint(){
    if (!vrHint) return;
    vrHint.hidden = false;
  }
  function hideVrHint(){
    if (!vrHint) return;
    vrHint.hidden = true;
  }

  btnPC && btnPC.addEventListener('click', ()=>{ setBodyView('pc'); hideVrHint(); setHudHidden(false); });
  btnM  && btnM.addEventListener('click',  ()=>{ setBodyView('mobile'); hideVrHint(); setHudHidden(false); });
  btnV  && btnV.addEventListener('click',  ()=>{ setBodyView('vr'); showVrHint(); });
  btnC  && btnC.addEventListener('click',  ()=>{ setBodyView('cvr'); showVrHint(); });

  vrOk && vrOk.addEventListener('click', ()=> hideVrHint());

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });
}

function bootEngine(){
  const layerL = DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  const crossL = DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair');
  const crossR = DOC.getElementById('gj-crosshair-r');

  const shootEl = DOC.getElementById('btnShoot');

  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = Number(qs('time', qs('duration','70'))) || 70;

  const endPolicy = qs('end','time'); // time | all | miss
  const challenge = qs('challenge','rush');

  return engineBoot({
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
    autoStart: false, // ✅ IMPORTANT
    context: {
      projectTag: qs('projectTag','HeroHealth')
    }
  });
}

function hookStartGate(controller){
  const overlay = DOC.getElementById('startOverlay');
  const btn = DOC.getElementById('btnStart');
  const meta = DOC.getElementById('startMeta');

  function show(){
    if (!overlay) return;
    overlay.hidden = false;
    if (meta){
      meta.textContent = `diff=${qs('diff','normal')} • time=${qs('time','70')} • end=${qs('end','time')} • view=${DOC.body.className}`;
    }
  }
  function hide(){
    if (!overlay) return;
    overlay.hidden = true;
  }

  show();

  btn && btn.addEventListener('click', ()=>{
    hide();
    syncMeta('running');
    controller && controller.start && controller.start();
    autoHideHudAfterStart();
  });
}

function main(){
  hookViewButtons();
  hookPeekToggle();

  setBodyView(pickInitialView());
  syncFsClass();
  syncMeta('ready');

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  const controller = bootEngine();

  // Start gate
  hookStartGate(controller);

  // If user starts in VR/cVR and wants hud hidden by default, still wait until start
  setHudHidden(false);
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();