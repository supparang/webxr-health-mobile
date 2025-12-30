// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (v3)
// ✅ View modes: PC / Mobile / VR / cVR (split)
// ✅ Fullscreen handling + body.is-fs
// ✅ VR hint overlay (portrait in VR/cVR) + OK hides
// ✅ START GATE: engine starts ONLY after pressing "เริ่มเล่น"
// ✅ HUD toggle (H) + Quest Peek (Q) + Hold ยิง to peek
// ✅ Prevent double-boot; safe & hardened

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const ROOT = window;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
  markActive(view);
}

function markActive(view){
  const map = {
    pc: 'btnViewPC',
    mobile: 'btnViewMobile',
    vr: 'btnViewVR',
    cvr: 'btnViewCVR'
  };
  ['btnViewPC','btnViewMobile','btnViewVR','btnViewCVR'].forEach(id=>{
    const el = DOC.getElementById(id);
    if (el) el.classList.toggle('is-active', map[view] === id);
  });
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

function toast(msg, ms=1200){
  const t = DOC.getElementById('toast');
  if (!t) return;
  t.textContent = String(msg||'');
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>{ t.hidden = true; }, ms);
}

function syncMeta(){
  const hudMeta = DOC.getElementById('hudMeta');
  const startMeta = DOC.getElementById('startMeta');
  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = Number(qs('time', qs('duration','70'))) || 70;
  const v = qs('v','');
  const dual = !!DOC.getElementById('gj-layer-r');

  const txt = `diff=${diff} • run=${run} • time=${time}s • dual=${dual}${v?` • v=${v}`:''}`;
  if (hudMeta) hudMeta.textContent = txt;
  if (startMeta) startMeta.textContent = txt;
}

function pickInitialView(){
  const v = String(qs('view','') || '').toLowerCase();
  if (v === 'vr') return 'vr';
  if (v === 'cvr') return 'cvr';

  const coarse = ROOT.matchMedia && ROOT.matchMedia('(pointer: coarse)').matches;
  const w = innerWidth || 360;
  const h = innerHeight || 640;
  const mobileLike = coarse || Math.min(w,h) < 520;
  return mobileLike ? 'mobile' : 'pc';
}

/* ---- VR hint: show only when in VR/cVR + portrait ---- */
function shouldShowVrHint(){
  const b = DOC.body;
  const isVR = b.classList.contains('view-vr') || b.classList.contains('view-cvr');
  if (!isVR) return false;
  const w = innerWidth || 360;
  const h = innerHeight || 640;
  return h > w; // portrait
}

function setVrHintVisible(on){
  const vrHint = DOC.getElementById('vrHint');
  if (!vrHint) return;
  vrHint.hidden = !on;
}

function syncVrHint(){
  setVrHintVisible(shouldShowVrHint());
}

/* ---- Quest Peek ---- */
let peekTimer = null;
function peekQuest(ms=1600){
  DOC.body.classList.add('peek-quest');
  clearTimeout(peekQuest._t);
  peekQuest._t = setTimeout(()=> DOC.body.classList.remove('peek-quest'), ms);
}

/* ---- Engine start gate ---- */
let engineStarted = false;

function bootEngine(){
  if (engineStarted) return;
  engineStarted = true;

  const layerL = DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  const crossL = DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair');
  const crossR = DOC.getElementById('gj-crosshair-r');

  const shootEl = DOC.getElementById('btnShoot');

  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = Number(qs('time', qs('duration','70'))) || 70;

  const endPolicy = qs('end','time');     // time | all | miss
  const challenge = qs('challenge','rush');

  // IMPORTANT: start overlay uses fixed UI; engine spawns avoid HUD based on actual rects.
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
    context: { projectTag: qs('projectTag','HeroHealth') }
  });

  toast('เริ่มเกมแล้ว! 🔥', 900);
}

