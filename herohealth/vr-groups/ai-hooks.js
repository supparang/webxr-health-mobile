/* === /herohealth/vr-groups/ai-hooks.js ===
PACK 15: AI Hooks Module (disabled by default)
✅ attach({runMode, seed, enabled})
✅ AI Difficulty Director (fair, smooth, bounded)
✅ AI Coach micro-tips (explainable, rate-limited)
✅ Pattern Generator hooks (seeded) -> provide overrides at start (optional)
Requires engine support:
- window.GroupsVR.GameEngine.setAIModifiers({spawnMul,sizeMul,junkMul,wrongMul})
*/
(function(root){
  'use strict';
  const DOC = root.document;
  const NS = root.GroupsVR = root.GroupsVR || {};
  const AI = NS.AIHooks = NS.AIHooks || {};

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function makeRng(seedU32){
    let s = (seedU32>>>0)||1;
    return function(){
      s = (Math.imul(1664525, s) + 1013904223)>>>0;
      return s / 4294967296;
    };
  }

  function emit(name, detail){
    try { root.dispatchEvent(new CustomEvent(name, { detail })); } catch(_){}
  }

  // state
  let on = false;
  let cfg = null;
  let rng = null;

  let lastTipAt = 0;
  let tipCooldownMs = 5200;

  // rolling metrics
  let acc = 0;
  let misses = 0;
  let combo = 0;

  // director smoothing
  let spawnMul = 1.0;
  let sizeMul  = 1.0;
  let junkMul  = 1.0;
  let wrongMul = 1.0;

  function coach(text, mood='neutral'){
    const t = performance.now ? performance.now() : Date.now();
    if (t - lastTipAt < tipCooldownMs) return;
    lastTipAt = t;
    emit('hha:coach', { text, mood });
  }

  function applyToEngine(){
    const E = NS.GameEngine;
    if (!E || typeof E.setAIModifiers !== 'function') return;
    E.setAIModifiers({ spawnMul, sizeMul, junkMul, wrongMul });
    emit('hha:ai', { spawnMul, sizeMul, junkMul, wrongMul });
  }

  function softToward(cur, target, rate=0.12){
    return cur + (target - cur) * clamp(rate, 0.02, 0.45);
  }

  function directorTick(){
    if (!on) return;

    // fair targets:
    // - if acc high and combo high -> slightly harder (faster + smaller + more wrong/junk)
    // - if misses climbing -> ease off
    const targetHard = clamp(
      (acc/100) * 0.65 + (Math.min(12, combo)/12) * 0.35,
      0, 1
    );

    const missPressure = clamp(misses / 10, 0, 1);

    // base hardness adjusted by miss pressure
    const h = clamp(targetHard - missPressure*0.45, 0, 1);

    // bounded multipliers (keep safe)
    const spawnT = clamp(1.08 - h*0.22 + missPressure*0.18, 0.88, 1.22);
    const sizeT  = clamp(1.06 - h*0.14 + missPressure*0.10, 0.92, 1.12);
    const junkT  = clamp(0.98 + h*0.18 - missPressure*0.12, 0.82, 1.22);
    const wrongT = clamp(0.98 + h*0.14 - missPressure*0.10, 0.84, 1.18);

    // smooth
    spawnMul = softToward(spawnMul, spawnT, 0.10);
    sizeMul  = softToward(sizeMul,  sizeT,  0.10);
    junkMul  = softToward(junkMul,  junkT,  0.08);
    wrongMul = softToward(wrongMul, wrongT, 0.08);

    applyToEngine();

    // explainable micro tips
    if (misses >= 6 && acc < 70) {
      coach('ลดความรีบก่อน! เล็งให้ตรงหมู่ แล้วค่อยยิง 🎯', 'sad');
    } else if (combo >= 8 && acc >= 85) {
      coach('คอมโบแรง! ระวังอย่าหลุดจังหวะ 🔥', 'happy');
    } else if (acc < 65 && misses < 4) {
      coach('ลอง “มองชื่อหมู่” แล้วค่อยยิง — จะลดพลาดได้มาก ✅', 'neutral');
    }
  }

  // pattern hooks (seeded) - OPTIONAL (safe)
  function patternAtStart(seed){
    // keep it deterministic and mild
    const r = rng ? rng() : 0.5;
    const stormBias = (r < 0.5) ? 'short' : 'normal';
    return { stormBias };
  }

  // events
  function onRank(ev){
    const d = (ev && ev.detail) || {};
    acc = Number(d.accuracy) || acc;
    directorTick();
  }

  function onScore(ev){
    const d = (ev && ev.detail) || {};
    combo = Number(d.combo) || combo;
    misses = Number(d.misses) || misses;
    directorTick();
  }

  function onProgress(ev){
    const k = String(((ev && ev.detail)||{}).kind || '').toLowerCase();
    if (!on) return;

    // extra small moments
    if (k === 'boss_spawn'){
      if (acc >= 80) coach('บอสมา! คุมจังหวะ อย่ารีบยิงมั่ว 👊', 'fever');
      else coach('บอสมา! เล็งให้ชัวร์ก่อนยิงนะ ✨', 'neutral');
    }
  }

  AI.attach = function({ runMode='play', seed='', enabled=false } = {}){
    runMode = String(runMode||'play').toLowerCase();
    if (runMode === 'research') enabled = false;

    on = !!enabled;
    cfg = { runMode, seed: String(seed||'') };

    rng = makeRng(hashSeed(cfg.seed + '::ai-hooks'));

    // reset
    acc = 0; misses = 0; combo = 0;
    spawnMul = 1.0; sizeMul=1.0; junkMul=1.0; wrongMul=1.0;
    lastTipAt = 0;

    if (!on){
      // ensure engine back to neutral
      try{
        const E = NS.GameEngine;
        E && E.setAIModifiers && E.setAIModifiers({ spawnMul:1, sizeMul:1, junkMul:1, wrongMul:1 });
      }catch(_){}
      return;
    }

    const pat = patternAtStart(cfg.seed);
    emit('hha:ai', { enabled:true, seed:cfg.seed, pattern:pat });

    // hooks
    root.addEventListener('hha:rank', onRank, { passive:true });
    root.addEventListener('hha:score', onScore, { passive:true });
    root.addEventListener('groups:progress', onProgress, { passive:true });

    coach('AI ON: จะปรับความยากแบบยุติธรรมให้นะ 🤖✨', 'happy');
  };

})(typeof window !== 'undefined' ? window : globalThis);