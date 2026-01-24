// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION
// ✅ Auto-detect view ONLY when ?view=auto (no override if ?view= exists)
// ✅ Applies body classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ Pass-through params (hub/run/diff/time/seed/studyId/phase/conditionGroup/log)
// ✅ Starts engine (goodjunk.safe.js) exactly once when DOM ready
// ✅ Nudges safe-area measure (resize/orientation events) so --gj-top-safe/bottom-safe settle

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, d=null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }
  catch{ return d; }
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view==='pc') b.classList.add('view-pc');
  else if(view==='vr') b.classList.add('view-vr');
  else if(view==='cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function isProbablyMobile(){
  const ua = navigator.userAgent || '';
  const small = Math.min(WIN.innerWidth||9999, WIN.innerHeight||9999) <= 820;
  return /Android|iPhone|iPad|iPod|Mobi/i.test(ua) || small;
}

async function detectViewAuto(){
  // Best-effort: if XR immersive-vr supported -> 'vr' (but still let user enter VR via button)
  // Otherwise mobile/pc split
  try{
    if(navigator.xr && navigator.xr.isSessionSupported){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok) return 'vr';
    }
  }catch(_){}
  return isProbablyMobile() ? 'mobile' : 'pc';
}

function applyMetaChip(){
  const v = qs('view','auto');
  const run  = qs('run','play');
  const diff = qs('diff','normal');
  const time = qs('time','80');
  const chipMeta = DOC.getElementById('gjChipMeta');
  if(chipMeta) chipMeta.textContent = `view=${v} · run=${run} · diff=${diff} · time=${time}`;
}

function nudgeSafeMeasure(){
  // ให้สคริปต์ใน HTML ที่วัด gjTopbar/gjHudTop/gjHudBot ทำงานนิ่งขึ้น
  try{
    WIN.dispatchEvent(new Event('resize'));
    WIN.dispatchEvent(new Event('orientationchange'));
  }catch(_){}
  setTimeout(()=>{ try{ WIN.dispatchEvent(new Event('resize')); }catch(_){} }, 120);
  setTimeout(()=>{ try{ WIN.dispatchEvent(new Event('resize')); }catch(_){} }, 360);
}

let started = false;

async function start(){
  if(started) return;
  started = true;

  // Respect explicit ?view= (NO override)
  let view = String(qs('view','auto')).toLowerCase();
  if(view === 'auto'){
    view = await detectViewAuto();
  }

  // Normalize view values
  if(view === 'cardboard') view = 'cvr';
  if(!['pc','mobile','vr','cvr'].includes(view)) view = 'mobile';

  setBodyView(view);
  applyMetaChip();

  // Pass-through gameplay params
  const opts = {
    view,
    run:  qs('run','play'),
    diff: qs('diff','normal'),
    time: Number(qs('time','80')) || 80,
    seed: qs('seed', Date.now())
  };

  // optional research ctx passthrough (logger may read itself too)
  const ctx = {
    hub: qs('hub', null),
    log: qs('log', null),
    studyId: qs('studyId', null),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', null),
    style: qs('style', null)
  };
  try{ WIN.__HHA_CTX__ = ctx; }catch(_){}

  // Start engine
  engineBoot(opts);

  // After engine mounts, nudge safe-area measure
  nudgeSafeMeasure();
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', start, { once:true });
}else{
  start();
}