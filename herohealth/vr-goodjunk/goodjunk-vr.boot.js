// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — V2 (safe start + VR UI preload + FX wait)
// ✅ waits for hha:start from overlay, but also auto-start fallback if overlay missing
// ✅ preloads vr-ui.js when view=cvr or on hha:enter-cvr
// ✅ prevents “start fired before boot loaded” via __HHA_PENDING_START__
// ✅ waits briefly for Particles module so FX won't be missing

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
  s.src = '../vr/vr-ui.js';
  s.defer = true;
  DOC.head.appendChild(s);
}

// ✅ wait a bit so FX module is ready (prevents “effect missing”)
async function waitForFxReady(timeoutMs=600){
  const t0 = performance.now();
  while(performance.now() - t0 < timeoutMs){
    const P =
      (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
      ROOT.Particles;
    if(P && (typeof P.burstAt === 'function' || typeof P.scorePop === 'function')) return true;
    await new Promise(r=>setTimeout(r, 30));
  }
  return false;
}

async function startEngine(opts={}){
  if(started) return;
  started = true;

  const view = normalizeView(opts.view || qs('view','mobile'));
  setBodyView(view);

  // preload vr-ui for VR/cVR
  if(view === 'vr' || view === 'cvr') ensureVrUi();

  // ✅ give particles a short chance to load
  await waitForFxReady(600);

  const payload = {
    view,
    diff: (qs('diff','normal')||'normal'),
    run:  (qs('run','play')||'play'),
    time: Number(qs('time','80')||80),
    seed: qs('seed', null),
    hub:  qs('hub', null),

    studyId: qs('study', qs('studyId', null)),
    phase: qs('phase', null),
    conditionGroup: qs('cond', qs('conditionGroup', null)),
  };

  console.debug('[GoodJunkVR boot] start', payload);

  try{
    engineBoot(payload);
  }catch(err){
    console.error('GoodJunkVR engineBoot error:', err);
  }
}

// ✅ If overlay fired start before boot loaded
function consumePendingStart(){
  const d = ROOT.__HHA_PENDING_START__;
  if(d && !started){
    ROOT.__HHA_PENDING_START__ = null;
    startEngine({ view: d.view });
  }
}

// ✅ listen: hha:start from overlay
ROOT.addEventListener('hha:start', (ev)=>{
  const view = ev?.detail?.view || qs('view','mobile');
  startEngine({ view });
}, { passive:true });

// ✅ recover pending start
if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
  queueMicrotask(consumePendingStart);
}else{
  DOC.addEventListener('DOMContentLoaded', consumePendingStart, { once:true });
}

// ✅ preload VR UI when user clicks "Enter VR" on overlay
ROOT.addEventListener('hha:enter-cvr', ()=>{
  ensureVrUi();
}, { passive:true });

// ✅ safety fallback (กัน “จอดำเพราะไม่มีใคร dispatch hha:start”)
setTimeout(()=>{
  if(started) return;
  const overlay = DOC.getElementById('startOverlay');
  if(!overlay){
    console.warn('[GoodJunkVR boot] overlay missing -> autostart');
    startEngine({ view: qs('view','mobile') });
  }
}, 900);