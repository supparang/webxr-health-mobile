// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR AI Hooks — deterministic (seeded) — ON only when run=play&ai=1
// Provides: GroupsVR.__ai = { director, pattern, tip }
// ✅ director.spawnSpeedMul(accPct, combo, misses)
// ✅ pattern.bias() -> [-0.08..+0.08] adjusts wrong/junk bias (fair)
// ✅ tip(text,mood) -> emits hha:coach (rate-limited)

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
  function makeRng(seedU32){
    let s = (seedU32>>>0) || 1;
    return function(){
      s = (Math.imul(1664525, s) + 1013904223)>>>0;
      return s / 4294967296;
    };
  }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // gate
  const run = String(qs('run','play')||'play').toLowerCase();
  const ai  = String(qs('ai','0')||'0');
  const seed= String(qs('seed', Date.now()) || Date.now());

  const enabled = (run === 'play' && (ai === '1' || ai === 'true'));
  if (!enabled){
    // ensure OFF = remove hooks
    try{ delete NS.__ai; }catch(_){}
    return;
  }

  const rng = makeRng(hashSeed(seed + '::groups-ai'));

  // --- director: fair adaptive without “cheating” ---
  const director = {
    spawnSpeedMul(accPct, combo, misses){
      accPct = clamp(accPct, 0, 100);
      combo  = clamp(combo, 0, 40);
      misses = clamp(misses,0, 40);

      // target: keep flow exciting but not punitive
      // good performance -> slightly faster
      // high misses -> slightly slower (help recovery)
      let mul = 1.0;

      if (accPct >= 88) mul *= 0.92;
      else if (accPct >= 80) mul *= 0.96;
      else if (accPct <= 55) mul *= 1.08;

      if (combo >= 10) mul *= 0.92;
      else if (combo >= 6) mul *= 0.96;

      if (misses >= 12) mul *= 1.10;
      else if (misses >= 8) mul *= 1.06;

      // tiny seeded jitter (deterministic) to avoid robotic feel
      const j = (rng() - 0.5) * 0.04; // [-0.02..+0.02]
      mul *= (1.0 + j);

      return clamp(mul, 0.85, 1.18);
    }
  };

  // --- pattern: bias difficulty very slightly (seeded), stays fair ---
  // +bias => more wrong, less junk (harder but less “unfair junk”)
  // -bias => less wrong, more junk (more traps)
  let biasBase = (rng() - 0.5) * 0.12; // [-0.06..+0.06]
  const pattern = {
    bias(){
      // slowly drift with deterministic wobble
      const wob = (rng() - 0.5) * 0.04; // [-0.02..+0.02]
      const v = biasBase + wob;
      return clamp(v, -0.08, 0.08);
    }
  };

  // --- explainable micro tips (rate limited) ---
  let lastTipAt = 0;
  function tip(text, mood){
    const t = performance.now();
    if (t - lastTipAt < 2500) return;
    lastTipAt = t;
    emit('hha:coach', { text:String(text||''), mood:String(mood||'neutral') });
  }

  NS.__ai = { director, pattern, tip };

  // announce once
  tip('AI ON ✅ (ปรับความยากแบบแฟร์ตามฟอร์มการเล่น)', 'neutral');

})(typeof window !== 'undefined' ? window : globalThis);