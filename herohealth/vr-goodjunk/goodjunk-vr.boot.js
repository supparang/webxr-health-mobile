// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (LATEST)
// ✅ sets view class (pc/mobile/vr/cvr)
// ✅ ensures cVR uses split layer (aria-hidden toggle)
// ✅ loads vr-ui.js only for vr/cvr (crosshair + enter/exit/recenter + hha:shoot)
// ✅ waits for FX (Particles) briefly before starting engine
// ✅ hooks keyboard shoot (Space/Enter) for testing
// ✅ calls goodjunk.safe.js boot(payload)
// ✅ start-once guard

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const ROOT = window;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function normalizeView(v){
  v = String(v || '').toLowerCase();
  if(v === 'pc') return 'pc';
  if(v === 'vr') return 'vr';
  if(v === 'cvr') return 'cvr';
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add('view-' + view);
}

function applyView(){
  const view = normalizeView(qs('view','mobile'));
  setBodyView(view);

  // toggle R layer aria for accessibility
  const r = DOC.getElementById('gj-layer-r');
  if(r){
    r.setAttribute('aria-hidden', view === 'cvr' ? 'false' : 'true');
  }
  return view;
}

// --- VR UI loader (only for vr/cvr) ---
function ensureVrUi(){
  if(ROOT.__HHA_VRUI_LOADED) return;
  ROOT.__HHA_VRUI_LOADED = true;

  // if already in DOM, don't inject again
  const exists = Array.from(DOC.scripts || []).some(s => (s.src || '').includes('/vr/vr-ui.js') || (s.src || '').endsWith('vr-ui.js'));
  if(exists) return;

  const s = DOC.createElement('script');
  s.src = '../vr/vr-ui.js';
  s.defer = true;
  DOC.head.appendChild(s);
}

// --- FX ready wait (Particles adapter in safe.js uses window.Particles or window.GAME_MODULES.Particles) ---
async function waitForFxReady(timeoutMs=650){
  const t0 = performance.now();
  while(performance.now() - t0 < timeoutMs){
    const P =
      (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
      ROOT.Particles;
    if(P && (typeof P.burstAt === 'function' || typeof P.scorePop === 'function' || typeof P.popText === 'function')) return true;
    await new Promise(r => setTimeout(r, 30));
  }
  return false;
}

// --- debug keys ---
function bindDebugKeys(){
  if(ROOT.__GJ_DEBUG_KEYS__) return;
  ROOT.__GJ_DEBUG_KEYS__ = true;

  ROOT.addEventListener('keydown', (e)=>{
    const k = e.key || '';
    if(k === ' ' || k === 'Enter'){
      e.preventDefault?.();
      try{ ROOT.dispatchEvent(new CustomEvent('hha:shoot')); }catch(_){}
    }
  }, { passive:false });
}

// --- start once ---
let __started = false;

async function start(){
  if(__started) return;
  __started = true;

  const view = applyView();
  bindDebugKeys();

  // VR/cVR: ensure vr-ui (crosshair + enter/exit/recenter)
  if(view === 'vr' || view === 'cvr') ensureVrUi();

  // Wait FX briefly (particles.js is defer)
  await waitForFxReady(650);

  // Engine boot with payload (optional overrides)
  const payload = {
    view,
    diff: String(qs('diff','normal') || 'normal'),
    run:  String(qs('run','play') || 'play'),
    time: Number(qs('time','80') || 80),
    seed: qs('seed', null),
    hub:  qs('hub', null),

    // research/meta passthrough
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };

  console.debug('[GoodJunkVR boot] start', payload);

  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR boot] engineBoot error:', err);
  }

  // gentle tip (optional) — does not require any coach UI, only emits event
  if(view === 'vr' || view === 'cvr'){
    try{
      ROOT.dispatchEvent(new CustomEvent('hha:coach', { detail:{
        kind:'tip',
        msg:'โหมด VR: เล็งกลางจอแล้วแตะ/คลิกเพื่อยิง (crosshair) — ระบบ spawn แบบ HUD-safe แล้ว',
      }}));
    }catch(_){}
  }
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', start, { once:true });
}else{
  start();
}