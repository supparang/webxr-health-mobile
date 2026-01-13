// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (AUTO VIEW, NO OVERRIDE)
// ✅ Auto-detect view: pc / mobile / vr / cvr (NO user override)
// ✅ Ensures vr-ui.js is active (Enter VR / Exit / Recenter + crosshair + tap-to-shoot)
// ✅ Passes params -> goodjunk.safe.js boot(payload)
// ✅ Hub passthrough + query passthrough
// ✅ Flush-hardened logger hooks (if hha-cloud-logger.js present)

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function isTouchDevice(){
  return (('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0));
}

function hasWebXR(){
  return !!(navigator && navigator.xr);
}

// Detect: if XR session active => vr. If mobile + cardboard query from hub => cvr.
// IMPORTANT: "NO OVERRIDE" — ignore any view=... in URL.
function detectView(){
  // 1) If already in XR immersive session (rare on first load)
  // We can’t await session check reliably without permissions; use cheap signals.
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua) || isTouchDevice();

  // 2) cVR hint (from hub/previous pages): allow ONLY as internal hint,
  //    but still auto validate device type; do NOT allow arbitrary override.
  //    We'll accept cvrHint=1 OR view=cvr BUT ONLY if device is mobile.
  const cvrHint = (qs('cvrHint', null) || '').toString().trim();
  const viewParam = (qs('view', null) || '').toString().trim().toLowerCase();

  const wantsCVR = (cvrHint === '1' || viewParam === 'cvr');
  if(isMobileUA && wantsCVR) return 'cvr';

  // 3) If WebXR available and user later presses Enter VR => still same page,
  //    we keep view as 'vr' for layout AFTER entering; until then treat as mobile/pc.
  if(isMobileUA) return 'mobile';
  return 'pc';
}

function setBodyViewClass(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'cvr') b.classList.add('view-cvr');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'pc') b.classList.add('view-pc');
  else b.classList.add('view-mobile');
}

function ensureVrUiConfig(){
  // This is read by /herohealth/vr/vr-ui.js (your Universal VR UI)
  // Keep cooldown 90ms (as you used), lockPx tuned moderate.
  WIN.HHA_VRUI_CONFIG = Object.assign(
    { lockPx: 28, cooldownMs: 90 },
    WIN.HHA_VRUI_CONFIG || {}
  );
}

function normalizeRunMode(){
  const r = (qs('run', 'play') || 'play').toLowerCase();
  return (r === 'research' || r === 'study') ? 'research' : 'play';
}

function normalizeDiff(){
  const d = (qs('diff', 'normal') || 'normal').toLowerCase();
  if(d === 'easy' || d === 'hard') return d;
  return 'normal';
}

function numberClamp(v, min, max, def){
  const n = Number(v);
  if(!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function buildPayload(){
  const runMode = normalizeRunMode();
  const diff = normalizeDiff();

  const time = numberClamp(qs('time', '80'), 20, 300, 80);

  // seed rules:
  // - research: deterministic -> prefer seed or ts
  // - play: seed defaults Date.now()
  const seedParam = qs('seed', null);
  const tsParam   = qs('ts', null);

  const seed = (runMode === 'research')
    ? (seedParam ?? tsParam ?? 'RESEARCH-SEED')
    : (seedParam ?? String(Date.now()));

  const hub = (qs('hub', null) || '').trim() || null;

  // study passthrough (optional)
  const studyId = qs('studyId', qs('study', null));
  const phase   = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  // IMPORTANT: view is auto-detected (NO OVERRIDE)
  const view = detectView();

  return {
    view,
    run: runMode,
    diff,
    time,
    seed,
    hub,
    studyId,
    phase,
    conditionGroup,
  };
}

// If A-Frame fires enter-vr / exit-vr, we flip body class for layout
function wireAframeVrEvents(){
  const scene = DOC.querySelector('a-scene');
  if(!scene) return;

  scene.addEventListener('enter-vr', ()=>{
    // entering VR: set view-vr (or view-cvr stays cvr)
    const b = DOC.body;
    if(b.classList.contains('view-cvr')) return;
    b.classList.remove('view-pc','view-mobile');
    b.classList.add('view-vr');
  });

  scene.addEventListener('exit-vr', ()=>{
    // leaving VR: revert to auto base (pc/mobile/cvr)
    const view = detectView();
    setBodyViewClass(view);
  });
}

// Optional: logger flush hardened
function wireFlushHardened(){
  // Your logger listens on 'hha:log' + may have flush method on window.HHA_LOGGER
  function safeLog(obj){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:log', { detail: obj }));
      DOC.dispatchEvent(new CustomEvent('hha:log', { detail: obj }));
    }catch(_){}
  }

  DOC.addEventListener('visibilitychange', ()=>{
    try{
      if(DOC.visibilityState === 'hidden'){
        safeLog({ type:'visibility', v:'hidden', t: new Date().toISOString(), tag:'GoodJunkVR' });
        if(WIN.HHA_LOGGER && typeof WIN.HHA_LOGGER.flush === 'function'){
          WIN.HHA_LOGGER.flush();
        }
      }
    }catch(_){}
  }, { passive:true });

  WIN.addEventListener('pagehide', ()=>{
    try{
      safeLog({ type:'pagehide', t: new Date().toISOString(), tag:'GoodJunkVR' });
      if(WIN.HHA_LOGGER && typeof WIN.HHA_LOGGER.flush === 'function'){
        WIN.HHA_LOGGER.flush();
      }
    }catch(_){}
  }, { passive:true });
}

// Boot sequence
(function main(){
  ensureVrUiConfig();

  const payload = buildPayload();
  setBodyViewClass(payload.view);

  // Keep chip meta in HTML if present
  try{
    const chip = DOC.getElementById('gjChipMeta');
    if(chip){
      chip.textContent = `view=${payload.view} · run=${payload.run} · diff=${payload.diff} · time=${payload.time}`;
    }
  }catch(_){}

  wireAframeVrEvents();
  wireFlushHardened();

  // Start engine
  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR.boot] engineBoot error:', err);
    alert('GoodJunkVR: เปิดเกมไม่สำเร็จ (ดู console)');
  }
})();