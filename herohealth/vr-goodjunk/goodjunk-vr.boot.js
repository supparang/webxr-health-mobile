// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — V3 (UI-start event + safe pending + VR UI preload + FX wait)
// ✅ listens: hha:ui-start (from startOverlay)
// ✅ supports: __HHA_PENDING_START__ (if overlay clicked before module loads)
// ✅ VR/cVR: preload ../vr/vr-ui.js
// ✅ waits briefly for Particles so FX won't be missing

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
async function waitForFxReady(timeoutMs=650){
  const t0 = performance.now();
  while(performance.now() - t0 < timeoutMs){
    const P =
      (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
      ROOT.Particles;
    if(P && (typeof P.burstAt === 'function' || typeof P.scorePop === 'function' || typeof P.toast === 'function')) {
      return true;
    }
    await new Promise(r=>setTimeout(r, 30));
  }
  return false;
}

// Build engine payload from (a) UI-start detail, then (b) URL params fallback
function buildPayload(detail={}){
  const view = normalizeView(detail.view || qs('view','mobile'));

  // prefer explicit detail, fallback to URL
  const diff = String(detail.diff ?? qs('diff','normal') ?? 'normal');
  const run  = String(detail.run  ?? qs('run','play')   ?? 'play');

  // time
  const t = detail.time ?? qs('time','80');
  const time = Math.max(20, Number(t || 80));

  // seed/hub
  const seed = (detail.seed != null && String(detail.seed).trim() !== '') ? String(detail.seed).trim() : qs('seed', null);
  const hub  = (detail.hub  != null && String(detail.hub ).trim() !== '') ? String(detail.hub ).trim() : qs('hub',  null);

  // study/meta (prefer detail then URL)
  const studyId = detail.studyId ?? qs('study', qs('studyId', null));
  const phase   = detail.phase   ?? qs('phase', null);
  const conditionGroup = detail.conditionGroup ?? qs('cond', qs('conditionGroup', null));

  // optional extras (logger already hydrates from URL too, but we pass through for completeness)
  const sessionOrder = detail.sessionOrder ?? qs('sessionOrder', null);
  const blockLabel   = detail.blockLabel   ?? qs('block', qs('blockLabel', null));
  const siteCode     = detail.siteCode     ?? qs('site', qs('siteCode', null));

  return {
    view,
    diff,
    run,
    time,
    seed,
    hub,

    studyId,
    phase,
    conditionGroup,

    sessionOrder,
    blockLabel,
    siteCode,
  };
}

async function startEngineFrom(detail={}){
  if(started) return;
  started = true;

  const payload = buildPayload(detail);
  setBodyView(payload.view);

  if(payload.view === 'vr' || payload.view === 'cvr') ensureVrUi();

  // ✅ give particles a short chance to load
  await waitForFxReady(650);

  console.debug('[GoodJunkVR boot] start', payload);

  try{
    engineBoot(payload);
  }catch(err){
    console.error('GoodJunkVR engineBoot error:', err);
  }
}

// ✅ If overlay clicked before boot module loaded
function consumePendingStart(){
  if(started) return;
  const d = ROOT.__HHA_PENDING_START__;
  if(d){
    ROOT.__HHA_PENDING_START__ = null;
    startEngineFrom(d);
  }
}

// ✅ listen: NEW event from overlay wiring
ROOT.addEventListener('hha:ui-start', (ev)=>{
  startEngineFrom(ev?.detail || {});
}, { passive:true });

// ✅ recover pending start once DOM ready
if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
  queueMicrotask(consumePendingStart);
}else{
  DOC.addEventListener('DOMContentLoaded', consumePendingStart, { once:true });
}

// ✅ preload VR UI when user clicks "Enter VR" on overlay
ROOT.addEventListener('hha:enter-cvr', ()=>{
  ensureVrUi();
}, { passive:true });

// ✅ safety fallback: if overlay missing -> autostart
setTimeout(()=>{
  if(started) return;
  const overlay = DOC.getElementById('startOverlay');
  if(!overlay){
    console.warn('[GoodJunkVR boot] overlay missing -> autostart');
    startEngineFrom({ view: qs('view','mobile') });
  }
}, 950);