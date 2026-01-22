// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ Reads qs: view/run/diff/time/seed (NO override)
// ✅ Applies body view class: view-pc / view-mobile / view-vr / view-cvr
// ✅ Boots engine: goodjunk.safe.js
// ✅ Safe start after DOM ready

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch(_){ return def; }
}

function normView(v){
  v = String(v || '').toLowerCase();
  if(v === 'cardboard') return 'vr';
  if(v === 'view-cvr') return 'cvr';
  if(v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'pc') return 'pc';
  if(v === 'mobile') return 'mobile';
  if(v === 'auto' || !v) return 'mobile'; // default safe
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
  // extra alias (บางไฟล์ชอบเช็ค)
  if(view === 'cvr') b.classList.add('view-cvr');
}

function updateChipMeta({view, run, diff, time}){
  const el = DOC.getElementById('gjChipMeta');
  if(!el) return;
  el.textContent = `view=${view} · run=${run} · diff=${diff} · time=${time}`;
}

function safeNum(v, fallback){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function start(){
  const view = normView(qs('view','mobile'));
  const run  = String(qs('run','play') || 'play').toLowerCase();
  const diff = String(qs('diff','normal') || 'normal').toLowerCase();
  const time = safeNum(qs('time','80'), 80);
  const seed = String(qs('seed', Date.now()));

  setBodyView(view);
  updateChipMeta({ view, run, diff, time });

  // Boot SAFE engine
  try{
    engineBoot({ view, run, diff, time, seed });
  }catch(err){
    console.error('[GoodJunkVR boot] engineBoot failed:', err);
    alert('GoodJunkVR: เริ่มเกมไม่สำเร็จ (ดู console)');
  }
}

// start when DOM ready
if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', start, { once:true });
}else{
  start();
}

// optional: expose for debugging
WIN.GJ_BOOT = { start };