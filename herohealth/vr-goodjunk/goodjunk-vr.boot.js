// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PACK-FAIR (A+B)
// ✅ View modes: PC / Mobile / VR / cVR (body class)
// ✅ Reads query params and passes into goodjunk.safe.js boot(payload)
// ✅ Does NOT override ?view= if provided
// ✅ Safe: prevents double boot

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function has(k){
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}
function normView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='view-cvr') return 'cvr';
  if(v==='cvr') return 'cvr';
  if(v==='vr') return 'vr';
  if(v==='pc') return 'pc';
  if(v==='mobile') return 'mobile';
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
}

function buildPayload(){
  const payload = {};

  // view (default mobile) — do not invent "auto" here
  payload.view = normView(qs('view','mobile'));

  payload.run  = String(qs('run','play')||'play').toLowerCase();   // play | research
  payload.diff = String(qs('diff','normal')||'normal').toLowerCase();
  payload.time = Number(qs('time','80')||80) || 80;

  // seed:
  // - research expects deterministic; allow seed param
  // - play can use seed too (for reproducible testing)
  payload.seed = qs('seed', qs('ts', null));

  // hub/back
  payload.hub = qs('hub', null);

  // study passthrough
  payload.studyId = qs('studyId', qs('study', null));
  payload.phase = qs('phase', null);
  payload.conditionGroup = qs('conditionGroup', qs('cond', null));

  // style passthrough (optional)
  payload.style = qs('style', null);

  return payload;
}

function attachTopbarMeta(payload){
  try{
    const el = DOC.getElementById('gjChipMeta');
    if(!el) return;
    const v = payload.view || 'mobile';
    const run = payload.run || 'play';
    const diff = payload.diff || 'normal';
    const time = payload.time || 80;
    el.textContent = `view=${v} · run=${run} · diff=${diff} · time=${time}`;
  }catch(_){}
}

function configureVRUI(payload){
  // If vr-ui.js loaded, we can set config before it initializes.
  // But in our current vr-ui.js it reads window.HHA_VRUI_CONFIG on load.
  // We still set it here (safe).
  try{
    WIN.HHA_VRUI_CONFIG = Object.assign(
      { lockPx: 28, cooldownMs: 90 },
      WIN.HHA_VRUI_CONFIG || {}
    );

    // strict cVR: aim from center, no clicking targets needed (targets still clickable though)
    if(payload.view === 'cvr'){
      DOC.body.classList.add('view-cvr');
    } else {
      DOC.body.classList.remove('view-cvr');
    }
  }catch(_){}
}

function once(fn){
  let done = false;
  return function(){
    if(done) return;
    done = true;
    fn();
  };
}

const startOnce = once(()=>{
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const payload = buildPayload();
  setBodyView(payload.view);
  configureVRUI(payload);
  attachTopbarMeta(payload);

  // Ensure safe-zone measure runs (the inline script in HTML already does)
  // Here just a backup ping:
  try{
    setTimeout(()=>WIN.dispatchEvent(new Event('resize')), 120);
  }catch(_){}

  // Boot engine
  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR Boot] engineBoot failed', err);
    try{
      const msg = DOC.createElement('div');
      msg.style.cssText = 'position:fixed;inset:0;z-index:999;background:#020617;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font:900 14px/1.4 system-ui;';
      msg.textContent = 'GoodJunkVR: boot error — เปิด console ดูรายละเอียด';
      DOC.body.appendChild(msg);
    }catch(_){}
  }
});

function domReady(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
    setTimeout(fn, 0);
  }else{
    DOC.addEventListener('DOMContentLoaded', fn, { once:true });
  }
}

domReady(startOnce);

// also allow manual retry via console: window.GJ_REBOOT()
WIN.GJ_REBOOT = ()=>{
  try{ WIN.__GJ_BOOTED__ = false; }catch(_){}
  try{ startOnce(); }catch(_){}
};