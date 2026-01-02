// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

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
  s.src = '../vr/vr-ui.js'; // ✅ แนะนำใช้ path นี้ (ดูข้อ 3)
  s.defer = true;
  DOC.head.appendChild(s);
}

// ✅ NEW: store pending start detail if fired too early
function consumePendingStart(){
  const d = ROOT.__HHA_PENDING_START__;
  if(d && !started){
    ROOT.__HHA_PENDING_START__ = null;
    startEngine({ view: d.view });
  }
}

// START engine only after hha:start
function startEngine(opts={}){
  if(started) return;
  started = true;

  const view = normalizeView(opts.view || qs('view','mobile'));
  setBodyView(view);

  ensureVrUi();

  engineBoot({
    view,
    diff: (qs('diff','normal')||'normal'),
    run:  (qs('run','play')||'play'),
    time: Number(qs('time','80')||80),
    seed: qs('seed', null),
    hub:  qs('hub', null),

    studyId: qs('study', qs('studyId', null)),
    phase: qs('phase', null),
    conditionGroup: qs('cond', qs('conditionGroup', null)),
  });
}

// ✅ listen
ROOT.addEventListener('hha:start', (ev)=>{
  const view = ev?.detail?.view || qs('view','mobile');
  startEngine({ view });
}, { passive:true });

// ✅ if start fired before boot loaded, recover
if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
  queueMicrotask(consumePendingStart);
}else{
  DOC.addEventListener('DOMContentLoaded', consumePendingStart, { once:true });
}

// Preload VR UI when user wants cVR
ROOT.addEventListener('hha:enter-cvr', ()=>{
  ensureVrUi();
}, { passive:true });