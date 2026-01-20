// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PACK-FAIR (PRODUCTION)
// ✅ Sets body view class: view-pc | view-mobile | view-vr | view-cvr
// ✅ Does NOT override if URL already has ?view=...
// ✅ Reads params: view/run/diff/time/seed/hub/studyId/phase/conditionGroup/log/style
// ✅ Boots engine: ./goodjunk.safe.js (your SAFE A+B+C)
// ✅ Avoid double boot; waits DOM ready
// ✅ Friendly VR hint (optional) + full-screen flag class

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

if (WIN.__HHA_GJ_BOOT__) {
  console.warn('[GoodJunkVR] boot already loaded');
} else {
  WIN.__HHA_GJ_BOOT__ = true;
}

function qs(k, def = null) {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function has(k) {
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}

function normView(v){
  v = String(v || '').toLowerCase();
  if (v === 'cardboard') return 'vr';
  if (v === 'view-cvr') return 'cvr';
  if (v === 'cvr') return 'cvr';
  if (v === 'vr') return 'vr';
  if (v === 'pc') return 'pc';
  if (v === 'mobile') return 'mobile';
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  if (!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if (view === 'pc') b.classList.add('view-pc');
  else if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function getPayload(){
  // ✅ IMPORTANT: do not override view if already in URL.
  // Here boot reads final view (launcher already sets it, or user manually passes ?view=)
  const view = normView(qs('view', 'mobile'));

  const run  = String(qs('run','play') || 'play').toLowerCase();   // play | research
  const diff = String(qs('diff','normal') || 'normal').toLowerCase();
  const time = Number(qs('time','80') || 80) || 80;

  const seed = qs('seed', null);
  const hub  = qs('hub', null);

  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  // passthrough for cloud logger (hha-cloud-logger.js reads ?log=)
  const log = qs('log', null);

  // optional style tag for experiments
  const style = qs('style', null);

  return {
    view, run, diff, time,
    seed, hub,
    studyId, phase, conditionGroup,
    log, style,
  };
}

function applyMetaToChip(payload){
  try{
    const chip = DOC.getElementById('gjChipMeta');
    if(!chip) return;
    const v = payload.view || 'mobile';
    chip.textContent = `view=${v} · run=${payload.run} · diff=${payload.diff} · time=${payload.time}`;
  }catch(_){}
}

function attachFullScreenClass(){
  // just cosmetic; helps css if needed
  try{
    const b = DOC.body;
    function mark(){
      if (!b) return;
      const fs = !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
      b.classList.toggle('is-fs', fs);
    }
    DOC.addEventListener('fullscreenchange', mark, { passive:true });
    DOC.addEventListener('webkitfullscreenchange', mark, { passive:true });
    mark();
  }catch(_){}
}

function ensureVRHint(){
  // optional hint overlay - light touch (no blocking)
  try{
    const view = normView(qs('view','mobile'));
    if(view !== 'vr' && view !== 'cvr') return;

    // vr-ui.js already provides Enter VR button; this is just a tiny hint.
    const hint = DOC.createElement('div');
    hint.id = 'gjVrHint';
    hint.style.cssText = `
      position:fixed; z-index:160;
      left:50%; top:calc(10px + var(--sat));
      transform:translateX(-50%);
      background:rgba(2,6,23,.62);
      border:1px solid rgba(148,163,184,.22);
      color:#e5e7eb;
      padding:8px 12px;
      border-radius:999px;
      font: 900 12px/1 system-ui;
      backdrop-filter: blur(10px);
      pointer-events:none;
      opacity:.95;
    `;
    hint.textContent = 'VR: กด ENTER VR (ปุ่มด้านขวาบน) แล้วเริ่มยิงที่เป้า 🎯';
    DOC.body.appendChild(hint);
    setTimeout(()=>{ try{ hint.remove(); }catch(_){} }, 2600);
  }catch(_){}
}

function safeBoot(){
  const payload = getPayload();

  // set body view classes for CSS + spawn policy
  setBodyView(payload.view);

  // meta chip in topbar
  applyMetaToChip(payload);

  // fullscreen class
  attachFullScreenClass();

  // tiny VR hint (non-blocking)
  ensureVRHint();

  // ✅ Boot engine (your SAFE)
  try{
    engineBoot({
      view: payload.view,
      run: payload.run,
      diff: payload.diff,
      time: payload.time,
      seed: payload.seed,
      hub: payload.hub,
      studyId: payload.studyId,
      phase: payload.phase,
      conditionGroup: payload.conditionGroup,
      style: payload.style,
      // no need to pass log, logger reads from URL
    });
  }catch(err){
    console.error('[GoodJunkVR] engine boot failed', err);
  }
}

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
    setTimeout(fn, 0);
  }else{
    DOC.addEventListener('DOMContentLoaded', fn, { once:true });
  }
}

ready(safeBoot);