/* === C: /herohealth/vr-groups/ai-hooks.js ===
GroupsVR — AI Hooks (SAFE STUB / PRODUCTION-SAFE)
✅ attach({runMode, seed, enabled})
✅ research/practice: force OFF
✅ Provides: GroupsVR.__ai = { director, pattern, tip }
✅ No external deps (optional Particles)
*/

(function(root){
  'use strict';

  const DOC = root.document;
  const NS = root.GroupsVR = root.GroupsVR || {};

  function clamp(v,a,b){ v = Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

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
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ---- Explainable tip bus (rate-limited) ----
  const Tip = (function(){
    let lastAt = 0;
    const GAP = 850; // ms (ไม่ถี่)
    function emitCoach(text, mood){
      try{
        root.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text:String(text||''), mood:String(mood||'neutral') } }));
      }catch(_){}
    }
    return {
      say(text, mood){
        const t = now();
        if (t - lastAt < GAP) return;
        lastAt = t;
        emitCoach(text, mood);
      }
    };
  })();

  // ---- Director: ปรับ spawn speed multiplier (เบา ๆ / ยุติธรรม) ----
  function makeDirector(rng){
    // แนวคิด: ถ้าแม่น+คอมโบสูง → เร็วขึ้นนิด
    // ถ้าพลาดเยอะ → ช้าลงนิด (ช่วยฟื้น)
    return {
      spawnSpeedMul(accPct, combo, misses){
        accPct = Number(accPct)||0;
        combo  = Number(combo)||0;
        misses = Number(misses)||0;

        let mul = 1.0;

        if (accPct >= 88) mul *= 0.95;
        if (accPct >= 94) mul *= 0.92;

        if (combo >= 8) mul *= 0.95;
        if (combo >= 12) mul *= 0.92;

        if (misses >= 6) mul *= 1.06;
        if (misses >= 10) mul *= 1.10;

        // tiny noise (deterministic)
        mul *= clamp(0.985 + rng()*0.03, 0.97, 1.03);

        return clamp(mul, 0.86, 1.16);
      }
    };
  }

  // ---- Pattern: bias wrong/junk (ส่งให้ engine ใช้) ----
  function makePattern(rng){
    // bias() คืนค่า -0.12..+0.12
    // +bias -> เพิ่ม wrongRate, ลด junkRate (หรือกลับได้ตามต้องการ)
    let t0 = now();
    let phase = 0;
    return {
      bias(){
        const t = now();
        const sec = (t - t0)/1000;

        // เปลี่ยน “สเตจ” ทุก ~14–18s
        if (sec > 14 + rng()*4){
          t0 = t;
          phase = (phase + 1) % 4;
        }

        // 4 รูปแบบ: กลาง / ท้าทาย / เมตตา / หลอกตา
        if (phase === 0) return 0;                 // balanced
        if (phase === 1) return clamp(0.05 + rng()*0.05, 0, 0.12);   // more wrong
        if (phase === 2) return clamp(-0.05 - rng()*0.05, -0.12, 0); // more junk (ยาก)
        return clamp((rng()-0.5)*0.10, -0.12, 0.12);                 // noisy
      }
    };
  }

  // ---- Public attach ----
  NS.AIHooks = {
    attach(cfg){
      cfg = cfg || {};
      const runMode = String(cfg.runMode || 'play').toLowerCase();
      const enabled = !!cfg.enabled;

      // research/practice: ปิดแน่นอน
      if (runMode !== 'play' || !enabled){
        NS.__ai = null;
        return { enabled:false };
      }

      const seed = String(cfg.seed ?? Date.now());
      const rng = makeRng(hashSeed(seed + '::ai'));

      const director = makeDirector(rng);
      const pattern  = makePattern(rng);

      // expose
      NS.__ai = {
        director,
        pattern,
        tip(text, mood){
          // explainable micro-tips
          Tip.say(text, mood);
        }
      };

      // tiny “AI on” hint (ครั้งเดียว)
      try{
        Tip.say('AI ON: เกมจะปรับจังหวะให้พอดีกับเรา 🤖', 'neutral');
      }catch(_){}

      return { enabled:true };
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);