// === /herohealth/vr-groups/ai-hooks.js ===
// AI Hooks — PACK 15 (SAFE, disabled by default)
// ✅ enabled only when attach({enabled:true, runMode:'play'}) AND ?ai=1 in launcher/run
// ✅ research/practice: forced OFF by caller
// Provides: GroupsVR.__ai = { enabled, director, pattern, tip }
// Note: Director is "fair + smooth" (no spikes), deterministic-safe (uses seed)

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

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
    let s=(seedU32>>>0)||1;
    return function(){
      s = (Math.imul(1664525,s)+1013904223)>>>0;
      return s/4294967296;
    };
  }

  // ---------------- Director ----------------
  function makeDirector(seedStr){
    const rng = makeRng(hashSeed(seedStr + '::dir'));

    const S = {
      // EMA smoothing (กันแกว่ง)
      emaAcc: 72,
      emaCombo: 0,
      emaMiss: 0,
      emaRt: 650,

      // target difficulty scalar
      d: 1.0,

      // update cadence
      lastUpdateAt: 0,
      tick: 0
    };

    function update(acc, combo, misses, rtMs){
      // clamp inputs
      acc = clamp(acc, 0, 100);
      combo = clamp(combo, 0, 30);
      misses = clamp(misses, 0, 30);
      rtMs = clamp(rtMs, 200, 1200);

      // EMA
      const a=0.12;
      S.emaAcc = S.emaAcc*(1-a) + acc*a;
      S.emaCombo = S.emaCombo*(1-a) + combo*a;
      S.emaMiss  = S.emaMiss*(1-a)  + misses*a;
      S.emaRt    = S.emaRt*(1-a)    + rtMs*a;

      // ----- Fair score: skill estimate -----
      // acc สูง + combo สูง = เก่งขึ้น
      // miss สูง + rt ช้า = ควรผ่อน
      const accTerm = (S.emaAcc - 70) / 25;      // -? .. +?
      const comboTerm = (S.emaCombo) / 18;       // 0..~1.6
      const missTerm = (S.emaMiss) / 10;         // 0..3
      const rtTerm = (S.emaRt - 650) / 350;      // -..+

      let skill = accTerm + comboTerm - (missTerm*0.85) - (rtTerm*0.55);

      // noise tiny deterministic (กัน pattern แข็งเกิน)
      const n = (rng()*2-1) * 0.03;
      skill += n;

      // ----- Convert to difficulty scalar d -----
      // skill ~ [-2..+2] -> d target [0.85..1.25]
      const target = clamp(1.0 + skill*0.10, 0.85, 1.25);

      // smooth toward target (กันกระชาก)
      S.d = S.d*0.88 + target*0.12;

      // fairness guardrails
      if (S.emaMiss >= 10) S.d = Math.min(S.d, 1.03); // พลาดเยอะ อย่าโหดเพิ่ม
      if (S.emaAcc <= 55)  S.d = Math.min(S.d, 0.98); // แม่นต่ำ ผ่อน
      if (S.emaAcc >= 90 && S.emaCombo >= 10) S.d = Math.max(S.d, 1.08); // เก่งจริง เพิ่มได้

      S.tick++;
    }

    // spawnSpeedMul: คูณกับ spawn interval (น้อยลง = เร็วขึ้น = โหดขึ้น)
    function spawnSpeedMul(acc, combo, misses, rtMs){
      update(acc, combo, misses, rtMs ?? 650);

      // d >1 = harder => interval * (1/d) ~ ลดเวลา
      // d <1 = easier => interval * (1/d) ~ เพิ่มเวลา
      const mul = clamp(1.0 / S.d, 0.78, 1.32);

      return mul;
    }

    function snapshot(){
      return {
        d: Number(S.d.toFixed(3)),
        emaAcc: Math.round(S.emaAcc),
        emaCombo: Math.round(S.emaCombo),
        emaMiss: Number(S.emaMiss.toFixed(2)),
        emaRt: Math.round(S.emaRt),
        tick: S.tick
      };
    }

    return { spawnSpeedMul, snapshot };
  }

  // ---------------- Pattern stub (optional) ----------------
  function makePattern(seedStr){
    const rng = makeRng(hashSeed(seedStr + '::pat'));
    return {
      // bias: + => wrongRate up, junkRate down (ตาม groups.safe.js ที่คุณทำไว้)
      bias(){
        // สลับ bias ช้า ๆ ให้รู้สึกมี “wave” แต่ deterministic
        const r = rng();
        return (r<0.33) ? 0.04 : (r<0.66 ? 0.00 : -0.03);
      }
    };
  }

  // ---------------- Tip emitter (explainable, rate-limited) ----------------
  function makeTip(){
    let lastAt = 0;
    return function(text, mood){
      const now = Date.now();
      if (now - lastAt < 2200) return; // กันสแปม
      lastAt = now;
      try{
        root.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text, mood: mood||'neutral' } }));
      }catch(_){}
    };
  }

  // ---------------- API ----------------
  function attach(opts){
    opts = opts || {};
    const enabled = !!opts.enabled && String(opts.runMode||'play') === 'play';
    const seed = String(opts.seed || Date.now());

    if (!enabled){
      NS.__ai = { enabled:false };
      return;
    }

    NS.__ai = {
      enabled:true,
      director: makeDirector(seed),
      pattern:  makePattern(seed),
      tip:      makeTip()
    };
  }

  NS.AIHooks = { attach };

})(typeof window!=='undefined'?window:globalThis);