// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (A+B+V)
// ✅ Auto-detect view (PC/Mobile/VR/Cardboard/cVR) BUT:
//    - If URL already has ?view=..., DO NOT override
// ✅ Sets body classes: view-pc | view-mobile | view-vr | view-cvr
// ✅ Pass-through: hub/run/diff/time/seed/studyId/phase/conditionGroup/ts
// ✅ Starts engine once DOM ready (no double boot)

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
  if(!b) return v;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(v==='pc') b.classList.add('view-pc');
  else if(v==='vr') b.classList.add('view-vr');
  else if(v==='cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
  return v;
}
function detectView(){
  if(hasParam('view')){
    const v = String(qs('view','')||'').toLowerCase();
    return normalizeView(v || 'mobile');
  }

  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  const xr = navigator && navigator.xr;
  if(xr && typeof xr.isSessionSupported === 'function'){
    xr.isSessionSupported('immersive-vr').then((ok)=>{
      if(hasParam('view')) return; // still honor "no override"
      if(ok){
        const v = isLikelyMobileUA() ? 'vr' : 'pc';
        applyView(v);
      }
    }).catch(()=>{});
  }

  return normalizeView(guess);
}
function buildPayload(){
  const view = detectView();
  const run  = String(qs('run','play') || 'play').toLowerCase();
  const diff = String(qs('diff','normal') || 'normal').toLowerCase();
  const time = clamp(qs('time', 80), 20, 300);
  const seed = (qs('seed', null) ?? qs('ts', null) ?? String(Date.now()));
  const hub = qs('hub', null);

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
  payload.view = applyView(payload.view);
  updateChipMeta(payload);

  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR boot] engineBoot failed:', err);
    alert('GoodJunkVR: engine boot error. ดู console เพื่อรายละเอียด');
  }
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', safeInit, { once:true });
}else{
  safeInit();
}