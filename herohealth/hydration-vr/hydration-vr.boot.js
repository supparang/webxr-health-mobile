// === /herohealth/hydration-vr/hydration-vr.boot.js ===
// HydrationVR Boot — AUTO-DETECT (NO URL OVERRIDE)
// ✅ PC / Mobile / cVR strict auto
// ✅ Cardboard split via gesture preference (Fullscreen button pressed twice) — still no menu
// ✅ Toast hint: show when in fullscreen landscape (cVR) to teach split toggle
// ✅ Maps window.HHA_VIEW.layers for hydration.safe.js

'use strict';

const DOC = document;
const WIN = window;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
const hub = String(qs('hub','../hub.html'));

function isMobileUA(){
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}
function isLandscape(){
  return (WIN.innerWidth > WIN.innerHeight);
}
function isFullscreen(){
  return !!DOC.fullscreenElement || matchMedia('(display-mode: fullscreen)').matches;
}
async function enterFullLandscape(){
  try{
    const el = DOC.documentElement;
    if (!DOC.fullscreenElement && el.requestFullscreen){
      await el.requestFullscreen({ navigationUI:'hide' });
    }
  }catch(_){}
  try{
    if (screen.orientation?.lock) await screen.orientation.lock('landscape');
  }catch(_){}
}

/* ===== toast hint ===== */
let toastEl=null;
function ensureToast(){
  if (toastEl) return toastEl;
  toastEl = DOC.createElement('div');
  toastEl.className = 'hha-toast';
  toastEl.textContent = '';
  DOC.body.appendChild(toastEl);
  return toastEl;
}
function toast(msg, ms=2400){
  const el = ensureToast();
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el.__t);
  el.__t = setTimeout(()=>el.classList.remove('show'), ms);
}

function detectMode(){
  const mobile = isMobileUA();
  if (!mobile) return 'pc';

  const pref = (localStorage.getItem('HHA_HYDRATION_PREF') || '').toLowerCase();
  if (pref === 'cardboard') return 'cardboard';

  if (isLandscape() && isFullscreen()){
    return 'cvr';
  }
  return 'mobile';
}

function applyMode(mode){
  const b = DOC.body;
  b.classList.remove('view-auto','view-pc','view-mobile','view-cvr','cardboard');

  if (mode === 'cardboard') b.classList.add('cardboard');
  else if (mode === 'cvr') b.classList.add('view-cvr');
  else if (mode === 'mobile') b.classList.add('view-mobile');
  else b.classList.add('view-pc');

  // map layers
  const cfg = WIN.HHA_VIEW || (WIN.HHA_VIEW = {});
  if (mode === 'cardboard'){
    cfg.layers = ['hydration-layerL','hydration-layerR'];
  }else{
    cfg.layers = ['hydration-layer'];
  }
  cfg.mode = mode;
}

function bindUI(){
  DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
    btn.addEventListener('click', ()=> location.href = hub);
  });

  let lastFullPressAt = 0;

  DOC.getElementById('btnEnterFull')?.addEventListener('click', async ()=>{
    const t = Date.now();
    const double = (t - lastFullPressAt) < 800; // double press gesture
    lastFullPressAt = t;

    await enterFullLandscape();

    // After entering full landscape, default cVR
    let mode = detectMode();
    applyMode(mode);

    // if double press while in cVR fullscreen landscape => toggle cardboard preference
    if (double && isLandscape() && isFullscreen()){
      const prev = (localStorage.getItem('HHA_HYDRATION_PREF') || '').toLowerCase();
      const next = (prev === 'cardboard') ? '' : 'cardboard';
      if (next) localStorage.setItem('HHA_HYDRATION_PREF', next);
      else localStorage.removeItem('HHA_HYDRATION_PREF');

      mode = detectMode();
      applyMode(mode);

      toast(mode === 'cardboard'
        ? '🕶️ Cardboard Split ON (จอแยกซ้าย–ขวา)'
        : '🎯 cVR strict ON (ยิงจาก crosshair)', 2200);
    } else {
      // gentle hint when in fullscreen landscape but not cardboard
      if (detectMode() === 'cvr'){
        toast('Tip: กด ⛶ Fullscreen “สองครั้งเร็ว ๆ” เพื่อสลับ Cardboard Split', 2600);
      }
    }
  });

  DOC.getElementById('btnStart')?.addEventListener('click', async ()=>{
    // Start gesture: apply mode again (fresh), and try fullscreen for VR feel
    let mode = detectMode();
    applyMode(mode);

    if (mode === 'cvr' || mode === 'cardboard'){
      await enterFullLandscape();
      mode = detectMode();
      applyMode(mode);
    }

    DOC.getElementById('startOverlay')?.classList.add('hide');
    WIN.dispatchEvent(new CustomEvent('hha:start'));

    if (mode === 'cvr'){
      toast('🎯 cVR strict: แตะเพื่อยิง (aim assist จะล็อกเป้าให้)', 2000);
    } else if (mode === 'cardboard'){
      toast('🕶️ Cardboard Split: ยิง/แตะเพื่อเล่น (แนะนำเต็มจอแนวนอน)', 2000);
    }
  });
}

(function init(){
  applyMode(detectMode());
  bindUI();

  let started = false;
  WIN.addEventListener('hha:start', ()=>{ started = true; }, { once:true });

  WIN.addEventListener('resize', ()=>{
    if (started) return;
    applyMode(detectMode());
  });
  WIN.addEventListener('orientationchange', ()=>{
    if (started) return;
    setTimeout(()=>applyMode(detectMode()), 250);
  });
})();