// === /herohealth/vr-groups/ai-hooks.js ===
// AI Hooks — SAFE STUB (deterministic-friendly) — v20260215a
// Purpose: provide window.HHA.createAIHooks() so groups.safe.js can attach AI optionally.
// ✅ Default OFF (unless ?ai=1 AND run=play AND not research/practice)
// ✅ Deterministic-safe: uses seed (string) -> u32 -> mulberry32 for any randomness
// ✅ Rate-limited tips, fairness clamps, no external deps
// API:
//   window.HHA.createAIHooks({game, runMode, diff, seed, enabled}) -> { getDifficulty(), getTip(), onEvent() }

(function(){
  'use strict';

  const WIN = window;
  WIN.HHA = WIN.HHA || {};

  // If already exists, do not override (let your upstream HHA provide real AI).
  if (typeof WIN.HHA.createAIHooks === 'function') return;

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function clamp(v, a, b){
    v = Number(v);
    if (!Number.isFinite(v)) v = 0;
    return Math.max(a, Math.min(b, v));
  }

  function nowMs(){
    try { return performance.now(); } catch { return Date.now(); }
  }

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

  // mulberry32
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

  function pick(rng, arr){
    return arr[(rng()*arr.length)|0];
  }

  function isAiEnabledByParams(){
    const run = String(qs('run','play')||'play').toLowerCase();
    if (run === 'research' || run === 'practice') return false;
    const on = String(qs('ai','0')||'0').toLowerCase();
    return (on === '1' || on === 'true');
  }

  // Very small "director" state: we output difficulty multiplier 0.85..1.18
  function createHooks(opts){
    const game = String(opts && opts.game ? opts.game : '').toLowerCase() || 'unknown';
    const runMode = String(opts && opts.runMode ? opts.runMode : '').toLowerCase() || 'play';
    const diff = String(opts && opts.diff ? opts.diff : '').toLowerCase() || 'normal';
    const seed = String(opts && opts.seed ? opts.seed : (qs('seed','')||Date.now()));
    const enabledFlag = !!(opts && opts.enabled);

    const enabled = enabledFlag && (runMode === 'play') && isAiEnabledByParams();
    const rng = makeRng(strSeedToU32(seed + '::ai::' + game));

    // session stats (updated via onEvent)
    const S = {
      enabled,
      game, runMode, diff, seed,
      shots: 0,
      hitGood: 0,
      hitBad: 0,
      missShot: 0,
      missTimeout: 0,
      combo: 0,
      maxCombo: 0,
      score: 0,
      miss: 0,

      // director output
      diffMul: 1.0,

      // tip controls
      lastTipAt: 0,
      tipCooldownMs: 5500,
      lastTipKey: '',
    };

    // Guidance library (super safe)
    const TIPS = {
      core: [
        {k:'look_name', t:'ดู “ชื่อหมู่” ก่อนยิงทุกครั้ง ✅'},
        {k:'combo', t:'คอมโบสำคัญ! ยิงถูกติดกันจะได้แต้มพุ่ง 🔥'},
        {k:'slow', t:'ไม่ต้องรีบ—ยิงให้ชัวร์แล้วค่อยเร่ง 🎯'},
      ],
      recover: [
        {k:'reset', t:'หลุดคอมโบไม่เป็นไร ตั้งหลักใหม่ แล้วเก็บต่อ 💪'},
        {k:'aim', t:'เล็งกลางเป้า แล้วแตะ/ยิงทีละช็อต จะนิ่งกว่า'},
      ],
      cvr: [
        {k:'cvr_center', t:'โหมด cVR: ให้ crosshair อยู่กลางเป้าก่อนค่อยยิง'},
        {k:'cvr_tap', t:'แตะจอ “ครั้งเดียว” ต่อช็อต อย่ารัว (กันพลาด)'},
      ],
      boss: [
        {k:'boss', t:'บอสมาแล้ว! โฟกัสยิง “หมู่ที่ถูก” เท่านั้น 👊'},
      ],
      mini: [
        {k:'mini', t:'MINI มาแล้ว! เก็บให้ครบตามเป้าเร็ว ๆ ⚡'},
      ],
    };

    function accuracy(){
      const total = S.shots || 0;
      if (total <= 0) return 0;
      return Math.round((S.hitGood / total) * 100);
    }

    function updateDirector(){
      // super simple & fair:
      // - if accuracy low or many misses => slow spawn a bit (mul < 1)
      // - if accuracy high + combo stable => speed up slightly (mul > 1)
      const acc = accuracy();
      const total = S.shots || 0;

      let mul = 1.0;

      if (total >= 12){
        if (acc <= 55) mul *= 0.90;
        else if (acc >= 85) mul *= 1.08;

        if ((S.miss || 0) >= 6) mul *= 0.92;
        if ((S.maxCombo || 0) >= 12) mul *= 1.05;
      }

      // clamp to stay fair
      S.diffMul = clamp(mul, 0.85, 1.18);
    }

    function canTip(){
      const t = nowMs();
      return (t - (S.lastTipAt || 0)) >= S.tipCooldownMs;
    }

    function chooseTip(eventName){
      const view = String(qs('view','')||'').toLowerCase();
      const pool = [];

      // base tips
      pool.push.apply(pool, TIPS.core);

      // contextual
      if (eventName === 'shot:hit_bad' || eventName === 'shot:miss' || eventName === 'target:timeout_miss'){
        pool.push.apply(pool, TIPS.recover);
      }
      if (view === 'cvr'){
        pool.push.apply(pool, TIPS.cvr);
      }
      if (eventName && String(eventName).indexOf('boss') >= 0){
        pool.push.apply(pool, TIPS.boss);
      }
      if (eventName && String(eventName).indexOf('mini') >= 0){
        pool.push.apply(pool, TIPS.mini);
      }

      // pick tip but avoid repeating immediately
      let tip = pick(rng, pool);
      if (tip && tip.k === S.lastTipKey && pool.length > 1){
        tip = pick(rng, pool);
      }
      return tip || null;
    }

    function getDifficulty(){
      if (!S.enabled) return 1.0;
      updateDirector();
      return S.diffMul;
    }

    function getTip(reason){
      if (!S.enabled) return null;
      if (!canTip()) return null;

      const tip = chooseTip(reason || '');
      if (!tip) return null;

      S.lastTipAt = nowMs();
      S.lastTipKey = tip.k;
      return { text: tip.t, key: tip.k, reason: String(reason||'') };
    }

    function onEvent(name, payload){
      if (!S.enabled) return;

      const n = String(name||'');
      const p = payload || {};

      // update stats from engine events
      if (n === 'run:start'){
        // reset minimal
        S.shots = 0; S.hitGood = 0; S.hitBad = 0; S.missShot = 0; S.missTimeout = 0;
        S.combo = 0; S.maxCombo = 0; S.score = 0; S.miss = 0;
        return;
      }

      if (n === 'shot:hit_good'){
        S.shots++;
        S.hitGood++;
        S.combo = clamp(p.combo ?? (S.combo+1), 0, 99);
        S.maxCombo = Math.max(S.maxCombo, S.combo);
        S.score = Number(p.score ?? S.score) || S.score;
        return;
      }

      if (n === 'shot:hit_bad'){
        S.shots++;
        S.hitBad++;
        S.combo = 0;
        S.miss++;
        return;
      }

      if (n === 'shot:miss'){
        S.shots++;
        S.missShot++;
        S.combo = 0;
        S.miss++;
        return;
      }

      if (n === 'target:timeout_miss'){
        S.missTimeout++;
        S.combo = 0;
        S.miss++;
        return;
      }

      if (n === 'run:end'){
        // nothing special
        return;
      }
    }

    // expose safe object
    return {
      enabled: S.enabled,
      seed: S.seed,
      getDifficulty,
      getTip,
      onEvent
    };
  }

  WIN.HHA.createAIHooks = function(opts){
    try{
      return createHooks(opts || {});
    }catch(_){
      // ultra-safe fallback: disabled hooks
      return {
        enabled:false,
        getDifficulty: ()=>1.0,
        getTip: ()=>null,
        onEvent: ()=>{}
      };
    }
  };

})();