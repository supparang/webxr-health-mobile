// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ Reads ctx from URL (view/run/diff/time/seed/...)
// ✅ Sets body view classes (view-pc / view-mobile / view-vr / view-cvr)
// ✅ Calls engine boot() from ./goodjunk.safe.js
// ✅ Nudges safe-zone update a few times (HUD/VR-UI load timing)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function has(k){
  try{ return new URL(location.href).searchParams.has(k); }
  catch{ return false; }
}

function normalizeView(v){
  v = String(v || '').toLowerCase();
  if(v === 'cardboard') return 'vr';
  if(v === 'view-cvr') return 'cvr';
  if(v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'pc') return 'pc';
  if(v === 'mobile') return 'mobile';
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
}

function nudgeSafe(){
  // call the inline updateSafe if it exists in goodjunk-vr.html
  try{
    if(typeof WIN.updateSafe === 'function') WIN.updateSafe();
  }catch(_){}
  // also dispatch resize/orientation to trigger listeners
  try{ WIN.dispatchEvent(new Event('resize')); }catch(_){}
}

function boot(){
  const view = normalizeView(qs('view','mobile'));
  const run  = String(qs('run','play') || 'play').toLowerCase();
  const diff = String(qs('diff','normal') || 'normal').toLowerCase();
  const time = Number(qs('time','80') || 80) || 80;

  // seed: prefer explicit seed, else use ts, else Date.now
  const seed =
    String(qs('seed', null) ?? qs('ts', null) ?? Date.now());

  setBodyView(view);

  // VR-UI config (optional)
  // (You can tune lockPx/cooldownMs here per game)
  WIN.HHA_VRUI_CONFIG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});

  // safe-zone timing: HUD + VR-UI may mount slightly later
  nudgeSafe();
  setTimeout(nudgeSafe, 60);
  setTimeout(nudgeSafe, 180);
  setTimeout(nudgeSafe, 420);

  // start engine
  engineBoot({
    view,
    run,
    diff,
    time,
    seed
  });
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', boot, { once:true });
}else{
  boot();
}