// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (A) for Folder-run
// ✅ Auto view detect: pc / mobile / vr / cvr (no launcher needed)
// ✅ Adds body classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ Enables right eye layer only for cVR
// ✅ Passes URL params to goodjunk.safe.js boot()
// ✅ Keeps "no duplicate end overlay listener": safe.js handles end overlay (if you wired it there)
// ✅ Loads gracefully even if some optional DOM nodes are missing

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function clamp(n, a, b){
  n = Number(n) || 0;
  if(n < a) return a;
  if(n > b) return b;
  return n;
}

function hasXR(){
  return !!(navigator && navigator.xr);
}

function isLikelyMobile(){
  const ua = (navigator.userAgent || '').toLowerCase();
  const coarse = (WIN.matchMedia && WIN.matchMedia('(pointer: coarse)').matches) ? true : false;
  const small = Math.min(DOC.documentElement.clientWidth || 9999, DOC.documentElement.clientHeight || 9999) < 860;
  return coarse || /android|iphone|ipad|ipod|mobile/.test(ua) || small;
}

function detectView(){
  // 1) explicit override (still allowed as query param, but you can choose to ignore if you want "hard no override")
  const v = String(qs('view', 'auto') || 'auto').toLowerCase();
  if(v && v !== 'auto'){
    if(v === 'pc') return 'pc';
    if(v === 'mobile') return 'mobile';
    if(v === 'vr') return 'vr';
    if(v === 'cvr') return 'cvr';
  }

  // 2) heuristics
  // If WebXR exists and device is mobile, prefer cVR (Cardboard style) by default
  if(hasXR() && isLikelyMobile()){
    return 'cvr';
  }

  // If WebXR exists but not mobile => pc view (still can Enter VR via button)
  if(hasXR() && !isLikelyMobile()){
    return 'pc';
  }

  // No XR => pc or mobile
  return isLikelyMobile() ? 'mobile' : 'pc';
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

function setLayerMode(view){
  // right layer only visible in cVR (dual-eye overlay)
  const r = DOC.getElementById('gj-layer-r');
  if(!r) return;
  if(view === 'cvr'){
    r.setAttribute('aria-hidden','false');
  }else{
    r.setAttribute('aria-hidden','true');
  }
}

function patchTopbarPointer(){
  // ensure topbar buttons clickable even over XR canvas
  const top = DOC.querySelector('.gj-topbar');
  if(top) top.style.pointerEvents = 'auto';
}

function ensureVrUiLoaded(){
  // In your HTML you already load ../vr/vr-ui.js
  // This is just a safety “wait until present” hook (no hard dependency).
  // vr-ui.js emits hha:shoot -> safe.js listens.
  return true;
}

function readRunParams(){
  const run  = String(qs('run','play') || 'play').toLowerCase();     // play|research
  const diff = String(qs('diff','normal') || 'normal').toLowerCase();// easy|normal|hard
  const time = clamp(qs('time','80'), 20, 300);
  const seed = qs('seed', null) ?? qs('ts', null) ?? null;
  const hub  = qs('hub', null);

  // study params (optional passthrough)
  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  return { run, diff, time, seed, hub, studyId, phase, conditionGroup };
}

function updateChip(){
  const chip = DOC.getElementById('gjChipMeta');
  if(!chip) return;
  const { run, diff, time } = readRunParams();
  const view = detectView();
  chip.textContent = `view=${view} · run=${run} · diff=${diff} · time=${time}`;
}

function bootEngine(){
  const view = detectView();
  setBodyView(view);
  setLayerMode(view);
  patchTopbarPointer();
  ensureVrUiLoaded();

  const P = readRunParams();

  // IMPORTANT: pass the view we decided (do not trust query if you want hard auto)
  const payload = {
    view,
    run: P.run,
    diff: P.diff,
    time: P.time,
    seed: P.seed,
    hub: P.hub,

    // study passthrough
    studyId: P.studyId,
    phase: P.phase,
    conditionGroup: P.conditionGroup,
  };

  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR boot] engineBoot failed:', err);
    // show minimal on-screen error (kid-safe)
    try{
      const box = DOC.createElement('div');
      box.style.cssText = `
        position:fixed; inset:0; z-index:9999;
        display:flex; align-items:center; justify-content:center;
        background:rgba(2,6,23,.92); color:#e5e7eb;
        font:900 16px/1.4 system-ui; padding:18px;
      `;
      box.innerHTML = `<div style="max-width:680px">
        <div style="font-size:20px;margin-bottom:10px">เกิดข้อผิดพลาดในการเริ่มเกม</div>
        <div style="opacity:.8">เปิด DevTools เพื่อดูรายละเอียด หรือรีเฟรชใหม่</div>
      </div>`;
      DOC.body.appendChild(box);
    }catch(_){}
  }

  // refresh chips after boot
  updateChip();
}

function onReady(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

onReady(()=>{
  bootEngine();

  // update view on resize/orientation (do NOT change view once chosen; only refresh safe vars + chip)
  WIN.addEventListener('resize', ()=>{ try{ updateChip(); }catch(_){} }, { passive:true });
  WIN.addEventListener('orientationchange', ()=>{ try{ updateChip(); }catch(_){} }, { passive:true });
});