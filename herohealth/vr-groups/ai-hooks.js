<!-- === /herohealth/vr-groups/ai-hooks.js ===
GroupsVR — AI Hooks (Attach point) — v20260215a
✅ D15: window.HHA.createAIHooks() for GroupsVR
- Default OFF unless runMode=play AND ?ai=1
- Research mode should be OFF (engine already blocks)
- Provides:
  - getDifficulty(): returns multiplier ~ 0.85..1.18
  - getTip(): explainable micro-tips (rate-limited)
  - onEvent(): receive events from engine/run page
-->
<script>
(function(){
  'use strict';

  const WIN = window;

  WIN.HHA = WIN.HHA || {};

  // If user already has a global createAIHooks elsewhere, do not override.
  if (typeof WIN.HHA.createAIHooks === 'function') return;

  function clamp(v,a,b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
  function now(){ try{return performance.now();}catch(_){return Date.now();} }

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  // Deterministic helper (optional): seed -> pseudo RNG (not used heavily yet)
  function strSeedToU32(s){
    s = String(s ?? '');
    if (!s) s = String(Date.now());
    let h = 2166136261 >>> 0;
    for (let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function makeRng(seedU32){
    let t = seedU32 >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  WIN.HHA.createAIHooks = function createAIHooks(cfg){
    cfg = cfg || {};
    const enabledFlag = !!cfg.enabled;
    const runMode = String(cfg.runMode||'play').toLowerCase();
    const diff = String(cfg.diff||'normal').toLowerCase();
    const seed = String(cfg.seed||'');

    // Hard safety: if not enabled or not play => return null (engine will fall back)
    if (!enabledFlag || runMode !== 'play') return null;

    // Require URL flag ?ai=1
    const aiQS = String(qs('ai','0')||'0').toLowerCase();
    if (!(aiQS === '1' || aiQS === 'true')) return null;

    const rng = makeRng(strSeedToU32(seed || 'ai'));

    // Rolling stats
    let shots = 0, good = 0, miss = 0, comboMax = 0, comboCur = 0;
    let lastTipAt = 0;
    let lastDiffAt = 0;
    let diffMul = 1.00;

    function accPct(){
      return shots > 0 ? (good / shots) * 100 : 0;
    }

    function chooseTip(){
      // explainable micro-tips (very short)
      const acc = accPct();
      const pool = [];

      // Basic:
      pool.push({ t:'ดูชื่อ “หมู่” ก่อนยิงทุกครั้ง ✅', mood:'neutral' });

      // If missing a lot:
      if (miss >= 3) pool.push({ t:'ช้าลงนิดนึง แล้วค่อยยิงให้ชัวร์ 🎯', mood:'neutral' });

      // If accuracy low:
      if (acc > 0 && acc < 55) pool.push({ t:'เล็งให้ใกล้เป้า แล้วค่อยยิง (อย่ารัว) ✨', mood:'neutral' });

      // If combo collapsing:
      if (comboMax >= 6 && comboCur === 0) pool.push({ t:'คอมโบหลุดไม่เป็นไร เริ่มใหม่ได้! 🔥', mood:'happy' });

      // If doing great:
      if (acc >= 80 && comboMax >= 8) pool.push({ t:'โคตรดี! รักษาคอมโบต่อเลย 💥', mood:'happy' });

      // Pick deterministic-ish
      const pick = pool[(rng()*pool.length)|0];
      return pick;
    }

    function maybeEmitTip(force){
      const t = now();
      if (!force && (t - lastTipAt) < 2200) return null; // rate-limit
      lastTipAt = t;
      return chooseTip();
    }

    function updateDifficulty(){
      // Don’t change too often
      const t = now();
      if ((t - lastDiffAt) < 900) return diffMul;
      lastDiffAt = t;

      // Goal: fair + smooth
      // - If accuracy high and combo stable => slightly harder (spawn faster)
      // - If accuracy low or many misses => easier
      const acc = accPct();
      let target = 1.00;

      if (acc >= 82 && comboMax >= 10) target = 0.90;         // harder (interval * 0.90)
      else if (acc >= 72 && comboMax >= 7) target = 0.95;
      else if (acc > 0 && acc <= 55) target = 1.10;           // easier (interval * 1.10)
      else if (miss >= 5 && acc < 65) target = 1.12;

      // Adjust by diff baseline a little
      if (diff === 'easy') target *= 1.04;
      if (diff === 'hard') target *= 0.96;

      // Smooth step
      diffMul = clamp(diffMul + (target - diffMul) * 0.35, 0.85, 1.18);
      return diffMul;
    }

    function onEvent(name, payload){
      payload = payload || {};
      switch(String(name||'')){
        case 'run:start':
          shots = 0; good = 0; miss = 0; comboMax = 0; comboCur = 0;
          diffMul = 1.00;
          lastTipAt = 0;
          lastDiffAt = 0;
          break;

        case 'shot:miss':
        case 'target:timeout_miss':
          shots++;
          miss++;
          comboCur = 0;
          break;

        case 'shot:hit_good':
          shots++;
          good++;
          comboCur = Math.min(99, (comboCur|0) + 1);
          comboMax = Math.max(comboMax|0, comboCur|0);
          break;

        case 'shot:hit_bad':
          shots++;
          miss++;
          comboCur = 0;
          break;

        case 'mini:start':
        case 'boss:spawn':
          // force a short tip when intensity rises (still rate-limited)
          maybeEmitTip(true);
          break;

        default:
          // ignore
          break;
      }
    }

    return {
      enabled: true,
      getDifficulty: updateDifficulty,
      getTip: function(){
        const tip = maybeEmitTip(false);
        return tip ? { text: tip.t, mood: tip.mood } : null;
      },
      onEvent
    };
  };

})();
</script>