// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ Imports: ./goodjunk.safe.js (FAIR PACK v2: STAR+SHIELD+SHOOT)
// ✅ View modes: pc / mobile / vr / cvr (view=cvr => view-cvr strict supported by vr-ui.js)
// ✅ Robust DOM-ready + single-boot guard
// ✅ Sets body view classes for CSS tuning
// ✅ Optional: forwards ctx to logger if present (non-breaking)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch(_){ return def; }
}
function has(k){
  try{ return new URL(location.href).searchParams.has(k); }
  catch(_){ return false; }
}
function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}
function normView(v){
  v = String(v || '').toLowerCase();
  if(v === 'cardboard') return 'vr';
  if(v === 'view-cvr') return 'cvr';
  if(v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'pc') return 'pc';
  if(v === 'mobile') return 'mobile';
  return 'mobile';
}
function setBodyView(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-vr','view-cvr');
  else b.classList.add('view-mobile');
}

// best-effort: wait until essential nodes exist
function waitForDomReady(){
  return new Promise((resolve)=>{
    const t0 = Date.now();
    const MAX = 2500;

    const tick = ()=>{
      const ok =
        DOC.getElementById('gj-layer') &&
        DOC.getElementById('hud-score') &&
        DOC.getElementById('hud-time') &&
        DOC.getElementById('hud-miss') &&
        DOC.getElementById('hud-grade');
      if(ok) return resolve(true);
      if(Date.now() - t0 > MAX) return resolve(false);
      requestAnimationFrame(tick);
    };

    if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
      requestAnimationFrame(tick);
    }else{
      DOC.addEventListener('DOMContentLoaded', ()=>requestAnimationFrame(tick), { once:true });
    }
  });
}

function buildCtx(){
  const view = normView(qs('view','mobile'));
  const run  = String(qs('run','play')).toLowerCase();     // play | research (ถ้ามี)
  const diff = String(qs('diff','normal')).toLowerCase();  // easy|normal|hard (แล้วแต่คุณ)
  const time = clamp(qs('time','80'), 20, 300);
  const seed = String(qs('seed', Date.now()));
  const hub  = qs('hub', null);
  const log  = qs('log', null);

  return { view, run, diff, time, seed, hub, log };
}

// optional: forward ctx to cloud logger if present (doesn't assume API)
function tryInitLogger(ctx){
  try{
    // Common patterns (non-breaking)
    // - if logger listens to events, it will capture hha:start/hha:end already.
    // - if logger exposes a function, we call it guarded.
    const L = WIN.HHA_LOGGER || WIN.hhaLogger || WIN.__HHA_LOGGER__;
    if(!L) return;

    if(typeof L.setContext === 'function'){
      L.setContext({ game:'GoodJunkVR', ...ctx });
    }else if(typeof L.init === 'function'){
      L.init({ game:'GoodJunkVR', ...ctx });
    }
  }catch(_){}
}

async function main(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const ctx = buildCtx();
  setBodyView(ctx.view);

  // ensure chip shows correct meta (if present)
  try{
    const chip = DOC.getElementById('gjChipMeta');
    if(chip) chip.textContent = `view=${ctx.view} · run=${ctx.run} · diff=${ctx.diff} · time=${ctx.time}`;
  }catch(_){}

  // wait for DOM nodes (still boot even if timeout)
  await waitForDomReady();

  // logger (optional)
  tryInitLogger(ctx);

  // BOOT ENGINE (FAIR PACK)
  try{
    engineBoot({
      view: ctx.view,
      run:  ctx.run,
      diff: ctx.diff,
      time: ctx.time,
      seed: ctx.seed
    });
  }catch(err){
    console.error('[GoodJunkVR boot] engineBoot failed', err);
    try{
      // show minimal error to user
      alert('GoodJunkVR: เปิดเกมไม่สำเร็จ (ดู Console เพื่อรายละเอียด)');
    }catch(_){}
  }
}

// kick
main();