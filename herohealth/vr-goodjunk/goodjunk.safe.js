// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (BOSS++ + STORM + RAGE + TELEGRAPH)
// FULL v20260220-fxHARDEN
// ✅ FIX: coordinate space unified to #gj-layer rect (shoot/tap/FX)
// ✅ FIX: crosshair hit uses real DOMRect centers (robust on short screens/HUD)
// ✅ FIX: cVR right-eye clone also gets pointer listener (optional)
// ✅ FX: tuned per target type (GOOD/STAR/SHIELD/DIAMOND/JUNK block vs hit/💣/💀)
// ✅ Hardened FX: ensure #gj-fx exists (recreate if layer re-rendered/cleared) every hit/shoot

'use strict';

export function boot(payload = {}) {
  const ROOT = window;
  const DOC  = document;

  // ---------------- helpers ----------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();
  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };
  const byId = (id)=> DOC.getElementById(id);

  function emit(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // ---------------- seeded RNG ----------------
  function xmur3(str){
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11