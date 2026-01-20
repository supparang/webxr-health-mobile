// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (PACK-FAIR)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Body classes: view-pc/view-mobile/view-vr/view-cvr + gj-storm/gj-boss/gj-rage/gj-phase2 pulses
// ✅ Fullscreen handling + body.is-fs (best effort)
// ✅ Wait-for-modules (Particles/vr-ui) gracefully (no hard dependency)
// ✅ Boots engine once DOM ready -> goodjunk.safe.js boot(payload)
// ✅ Pass-through: hub/run/diff/time/seed/studyId/phase/conditionGroup/ts/log/style
// ✅ DO NOT override if ?view= exists (launcher handles this already, but keep safe)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function has(k){
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}
function clamp(v,min,max){
  v = Number(v)||0;
  if(v<min) return min;
  if(v>max) return max;
  return v;
}

function normalizeView(v){
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
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
}

function setFsClass(){
  try{
    const isFs = !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
    DOC.body.classList.toggle('is-fs', isFs);
  }catch(_){}
}

function bestEffortFullscreenForVRHint(view){
  // Don't force fullscreen always (kids UX). Just mark class if user enters.
  // vr-ui.js will handle Enter VR; we only listen to fullscreen changes.
  if(view === 'vr' || view === 'cvr'){
    // optional: could request fullscreen on first user gesture, but keep FAIR (ไม่บังคับ)
  }
}

function attachStateCssHooks(){
  const b = DOC.body;

  function onStorm(ev){
    const on = !!(ev?.detail?.on);
    b.classList.toggle('gj-storm', on);
  }
  function onBoss(ev){
    const d = ev?.detail || {};
    b.classList.toggle('gj-boss', !!d.on);
    b.classList.toggle('gj-rage', !!d.rage);
    b.classList.toggle('gj-phase2', (d.phase === 2));
  }
  function onJudge(ev){
    const t = (ev?.detail?.type || '').toLowerCase();
    if(t === 'bad'){
      b.classList.add('gj-junk-hit');
      setTimeout(()=>b.classList.remove('gj-junk-hit'), 160);
    } else if(t === 'miss'){
      b.classList.add('gj-good-expire');
      setTimeout(()=>b.classList.remove('gj-good-expire'), 160);
    }
  }

  WIN.addEventListener('hha:storm', onStorm, { passive:true });
  WIN.addEventListener('hha:boss', onBoss, { passive:true });
  WIN.addEventListener('hha:judge', onJudge, { passive:true });
}

function waitMs(ms){
  return new Promise(res => setTimeout(res, ms));
}

async function waitForOptionalModules(timeoutMs = 800){
  // Particles + vr-ui may load with defer script; we don't block hard.
  const t0 = performance.now();
  while(performance.now() - t0 < timeoutMs){
    // if either exists, good enough
    const hasParticles = !!(WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles));
    const hasVrUi = !!WIN.__HHA_VRUI_LOADED__;
    if(hasParticles || hasVrUi) break;
    await waitMs(30);
  }
}

function buildPayload(){
  const view = normalizeView(qs('view','mobile'));
  const run  = String(qs('run','play')||'play').toLowerCase();   // play|research|practice (goodjunk uses play|research)
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = clamp(qs('time','80'), 20, 300);
  const seed = qs('seed', null) ?? qs('ts', null) ?? String(Date.now());

  const hub = qs('hub', null);

  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  const style = qs('style', null);

  // If user explicitly passed view param, respect it. (Already guaranteed)
  // If missing, we keep mobile. Launcher is responsible for auto-detect.

  return {
    view, run, diff, time, seed, hub, studyId, phase, conditionGroup, style
  };
}

function wireTopbarButtons(){
  const qsEl = (id)=> DOC.getElementById(id);

  const btnBack = qsEl('btnBackHub');
  const btnHide = qsEl('btnHideHud');
  const btnMis  = qsEl('btnMissions');
  const peek = qsEl('missionsPeek');

  btnBack?.addEventListener('click', ()=>{
    const hub = qs('hub', null);
    if(hub) location.href = hub;
    else alert('ยังไม่ได้ใส่ hub url');
  });

  // Hide HUD just toggles class; safe vars updated in HTML updateSafe() already
  btnHide?.addEventListener('click', ()=>{
    DOC.body.classList.toggle('hud-hidden');
    // trigger safe recalculation (HTML has updateSafe in IIFE)
    try{ WIN.dispatchEvent(new Event('resize')); }catch(_){}
  });

  // Missions handled in HTML; keep here as safe fallback
  function toggleMissions(){
    DOC.body.classList.toggle('show-missions');
    const shown = DOC.body.classList.contains('show-missions');
    peek?.setAttribute('aria-hidden', shown ? 'false' : 'true');
  }
  btnMis?.addEventListener('click', toggleMissions);
  peek?.addEventListener('click', toggleMissions);
}

function setChipMeta(){
  const el = DOC.getElementById('gjChipMeta');
  if(!el) return;
  const v = qs('view','auto');
  const run = qs('run','play');
  const diff = qs('diff','normal');
  const time = qs('time','80');
  el.textContent = `view=${v} · run=${run} · diff=${diff} · time=${time}`;
}

function start(){
  const payload = buildPayload();
  setBodyView(payload.view);
  attachStateCssHooks();
  setChipMeta();
  wireTopbarButtons();

  bestEffortFullscreenForVRHint(payload.view);

  // listen fullscreen changes
  DOC.addEventListener('fullscreenchange', setFsClass, { passive:true });
  DOC.addEventListener('webkitfullscreenchange', setFsClass, { passive:true });
  setFsClass();

  // (optional) wait a tiny bit for FX/UI modules
  waitForOptionalModules(800).finally(()=>{
    try{
      engineBoot(payload);
    }catch(err){
      console.error('[GoodJunkVR boot] engine error:', err);
      alert('GoodJunkVR: engine error — ดู console');
    }
  });
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', start, { once:true });
}else{
  start();
}