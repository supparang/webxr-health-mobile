// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION
// ✅ Auto detect view when view=auto (NO override when view=pc/mobile/vr/cvr specified)
// ✅ Ensures vr-ui.js already loaded (Enter VR / Exit / Recenter + crosshair/tap-to-shoot)
// ✅ Boots engine from ./goodjunk.safe.js

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
}

function detectView(){
  // If user set view explicitly, respect it (no override)
  const explicit = (qs('view', '') || '').toLowerCase();
  if(explicit && explicit !== 'auto') return explicit;

  // Heuristic
  const ua = (navigator.userAgent || '').toLowerCase();
  const isMobile = /android|iphone|ipad|ipod/.test(ua) || (navigator.maxTouchPoints>1);
  const hasXR = !!(navigator.xr);

  // If has XR and screen is wide enough -> "vr" or "cvr"? (keep simple: vr)
  // For Cardboard/cVR mode user usually passes view=cvr explicitly.
  if(hasXR && isMobile) return 'vr';
  return isMobile ? 'mobile' : 'pc';
}

function setBodyView(view){
  DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr','view-auto');
  DOC.body.classList.add(view==='pc'?'view-pc':view==='vr'?'view-vr':view==='cvr'?'view-cvr':'view-mobile');
}

function main(){
  const view = detectView();
  setBodyView(view);

  const payload = {
    view,
    run: qs('run','play'),
    diff: qs('diff','normal'),
    time: Number(qs('time','80')||80),
    seed: qs('seed', null),
    hub: qs('hub', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };

  try{ engineBoot(payload); }catch(err){ console.error('[GoodJunkVR boot] error', err); }
}

if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main, { once:true });
else main();