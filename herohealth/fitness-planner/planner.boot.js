'use strict';

const $  = (s)=>document.querySelector(s);

function fatal(msg){
  const box = document.getElementById('fp-fatal');
  if(!box){ alert(msg); return; }
  box.textContent = msg;
  box.classList.remove('fp-hidden');
}

window.addEventListener('error', (e)=>{
  fatal('JS ERROR:\n' + (e?.message||e) + '\n\n' + (e?.filename||'') + ':' + (e?.lineno||'') + ':' + (e?.colno||''));
});
window.addEventListener('unhandledrejection', (e)=>{
  fatal('PROMISE REJECTION:\n' + (e?.reason?.message || e?.reason || e));
});

function getQS(){
  try { return new URL(location.href).searchParams; }
  catch(e){ return new URLSearchParams(); }
}

function safeNum(x, d=0){
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

function getViewAuto(){
  // Respect existing ?view= (DO NOT override)
  const qs = getQS();
  const v = (qs.get('view')||'').toLowerCase();
  if(v) return v;

  // auto-detect: mobile => cvr, desktop => pc
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
  return isMobile ? 'cvr' : 'pc';
}

function ctxFromQS(qs){
  // passthrough context for research/logging compatibility
  const ctx = {
    hub: qs.get('hub') || '../hub.html',
    run: qs.get('run') || '',
    view: getViewAuto(),
    seed: safeNum(qs.get('seed'), Date.now()),
    pid: qs.get('pid') || qs.get('participantId') || '',
    studyId: qs.get('studyId') || '',
    phase: qs.get('phase') || '',
    conditionGroup: qs.get('conditionGroup') || '',
    log: qs.get('log') || '', // endpoint
    time: qs.get('time') || ''
  };
  return ctx;
}

function setBackHub(ctx){
  const a = $('#fp-backhub');
  if(!a) return;
  try{
    const u = new URL(ctx.hub, location.href);
    // passthrough some ctx back if needed
    if(ctx.pid) u.searchParams.set('pid', ctx.pid);
    if(ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
    if(ctx.phase) u.searchParams.set('phase', ctx.phase);
    if(ctx.conditionGroup) u.searchParams.set('conditionGroup', ctx.conditionGroup);
    a.href = u.toString();
  }catch(e){
    a.href = ctx.hub;
  }
}

async function boot(){
  const qs = getQS();
  const ctx = ctxFromQS(qs);

  // show ctx
  $('#fp-ctx-view').textContent = ctx.view;
  $('#fp-ctx-seed').textContent = String(ctx.seed >>> 0);
  setBackHub(ctx);

  // apply body class for view if you want (optional)
  document.body.dataset.view = ctx.view;

  // Start engine (standalone, no modules)
  if(!window.HHA_FITNESS_PLANNER || typeof window.HHA_FITNESS_PLANNER.boot !== 'function'){
    throw new Error('planner.safe.js not loaded or missing HHA_FITNESS_PLANNER.boot()');
  }

  window.HHA_FITNESS_PLANNER.boot({
    ctx,
    rng: seededRng(ctx.seed),
    now
  });
}

boot().catch((e)=>fatal(String(e?.stack || e?.message || e)));