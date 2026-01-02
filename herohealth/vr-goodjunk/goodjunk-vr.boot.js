// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Start-gated boot to prevent target flash + unify PC/Mobile/VR/cVR
'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';
import { applyCalibration, openCalibration } from './gj-calibration.js';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='pc') return 'pc';
  if(v==='vr') return 'vr';
  if(v==='cvr') return 'cvr';
  return 'mobile';
}
function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add('view-'+view);
}

let started = false;

function ensureVrUi(){
  if(ROOT.__HHA_VRUI_LOADED) return;
  ROOT.__HHA_VRUI_LOADED = true;
  const s = DOC.createElement('script');
  s.src = './vr/vr-ui.js';
  s.defer = true;
  DOC.head.appendChild(s);
}

function startEngine(opts={}){
  if(started) return;
  started = true;

  const view = normalizeView(opts.view || qs('view','mobile'));
  setBodyView(view);

  // ✅ load aimpoint from saved calibration (cVR/VR)
  applyCalibration(view);

  ensureVrUi();

  engineBoot({
    view,
    diff: (qs('diff','normal')||'normal'),
    run:  (qs('run','play')||'play'),
    time: Number(qs('time','80')||80),
    seed: qs('seed', null),
    hub:  qs('hub', null),

    // research meta (optional)
    studyId: qs('study', qs('studyId', null)),
    phase: qs('phase', null),
    conditionGroup: qs('cond', qs('conditionGroup', null)),
  });
}

// ---- UI wiring ----
const overlay = DOC.getElementById('startOverlay');
const btnStart = DOC.getElementById('btnStart');
const btnCalib = DOC.getElementById('btnCalib');
const btnEnterVR = DOC.getElementById('btnEnterVR');

btnStart?.addEventListener('click', ()=>{
  overlay.style.display = 'none';
  startEngine({ view: qs('view','mobile') });
}, { passive:true });

btnCalib?.addEventListener('click', ()=>{
  const v = normalizeView(qs('view','cvr'));
  openCalibration({ view:v, shotsNeed: 8 });
}, { passive:true });

btnEnterVR?.addEventListener('click', ()=>{
  // preload VR UI then user can press Enter VR
  ensureVrUi();
  overlay.querySelector('.hint').textContent = 'โหลด VR UI แล้ว ✅ กด ENTER VR ที่มุมจอได้เลย';
}, { passive:true });

// Open calibration by query
if(qs('calib','0')==='1'){
  const v = normalizeView(qs('view','cvr'));
  openCalibration({ view:v, shotsNeed: 8 });
}

// RECENTER from vr-ui opens calibration (cVR/VR only)
ROOT.addEventListener('hha:recenter', ()=>{
  const v = normalizeView(qs('view','cvr'));
  if(v==='cvr' || v==='vr') openCalibration({ view:v, shotsNeed: 8 });
}, { passive:true });

// Preload VR UI when user wants cVR
ROOT.addEventListener('hha:enter-cvr', ()=>{
  ensureVrUi();
}, { passive:true });