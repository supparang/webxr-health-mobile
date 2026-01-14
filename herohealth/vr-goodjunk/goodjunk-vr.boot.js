/* === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
GoodJunkVR Boot — PRODUCTION
✅ Auto view detect (pc/mobile) + respects explicit view param (vr/cvr) when supplied by hub
✅ Adds body classes: view-pc / view-mobile / view-vr / view-cvr
✅ Ensures vr-ui.js config + keeps buttons clickable
✅ Boots engine: ./goodjunk.safe.js (export function boot)
*/

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function clamp(v,min,max){
  v = Number(v)||0;
  return v<min?min:(v>max?max:v);
}
function isTouch(){
  return ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
}
function isSmallScreen(){
  const w = DOC.documentElement.clientWidth || WIN.innerWidth || 0;
  return w > 0 && w <= 860;
}
function looksMobile(){
  return isTouch() && isSmallScreen();
}

function getAutoView(){
  // Default: pc/mobile
  return looksMobile() ? 'mobile' : 'pc';
}

function getView(){
  // IMPORTANT: no UI override; but URL param from HUB is allowed (vr/cvr)
  const v = String(qs('view','auto') || 'auto').toLowerCase();
  if(v === 'vr' || v === 'cvr' || v === 'pc' || v === 'mobile') return v;
  return getAutoView();
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
}

function setLayerR(view){
  const r = DOC.getElementById('gj-layer-r');
  if(!r) return;
  const on = (view === 'vr' || view === 'cvr');
  r.setAttribute('aria-hidden', on ? 'false' : 'true');
}

function updateChips(){
  const chip = DOC.getElementById('gjChipMeta');
  if(!chip) return;
  const v = String(qs('view','auto'));
  const run = String(qs('run','play'));
  const diff = String(qs('diff','normal'));
  const time = String(qs('time','80'));
  chip.textContent = `view=${v} · run=${run} · diff=${diff} · time=${time}`;
}

function ensureVrUiConfig(){
  // vr-ui.js reads window.HHA_VRUI_CONFIG
  // lockPx = aim assist radius (cVR), cooldown = tap-to-shoot throttling
  if(!WIN.HHA_VRUI_CONFIG){
    WIN.HHA_VRUI_CONFIG = { lockPx: 28, cooldownMs: 90 };
  }else{
    // keep existing but ensure defaults
    if(WIN.HHA_VRUI_CONFIG.lockPx == null) WIN.HHA_VRUI_CONFIG.lockPx = 28;
    if(WIN.HHA_VRUI_CONFIG.cooldownMs == null) WIN.HHA_VRUI_CONFIG.cooldownMs = 90;
  }
}

function boot(){
  updateChips();
  ensureVrUiConfig();

  const view = getView();
  setBodyView(view);
  setLayerR(view);

  const diff = String(qs('diff','normal') || 'normal').toLowerCase();
  const run  = String(qs('run','play') || 'play').toLowerCase();
  const time = clamp(qs('time','80'), 20, 300);

  const hub  = (qs('hub', null) || null);
  const seed = (qs('seed', null) || null);

  // study params passthrough (logger schema)
  const studyId = qs('studyId', qs('study', null));
  const phase   = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  // start engine
  engineBoot({
    view,
    diff,
    run,
    time,
    hub,
    seed,
    studyId,
    phase,
    conditionGroup
  });
}

/* Wait DOM ready (safe for module defer too) */
if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', boot, { once:true });
}else{
  boot();
}

/* Keep view class in sync on resize (pc<->mobile auto only when view=auto) */
WIN.addEventListener('resize', ()=>{
  const vRaw = String(qs('view','auto') || 'auto').toLowerCase();
  if(vRaw !== 'auto') return; // respect explicit view
  const v = getAutoView();
  setBodyView(v);
  setLayerR(v);
}, { passive:true });