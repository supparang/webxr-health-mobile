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

/**
 * View conventions in HeroHealth:
 * - pc
 * - mobile
 * - cvr / cardboard (optional, if user explicitly sets ?view=cvr)
 */
function getViewAuto(){
  // Respect existing ?view= (DO NOT override)
  const qs = getQS();
  const v = (qs.get('view')||'').toLowerCase().trim();
  if(v) return v;

  // Auto-detect: mobile => mobile, desktop => pc
  const ua = navigator.userAgent || '';
  const coarse = (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) || false;
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const small = Math.min(window.innerWidth||9999, window.innerHeight||9999) <= 820;

  return (coarse || isMobileUA || small) ? 'mobile' : 'pc';
}

function ctxFromQS(qs){
  // Real-use defaults (consistent with hub/game patterns)
  const ctx = {
    hub: qs.get('hub') || '../hub.html',

    // play / research / practice (up to your safe.js)
    run: (qs.get('run') || 'play'),

    // pc/mobile/cvr — auto if missing
    view: getViewAuto(),

    // deterministic-ish by default if seed missing
    seed: safeNum(qs.get('seed'), Date.now()),

    // participant context
    pid: qs.get('pid') || qs.get('participantId') || '',
    studyId: qs.get('studyId') || '',
    phase: qs.get('phase') || '',
    conditionGroup: qs.get('conditionGroup') || '',

    // logging endpoint if any
    log: qs.get('log') || '',

    // difficulty + time budget (planner/game can interpret)
    diff: (qs.get('diff') || 'normal'),
    time: safeNum(qs.get('time'), 90)
  };
  return ctx;
}

function setBackHub(ctx){
  const a = $('#fp-backhub');
  if(!a) return;
  try{
    const u = new URL(ctx.hub, location.href);

    // passthrough back-context (keep continuity)
    if(ctx.pid) u.searchParams.set('pid', ctx.pid);
    if(ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
    if(ctx.phase) u.searchParams.set('phase', ctx.phase);
    if(ctx.conditionGroup) u.searchParams.set('conditionGroup', ctx.conditionGroup);

    // also keep these if hub wants to show ctx pills
    if(ctx.view) u.searchParams.set('view', ctx.view);
    if(ctx.run)  u.searchParams.set('run', ctx.run);
    if(ctx.diff) u.searchParams.set('diff', ctx.diff);
    if(Number.isFinite(ctx.time)) u.searchParams.set('time', String(ctx.time));
    if(ctx.seed) u.searchParams.set('seed', String(ctx.seed >>> 0));

    a.href = u.toString();
  }catch(e){
    a.href = ctx.hub;
  }
}

async function boot(){
  const qs = getQS();
  const ctx = ctxFromQS(qs);

  // show ctx (safe if some elements not present)
  const vView = $('#fp-ctx-view'); if(vView) vView.textContent = ctx.view;
  const vSeed = $('#fp-ctx-seed'); if(vSeed) vSeed.textContent = String(ctx.seed >>> 0);
  const vDiff = $('#fp-ctx-diff'); if(vDiff) vDiff.textContent = String(ctx.diff || '-');
  const vTime = $('#fp-ctx-time'); if(vTime) vTime.textContent = String(ctx.time || '-');
  const vRun  = $('#fp-ctx-run');  if(vRun)  vRun.textContent  = String(ctx.run || '-');

  setBackHub(ctx);

  // apply body dataset for CSS tweaks per view if needed
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