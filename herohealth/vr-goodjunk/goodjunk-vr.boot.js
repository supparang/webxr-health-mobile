// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Fair Pack)
// ✅ Sets body view class: view-pc / view-mobile / view-vr / view-cvr
// ✅ Pass-through opts -> goodjunk.safe.js boot()
// ✅ Boot once (guarded)
// ✅ Works with vr-ui.js (hha:shoot) in cVR strict
// ✅ Safe DOM-ready init

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

function normView(v){
  v = String(v||'').toLowerCase();
  if(v==='view-cvr') v='cvr';
  if(v==='cardboard') v='vr';
  if(v!=='pc' && v!=='mobile' && v!=='vr' && v!=='cvr') v='mobile';
  return v;
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add('view-'+view);
}

function parseNumber(v, def){
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function once(fn){
  let done=false;
  return (...args)=>{
    if(done) return;
    done=true;
    try{ fn(...args); }catch(e){ console.error(e); }
  };
}

function init(){
  const view = normView(qs('view','mobile'));
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = parseNumber(qs('time','80'), 80);
  const seed = String(qs('seed', String(Date.now())));

  setBodyView(view);

  // optional: meta chip already handled in HTML wiring, but safe to set here too
  try{
    const chip = DOC.getElementById('gjChipMeta');
    if(chip){
      chip.textContent = `view=${view} · run=${run} · diff=${diff} · time=${time}`;
    }
  }catch(_){}

  // boot engine
  engineBoot({
    view,
    run,
    diff,
    time,
    seed,

    // passthrough extras (if later you want logger/ctx)
    hub: qs('hub', null),
    log: qs('log', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
    style: qs('style', null),
    ts: qs('ts', null),
  });
}

const bootOnce = once(init);

// DOM ready guard
if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
  bootOnce();
}else{
  DOC.addEventListener('DOMContentLoaded', bootOnce, { once:true });
  // extra safety (some Android WebViews)
  setTimeout(bootOnce, 600);
}