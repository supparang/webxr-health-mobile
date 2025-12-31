// === /herohealth/plate/plate-vr.boot.js ===
// Balanced Plate VR Boot — PRODUCTION
// ✅ View modes: PC / Mobile / VR / cVR (via ?view=pc|mobile|vr|cvr)
// ✅ Fullscreen handling + body.is-fs
// ✅ URL params preview fill (diff/time/run) if missing
// ✅ Safe: does not assume load order beyond DOMContentLoaded

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch(e){ return def; }
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
}

function detectView(){
  // explicit override
  const v = String(qs('view','')||'').toLowerCase();
  if(v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return v;

  // infer
  const ua = (navigator && navigator.userAgent) ? navigator.userAgent : '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  // if WebXR session active later, we will flip to vr/cvr via enterVR hook
  return isMobile ? 'mobile' : 'pc';
}

function isFs(){
  return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
}
async function enterFs(){
  try{
    const el = DOC.documentElement;
    if(el.requestFullscreen) await el.requestFullscreen();
    else if(el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  }catch(_){}
}
function syncFsClass(){
  try{
    if(!DOC.body) return;
    DOC.body.classList.toggle('is-fs', isFs());
  }catch(_){}
}

function wireFsEvents(){
  DOC.addEventListener('fullscreenchange', syncFsClass, { passive:true });
  DOC.addEventListener('webkitfullscreenchange', syncFsClass, { passive:true });
  syncFsClass();
}

function ensurePreview(){
  // Fill preview pills if not already set
  try{
    const u = new URL(location.href);
    const diff = (u.searchParams.get('diff') || 'normal');
    const time = (u.searchParams.get('time') || '90');
    const run  = (u.searchParams.get('run') || u.searchParams.get('runMode') || 'play');

    const a = DOC.getElementById('uiDiffPreview'); if(a && !a.textContent) a.textContent = String(diff);
    const b = DOC.getElementById('uiTimePreview'); if(b && !b.textContent) b.textContent = String(time);
    const c = DOC.getElementById('uiRunPreview');  if(c && !c.textContent) c.textContent  = String(run);
  }catch(_){}
}

function wireEnterVrButtons(){
  // page already has btnEnterVR & btnEnterVR2; this keeps them consistent
  function enterVR(){
    try{
      const scene = DOC.querySelector('a-scene');
      if(scene && scene.enterVR) scene.enterVR();
    }catch(_){}
  }
  const b1 = DOC.getElementById('btnEnterVR');
  const b2 = DOC.getElementById('btnEnterVR2');
  if(b1) b1.addEventListener('click', enterVR, { passive:true });
  if(b2) b2.addEventListener('click', enterVR, { passive:true });

  // After XR enters, set body view
  // (A-Frame emits enter-vr / exit-vr on scene)
  try{
    const scene = DOC.querySelector('a-scene');
    if(scene){
      scene.addEventListener('enter-vr', ()=>{
        // If cardboard style, you may want view=cvr later; default to vr
        const cur = DOC.body?.classList.contains('view-cvr') ? 'cvr' : 'vr';
        setBodyView(cur);
      });
      scene.addEventListener('exit-vr', ()=>{
        setBodyView(detectView());
      });
    }
  }catch(_){}
}

function wireStartOverlayFsHint(){
  // Optional: enter fullscreen on start for better mobile/vr feel
  const btnStart = DOC.getElementById('btnStart');
  if(!btnStart) return;
  btnStart.addEventListener('click', async ()=>{
    // On mobile browsers, fullscreen often improves play
    if(!isFs()) await enterFs();
    syncFsClass();
  }, { passive:true });
}

function init(){
  setBodyView(detectView());
  wireFsEvents();
  ensurePreview();
  wireEnterVrButtons();
  wireStartOverlayFsHint();
}

if(DOC && DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', init, { passive:true });
}else{
  init();
}