// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (v2 GATED)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs
// ✅ Overlay state: body.booting / body.overlay-open (no "flash behind")
// ✅ VR hint overlay OK -> hide
// ✅ Starts engine ONLY after pressing "เริ่มเล่น" (or ?autostart=1)
// ✅ HUD meta sync (waiting/started, dual, view, fs, v)

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function hasEl(id){ return !!DOC.getElementById(id); }

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
  syncMeta();
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
async function exitFs(){
  try{
    if (DOC.exitFullscreen) await DOC.exitFullscreen();
    else if (DOC.webkitExitFullscreen) await DOC.webkitExitFullscreen();
  }catch(_){}
}
function syncFsClass(){
  DOC.body.classList.toggle('is-fs', isFs());
  syncMeta();
}

function setOverlayOpen(on){
  const b = DOC.body;
  b.classList.toggle('overlay-open', !!on);
}

function showStartOverlay(){
  const so = DOC.getElementById('startOverlay');
  if (!so) return;
  so.hidden = false;
  DOC.body.classList.add('booting');
  setOverlayOpen(true);
  syncMeta();
}
function hideStartOverlay(){
  const so = DOC.getElementById('startOverlay');
  if (!so) return;
  so.hidden = true;
  DOC.body.classList.remove('booting');
  // ยังอาจมี vrHint เปิดอยู่ → syncOverlayState จะจัดการ
  syncOverlayState();
  syncMeta();
}

function showVrHint(){
  const vh = DOC.getElementById('vrHint');
  if (!vh) return;
  vh.hidden = false;
  setOverlayOpen(true);
  syncMeta();
}
function hideVrHint(){
  const vh = DOC.getElementById('vrHint');
  if (!vh) return;
  vh.hidden = true;
  syncOverlayState();
  syncMeta();
}

function syncOverlayState(){
  const so = DOC.getElementById('startOverlay');
  const vh = DOC.getElementById('vrHint');
  const open = (so && !so.hidden) || (vh && !vh.hidden);
  setOverlayOpen(open);
}

function pickInitialView(){
  const v = String(qs('view','') || '').toLowerCase();
  if (v === 'vr')  return 'vr';
  if (v === 'cvr') return 'cvr';

  const coarse = (ROOT.matchMedia && ROOT.matchMedia('(pointer: coarse)').matches);
  const w = ROOT.innerWidth || 360;
  const h = ROOT.innerHeight || 640;
  const mobileLike = coarse || Math.min(w,h) < 520;
  return mobileLike ? 'mobile' : 'pc';
}

function syncMeta(state = null){
  const hudMeta = DOC.getElementById('hudMeta');
  if (!hudMeta) return;

  const dual = !!DOC.getElementById('gj-layer-r');
  const v = qs('v','');
  const view =
    DOC.body.classList.contains('view-vr') ? 'vr' :
    DOC.body.classList.contains('view-cvr') ? 'cvr' :
    DOC.body.classList.contains('view-pc') ? 'pc' : 'mobile';

  const fs = isFs() ? 'fs' : 'win';
  const s  = state || (DOC.body.classList.contains('booting') ? 'waiting' : 'started');

  hudMeta.textContent = `[BOOT] ${s} • view=${view} • ${fs} • dual=${dual} • v=${v}`;
}

