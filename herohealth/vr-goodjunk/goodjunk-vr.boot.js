// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (A+B+C safe)
// ✅ Auto view detect (pc/mobile/vr/cvr) BUT never override if ?view= exists
// ✅ Ensures vr-ui.js loaded ONCE (Enter VR/Exit/Recenter + crosshair + tap-to-shoot => hha:shoot)
// ✅ Ensures Particles ready (best effort) before starting safe engine
// ✅ Pass-through: hub/run/diff/time/seed/studyId/phase/conditionGroup/ts
// ✅ Applies body classes: view-* and is-fs
// ✅ No duplicate end overlay handling here (safe.js owns it)

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function hasParam(k){
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}
function isProbablyDesktop(){
  try{
    const ua = navigator.userAgent || '';
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const finePointer = matchMedia && matchMedia('(pointer:fine)').matches;
    const w = DOC.documentElement.clientWidth || innerWidth || 0;
    return !isMobileUA && (finePointer || w >= 980);
  }catch(_){ return true; }
}
function supportsXR(){
  return !!(navigator && navigator.xr);
}
async function isImmersiveVrSupported(){
  try{
    if(!supportsXR()) return false;
    return await navigator.xr.isSessionSupported('immersive-vr');
  }catch(_){
    return false;
  }
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view==='pc') b.classList.add('view-pc');
  else if(view==='vr') b.classList.add('view-vr');
  else if(view==='cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function ensureScript(src){
  return new Promise((resolve, reject)=>{
    try{
      // already present?
      const exists = [...DOC.scripts].some(s => (s.src||'').includes(src));
      if(exists) return resolve(true);

      const s = DOC.createElement('script');
      s.src = src;
      s.defer = true;
      s.onload = ()=> resolve(true);
      s.onerror = ()=> reject(new Error('load failed: '+src));
      DOC.head.appendChild(s);
    }catch(e){ reject(e); }
  });
}

async function ensureVrUi(){
  // If vr-ui.js already loaded (global guard), skip.
  if(ROOT.__HHA_VRUI_LOADED__) return true;

  // Path from /vr-goodjunk/ to /vr/vr-ui.js
  try{
    await ensureScript('../vr/vr-ui.js');
    return true;
  }catch(_){
    // still allow game to run without vr-ui, but VR/cVR will lose crosshair shooting
    console.warn('[GoodJunkVR] vr-ui.js load failed (continue without)');
    return false;
  }
}

async function waitForParticles(ms=900){
  const t0 = performance.now();
  while(performance.now() - t0 < ms){
    const P = (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles;
    if(P && (typeof P.burstAt==='function' || typeof P.popText==='function')) return true;
    await new Promise(r=>setTimeout(r, 40));
  }
  return false;
}

function parseRunCtx(){
  const run = String(qs('run','play') || 'play').toLowerCase(); // play|research
  const diff = String(qs('diff','normal') || 'normal').toLowerCase();
  const time = Number(qs('time','80') || 80) || 80;

  // research context passthrough
  const hub = qs('hub', null);
  const seed = qs('seed', null);
  const ts   = qs('ts', null);
  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  return { run, diff, time, hub, seed, ts, studyId, phase, conditionGroup };
}

function chooseViewAuto(){
  // Never override explicit view
  if(hasParam('view')){
    const v = String(qs('view','mobile')).toLowerCase();
    if(v==='pc' || v==='vr' || v==='cvr' || v==='mobile') return v;
    return 'mobile';
  }

  // Auto detect:
  // - If immersive-vr supported and screen looks like headset flow => choose 'vr'
  // - Else if desktop => 'pc'
  // - Else 'mobile'
  // NOTE: cVR should be explicit via ?view=cvr (research/launcher decides)
  return isProbablyDesktop() ? 'pc' : 'mobile';
}

function bestEffortFullscreen(){
  try{
    const b = DOC.body;
    const wantsFs = (qs('fs', null) === '1');
    if(!wantsFs) return;
    const el = DOC.documentElement;
    if(el.requestFullscreen) el.requestFullscreen().catch(()=>{});
    b.classList.add('is-fs');
  }catch(_){}
}

async function init(){
  // Wait DOM
  if(DOC.readyState === 'loading'){
    await new Promise(r=>DOC.addEventListener('DOMContentLoaded', r, { once:true }));
  }

  const ctx = parseRunCtx();

  // Decide view
  let view = chooseViewAuto();

  // If auto picked pc/mobile, we can upgrade to vr if XR supported AND user asked via ?wantVr=1
  // (keeps "no launcher" flow clean; you can still open ?view=vr directly)
  if(!hasParam('view') && qs('wantVr', null)==='1'){
    const vrOk = await isImmersiveVrSupported();
    if(vrOk) view = 'vr';
  }

  // Apply class
  setBodyView(view);

  // Ensure VR UI (for vr/cvr) — safe to load always, cheap
  await ensureVrUi();

  // Give safe-area measurement script time to set --gj-top-safe/--gj-bottom-safe
  // (your HTML already does updateSafe() 0/120/360ms)
  await new Promise(r=>setTimeout(r, 160));

  // Best effort wait for Particles (effects)
  await waitForParticles(900);

  // Optional: fullscreen if ?fs=1
  bestEffortFullscreen();

  // Boot SAFE engine
  engineBoot({
    view,
    run: ctx.run,
    diff: ctx.diff,
    time: ctx.time,
    hub: ctx.hub,
    seed: ctx.seed ?? ctx.ts ?? null,
    studyId: ctx.studyId,
    phase: ctx.phase,
    conditionGroup: ctx.conditionGroup,
  });
}

init().catch((e)=>{
  console.error('[GoodJunkVR] boot failed:', e);
  try{
    const msg = DOC.createElement('div');
    msg.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#020617;color:#e5e7eb;font:700 16px/1.4 system-ui;padding:20px;z-index:9999;';
    msg.textContent = 'Boot error: ' + (e?.message || e);
    DOC.body.appendChild(msg);
  }catch(_){}
});