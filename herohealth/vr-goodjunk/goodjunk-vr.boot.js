// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (A+B+V)
// ✅ Auto-detect view (PC/Mobile/VR/Cardboard/cVR) BUT:
//    - If URL already has ?view=..., DO NOT override (per requirement)
// ✅ Sets body classes: view-pc | view-mobile | view-vr | view-cvr
// ✅ Pass-through: hub/run/diff/time/seed/studyId/phase/conditionGroup/ts/seed
// ✅ Starts engine once DOM ready (no double boot)
// ✅ Works with ../vr/vr-ui.js emitting hha:shoot (cVR strict aims center)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function hasParam(k){
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}
function clamp(v, a, b){
  v = Number(v);
  if(!isFinite(v)) v = a;
  return (v<a)?a:(v>b)?b:v;
}

function isLikelyMobileUA(){
  const ua = (navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

function detectView(){
  // ✅ DO NOT override if user already specified ?view=
  if(hasParam('view')){
    const v = String(qs('view','')||'').toLowerCase();
    return v || 'mobile';
  }

  // Detect WebXR immersive-vr support (Cardboard / VR)
  const nav = navigator;
  const xr = nav && nav.xr;

  // Default guess first
  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // If WebXR is available, try to test immersive-vr
  if(xr && typeof xr.isSessionSupported === 'function'){
    xr.isSessionSupported('immersive-vr').then((ok)=>{
      // If VR supported and on mobile => treat as "vr"
      // NOTE: we still won't force cVR here; cVR is explicitly via URL (?view=cvr) or your loader.
      if(ok){
        const isMobile = isLikelyMobileUA();
        const v = isMobile ? 'vr' : 'pc';
        applyView(v);
      }
    }).catch(()=>{});
  }

  return guess;
}

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='vr') return 'vr';
  if(v==='cvr' || v==='view-cvr') return 'cvr';
  if(v==='pc') return 'pc';
  return 'mobile';
}

function applyView(v){
  v = normalizeView(v);
  const b = DOC.body;
  if(!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  if(v==='pc') b.classList.add('view-pc');
  else if(v==='vr') b.classList.add('view-vr');
  else if(v==='cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');

  // For VR/cVR: show right-eye layer (CSS relies on these classes)
  // NOTE: goodjunk.safe.js already checks view param too, but class helps CSS.
}

function buildPayload(){
  // passthrough params (HHA standard)
  const view = normalizeView(detectView());
  const run  = String(qs('run','play') || 'play').toLowerCase();      // play | research | practice (if you add)
  const diff = String(qs('diff','normal') || 'normal').toLowerCase(); // easy | normal | hard
  const time = clamp(qs('time', 80), 20, 300);

  // seed: prefer explicit seed, else ts, else Date.now
  const seed = (qs('seed', null) ?? qs('ts', null) ?? String(Date.now()));

  const hub = qs('hub', null);

  // study params for logger
  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  return { view, run, diff, time, seed, hub, studyId, phase, conditionGroup };
}

function updateChipMeta(payload){
  const el = DOC.getElementById('gjChipMeta');
  if(!el) return;
  el.textContent = `view=${payload.view} · run=${payload.run} · diff=${payload.diff} · time=${payload.time}`;
}

function safeInit(){
  if(WIN.__GOODJUNK_BOOTED__) return;
  WIN.__GOODJUNK_BOOTED__ = true;

  const payload = buildPayload();
  applyView(payload.view);
  updateChipMeta(payload);

  // If cVR strict, make sure right-eye layer is visible (CSS already handles)
  // engineBoot will attach hha:shoot listener and handle crosshair hits.
  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR boot] engineBoot failed:', err);
    alert('GoodJunkVR: engine boot error. ดู console เพื่อรายละเอียด');
  }
}

// DOM Ready
if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', safeInit, { once:true });
}else{
  safeInit();
}

// optional: keep view classes in sync if user changes URL manually (rare)
WIN.addEventListener('popstate', ()=>{
  try{
    const payload = buildPayload();
    applyView(payload.view);
    updateChipMeta(payload);
  }catch(_){}
}, { passive:true });