function hookViewButtons(){
  const btnPC = DOC.getElementById('btnViewPC');
  const btnM  = DOC.getElementById('btnViewMobile');
  const btnV  = DOC.getElementById('btnViewVR');
  const btnC  = DOC.getElementById('btnViewCVR');
  const btnFS = DOC.getElementById('btnEnterFS');
  const btnVR = DOC.getElementById('btnEnterVR');

  const vrOk  = DOC.getElementById('btnVrOk');

  btnPC && btnPC.addEventListener('click', ()=>{
    setBodyView('pc');
    hideVrHint();
  });

  btnM && btnM.addEventListener('click', ()=>{
    setBodyView('mobile');
    hideVrHint();
  });

  btnV && btnV.addEventListener('click', ()=>{
    setBodyView('vr');
    showVrHint();
  });

  btnC && btnC.addEventListener('click', ()=>{
    setBodyView('cvr');
    showVrHint();
  });

  vrOk && vrOk.addEventListener('click', ()=>{
    hideVrHint();
  });

  btnFS && btnFS.addEventListener('click', async ()=>{
    if (isFs()) await exitFs();
    else await enterFs();
    syncFsClass();
  });

  // ไม่มี A-Frame ใน DOM เวอร์ชันนี้ → ใช้เป็น shortcut เปิดโหมด VR + fullscreen
  btnVR && btnVR.addEventListener('click', async ()=>{
    // ถ้าไม่ได้อยู่ VR/cVR ให้พาไป VR ก่อน
    if (!DOC.body.classList.contains('view-vr') && !DOC.body.classList.contains('view-cvr')){
      setBodyView('vr');
      showVrHint();
    }
    // แนะนำให้ fullscreen ก่อน (ผู้ใช้กดเองได้)
    try{ if (!isFs()) await enterFs(); }catch(_){}
    syncFsClass();
  });
}

let _engineStarted = false;

function bootEngineOnce(){
  if (_engineStarted) return;
  _engineStarted = true;

  const layerL  = DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer');
  const layerR  = DOC.getElementById('gj-layer-r');

  const crossL  = DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair');
  const crossR  = DOC.getElementById('gj-crosshair-r');

  const shootEl = DOC.getElementById('btnShoot');

  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = Number(qs('time', qs('duration','70'))) || 70;

  const endPolicy = qs('end','time');        // time | all | miss
  const challenge = qs('challenge','rush');  // rush default

  // safeMargins (สำคัญกับ fullscreen/VR layout) — ให้ขยับตาม view
  const view =
    DOC.body.classList.contains('view-vr') ? 'vr' :
    DOC.body.classList.contains('view-cvr') ? 'cvr' :
    DOC.body.classList.contains('view-pc') ? 'pc' : 'mobile';

  const safeMargins =
    (view === 'vr' || view === 'cvr')
      ? { top: 120, bottom: 160, left: 18, right: 18 }
      : (view === 'mobile')
        ? { top: 150, bottom: 180, left: 16, right: 16 }
        : { top: 130, bottom: 170, left: 18, right: 18 };

  syncMeta('started');

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
    safeMargins,
    context: {
      projectTag: qs('projectTag','HeroHealth')
    }
  });
}

function hookStartGate(){
  const so = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');

  // ถ้าไม่มี startOverlay ก็เริ่มทันที (โหมด dev/legacy)
  if (!so || !btnStart){
    DOC.body.classList.remove('booting');
    setOverlayOpen(false);
    bootEngineOnce();
    return;
  }

  // ให้แน่ใจว่า startOverlay “โชว์” ตอนเริ่ม (ใช้ hidden คุม)
  so.hidden = false;
  DOC.body.classList.add('booting');
  setOverlayOpen(true);
  syncMeta('waiting');

  btnStart.addEventListener('click', ()=>{
    hideStartOverlay();
    bootEngineOnce();
  });

  // รองรับเปิดอัตโนมัติ (สำหรับ test)
  const autostart = String(qs('autostart','0'));
  if (autostart === '1'){
    hideStartOverlay();
    bootEngineOnce();
  }
}

function observeOverlayMutations(){
  const so = DOC.getElementById('startOverlay');
  const vh = DOC.getElementById('vrHint');
  const mo = new MutationObserver(syncOverlayState);
  if (so) mo.observe(so, { attributes:true, attributeFilter:['hidden'] });
  if (vh) mo.observe(vh, { attributes:true, attributeFilter:['hidden'] });
  syncOverlayState();
}

function main(){
  hookViewButtons();
  setBodyView(pickInitialView());

  // ถ้าเข้า view=vr/cvr ตั้งแต่แรก → โชว์คำแนะนำ
  if (DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr')){
    showVrHint();
  }

  syncFsClass();
  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  observeOverlayMutations();
  hookStartGate();
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();