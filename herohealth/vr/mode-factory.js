// === /herohealth/vr/mode-factory.js ===
// HHA Spawn Factory — PRODUCTION
// ✅ Exports: boot (named export)
// ✅ Seeded RNG (deterministic for research)
// ✅ Tap target (pointerdown)
// ✅ Crosshair / tap-to-shoot via vr-ui.js -> listens hha:shoot
// ✅ Safe spawn rect (reads CSS vars --plate-*-safe if present)
// ✅ NEW: decorateTarget(el, target) callback for emoji/icon UI
//
// NOTE: This version intentionally has NO 'controller' TDZ usage.
//       (Fixes: Cannot access 'controller' before initialization)

'use strict';

const WIN = window;
const DOC = document;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^