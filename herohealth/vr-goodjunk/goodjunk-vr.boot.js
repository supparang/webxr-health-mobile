// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Start-gated to prevent target flash)
// ✅ View: PC / Mobile / VR / cVR
// ✅ Fullscreen handling (best effort)
// ✅ Uses Universal VR UI: /herohealth/vr/vr-ui.js (Enter VR/Exit/Recenter + crosshair shoot)
// ✅ Engine starts ONLY after 'hha:start' event

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add('view-'+view);
}

function normalizeView(v){
  v = String(v || '').toLowerCase();
  if(v==='pc') return 'pc';
  if(v==='vr') return 'vr';
  if(v==='cvr') return 'cvr';
  return 'mobile';
}

let started = false;

function ensureVrUi(){
  // Load once
  if(ROOT.__HHA_VRUI_LOADED) return;
  ROOT.__HHA_VRUI_LOADED = true;

  const s = DOC.createElement('script');
  s.src = './vr/vr-ui.js';   // <— universal module you already have
  s.defer = true;
  DOC.head.appendChild(s);
}

function attachShootBridge(){
  // In cVR we shoot from crosshair; vr-ui.js emits hha:shoot
  // Engine listens to hha:shoot or you already bridge it in safe.js.
  // We don’t implement gameplay here—just ensure event exists.
  // (No-op if engine handles it already)
}

function startEngine(opts={}){
  if(started) return;
  started = true;

  const view = normalizeView(opts.view || qs('view','mobile'));
  setBodyView(view);

  // Ensure VR UI exists early (Enter VR/Exit/Recenter + crosshair)
  ensureVrUi();
  attachShootBridge();

  // IMPORTANT: boot engine now (after START only)
  engineBoot({
    view,
    diff: (qs('diff','normal')||'normal'),
    run:  (qs('run','play')||'play'),
    time: Number(qs('time','80')||80),
    seed: qs('seed', null),
    hub:  qs('hub', null),
  });
}

// --- Gate engine start until user presses START ---
ROOT.addEventListener('hha:start', (ev)=>{
  const view = ev?.detail?.view || qs('view','mobile');
  startEngine({ view });
}, { passive:true });

// Optional: If user taps Enter cVR button in overlay, we can pre-load vr-ui.js
ROOT.addEventListener('hha:enter-cvr', ()=>{
  ensureVrUi();
  // Let vr-ui.js handle entering XR; engine still starts on START to avoid flashes.
}, { passive:true });

// Safety: if someone opens with &autostart=1 (debug only)
if(qs('autostart','0') === '1'){
  startEngine({ view: qs('view','mobile') });
}