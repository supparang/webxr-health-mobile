// === /herohealth/hydration-vr/hydration-vr.boot.js ===
// HydrationVR Boot — AUTO-DETECT (NO URL OVERRIDE)
// ✅ PC / Mobile / cVR strict / Cardboard split (heuristic)
// ✅ Maps window.HHA_VIEW.layers
// ✅ Start overlay -> hha:start
// ✅ Fullscreen best-effort for mobile/cVR/cardboard

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
  return !!DOC.fullscreenElement || (String(DOC.fullscreenElement||'') !== '');
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

/**
 * Heuristic:
 * - PC => view-pc
 * - Mobile portrait => view-mobile
 * - Mobile landscape + fullscreen => prefer cVR (strict) (better feel + no split artifacts)
 * - Mobile landscape + NOT fullscreen but very wide => still mobile
 * - Cardboard split mode:
 *    เราเปิดเมื่อ (mobile + landscape + fullscreen + url has "cb=1" in hash/localStorage) ❗
 *    แต่ “ห้าม override URL” -> ใช้ localStorage flag ที่เปิดจาก gesture ปุ่ม Fullscreen เท่านั้น
 */
function detectMode(){
  const mobile = isMobileUA();

  if (!mobile) return 'pc';

  // if user previously opted cardboard via localStorage (not via URL) — still "no override"
  const cbPref = (localStorage.getItem('HHA_HYDRATION_PREF') || '').toLowerCase();
  if (cbPref === 'cardboard') return 'cardboard';

  // prefer cVR when landscape+fullscreen (best for strict crosshair shooting)
  if (isLandscape() && (isFullscreen() || matchMedia('(display-mode: fullscreen)').matches)){
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

  // map layers for hydration.safe.js
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

  DOC.getElementById('btnEnterFull')?.addEventListener('click', async ()=>{
    // gesture: allow user to “push” into fullscreen (helps cVR detection)
    await enterFullLandscape();

    // If user is in fullscreen+landscape and wants stronger VR feel, still keep cVR by default.
    // BUT allow “cardboard split preference” via a second press (gesture-based, not URL).
    const cur = (WIN.HHA_VIEW?.mode || detectMode());
    if (cur === 'cvr' && isLandscape() && isFullscreen()){
      // optional: second press toggles to cardboard split
      const prev = (localStorage.getItem('HHA_HYDRATION_PREF') || '').toLowerCase();
      const next = (prev === 'cardboard') ? '' : 'cardboard';
      if (next) localStorage.setItem('HHA_HYDRATION_PREF', next);
      else localStorage.removeItem('HHA_HYDRATION_PREF');
      applyMode(detectMode());
    }
  });

  DOC.getElementById('btnStart')?.addEventListener('click', async ()=>{
    // start gesture
    const mode = detectMode();
    applyMode(mode);

    // if mobile and going into cvr/cardboard: try fullscreen+landscape
    if (mode === 'cvr' || mode === 'cardboard'){
      await enterFullLandscape();
    }

    // hide overlay + start
    DOC.getElementById('startOverlay')?.classList.add('hide');
    WIN.dispatchEvent(new CustomEvent('hha:start'));
  });
}

(function init(){
  // default apply once (still shows overlay)
  applyMode(detectMode());
  bindUI();

  // Re-detect on rotate (but keep stable while playing)
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