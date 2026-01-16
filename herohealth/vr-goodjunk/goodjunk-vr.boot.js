// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Folder-run)
// ✅ view=auto detect (pc/mobile/vr/cvr) but NEVER override when view= is provided
// ✅ Sets body classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ Ensures particles.js loaded before starting (best-effort)
// ✅ Calls engine boot() from ./goodjunk.safe.js exactly once
// ✅ Works with ../vr/vr-ui.js emitting hha:shoot (cVR strict aim from center)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function detectViewAuto(){
  // If user explicitly provides view=, do NOT override
  const vParam = (qs('view','') || '').toLowerCase().trim();
  if(vParam && vParam !== 'auto') return vParam;

  // Try to infer:
  // 1) WebXR capable + in immersive session => vr
  // 2) "cardboard-ish" / dual-eye flags => cvr
  // 3) Desktop pointer+large screen => pc
  // else mobile

  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua);

  // cVR hints
  const q = new URL(location.href).searchParams;
  const hintCVR = (q.get('cvr') === '1') || (q.get('stereo') === '1') || (q.get('dual') === '1');
  if(hintCVR) return 'cvr';

  // If WebXR and already presenting immersive-vr (rare on load, but safe)
  try{
    const xr = navigator.xr;
    if(xr && typeof xr.isSessionSupported === 'function'){
      // we can't await here without async; we use heuristic fallback
      // If user is on desktop with XR, they likely intended VR: let vr-ui handle button anyway.
    }
  }catch(_){}

  // Desktop vs mobile heuristic
  const w = Math.max(DOC.documentElement.clientWidth || 0, WIN.innerWidth || 0);
  const h = Math.max(DOC.documentElement.clientHeight || 0, WIN.innerHeight || 0);
  const bigScreen = Math.max(w,h) >= 900;
  const finePointer = matchMedia && matchMedia('(pointer:fine)').matches;

  if(!isMobileUA && bigScreen && finePointer) return 'pc';
  return 'mobile';
}

function once(fn){
  let done = false;
  return function(...args){
    if(done) return;
    done = true;
    return fn.apply(this, args);
  };
}

function waitForParticles(timeoutMs=1200){
  const t0 = performance.now();
  return new Promise((resolve)=>{
    function ok(){
      const P = (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles;
      if(P) return resolve(true);
      if(performance.now() - t0 > timeoutMs) return resolve(false);
      requestAnimationFrame(ok);
    }
    ok();
  });
}

const startOnce = once(async function start(){
  const view = String(detectViewAuto() || 'mobile').toLowerCase();
  setBodyView(view);

  // Pass-through parameters to engine
  const payload = {
    view,
    run: qs('run','play'),
    diff: qs('diff','normal'),
    time: qs('time','80'),
    seed: qs('seed', null),
    hub: qs('hub', null),

    // research params
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };

  // Best-effort: wait for FX core to be available (so early score pop/coach appears)
  await waitForParticles(1200);

  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR boot] engineBoot failed', err);
    // show a minimal on-screen error to help debugging in mobile
    try{
      const el = DOC.createElement('div');
      el.style.cssText = `
        position:fixed; inset:12px; z-index:9999;
        background:rgba(2,6,23,.92); color:#e5e7eb;
        border:1px solid rgba(148,163,184,.22);
        border-radius:18px; padding:14px;
        font: 700 13px/1.45 system-ui;
        overflow:auto;
      `;
      el.textContent = 'Boot error: ' + (err && (err.message||String(err)) ? (err.message||String(err)) : 'unknown');
      DOC.body.appendChild(el);
    }catch(_){}
  }
});

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

ready(()=> startOnce());

// Extra safety: if module loaded very early, ensure start triggers
setTimeout(()=> startOnce(), 300);