// === /herohealth/vr/mode-factory.js ===
// Mode Factory — PRODUCTION (Plate/Groups shared spawner)
// ✅ Named export: boot()
// ✅ Fix: no "controller before init" refs
// ✅ Supports hha:shoot crosshair lock + tap hit
// ✅ NEW: decorateTarget(el, target) callback for emoji/icon UI
'use strict';

const WIN = window;
const DOC = document;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

function readSafeVars(){
  // fallback 0 if not defined in CSS
  const cs = getComputedStyle(DOC.documentElement);
  const top