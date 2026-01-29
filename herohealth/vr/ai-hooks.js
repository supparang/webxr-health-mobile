// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (Stable API)
// ✅ createAIHooks(opts) => { onEvent, getDifficulty, getTip, isEnabled }
// ✅ Works even if "AI disabled" (returns safe defaults)
// ✅ Deterministic-friendly (no extra randomness beyond provided rng / inputs)
// Notes:
// - Keep behavior conservative: "fun + fair" not chaotic
// - In research mode, you can disable externally; Safe.js should never crash.

'use strict';

const WIN = window;

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const lerp  = (a, b, t) => a + (b - a) * clamp(t, 0, 1);

function qs(k, d=null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; }
}

export function createAIHooks(opts = {}){
  const game = String(opts.game || 'Game').trim();
  const mode = String(opts.mode || 'play').toLowerCase();
  const rng  = (typeof opts.rng === 'function') ? opts.rng : null;

  // AI enable policy:
  // - default ON for play
  // - default OFF for research/practice
  // - can force by ?ai=1 / ?ai=0
  const q = String(qs('ai','')).trim();
  const enabled =
    (q === '1') ? true :
    (q === '0') ? false :
    (mode === 'play');

  // --- telemetry state (lite) ---
  const S = {
    enabled,
    // counters
    hitGood: 0,
    hitJunk: 0,
    miss: 0,
    // rolling “pressure” signals
    emaAcc: 0.85,     // 0..1 (start optimistic)
    emaMissRate: 0.0, // 0..1
    lastTipAt: -1,
    tipCooldownSec: 4.0
  };

  function updateEMA(prev, x, a){
    const aa = clamp(a, 0.01, 0.40);
    return prev * (1 - aa) + x * aa;
  }

  function onEvent(type, payload = {}){
    // always safe (even disabled)
    const t = Number(payload.t || 0);
    if(type === 'hitGood'){ S.hitGood++; }
    else if(type === 'hitJunk'){ S.hitJunk++; }
    else if(type === 'miss'){ S.miss++; }

    // update rolling signals (deterministic)
    const total = S.hitGood + S.hitJunk + S.miss;
    if(total > 0){
      const acc = S.hitGood / Math.max(1, (S.hitGood + S.hitJunk + S.miss));
      const missRate = S.miss / Math.max(1, total);
      S.emaAcc = updateEMA(S.emaAcc, acc, 0.12);
      S.emaMissRate = updateEMA(S.emaMissRate, missRate, 0.12);
    }

    // store time for tip gating (if provided)
    if(Number.isFinite(t) && t > 0){
      // no-op: tick() uses playedSec
    }
  }

  // ✅ Always exists: returns difficulty object
  function getDifficulty(playedSec, base){
    // If disabled, just return base unchanged (but safe)
    const B = Object.assign({ spawnMs: 900, pGood: 0.70, pJunk: 0.26, pStar: 0.02, pShield: 0.02 }, base || {});
    if(!S.enabled) return { ...B };

    // Build a “skill” value from EMA
    // - higher acc => harder
    // - higher missRate => easier
    const acc = clamp(S.emaAcc, 0, 1);
    const mr  = clamp(S.emaMissRate, 0, 1);

    // skill in [-1..+1]
    const skill = clamp((acc - 0.65) * 2.1 - (mr * 1.8), -1, 1);

    // Early game ramp (avoid spike)
    const ramp = clamp((Number(playedSec)||0) / 18, 0, 1); // 0..1

    // spawn speed: faster when skill high, but gradual by ramp
    const spawnMs = Math.round(
      clamp(
        lerp(B.spawnMs, B.spawnMs - 220 * skill, ramp),
        520,
        1150
      )
    );

    // distribution: more junk if skill high, more good if skill low
    const delta = (skill * 0.10) * ramp; // max +-10%
    let pGood = clamp(B.pGood - delta, 0.38, 0.86);
    let pJunk = clamp(B.pJunk + delta, 0.10, 0.55);

    // powerups: slightly help when missRate high
    const help = clamp((mr - 0.10) * 1.2, 0, 0.20) * ramp;
    let pStar   = clamp(B.pStar + help*0.25, 0.01, 0.06);
    let pShield = clamp(B.pShield + help*0.35, 0.01, 0.08);

    // normalize
    let s = pGood + pJunk + pStar + pShield;
    if(s <= 0) s = 1;
    pGood/=s; pJunk/=s; pStar/=s; pShield/=s;

    return { spawnMs, pGood, pJunk, pStar, pShield };
  }

  // ✅ Always exists: returns tip object or null
  function getTip(playedSec){
    if(!S.enabled) return null;

    const t = Number(playedSec)||0;
    if(S.lastTipAt >= 0 && (t - S.lastTipAt) < S.tipCooldownSec) return null;

    // only tip when meaningful
    const mr = clamp(S.emaMissRate, 0, 1);
    const acc = clamp(S.emaAcc, 0, 1);

    let msg = null;

    // deterministic-ish choice (optional): use rng if present
    const r = (typeof rng === 'function') ? rng() : 0.5;

    if(mr >= 0.22){
      msg = (r < 0.5)
        ? 'ลอง “ชะลอ” นิดนึง: เล็งก่อนค่อยยิง จะพลาดน้อยลง!'
        : 'โฟกัสของดีอย่างเดียวก่อนนะ 🥦 แล้วค่อยเล่นเร็วขึ้น';
    }else if(acc < 0.55){
      msg = 'เคล็ดลับ: ยิงจาก “กลางจอ” ให้ตรงเป้า แล้วค่อยกวาดไปทีละตัว';
    }else if(acc > 0.80 && mr < 0.10 && t > 12){
      msg = 'เริ่มเก่งแล้ว! ลองทำคอมโบของดีให้ยาวขึ้น จะได้คะแนนพุ่ง 🚀';
    }

    if(!msg) return null;

    S.lastTipAt = t;
    return { msg, tag: 'Coach' };
  }

  function isEnabled(){ return !!S.enabled; }

  // Return stable API
  return Object.freeze({
    onEvent,
    getDifficulty,
    getTip,
    isEnabled
  });
}