/* ---- UI hooks ---- */
function hookViewButtons(){
  const btnPC = DOC.getElementById('btnViewPC');
  const btnM  = DOC.getElementById('btnViewMobile');
  const btnV  = DOC.getElementById('btnViewVR');
  const btnC  = DOC.getElementById('btnViewCVR');
  const btnFS = DOC.getElementById('btnEnterFS');
  const btnVR = DOC.getElementById('btnEnterVR');
  const btnHUD = DOC.getElementById('btnToggleHUD');
  const btnPeek = DOC.getElementById('btnPeekQuest');

  const vrOk = DOC.getElementById('btnVrOk');

  btnPC && btnPC.addEventListener('click', ()=>{ setBodyView('pc'); syncVrHint(); });
  btnM  && btnM.addEventListener('click',  ()=>{ setBodyView('mobile'); syncVrHint(); });
  btnV  && btnV.addEventListener('click',  ()=>{ setBodyView('vr'); syncVrHint(); peekQuest(1200); });
  btnC  && btnC.addEventListener('click',  ()=>{ setBodyView('cvr'); syncVrHint(); peekQuest(1200); });

  vrOk && vrOk.addEventListener('click', ()=> setVrHintVisible(false));

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
    syncVrHint();
  });

  // Enter VR (for DOM/cardboard): go cVR + fullscreen + show hint if portrait
  btnVR && btnVR.addEventListener('click', async ()=>{
    setBodyView('cvr');
    await enterFs();
    syncFsClass();
    syncVrHint();
    peekQuest(1400);
    toast('โหมด cVR พร้อม! (หมุนจอแนวนอน)', 1400);
  });

  // HUD toggle
  function toggleHUD(){
    DOC.body.classList.toggle('hud-off');
    toast(DOC.body.classList.contains('hud-off') ? 'HUD: OFF' : 'HUD: ON', 900);
    syncVrHint();
  }
  btnHUD && btnHUD.addEventListener('click', toggleHUD);

  // Quest peek (button)
  btnPeek && btnPeek.addEventListener('click', ()=> peekQuest(1700));

  // Keyboard shortcuts
  DOC.addEventListener('keydown', (e)=>{
    const k = String(e.key||'').toLowerCase();
    if (k === 'h'){ e.preventDefault?.(); toggleHUD(); }
    if (k === 'q'){ e.preventDefault?.(); peekQuest(1700); }
  });
}

/* ---- Start overlay gate ---- */
function hookStartGate(){
  const overlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  if (!overlay || !btnStart) return;

  function startNow(){
    if (overlay.hidden) return; // already started
    overlay.hidden = true;
    bootEngine();
    // show a quick peek in VR modes so user sees quest instantly
    if (DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr')) peekQuest(1600);
  }

  btnStart.addEventListener('click', (e)=>{
    e.preventDefault?.();
    startNow();
  });

  // nice-to-have: tap overlay background to start (but not on card)
  overlay.addEventListener('click', (e)=>{
    const card = overlay.querySelector('.start-card');
    if (card && card.contains(e.target)) return;
    startNow();
  });
}

/* ---- Hold ยิง -> Peek Quest ---- */
function hookHoldShootPeek(){
  const shootEl = DOC.getElementById('btnShoot');
  if (!shootEl) return;

  function clearHold(){
    if (peekTimer){ clearTimeout(peekTimer); peekTimer = null; }
  }

  shootEl.addEventListener('pointerdown', ()=>{
    clearHold();
    // hold 420ms -> peek quest
    peekTimer = setTimeout(()=>{
      peekQuest(1600);
      peekTimer = null;
    }, 420);
  }, { passive:true });

  shootEl.addEventListener('pointerup', clearHold, { passive:true });
  shootEl.addEventListener('pointercancel', clearHold, { passive:true });
}

/* ---- Main ---- */
function main(){
  hookViewButtons();
  hookStartGate();
  hookHoldShootPeek();

  setBodyView(pickInitialView());
  syncMeta();
  syncFsClass();
  syncVrHint();

  DOC.addEventListener('fullscreenchange', ()=>{ syncFsClass(); syncVrHint(); });
  DOC.addEventListener('webkitfullscreenchange', ()=>{ syncFsClass(); syncVrHint(); });
  ROOT.addEventListener('resize', ()=>{ syncVrHint(); });
  ROOT.addEventListener('orientationchange', ()=>{ setTimeout(syncVrHint, 120); });

  // IMPORTANT: do NOT start engine here. Start only after pressing "เริ่มเล่น".
  toast('กด “เริ่มเล่น” เพื่อเริ่มเกม', 1200);
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();