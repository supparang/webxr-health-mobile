// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + BOSS A+B+C)
// ✅ Storm: timeLeft<=30s
// ✅ Boss: miss>=4
// ✅ Rage: miss>=5
// ✅ Boss HP: easy/normal/hard = 10/12/14
// ✅ Phase length: deterministic 2–6s
// ✅ Skills: Decoy / Swap / StormWall
// ✅ Counter items: ⭐ slow pressure, 💎 stun boss+bonus, 🛡️ block junk

'use strict';

export function boot(payload = {}) {
  const ROOT = window;
  const DOC  = document;

  // ----------------------- helpers -----------------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();
  const qs = (k, def=null)=>{ try { return new URL(location.href).search