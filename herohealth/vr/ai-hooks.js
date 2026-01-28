// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (LIGHT, DETERMINISTIC-FRIENDLY)
// ✅ createAIHooks({game, mode, rng})
// ✅ API: onEvent(name, payload), getTip(playedSec), getDifficulty(playedSec, base)
// Notes:
// - mode: 'play' => adaptive ON, else => adaptive OFF (return base)
// - rng: seeded rng preferred (for research reproducibility)

'use strict';

export function createAIHooks(opts = {}){
  const game = String(opts.game || 'HHA').trim();
  const mode = String(opts.mode || 'play').trim().toLowerCase();
  const rng  = (typeof opts.rng === 'function') ? opts.rng : Math.random;

  const adaptive = (mode === 'play');

  // --- simple state (EMA) ---
  const S = {
    lastTipAt: 0,
    tipCooldownMs: 3500,

    // performance indicators
    hitGood: 0,
    hitJunk: 0,
    miss: 0,

    // EMA of "error pressure" (0..1)
    // higher => struggling => ease down
    errEMA: 0.18,

    // EMA of "speed" (higher => doing well => can raise)
    goodEMA: 0.22,

    // internal difficulty scalar (0.75 .. 1.35)
    diff: 1.0,
  };

  function clamp(v, a, b){ return Math.max(a, Math.min(b, Number(v)||0)); }
  function nowMs(){ try{ return performance.now(); }catch{ return Date.now(); } }

  function ema(prev, x, k){ return prev + k*(x - prev); }

  // --- events from game ---
  function onEvent(name, payload = {}){
    if(!adaptive) return;

    const n = String(name||'').toLowerCase();
    if(n === 'hitgood'){
      S.hitGood++;
      S.goodEMA = ema(S.goodEMA, 1.0, 0.08);
      S.errEMA  = ema(S.errEMA, 0.0, 0.06);
    }else if(n === 'hitjunk'){
      S.hitJunk++;
      S.errEMA  = ema(S.errEMA, 1.0, 0.10);
      S.goodEMA = ema(S.goodEMA, 0.0, 0.05);
    }else if(n === 'miss'){
      S.miss++;
      S.errEMA  = ema(S.errEMA, 1.0, 0.12);
      S.goodEMA = ema(S.goodEMA, 0.0, 0.06);
    }
  }

  // --- micro tips (rate-limited) ---
  function getTip(playedSec){
    if(!adaptive) return null;

    const t = nowMs();
    if(t - S.lastTipAt < S.tipCooldownMs) return null;

    // tip conditions (light)
    const struggling = (S.errEMA > 0.55);
    const doingWell  = (S.goodEMA > 0.55 && S.errEMA < 0.35);

    let msg = '';
    if(struggling){
      msg = 'ลอง “เล็งของดี” ก่อน แล้วค่อยหลบของเสีย 👀';
    }else if(doingWell){
      msg = 'เยี่ยม! ลองทำคอมโบของดีให้ยาวขึ้นอีกนิด 💥';
    }else{
      // small random variety
      msg = (rng() < 0.5) ? 'อย่าลืม SHIELD บล็อคขยะได้นะ 🛡️' : 'MINI: เก็บให้ครบ 3 หมู่ในเวลาที่กำหนด 🎯';
    }

    S.lastTipAt = t;
    return { msg, tag:'AI Coach' };
  }

  // --- difficulty mixer ---
  function getDifficulty(playedSec, base){
    // If not play mode => deterministic / research: return base as-is
    if(!adaptive) return Object.assign({}, base);

    const b = Object.assign({
      spawnMs: 900,
      pGood: 0.70,
      pJunk: 0.26,
      pStar: 0.02,
      pShield: 0.02
    }, base || {});

    // time ramp (slow increase)
    const ramp = clamp((Number(playedSec)||0) / 60, 0, 1); // 0..1 over 60s

    // update diff scalar from EMA
    // - more errors => reduce difficulty
    // - more good => increase a bit
    const target =
      1.02
      + (S.goodEMA - 0.35) * 0.35
      - (S.errEMA  - 0.30) * 0.55
      + ramp * 0.20;

    S.diff = clamp(ema(S.diff, target, 0.06), 0.75, 1.35);

    // apply to spawnMs (lower ms => harder)
    const spawnMs = clamp(b.spawnMs / S.diff, 520, 1200);

    // mix probabilities (harder => more junk)
    const hard = clamp((S.diff - 1.0) / 0.35, -1, 1); // -1..1
    let pGood   = clamp(b.pGood  - hard*0.08, 0.35, 0.85);
    let pJunk   = clamp(b.pJunk  + hard*0.08, 0.10, 0.55);
    let pStar   = clamp(b.pStar  + (S.errEMA>0.55 ? 0.01 : 0), 0.01, 0.06);
    let pShield = clamp(b.pShield+ (S.errEMA>0.50 ? 0.02 : 0), 0.01, 0.10);

    // normalize
    let s = pGood + pJunk + pStar + pShield;
    if(s <= 0) s = 1;
    pGood/=s; pJunk/=s; pStar/=s; pShield/=s;

    return { spawnMs, pGood, pJunk, pStar, pShield, diffScalar: S.diff };
  }

  return { onEvent, getTip, getDifficulty };
}