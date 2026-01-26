// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (B FULL + Pack 14 Practice 15s)

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
  const v = String(qs('view','')).trim().toLowerCase();
  if(v) return v;
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
  else b.classList.add('view-mobile');
}

function getRunOpts(){
  const view = String(qs('view', detectViewAuto())).toLowerCase();
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = clamp(qs('time','80'), 20, 300);
  const seed = String(qs('seed', Date.now()));

  const hub = qs('hub', null);
  const studyId = qs('studyId', null);
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', null);
  const log = qs('log', null);

  return { view, run, diff, time, seed, hub, studyId, phase, conditionGroup, log };
}

function initVRUI(){
  WIN.HHA_VRUI_CONFIG = Object.assign(
    { lockPx: 28, cooldownMs: 90 },
    WIN.HHA_VRUI_CONFIG || {}
  );
}

function hardenFlush(){
  const L = WIN.HHACloudLogger;
  const flush = (why='flush')=>{
    try{
      if(L && typeof L.flush === 'function') L.flush({ reason: why });
      if(L && typeof L.flushNow === 'function') L.flushNow({ reason: why });
    }catch(_){}
  };

  WIN.addEventListener('pagehide', ()=>flush('pagehide'), { passive:true });
  WIN.addEventListener('beforeunload', ()=>flush('beforeunload'), { passive:true });

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flush('hidden');
  }, { passive:true });

  WIN.addEventListener('hha:end', ()=>flush('hha:end'), { passive:true });

  const btnBack = DOC.getElementById('btnBackHub');
  if(btnBack){
    btnBack.addEventListener('click', (ev)=>{
      try{
        const hub = qs('hub', null);
        flush('backhub');
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

function redirect(url){
  try{ location.replace(url); }catch(_){ location.href = url; }
}

function start(){
  const opts = getRunOpts();

  // 0) Practice preflight (Pack 14)
  // - default: only VR/cVR do practice (run=play -> run=practice)
  try{
    const P = WIN.HHAPractice;
    if(P && typeof P.preflight === 'function'){
      const r = P.preflight({ practiceSec: 15, views:['vr','cvr'], practiceDiff:'easy' });
      if(r && r.action === 'redirect' && r.url){
        redirect(r.url);
        return;
      }
    }
  }catch(_){}

  // 1) view classes
  setBodyView(opts.view);

  // 2) vrui config
  initVRUI();

  // 3) logger ctx + flush hardening
  const flush = hardenFlush();
  initLoggerContext(opts);

  // 4) show overlay if this is practice run
  try{
    if(opts.run === 'practice' && WIN.HHAPractice){
      WIN.HHAPractice.setOverlay?.('Practice 15s — ฝึกก่อนเริ่มรอบจริง');
    }else{
      WIN.HHAPractice?.hideOverlay?.();
    }
  }catch(_){}

  // 5) if practice ends -> redirect to real run
  //    (we listen once and check run=practice)
  WIN.addEventListener('hha:end', ()=>{
    try{
      if(opts.run !== 'practice') return;

      // best-effort flush before redirect
      try{ flush && flush('practice->real'); }catch(_){}

      const P = WIN.HHAPractice;
      const next = P && typeof P.onEndRedirect === 'function' ? P.onEndRedirect() : null;
      if(next){
        setTimeout(()=>redirect(next), 120);
      }
    }catch(_){}
  }, { passive:true, once:false });

  // 6) boot SAFE engine
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