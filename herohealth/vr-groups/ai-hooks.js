/* === /herohealth/vr-groups/ai-hooks.js ===
Food Groups VR — AI Hooks (SAFE / EXPLAINABLE / SEEDED)
✅ Disabled by default (only attaches when enabled=true)
✅ Play-only: runMode must be 'play'
✅ Seeded deterministic: derived from provided seed
✅ Expose:
  - GroupsVR.AIHooks.attach({runMode, seed, enabled})
  - GroupsVR.__ai.director.spawnSpeedMul(accPct, combo, misses)
  - GroupsVR.__ai.pattern.bias()  // small bias for wrong/junk mix
  - GroupsVR.__ai.tip(text, mood, meta) // rate-limit + explainable coach
Notes:
- Research/practice: NEVER attach
- Bias is intentionally small to keep fairness
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  const NS = root.GroupsVR = root.GroupsVR || {};

  function emit(name, detail) {
    try { root.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }

  function clamp(v, a, b) {
    v = Number(v);
    if (!isFinite(v)) v = a;
    return v < a ? a : (v > b ? b : v);
  }

  // ---------- seeded rng ----------
  function hashSeed(str) {
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeRng(seedU32) {
    let s = (seedU32 >>> 0) || 1;
    return function rand() {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function nowMs() {
    return (root.performance && performance.now) ? performance.now() : Date.now();
  }

  // ---------- Micro Coach (rate-limit + explainable) ----------
  function createCoach(rng, opts) {
    const cfg = Object.assign({
      minGapMs: 2600,   // rate-limit
      maxPerMin: 10,    // safety
    }, opts || {});

    let lastAt = 0;
    let windowStart = 0;
    let countInWindow = 0;

    function canTalk(t) {
      if (t - lastAt < cfg.minGapMs) return false;
      if (t - windowStart > 60000) { windowStart = t; countInWindow = 0; }
      if (countInWindow >= cfg.maxPerMin) return false;
      return true;
    }

    function moodFrom(meta) {
      const p = Number(meta && meta.pressureLevel);
      if (p >= 3) return 'sad';
      if (p >= 2) return 'fever';
      if (p >= 1) return 'neutral';
      return 'happy';
    }

    function tip(text, mood, meta) {
      const t = nowMs();
      if (!canTalk(t)) return false;

      lastAt = t;
      countInWindow++;

      const why = (meta && meta.why) ? String(meta.why) : '';
      const explain = (meta && meta.explain) ? String(meta.explain) : '';

      // Keep it short & kid-friendly (ป.5)
      let msg = String(text || '').trim();
      if (explain) msg += `\n(${explain})`;
      if (why) msg += `\n#${why}`;

      emit('hha:coach', {
        text: msg,
        mood: String(mood || moodFrom(meta) || 'neutral')
      });
      return true;
    }

    function nudgePack(state) {
      // state: {accPct, combo, misses, pressureLevel}
      const a = state.accPct|0;
      const c = state.combo|0;
      const m = state.misses|0;
      const p = state.pressureLevel|0;

      // deterministic selection
      const r = rng();

      if (p >= 3) {
        return tip('หยุด 0.5 วิแล้วค่อยยิง 🎯', 'sad', {
          why: 'pressure3',
          explain: 'Miss เยอะ → ช้าลงนิดเพื่อความแม่น'
        });
      }
      if (p === 2) {
        return tip('เล็งหมู่ให้ชัวร์ก่อนยิง 🔥', 'fever', {
          why: 'pressure2',
          explain: 'ยิงมั่วจะโดนผิดหมู่/ขยะ'
        });
      }
      if (a < 55 && m >= 4) {
        return tip('ดูชื่อหมู่บน GOAL แล้วค่อยยิง 👀', 'neutral', {
          why: 'low-acc',
          explain: `ความแม่น ${a}%`
        });
      }
      if (c >= 8 && a >= 75) {
        return tip('คอมโบสวยมาก! รักษาจังหวะต่อ 💪', 'happy', {
          why: 'combo',
          explain: `combo ${c}`
        });
      }

      // random small variety (still deterministic)
      if (r < 0.33) return tip('ถ้าไม่มั่นใจ “อย่ายิง” ก่อน 👌', 'neutral', { why:'discipline', explain:'กันพลาด' });
      if (r < 0.66) return tip('ยิงช้าแต่ชัวร์ ดีกว่ายิงเร็วแล้วพลาด 😄', 'neutral', { why:'pace', explain:'ช้า=แม่น' });
      return tip('โฟกัสแค่ “หมู่ที่ถูก” ก่อนนะ 🎯', 'happy', { why:'focus', explain:'ลดสิ่งรบกวน' });
    }

    return { tip, nudgePack };
  }

  // ---------- Difficulty Director (fair & smooth) ----------
  function createDirector(rng, coach) {
    // smoothed estimates to avoid jitter
    let emaAcc = 70;      // %
    let emaMiss = 0;      // count proxy
    let emaCombo = 0;

    let lastDecisionAt = 0;
    let lastMul = 1.0;

    function update(accPct, combo, misses) {
      const a = clamp(accPct, 0, 100);
      const c = clamp(combo, 0, 30);
      const m = clamp(misses, 0, 99);

      // EWMA smoothing
      const k = 0.12;
      emaAcc = emaAcc + (a - emaAcc) * k;
      emaCombo = emaCombo + (c - emaCombo) * k;
      emaMiss = emaMiss + ((m) - emaMiss) * 0.10;

      return { emaAcc, emaCombo, emaMiss };
    }

    function spawnSpeedMul(accPct, combo, misses, meta) {
      const t = nowMs();
      const s = update(accPct, combo, misses);

      // decide at most every 900ms
      if (t - lastDecisionAt < 900) return lastMul;
      lastDecisionAt = t;

      // base difficulty target: keep “flow”
      // higher acc/combo -> faster spawns (mul < 1)
      // high misses -> slower spawns (mul > 1)
      let mul = 1.0;

      // performance component
      mul *= (s.emaAcc >= 85) ? 0.90 : (s.emaAcc >= 75 ? 0.95 : (s.emaAcc <= 55 ? 1.10 : 1.02));

      // combo component
      if (s.emaCombo >= 10) mul *= 0.92;
      else if (s.emaCombo >= 6) mul *= 0.96;

      // miss component
      if (s.emaMiss >= 14) mul *= 1.14;
      else if (s.emaMiss >= 9) mul *= 1.10;
      else if (s.emaMiss >= 5) mul *= 1.06;

      // small deterministic wobble to avoid robotic feel (±2%)
      const wobble = (rng() * 0.04) - 0.02;
      mul *= (1 + wobble);

      // clamp for fairness (do not become impossible)
      mul = clamp(mul, 0.82, 1.18);

      // occasional explainable coach nudge
      if (coach && coach.nudgePack) {
        const p = Number(meta && meta.pressureLevel) || 0;
        // nudge on meaningful swings only
        if (Math.abs(mul - lastMul) > 0.06 && rng() < 0.55) {
          coach.nudgePack({ accPct: Math.round(s.emaAcc), combo: combo|0, misses: misses|0, pressureLevel: p });
        }
      }

      lastMul = mul;
      return mul;
    }

    return { spawnSpeedMul };
  }

  // ---------- Pattern Generator (bias only; engine-safe) ----------
  function createPattern(rng) {
    // bias affects wrongRate (+bias) and junkRate (-bias) inside engine
    // keep tiny to preserve fairness
    let phase = 0;
    let lastAt = 0;

    function bias(meta) {
      const t = nowMs();
      if (t - lastAt > 2200) {
        lastAt = t;
        // deterministic phase stepping
        phase = (phase + 1 + ((rng()*2)|0)) % 7;
      }

      // base bias table (small)
      const table = [ -0.03, -0.015, 0.0, 0.02, 0.035, 0.015, -0.01 ];
      let b = table[phase] || 0;

      // if player is struggling, bias toward fewer wrong (reduce b)
      const acc = Number(meta && meta.accPct);
      const miss = Number(meta && meta.misses);
      if (isFinite(acc) && acc < 55) b -= 0.02;
      if (isFinite(miss) && miss >= 10) b -= 0.02;

      // clamp small
      return clamp(b, -0.06, 0.06);
    }

    return { bias };
  }

  // ---------- Public AIHooks ----------
  NS.AIHooks = NS.AIHooks || {};

  NS.AIHooks.attach = function attach(opts) {
    opts = opts || {};
    const runMode = String(opts.runMode || '').toLowerCase();
    const enabled = !!opts.enabled;

    // HARD RULE: never in research/practice
    if (runMode !== 'play') {
      NS.__ai = null;
      return { ok:false, reason:'runMode-not-play' };
    }
    if (!enabled) {
      NS.__ai = null;
      return { ok:false, reason:'disabled' };
    }

    const seed = String(opts.seed ?? Date.now());
    const rng = makeRng(hashSeed(seed + '::ai-hooks::groups'));

    const coach = createCoach(rng, { minGapMs: 2500, maxPerMin: 9 });
    const pattern = createPattern(rng);
    const director = createDirector(rng, coach);

    // expose in a single object used by engine
    NS.__ai = {
      enabled: true,
      seed,
      director,
      pattern,
      tip: function (text, mood, meta) {
        return coach.tip(text, mood, meta);
      }
    };

    // announce once
    coach.tip('AI ช่วยปรับความยากแล้ว 🤖✨', 'happy', { why:'ai-on', explain:'โหมดเล่นเท่านั้น (วิจัยปิด)' });

    return { ok:true, reason:'attached', seed };
  };

})(typeof window !== 'undefined' ? window : globalThis);