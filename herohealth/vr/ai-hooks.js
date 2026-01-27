// === /herohealth/vr/ai-hooks.js ===
// AI Hooks (HHA Standard) — SAFE DEFAULT
// ✅ createAIHooks({game, mode, rng})
// ✅ API: getDifficulty(playedSec, base), onEvent(name,payload), getTip(playedSec)
// ✅ SAFE: if mode != 'play' => returns base (deterministic friendly)
//
// NOTE:
// - "Prediction/ML/DL" ในที่นี้เป็น hook-ready scaffold
// - ค่าเริ่มต้นใช้ heuristic + EMA (เหมือน tiny-ML) เพื่อ "adaptive fair"
// - ถ้าคุณจะต่อ Deep Learning จริง ให้เสียบภายหลังที่ TODO:DL

'use strict';

const clamp = (v, a, b)=>Math.max(a, Math.min(b, v));
const nowMs = ()=> (performance?.now ? performance.now() : Date.now());

export function createAIHooks({ game='Game', mode='play', rng=null } = {}){
  const aiEnabled = (String(mode).toLowerCase() === 'play');

  // --- tiny state for "prediction/ML-like" (EMA + trend) ---
  const S = {
    game,
    mode,
    enabled: aiEnabled,
    t0: nowMs(),
    // hit/miss tracking
    hitGood: 0,
    hitJunk: 0,
    miss: 0,
    // rolling window (EMA)
    emaAcc: 0.72,     // estimated accuracy 0..1
    emaSpeed: 1.0,    // estimated reaction speed factor
    lastEventAt: 0,
    // rate-limit tips
    lastTipAt: 0,
    tipCooldownMs: 3200,
  };

  // ---------- helpers ----------
  function ema(prev, x, a){ return prev*(1-a) + x*a; }

  function updateFromEvent(name){
    // accuracy proxy: good hit = +, junk hit/miss = -
    let xAcc = 0.0;
    if(name === 'hitGood') xAcc = 1.0;
    else if(name === 'hitJunk') xAcc = 0.0;
    else if(name === 'miss') xAcc = 0.0;
    else xAcc = null;

    const t = nowMs();
    const dt = S.lastEventAt ? (t - S.lastEventAt) : 900;
    S.lastEventAt = t;

    // speed proxy: faster actions => higher "speed"
    const speed = clamp(1200 / clamp(dt, 250, 2000), 0.6, 1.35);

    if(xAcc != null){
      S.emaAcc = clamp(ema(S.emaAcc, xAcc, 0.12), 0.10, 0.98);
      S.emaSpeed = clamp(ema(S.emaSpeed, speed, 0.10), 0.60, 1.40);
    }
  }

  // ---------- public API ----------
  function onEvent(name, payload={}){
    if(!S.enabled) return;
    if(name === 'hitGood') S.hitGood++;
    else if(name === 'hitJunk') S.hitJunk++;
    else if(name === 'miss') S.miss++;
    updateFromEvent(name);
  }

  function getDifficulty(playedSec, base){
    // ✅ SAFE: if AI not enabled => return base
    if(!S.enabled) return { ...base };

    // base sanity
    const B = Object.assign({ spawnMs: 900, pGood:0.70, pJunk:0.26, pStar:0.02, pShield:0.02 }, base || {});
    let spawnMs = B.spawnMs;

    // --- "Prediction" layer: estimate difficulty need ---
    // if player accuracy high => make slightly harder, else easier
    const acc = clamp(S.emaAcc, 0, 1);     // 0..1
    const spd = clamp(S.emaSpeed, 0.6, 1.4);

    // target difficulty scalar (0.85..1.18)
    let k = 1.0;
    // accuracy drives (bigger accuracy => harder)
    k *= clamp(0.92 + (acc * 0.40), 0.85, 1.18);
    // speed drives (faster => slightly harder)
    k *= clamp(0.95 + ((spd - 1.0) * 0.18), 0.88, 1.12);

    // time ramp (late game little harder but capped)
    const ramp = clamp(playedSec / 60, 0, 1); // 0..1 per 60s
    k *= (1.0 + 0.10 * ramp);

    // apply to spawnMs (harder => smaller spawnMs)
    spawnMs = clamp(spawnMs / k, 520, 1200);

    // --- "ML-ish" layer: adjust probabilities fairly ---
    // if player misses a lot => give more good & shield
    const missPressure = clamp((S.miss + S.hitJunk) / Math.max(1, S.hitGood + S.hitJunk + S.miss), 0, 0.7);

    let pGood   = clamp(B.pGood   + (0.08 * missPressure) - (0.06 * (acc - 0.6)), 0.35, 0.86);
    let pJunk   = clamp(B.pJunk   - (0.06 * missPressure) + (0.08 * (acc - 0.6)), 0.10, 0.55);
    let pStar   = clamp(B.pStar   + (0.01 * ramp), 0.01, 0.06);
    let pShield = clamp(B.pShield + (0.03 * missPressure), 0.01, 0.08);

    // normalize
    let s = pGood + pJunk + pStar + pShield;
    if(s <= 0) s = 1;
    pGood/=s; pJunk/=s; pStar/=s; pShield/=s;

    return { spawnMs, pGood, pJunk, pStar, pShield };
  }

  function getTip(playedSec){
    if(!S.enabled) return null;

    const t = nowMs();
    if(t - S.lastTipAt < S.tipCooldownMs) return null;

    // lightweight tips depending on failure pattern
    const missish = S.miss + S.hitJunk;
    const total = Math.max(1, S.hitGood + S.hitJunk + S.miss);
    const missRate = missish / total;

    let msg = null;
    if(missRate > 0.42){
      msg = 'ลอง “ช้าลงนิดนึง” แล้วเล็งของดีให้ชัดก่อนยิง 🎯';
    }else if(S.hitGood < S.hitJunk){
      msg = 'โฟกัสของดีให้มากขึ้น—ของทอด/หวานคือ “ของเสีย” 🍟❌';
    }else if(playedSec > 20 && S.emaAcc > 0.78){
      msg = 'ทำได้ดีมาก! ช่วงท้ายจะเร็วขึ้น—รักษาคอมโบไว้ 🔥';
    }

    if(!msg) return null;

    S.lastTipAt = t;
    return { msg, tag: 'AI Coach' };
  }

  return Object.freeze({
    enabled: S.enabled,
    onEvent,
    getDifficulty,
    getTip
  });
}