// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (DOM Engine)
// ✅ Boot gate: starts engine AFTER pressing "เริ่มเล่น"
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Enter VR = Fullscreen + cVR + try lock landscape + show hint
// ✅ Fullscreen handling + body.is-fs
// ✅ Meta + start meta
// ✅ PATCH: eyeR toggle + dynamic safeMargins + layout event bridge for engine/vr-ui

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
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

/* -------------------- View + eyeR toggle -------------------- */
function setEyeMode(view){
  const eyeR = DOC.getElementById('eyeR');
  if (!eyeR) return;

  const isDual = (view === 'cvr'); // cVR = split dual-eye
  eyeR.style.display = isDual ? '' : 'none';
  eyeR.setAttribute('aria-hidden', isDual ? 'false' : 'true');
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
  setEyeMode(view);

  // notify: layout changed (engine may listen; safe even if not)
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:layout', {
      detail: { view, safeMargins: getSafeMargins() }
    }));
  }catch(_){}
}

/* -------------------- Meta -------------------- */
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

/* -------------------- Overlays -------------------- */
function showStartOverlay(){
  const ov = DOC.getElementById('startOverlay');
  if (!ov) return;
  ov.hidden = false;
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

/* -------------------- Dynamic Safe Margins -------------------- */
/**
 * คำนวณ safeMargins จากสิ่งที่ "ทับ playfield จริง" แทนการเดาเลข
 * - เอา rect ของ layerL (พื้นที่เกิดเป้า)
 * - ดูว่ามี HUD/Controls/Fever/MiniHUD ทับตรงไหน → แปลงเป็น margin
 */
function rect(el){
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!isFinite(r.width) || !isFinite(r.height) || r.width <= 1 || r.height <= 1) return null;
  return r;
}
function clamp(n, a, b){ n = Number(n)||0; return n<a?a:(n>b?b:n); }

function overlapMargin(layerR, uiR){
  if (!layerR || !uiR) return null;

  const x1 = Math.max(layerR.left, uiR.left);
  const y1 = Math.max(layerR.top, uiR.top);
  const x2 = Math.min(layerR.right, uiR.right);
  const y2 = Math.min(layerR.bottom, uiR.bottom);

  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return null; // no overlap

  // decide which side to push away based on which edge is closer
  const dTop    = y2 - layerR.top;
  const dBottom = layerR.bottom - y1;
  const dLeft   = x2 - layerR.left;
  const dRight  = layerR.right - x1;

  // We'll expand margins by overlap thickness + padding
  const pad = 10;

  // Top overlap if UI is near top
  const top = (uiR.top <= layerR.top + 6) ? (y2 - layerR.top + pad) : 0;
  const bottom = (uiR.bottom >= layerR.bottom - 6) ? (layerR.bottom - y1 + pad) : 0;
  const left = (uiR.left <= layerR.left + 6) ? (x2 - layerR.left + pad) : 0;
  const right = (uiR.right >= layerR.right - 6) ? (layerR.right - x1 + pad) : 0;

  // If UI is floating somewhere in middle, we don't push (engine safezone handles in-spawn avoidance separately)
  return { top, bottom, left, right };
}

function mergeMargins(a, b){
  return {
    top: Math.max(a.top, b.top),
    bottom: Math.max(a.bottom, b.bottom),
    left: Math.max(a.left, b.left),
    right: Math.max(a.right, b.right),
  };
}

function getSafeMargins(){
  // Default small margins (base)
  const b = DOC.body;
  const isVR = b.classList.contains('view-vr') || b.classList.contains('view-cvr');

  let m = isVR
    ? { top: 14, bottom: 14, left: 12, right: 12 }
    : (b.classList.contains('view-mobile')
        ? { top: 14, bottom: 16, left: 12, right: 12 }
        : { top: 14, bottom: 14, left: 14, right: 14 });

  // Use actual layer rect
  const layerEl = DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer');
  const layerR = rect(layerEl);
  if (!layerR) return m;

  // UI candidates that may overlap
  const hudRoot = rect(DOC.getElementById('hudRoot'));
  const fever   = rect(DOC.getElementById('hhaFever'));
  const ctrls   = rect(DOC.querySelector('.hha-controls'));
  const miniHud = rect(DOC.getElementById('vrMiniHud'));
  const peek    = rect(DOC.getElementById('questPeek')); // if open

  const list = [hudRoot, fever, ctrls, miniHud, peek].filter(Boolean);

  for (const uiR of list){
    const dm = overlapMargin(layerR, uiR);
    if (dm) m = mergeMargins(m, dm);
  }

  // Clamp to avoid killing play area
  const maxTop = Math.floor(layerR.height * 0.35);
  const maxBot = Math.floor(layerR.height * 0.35);
  const maxLR  = Math.floor(layerR.width  * 0.28);

  m.top    = clamp(m.top,    8, maxTop);
  m.bottom = clamp(m.bottom, 8, maxBot);
  m.left   = clamp(m.left,   8, maxLR);
  m.right  = clamp(m.right,  8, maxLR);

  return m;
}

/* -------------------- Engine Boot Gate -------------------- */
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

  const endPolicy = qs('end','time');      // time | all | miss
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

/* -------------------- Buttons -------------------- */
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

  // Enter VR (page-level helper): Fullscreen + cVR + landscape lock + hint
  // (vr-ui.js will also provide its own Enter/Exit/Recenter UI)
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

    const isVR = DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr');
    if (isVR){
      await enterFs();
      syncFsClass();
      await lockLandscape();
    }
    bootEngineOnce();
  });
}

/* -------------------- Recompute safe margins on resize/orient -------------------- */
function hookResizeReflow(){
  let t = 0;
  function fire(){
    clearTimeout(t);
    t = setTimeout(() => {
      try{
        ROOT.dispatchEvent(new CustomEvent('hha:layout', {
          detail: { view: getCurrentView(), safeMargins: getSafeMargins() }
        }));
      }catch(_){}
    }, 120);
  }
  ROOT.addEventListener('resize', fire);
  ROOT.addEventListener('orientationchange', fire);
}

function getCurrentView(){
  const b = DOC.body;
  if (b.classList.contains('view-cvr')) return 'cvr';
  if (b.classList.contains('view-vr')) return 'vr';
  if (b.classList.contains('view-mobile')) return 'mobile';
  return 'pc';
}

/* -------------------- Main -------------------- */
function main(){
  hookViewButtons();
  hookStartButton();
  hookResizeReflow();

  setBodyView(pickInitialView());
  syncMeta();
  syncStartMeta();
  syncFsClass();

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  // show start overlay ALWAYS and do NOT auto-start engine
  showStartOverlay();
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();