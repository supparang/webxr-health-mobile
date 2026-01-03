// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — V2.1 (safe UI-start + VR UI preload + FX wait + flush-hardened)

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

async function waitForFxReady(timeoutMs=600){
  const t0 = performance.now();
  while(performance.now() - t0 < timeoutMs){
    const P = (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles;
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

  if(view === 'vr' || view === 'cvr') ensureVrUi();

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

// overlay might fire before module loaded
function consumePendingStart(){
  const d = ROOT.__HHA_PENDING_START__;
  if(d && !started){
    ROOT.__HHA_PENDING_START__ = null;
    startEngine({ view: d.view });
  }
}

// ✅ listen: UI start (from overlay script)
ROOT.addEventListener('hha:ui-start', (ev)=>{
  const view = ev?.detail?.view || qs('view','mobile');
  startEngine({ view });
}, { passive:true });

if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
  queueMicrotask(consumePendingStart);
}else{
  DOC.addEventListener('DOMContentLoaded', consumePendingStart, { once:true });
}

// preload VR UI when user clicks Enter VR
ROOT.addEventListener('hha:enter-cvr', ()=>{
  ensureVrUi();
}, { passive:true });

// safety fallback: autostart if overlay missing
setTimeout(()=>{
  if(started) return;
  const overlay = DOC.getElementById('startOverlay');
  if(!overlay){
    console.warn('[GoodJunkVR boot] overlay missing -> autostart');
    startEngine({ view: qs('view','mobile') });
  }
}, 900);

// ✅ flush-hardened on pagehide (extra safety)
ROOT.addEventListener('pagehide', ()=>{
  try{ ROOT.dispatchEvent(new CustomEvent('hha:flush-all', { detail:{ reason:'pagehide' } })); }catch(_){}
}, { passive:true });