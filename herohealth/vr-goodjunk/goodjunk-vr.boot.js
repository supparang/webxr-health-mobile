// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (B FULL — FIXED)
// ✅ Auto view detect (no override if ?view= exists)
// ✅ Normalizes view: pc/mobile/vr/cvr + cardboard/view-cvr/auto
// ✅ Sets body classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ VRUI config set EARLY (before vr-ui.js reads it)
// ✅ Flush-hardened (pagehide/visibilitychange/beforeunload/hha:end/back hub)
// ✅ Boots SAFE engine: ./goodjunk.safe.js

import { boot as safeBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };
const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));

/** 1) Set VRUI config EARLY (สำคัญมาก) */
WIN.HHA_VRUI_CONFIG = Object.assign(
  { lockPx: 28, cooldownMs: 90 },
  WIN.HHA_VRUI_CONFIG || {}
);

function isMobile(){
  const ua = (navigator.userAgent || '').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua) || (WIN.innerWidth < 860);
}

function normalizeView(v){
  v = String(v || '').trim().toLowerCase();
  if(!v) return '';
  if(v === 'view-cvr') return 'cvr';
  if(v === 'cardboard') return 'vr';
  if(v === 'auto') return ''; // treat as not provided
  if(v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return v;
  return '';
}

async function detectViewAuto(){
  // IMPORTANT: do not override if ?view exists (even if view=auto)
  const vRaw = qs('view','');
  const vNorm = normalizeView(vRaw);
  if(has('view') && vNorm) return vNorm;
  if(has('view') && !vNorm) {
    // user explicitly passed view=auto or unknown -> fallback to auto
    // (still counts as "do not override": we won't set view param)
  }

  // base guess
  let guess = isMobile() ? 'mobile' : 'pc';

  // best-effort WebXR detection: if immersive-vr supported, allow 'vr' (prefer on mobile)
  try{
    if(!has('view') && navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok && isMobile()) guess = 'vr';
    }
  }catch(_){}

  return guess;
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.add('gj');
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  if(view === 'cvr') b.classList.add('view-cvr');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'pc') b.classList.add('view-pc');
  else b.classList.add('view-mobile'); // fallback
}

function getRunOptsSync(viewResolved){
  const view = String(viewResolved || 'mobile').toLowerCase();

  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = clamp(qs('time','80'), 20, 300);
  const seed = String(qs('seed', Date.now()));

  // passthrough ctx (for logger)
  const hub = qs('hub', null);
  const studyId = qs('studyId', null);
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', null);
  const log = qs('log', null);

  return { view, run, diff, time, seed, hub, studyId, phase, conditionGroup, log };
}

function hardenFlush(){
  const flush = (why='flush')=>{
    try{
      const L = WIN.HHACloudLogger;
      if(L && typeof L.flushNow === 'function') L.flushNow({ reason: why });
      else if(L && typeof L.flush === 'function') L.flush({ reason: why });
    }catch(_){}
  };

  WIN.addEventListener('pagehide', ()=>flush('pagehide'), { passive:true });
  WIN.addEventListener('beforeunload', ()=>flush('beforeunload'), { passive:true });

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flush('hidden');
  }, { passive:true });

  WIN.addEventListener('hha:end', ()=>flush('hha:end'), { passive:true });

  // back hub button flush (capture เพื่อชนะ handler เดิมในหน้า)
  const btnBack = DOC.getElementById('btnBackHub');
  if(btnBack){
    btnBack.addEventListener('click', (ev)=>{
      try{
        const hub = qs('hub', null);
        flush('backhub');
        if(hub){
          ev.preventDefault();
          setTimeout(()=>{ location.href = hub; }, 80);
        }
      }catch(_){}
    }, { capture:true });
  }

  return flush;
}

function initLoggerContext(opts){
  const L = WIN.HHACloudLogger;
  if(!L) return;

  const ctx = {
    game: 'GoodJunkVR',
    pack: 'fair',
    view: opts.view,
    runMode: opts.run,
    diff: opts.diff,
    timePlanSec: opts.time,
    seed: opts.seed,
    hub: opts.hub,
    studyId: opts.studyId,
    phase: opts.phase,
    conditionGroup: opts.conditionGroup,
    log: opts.log
  };

  try{
    if(typeof L.setContext === 'function') L.setContext(ctx);
    else if(typeof L.init === 'function') L.init(ctx);
  }catch(_){}
}

async function start(){
  // 1) resolve view (no override if ?view= exists)
  const view = normalizeView(qs('view','')) || await detectViewAuto();

  // 2) set body classes
  setBodyView(view);

  // 3) build opts
  const opts = getRunOptsSync(view);

  // 4) logger ctx + flush hardening
  initLoggerContext(opts);
  hardenFlush();

  // 5) boot SAFE engine
  safeBoot({
    view: opts.view,
    run:  opts.run,
    diff: opts.diff,
    time: opts.time,
    seed: opts.seed
  });
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', start, { once:true });
}else{
  start();
}