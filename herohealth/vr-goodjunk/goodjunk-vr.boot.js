// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION
// ✅ Sets body view classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ Does NOT override explicit ?view= (launcher already respects this)
// ✅ Calls goodjunk.safe.js boot() exactly once (guard)
// ✅ Pass-through context: view/run/diff/time/seed/hub/log/style/studyId/phase/conditionGroup
// ✅ Emits nothing itself; listens for hha:end to offer safe back-to-hub UX if needed

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch{ return false; } };

function clamp(v,min,max){ v = Number(v)||0; return Math.max(min, Math.min(max, v)); }

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='view-cvr') return 'cvr';
  if(v==='cvr') return 'cvr';
  if(v==='vr') return 'vr';
  if(v==='pc') return 'pc';
  if(v==='mobile') return 'mobile';
  return 'mobile';
}

function isLikelyMobileUA(){
  const ua = (navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

async function detectViewFallback(){
  // used only if no ?view= provided
  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  try{
    if(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok && isLikelyMobileUA()) guess = 'vr';
    }
  }catch(_){}

  return guess;
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.add('gj');
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  const v = normalizeView(view);
  if(v==='pc') b.classList.add('view-pc');
  else if(v==='vr') b.classList.add('view-vr');
  else if(v==='cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function getHub(){
  // hub= URL (encoded) from launcher/hub
  const hub = qs('hub', null);
  return hub;
}

function bindBackHubButton(){
  const hub = getHub();
  const btn = DOC.getElementById('btnBackHub');
  if(!btn) return;

  btn.addEventListener('click', ()=>{
    if(hub) location.href = hub;
    else alert('ยังไม่ได้ใส่ hub url');
  });
}

function bindEndAutoBack(){
  // optional safety: if user ends and wants back
  const hub = getHub();
  WIN.addEventListener('hha:end', ()=>{
    // ไม่ auto เด้งทันที (กันสะดุ้ง) — ผู้ใช้กดเองที่ปุ่ม ↩ กลับ HUB
    // แต่ถ้าคุณอยาก auto-back ใน research mode ค่อยเปิดในอนาคตได้
    void hub;
  }, { passive:true });
}

function onceGuard(){
  if(WIN.__HHA_GJ_BOOTED__) return false;
  WIN.__HHA_GJ_BOOTED__ = true;
  return true;
}

async function main(){
  if(!onceGuard()) return;

  // View: respect explicit param; otherwise fallback detect
  let view = has('view') ? normalizeView(qs('view','mobile')) : await detectViewFallback();
  setBodyView(view);

  // Wire buttons (back hub)
  bindBackHubButton();
  bindEndAutoBack();

  // Collect opts for engine
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = clamp(qs('time','80'), 20, 300);
  const seed = String(qs('seed', Date.now()));

  // (optional) show meta in chip if exists
  try{
    const chip = DOC.getElementById('gjChipMeta');
    if(chip){
      chip.textContent = `view=${view} · run=${run} · diff=${diff} · time=${time}`;
    }
  }catch(_){}

  // Start engine
  engineBoot({ view, run, diff, time, seed });
}

// DOM ready
if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', main, { once:true });
}else{
  main();
}