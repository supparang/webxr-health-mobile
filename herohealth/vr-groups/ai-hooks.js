/* === /herohealth/vr-groups/ai-hooks.js ===
Food Groups VR — AI Hooks (SAFE / EXPLAINABLE / SEEDED) + PATTERN PACKS
✅ Disabled by default (only attaches when enabled=true)
✅ Play-only (runMode must be 'play')
✅ Seeded deterministic (seed -> rng)
✅ Expose:
  - GroupsVR.AIHooks.attach({runMode, seed, enabled})
  - GroupsVR.__ai.director.spawnSpeedMul(accPct, combo, misses, meta)
  - GroupsVR.__ai.pattern.nextPos(rect, meta, kind)  // NEW
  - GroupsVR.__ai.pattern.bias(meta)
  - GroupsVR.__ai.tip(text, mood, meta)
*/

(function (root) {
  'use strict';

  const NS = root.GroupsVR = root.GroupsVR || {};

  function emit(name, detail) {
    try { root.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }
  function clamp(v, a, b) {
    v = Number(v);
    if (!isFinite(v)) v = a;
    return v < a ? a : (v > b ? b : v);
  }
  function nowMs() {
    return (root.performance && performance.now) ? performance.now() : Date.now();
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

  // ---------- Micro Coach ----------
  function createCoach(rng, opts) {
    const cfg = Object.assign({ minGapMs: 2600, maxPerMin: 10 }, opts || {});
    let lastAt = 0;
    let windowStart = 0;
    let countInWindow = 0;

    function canTalk(t) {
      if (t - lastAt < cfg.minGapMs) return false;
      if (t - windowStart > 60000) { windowStart = t; countInWindow = 0; }
      if (countInWindow >= cfg.maxPerMin) return false;
      return true;
    }

    function tip(text, mood, meta) {
      const t = nowMs();
      if (!canTalk(t)) return false;
      lastAt = t;
      countInWindow++;

      const explain = meta && meta.explain ? String(meta.explain) : '';
      let msg = String(text || '').trim();
      if (explain) msg += `\n(${explain})`;

      emit('hha:coach', { text: msg, mood: String(mood || 'neutral') });
      return true;
    }

    function nudgePack(state) {
      const a = state.accPct|0, c = state.combo|0, m = state.misses|0, p = state.pressureLevel|0;
      if (p >= 3) return tip('หยุด-เล็ง-ยิง 🎯', 'sad', { explain:'พลาดเยอะ → ช้าลงนิดเพื่อแม่น' });
      if (p === 2) return tip('โฟกัสหมู่ที่ถูกก่อน 🔥', 'fever', { explain:'กันโดนผิดหมู่/ขยะ' });
      if (a < 55 && m >= 4) return tip('ดู GOAL แล้วค่อยยิง 👀', 'neutral', { explain:`ความแม่น ${a}%` });
      if (c >= 8 && a >= 75) return tip('คอมโบมาแล้ว! เก็บต่อ 💪', 'happy', { explain:`combo ${c}` });

      const r = rng();
      if (r < 0.33) return tip('ไม่มั่นใจ “อย่ายิง” ก่อน 👌', 'neutral', { explain:'กันพลาด' });
      if (r < 0.66) return tip('ยิงช้าแต่ชัวร์ ดีกว่ายิงเร็วแล้วพลาด 😄', 'neutral', { explain:'ช้า=แม่น' });
      return tip('โฟกัสแค่ “หมู่ที่ถูก” 🎯', 'happy', { explain:'ลดสิ่งรบกวน' });
    }

    return { tip, nudgePack };
  }

  // ---------- Difficulty Director ----------
  function createDirector(rng, coach) {
    let emaAcc = 70, emaMiss = 0, emaCombo = 0;
    let lastDecisionAt = 0;
    let lastMul = 1.0;

    function update(accPct, combo, misses) {
      const a = clamp(accPct, 0, 100);
      const c = clamp(combo, 0, 30);
      const m = clamp(misses, 0, 99);
      const k = 0.12;
      emaAcc = emaAcc + (a - emaAcc) * k;
      emaCombo = emaCombo + (c - emaCombo) * k;
      emaMiss = emaMiss + (m - emaMiss) * 0.10;
      return { emaAcc, emaCombo, emaMiss };
    }

    function spawnSpeedMul(accPct, combo, misses, meta) {
      const t = nowMs();
      const s = update(accPct, combo, misses);
      if (t - lastDecisionAt < 900) return lastMul;
      lastDecisionAt = t;

      let mul = 1.0;
      mul *= (s.emaAcc >= 85) ? 0.90 : (s.emaAcc >= 75 ? 0.95 : (s.emaAcc <= 55 ? 1.10 : 1.02));
      if (s.emaCombo >= 10) mul *= 0.92;
      else if (s.emaCombo >= 6) mul *= 0.96;

      if (s.emaMiss >= 14) mul *= 1.14;
      else if (s.emaMiss >= 9) mul *= 1.10;
      else if (s.emaMiss >= 5) mul *= 1.06;

      const wobble = (rng() * 0.04) - 0.02;
      mul *= (1 + wobble);

      mul = clamp(mul, 0.82, 1.18);

      if (coach && coach.nudgePack) {
        if (Math.abs(mul - lastMul) > 0.06 && rng() < 0.55) {
          coach.nudgePack({
            accPct: Math.round(s.emaAcc),
            combo: combo|0,
            misses: misses|0,
            pressureLevel: Number(meta && meta.pressureLevel) || 0
          });
        }
      }

      lastMul = mul;
      return mul;
    }

    return { spawnSpeedMul };
  }

  // ---------- Pattern Packs ----------
  function createPattern(rng) {
    let phase = 0;
    let lastAt = 0;

    function _center(rect) {
      return { x: (rect.xMin + rect.xMax) * 0.5, y: (rect.yMin + rect.yMax) * 0.5 };
    }

    function _randIn(rect) {
      return {
        x: rect.xMin + rng() * (rect.xMax - rect.xMin),
        y: rect.yMin + rng() * (rect.yMax - rect.yMin),
      };
    }

    function _ring(rect, meta) {
      const c = _center(rect);
      const w = (rect.xMax - rect.xMin);
      const h = (rect.yMax - rect.yMin);
      const rad = clamp(Math.min(w, h) * (0.28 + rng()*0.12), 90, 240);

      const storm = !!(meta && meta.stormOn);
      // storm: angle sweeping feel
      const a = (storm ? (phase * 0.9) : (rng()*Math.PI*2));
      const x = c.x + Math.cos(a) * rad;
      const y = c.y + Math.sin(a) * rad * 0.75;
      return { x, y, explain: storm ? 'แพทเทิร์นวงแหวนช่วงพายุ' : 'แพทเทิร์นวงแหวน' };
    }

    function _sweep(rect, meta) {
      const w = rect.xMax - rect.xMin;
      const c = _center(rect);

      // sweep left->right->left
      const t = (phase % 6) / 5; // 0..1
      const dir = (Math.floor(phase/6) % 2 === 0) ? 1 : -1;
      const x = rect.xMin + (dir>0 ? t*w : (1-t)*w);

      // y slightly around center
      const y = clamp(c.y + (rng()*120 - 60), rect.yMin, rect.yMax);
      return { x, y, explain: 'แพทเทิร์นกวาดซ้าย-ขวา' };
    }

    function _clusterNearCrosshair(rect, meta) {
      const cx = (root.innerWidth || rect.W || 360) * 0.5;
      const cy = (root.innerHeight|| rect.H || 640) * 0.5;

      const p = Number(meta && meta.pressureLevel) || 0;
      const spread = (p >= 2) ? 140 : 210; // pressure สูง -> เกิดใกล้ขึ้นช่วยให้ไม่พัง

      const x = clamp(cx + (rng()*2-1)*spread, rect.xMin, rect.xMax);
      const y = clamp(cy + (rng()*2-1)*spread*0.72, rect.yMin, rect.yMax);
      return { x, y, explain: p>=2 ? 'ช่วยให้เกิดใกล้จุดเล็ง (pressure สูง)' : 'แพทเทิร์นกระจุกใกล้จุดเล็ง' };
    }

    function _corners(rect) {
      // 4 corners cycling
      const c = phase % 4;
      const pad = 10 + rng()*18;
      const x = (c===0||c===2) ? (rect.xMin+pad) : (rect.xMax-pad);
      const y = (c===0||c===1) ? (rect.yMin+pad) : (rect.yMax-pad);
      return { x, y, explain: 'แพทเทิร์นมุม' };
    }

    function nextPos(rect, meta, kind) {
      const t = nowMs();
      if (t - lastAt > 850) {
        lastAt = t;
        phase = (phase + 1 + ((rng()*3)|0)) % 24;
      }

      const storm = !!(meta && meta.stormOn);
      const p = Number(meta && meta.pressureLevel) || 0;

      // Boss: bias to center-ish for readability
      if (kind === 'boss') {
        const c = _center(rect);
        const x = clamp(c.x + (rng()*140 - 70), rect.xMin, rect.xMax);
        const y = clamp(c.y + (rng()*140 - 70), rect.yMin, rect.yMax);
        return { x, y, explain:'บอสเกิดกลางจอเพื่ออ่านง่าย' };
      }

      // pressure high -> cluster near crosshair more often (help recovery)
      if (p >= 2 && rng() < 0.58) return _clusterNearCrosshair(rect, meta);

      // storm -> more sweep/ring
      if (storm) {
        const r = rng();
        if (r < 0.45) return _sweep(rect, meta);
        if (r < 0.80) return _ring(rect, meta);
        if (r < 0.92) return _corners(rect);
        return _randIn(rect);
      }

      // normal play rotation
      const r = rng();
      if (r < 0.28) return _ring(rect, meta);
      if (r < 0.50) return _sweep(rect, meta);
      if (r < 0.72) return _clusterNearCrosshair(rect, meta);
      if (r < 0.86) return _corners(rect);
      return _randIn(rect);
    }

    function bias(meta) {
      // same as before, keep tiny
      let b = 0;
      const p = Number(meta && meta.pressureLevel) || 0;
      // if struggling -> reduce wrong a bit (bias negative)
      if (p >= 2) b -= 0.02;
      return clamp(b, -0.06, 0.06);
    }

    return { nextPos, bias };
  }

  // ---------- Public ----------
  NS.AIHooks = NS.AIHooks || {};

  NS.AIHooks.attach = function attach(opts) {
    opts = opts || {};
    const runMode = String(opts.runMode || '').toLowerCase();
    const enabled = !!opts.enabled;

    if (runMode !== 'play') { NS.__ai = null; return { ok:false, reason:'runMode-not-play' }; }
    if (!enabled) { NS.__ai = null; return { ok:false, reason:'disabled' }; }

    const seed = String(opts.seed ?? Date.now());
    const rng = makeRng(hashSeed(seed + '::ai-hooks::groups'));

    const coach = createCoach(rng, { minGapMs: 2500, maxPerMin: 9 });
    const pattern = createPattern(rng);
    const director = createDirector(rng, coach);

    NS.__ai = {
      enabled: true,
      seed,
      director,
      pattern,
      tip: function (text, mood, meta) { return coach.tip(text, mood, meta); }
    };

    coach.tip('AI Pattern เปิดแล้ว! เป้าจะ “เป็นแพทเทิร์น” มากขึ้น 🤖🎯', 'happy', { explain:'โหมดเล่นเท่านั้น (วิจัยปิด)' });
    return { ok:true, reason:'attached', seed };
  };

})(typeof window !== 'undefined' ? window : globalThis);