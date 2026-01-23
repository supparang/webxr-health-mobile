// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Spacious Layout A)
// ✅ Sets body view class: view-pc / view-mobile / view-vr / view-cvr
// ✅ Reads query params + passes through to goodjunk.safe.js boot()
// ✅ Prevent double-boot
// ✅ Starts after DOM ready + one beat (so updateSafe in HTML has time to set vars)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function has(k){
  try{ return new URL(location.href).searchParams.has(k); }
  catch{ return false; }
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
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(
    view==='pc' ? 'view-pc' :
    view==='vr' ? 'view-vr' :
    view==='cvr'? 'view-cvr' : 'view-mobile'
  );
}

function parseNumber(v, fallback){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildOpts(){
  const view = normView(qs('view','mobile'));
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = parseNumber(qs('time','80'), 80);
  const seed = String(qs('seed', Date.now()));

  // passthrough context (optional for logging/research)
  const hub = qs('hub', null);
  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));
  const style = qs('style', null);
  const log = qs('log', null);
  const ts = qs('ts', null);

  return { view, run, diff, time, seed, hub, studyId, phase, conditionGroup, style, log, ts };
}

function markMeta(opts){
  // update chip meta if exists
  try{
    const chip = DOC.getElementById('gjChipMeta');
    if(chip){
      chip.textContent = `view=${opts.view} · run=${opts.run} · diff=${opts.diff} · time=${opts.time}`;
    }
  }catch(_){}
}

function startOnce(){
  if(WIN.__HHA_GJ_BOOTED__) return;
  WIN.__HHA_GJ_BOOTED__ = true;

  const opts = buildOpts();
  setBodyView(opts.view);
  markMeta(opts);

  // Give HTML safe-measure script time to set CSS vars (--gj-top-safe/--gj-bottom-safe)
  // and let vr-ui mount its controls
  setTimeout(()=>{
    try{
      engineBoot(opts);
    }catch(err){
      console.error('[GoodJunkVR] boot failed:', err);
      // allow retry by refreshing
      WIN.__HHA_GJ_BOOTED__ = false;
      alert('เริ่มเกมไม่สำเร็จ (boot error) — ลองรีเฟรชอีกครั้ง');
    }
  }, 180);
}

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

ready(()=>{
  // If view not provided, do NOT override here (launcher already decides).
  // Just start using whatever is in URL.
  startOnce();
});