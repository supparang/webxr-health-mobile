// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — SAFE DEFAULTS (Production)
// ✅ Always provides: getDifficulty(playedSec, base), getTip(playedSec), onEvent(type,payload)
// ✅ Default behavior is "lightweight + fair" (no ML), but leaves hooks for future ML/DL.
// ✅ If AI is "disabled", methods still exist and return safe outputs.

'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

export function createAIHooks(opts = {}) {
  const game = String(opts.game || 'HHA').trim();
  const mode = String(opts.mode || 'play').toLowerCase(); // play / study / research
  const rng  = (typeof opts.rng === 'function') ? opts.rng : Math.random;

  // --- internal lightweight state (future ML can replace) ---
  const S = {
    game, mode,
    lastTipAt: 0,
    tipCooldownMs: 2600,
    // performance signals
    hitGood: 0,
    hitJunk: 0,
    miss: 0,
    comboMax: 0,
    lastEventAt: 0
  };

  function onEvent(type, payload = {}) {
    const t = Number(payload.t || performance.now?.() || Date.now());
    S.lastEventAt = t;

    if (type === 'hitGood') S.hitGood++;
    else if (type === 'hitJunk') S.hitJunk++;
    else if (type === 'miss') S.miss++;
    else if (type === 'comboMax') S.comboMax = Math.max(S.comboMax, Number(payload.value || 0));
  }

  // ✅ Difficulty mixer: returns {spawnMs, pGood,pJunk,pStar,pShield}
  function getDifficulty(playedSec, base) {
    const b = base || { spawnMs: 900, pGood: 0.70, pJunk: 0.26, pStar: 0.02, pShield: 0.02 };

    // If not play mode => do not adapt (deterministic research safe)
    if (mode !== 'play') return { ...b };

    const t = clamp(playedSec, 0, 999);
    const stress = clamp((S.miss * 1.2 + S.hitJunk * 0.6) - (S.hitGood * 0.25), -6, 12);

    // Time-based ramp (gentle)
    let spawnMs = b.spawnMs - clamp((t - 8) * 5, 0, 220); // after 8s, faster
    // Stress-based relief
    spawnMs += clamp(stress * 10, -80, 160);

    // Mix probabilities (keep sums positive)
    let pGood  = b.pGood  - clamp(t * 0.002, 0, 0.12) + clamp(-stress * 0.012, -0.08, 0.08);
    let pJunk  = b.pJunk  + clamp(t * 0.002, 0, 0.12) + clamp(stress * 0.012, -0.06, 0.10);
    let pStar  = b.pStar  + clamp(stress > 3 ? 0.010 : 0, 0, 0.012);
    let pShield= b.pShield+ clamp(stress > 4 ? 0.014 : 0, 0, 0.016);

    // clamp
    spawnMs = clamp(spawnMs, 520, 1300);
    pGood   = clamp(pGood,  0.35, 0.82);
    pJunk   = clamp(pJunk,  0.12, 0.55);
    pStar   = clamp(pStar,  0.01, 0.06);
    pShield = clamp(pShield,0.01, 0.08);

    // normalize
    let s = pGood + pJunk + pStar + pShield;
    if (s <= 0) s = 1;
    pGood /= s; pJunk /= s; pStar /= s; pShield /= s;

    return { spawnMs, pGood, pJunk, pStar, pShield };
  }

  // ✅ Micro tips (explainable). Rate-limited.
  function getTip(playedSec) {
    if (mode !== 'play') return null;

    const now = performance.now?.() || Date.now();
    if (now - S.lastTipAt < S.tipCooldownMs) return null;

    const t = clamp(playedSec, 0, 999);

    // only tip occasionally
    const r = rng();
    if (r > 0.20) return null;

    let msg = '';
    if (S.miss >= 3) msg = 'ลอง “ชะลอมือ” นิดนึง 🎯 เล็งกลางจอก่อนยิง จะพลาดน้อยลง';
    else if (S.hitJunk >= 3) msg = 'ทริค: เห็นของทอด/หวาน ให้หลบ! 🛡️ ถ้ามีโล่ให้เก็บไว้กันพลาด';
    else if (t > 20 && S.comboMax < 6) msg = 'โฟกัสของดีติดกันให้ได้คอมโบ 🔥 คอมโบสูง = คะแนนพุ่ง';
    else msg = 'ถ้าเริ่มรวน ให้เลือกยิงเฉพาะ “ของดี” ก่อน คุมจังหวะให้ได้ ✅';

    S.lastTipAt = now;
    return { msg, tag: 'AI Coach' };
  }

  return { onEvent, getDifficulty, getTip };
}