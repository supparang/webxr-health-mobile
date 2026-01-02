// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (PC/Mobile/Cardboard/cVR)
// ✅ Sets body view classes
// ✅ Sets window.HHA_VIEW.layers for game (main or L/R)
// ✅ Best-effort fullscreen + landscape lock for Cardboard/cVR
// ✅ cVR fallback: tap-to-shoot -> emit hha:shoot (if Universal VR UI not present)

'use strict';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr','cardboard');

  if (view === 'cardboard') b.classList.add('cardboard');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'mobile') b.classList.add('view-mobile');
  else b.classList.add('view-pc');
}

function setLayersForHydration(){
  // ให้ safe.js เรียกใช้ผ่าน window.HHA_VIEW.layers
  // main: hydration-layer
  // cardboard: hydration-layerL + hydration-layerR
  const main = DOC.getElementById('hydration-layer');
  const L = DOC.getElementById('hydration-layerL');
  const R = DOC.getElementById('hydration-layerR');

  ROOT.HHA_VIEW = ROOT.HHA_VIEW || {};
  if (DOC.body.classList.contains('cardboard') && L && R){
    ROOT.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
  } else if (main){
    ROOT.HHA_VIEW.layers = ['hydration-layer'];
  } else if (L && R){
    // เผื่อกรณี main ไม่มี
    ROOT.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
  } else {
    ROOT.HHA_VIEW.layers = [];
  }
}

async function tryFullscreenAndLandscape(){
  // best-effort (บางเครื่อง/เบราว์เซอร์อาจไม่ให้)
  try{
    const el = DOC.documentElement;
    if (!DOC.fullscreenElement && el.requestFullscreen){
      await el.requestFullscreen({ navigationUI:'hide' });
    }
  }catch(_){}

  try{
    if (screen.orientation && screen.orientation.lock){
      await screen.orientation.lock('landscape');
    }
  }catch(_){}
}

function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function installCVRFallbackTapToShoot(){
  // ถ้ามี Universal VR UI อยู่แล้ว มันจะยิง hha:shoot ให้เอง (tap-to-shoot ผ่าน crosshair)
  // แต่เพื่อกัน “เงียบ” ในบางหน้า เราทำ fallback: แตะจอ = emit hha:shoot
  // NOTE: safe.js ฟัง hha:shoot เฉพาะเมื่อ body.view-cvr
  let last=0;

  function shootOnce(e){
    const now = performance.now();
    if (now - last < 90) return;
    last = now;
    emit('hha:shoot', { src:'cvr-fallback' });
  }

  DOC.addEventListener('pointerdown', (e)=>{
    if (!DOC.body.classList.contains('view-cvr')) return;
    // กันกดบนปุ่ม HUD/overlay
    const t = e.target;
    if (t && t.closest && t.closest('button,a,input,textarea,select,#startOverlay,#resultBackdrop')) return;
    shootOnce(e);
  }, { passive:true });
}

async function boot(){
  const view = String(qs('view','pc')).toLowerCase();

  // view normalization
  const v =
    (view === 'cardboard' || view === 'cb') ? 'cardboard' :
    (view === 'cvr') ? 'cvr' :
    (view === 'vr') ? 'vr' :
    (view === 'mobile' || view === 'm') ? 'mobile' :
    'pc';

  setBodyView(v);

  // fullscreen for cardboard/cvr
  if (v === 'cardboard' || v === 'cvr'){
    // ถ้า user มาจากปุ่มเลือกโหมด มักเรียก fullscreen ไปแล้ว
    // แต่เราทำ best-effort ซ้ำอีกครั้งเพื่อความชัวร์
    await tryFullscreenAndLandscape();
  }

  setLayersForHydration();

  // cVR: install fallback tap-to-shoot (กรณีไม่ได้โหลด /vr/vr-ui.js)
  installCVRFallbackTapToShoot();

  // Import game logic (safe.js)
  await import('./hydration.safe.js');

  // Auto start (เพราะหน้าเลือกโหมดจะ hide overlay แล้ว)
  emit('hha:start');
}

boot();