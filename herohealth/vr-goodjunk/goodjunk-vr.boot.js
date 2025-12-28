// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot (ESM)
// ✅ Start overlay gating (engine starts on click)
// ✅ view=vr -> body.gj-vr + layerEls [#gj-layer, #gj-layer-r]
// ✅ Touch-look (drag look) on #gj-world
// ✅ Optional motion permission button

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';
import { attachTouchLook } from './touch-look-goodjunk.js';

function qs(name, def){
  try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
}
function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

function isVRView(){
  const view = String(qs('view','') || '').toLowerCase();
  const cardboard = String(qs('cardboard','') || '').toLowerCase();
  return view === 'vr' || cardboard === '1' || cardboard === 'true';
}

function metaText(){
  const diff = String(qs('diff','normal')).toLowerCase();
  const run  = String(qs('run','play')).toLowerCase();
  const time = clamp(Number(qs('time','80')), 30, 600);
  const seed = qs('seed','(auto)');
  const mode = isVRView() ? 'VR/Cardboard' : 'PC/Mobile';
  return `${mode} • diff=${diff} • run=${run} • time=${time}s • seed=${seed}`;
}

function setTxt(id, t){
  const el = document.getElementById(id);
  if (el) el.textContent = String(t||'');
}

function hideStart(){
  const ov = document.getElementById('startOverlay');
  if (ov) ov.style.display = 'none';
}

function main(){
  const stage = document.getElementById('gj-stage');
  const world = document.getElementById('gj-world');

  const btnStart = document.getElementById('btnStart');
  const btnStartMotion = document.getElementById('btnStartMotion');

  setTxt('startMeta', metaText());
  setTxt('hudMeta', metaText());

  const vr = isVRView();
  document.body.classList.toggle('gj-vr', !!vr);

  // touch-look always on (drag to look)
  const look = attachTouchLook({
    stageEl: stage,
    layerEl: world,
    maxShiftPx: vr ? 210 : 170,
    ease: 0.12,
    useMotion: false
  });

  // layers for engine (stereo if VR)
  const layerL = document.getElementById('gj-layer');
  const layerR = document.getElementById('gj-layer-r');

  const layerEls = vr ? [layerL, layerR] : [layerL];

  // build context for logger (optional)
  const ctx = {
    projectTag: 'GoodJunkVR',
    gameVersion: '2025-12-28',
  };

  // Create engine but DO NOT autoStart yet
  const api = engineBoot({
    layerEls,
    layerEl: layerL,
    shootEl: document.getElementById('btnShoot'),
    hub: qs('hub','../hub.html'),
    diff: qs('diff','normal'),
    run: qs('run','play'),
    time: qs('time','80'),
    seed: qs('seed', null),
    sessionId: qs('sessionId', qs('sid','')),
    context: ctx,
    autoStart: false,     // ✅ start-gated
  });

  function startNow(){
    hideStart();
    api?.start?.();
  }

  btnStart?.addEventListener('click', (e)=>{
    e.preventDefault?.();
    startNow();
  });

  btnStartMotion?.addEventListener('click', async (e)=>{
    e.preventDefault?.();
    // request gyro permission then start
    const ok = await look.requestMotionPermission();
    look.setUseMotion(!!ok);
    startNow();
  });

  // optional: autostart=1
  const autostart = String(qs('autostart','0')).toLowerCase();
  if (autostart === '1' || autostart === 'true'){
    startNow();
  }
}

// DOM ready
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', main, { once:true });
} else {
  main();
}