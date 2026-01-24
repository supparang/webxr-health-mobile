// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (B FULL)
// ✅ Auto view detect (no override if ?view= exists)
// ✅ Sets body classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ VRUI config: crosshair shoot lock + cooldown
// ✅ Flush-hardened (pagehide/visibilitychange/back hub)
// ✅ Boots SAFE engine: ./goodjunk.safe.js

import { boot as safeBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));

function isMobile(){
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.innerWidth < 860);
}

function detectViewAuto(){
  // IMPORTANT: do not override if ?view exists
  const v = String(qs('view','')).trim().toLowerCase();
  if(v) return v;

  // default: pc vs mobile
  return isMobile() ? 'mobile' : 'pc';
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

function getRunOpts(){
  const view = String(qs('view', detectViewAuto())).toLowerCase();
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

function initVRUI(){
  // vr-ui.js reads this config (if present) when it loads
  // (ถ้า vr-ui.js โหลดก่อน boot ก็ยัง OK เพราะมัน default ได้)
  WIN.HHA_VRUI_CONFIG = Object.assign(
    { lockPx: 28, cooldownMs: 90 },
    WIN.HHA_VRUI_CONFIG || {}
  );
}

function hardenFlush(){
  const L = WIN.HHACloudLogger;

  // best-effort flush function
  const flush = (why='flush')=>{
    try{
      if(L && typeof L.flush === 'function') L.flush({ reason: why });
      if(L && typeof L.flushNow === 'function') L.flushNow({ reason: why });
    }catch(_){}
  };

  // flush on leave
  WIN.addEventListener('pagehide', ()=>flush('pagehide'), { passive:true });
  WIN.addEventListener('beforeunload', ()=>flush('beforeunload'), { passive:true });

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flush('hidden');
  }, { passive:true });

  // also flush when game ends
  WIN.addEventListener('hha:end', ()=>flush('hha:end'), { passive:true });

  // back hub button flush (override behavior safely)
  const btnBack = DOC.getElementById('btnBackHub');
  if(btnBack){
    btnBack.addEventListener('click', (ev)=>{
      try{
        const hub = qs('hub', null);
        flush('backhub');
        // allow a tiny tick for async logger
        if(hub){
          ev.preventDefault();
          setTimeout(()=>{ location.href = hub; }, 60);
        }
      }catch(_){}
    }, { capture:true });
  }

  return flush;
}

function initLoggerContext(opts){
  // hha-cloud-logger.js ควรจะ “ดัก event” อยู่แล้ว
  // แต่เราส่ง context ไว้ให้ชัดเจน (ถ้ามีเมธอด)
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

function start(){
  const opts = getRunOpts();

  // 1) view classes
  setBodyView(opts.view);

  // 2) vrui config
  initVRUI();

  // 3) logger ctx + flush hardening
  initLoggerContext(opts);
  hardenFlush();

  // 4) boot SAFE engine
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