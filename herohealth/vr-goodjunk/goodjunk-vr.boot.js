// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ View modes: PC / Mobile / VR / cVR (via body classes)
// ✅ Starts engine once DOM ready
// ✅ Pass-through ctx (hub/run/diff/time/seed/studyId/phase/conditionGroup/log/style)
// ✅ Does NOT override view if already present (handled in launcher)
// ✅ Works with: ../vr/vr-ui.js (crosshair/tap-to-shoot emits hha:shoot)

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

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='vr') return 'vr';
  if(v==='cvr' || v==='view-cvr') return 'cvr';
  if(v==='pc') return 'pc';
  if(v==='mobile') return 'mobile';
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr','view-auto');
  b.classList.add('view-'+view);

  // helpful flags (optional)
  if(view==='cvr') b.classList.add('is-cvr');
  else b.classList.remove('is-cvr');

  if(view==='vr') b.classList.add('is-vr');
  else b.classList.remove('is-vr');
}

function getCtx(){
  const view = normalizeView(qs('view','mobile'));
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = Number(qs('time','80')) || 80;

  // seed precedence: explicit seed param, else ts, else now
  const seed =
    (has('seed') ? qs('seed') : null) ??
    (has('ts') ? qs('ts') : null) ??
    String(Date.now());

  // keep for logging
  const ctx = {
    view, run, diff, time,
    seed: String(seed),
    hub: qs('hub', null),
    log: qs('log', null),
    style: qs('style', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };

  return ctx;
}

function applyMetaChip(ctx){
  try{
    const el = DOC.getElementById('gjChipMeta');
    if(!el) return;
    el.textContent = `view=${ctx.view} · run=${ctx.run} · diff=${ctx.diff} · time=${ctx.time}`;
  }catch(_){}
}

function bootOnce(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const ctx = getCtx();
  setBodyView(ctx.view);
  applyMetaChip(ctx);

  // expose context for debugs (optional)
  WIN.HHA_CTX = Object.assign({}, WIN.HHA_CTX||{}, {
    game: 'GoodJunkVR',
    view: ctx.view,
    run: ctx.run,
    diff: ctx.diff,
    time: ctx.time,
    seed: ctx.seed,
    hub: ctx.hub,
    studyId: ctx.studyId,
    phase: ctx.phase,
    conditionGroup: ctx.conditionGroup,
    log: ctx.log,
    style: ctx.style,
  });

  // IMPORTANT: engineBoot reads query params too, but we pass explicit ctx
  try{
    engineBoot({
      view: ctx.view,
      run: ctx.run,
      diff: ctx.diff,
      time: ctx.time,
      seed: ctx.seed,
    });
  }catch(err){
    console.error('[GoodJunkVR boot] failed:', err);
    try{
      alert('Boot error: ' + (err?.message || err));
    }catch(_){}
  }
}

function onReady(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

onReady(()=>{
  // small delay ensures CSS vars safe-area & HUD measure script ran
  setTimeout(bootOnce, 0);
});