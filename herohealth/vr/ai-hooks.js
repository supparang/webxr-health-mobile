// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (Deterministic-friendly)
// ✅ createAIHooks({ game, mode, rng })
// ✅ getDifficulty(tSec, base) -> {spawnMs,pGood,pJunk,pStar,pShield}
// ✅ getTip(tSec) -> {msg,tag} rate-limited
// ✅ onEvent(type, payload)
// Notes:
// - "mode": 'play' => adaptive ON by default, 'research' => adaptive OFF by default
// - still safe if caller uses only some methods

'use strict';

export function createAIHooks(opts = {}){
  const WIN = window;
  const DOC = document;

  const game = String(opts.game || 'HHA').trim();
  const mode = String(opts.mode || 'play').toLowerCase();
  const rng  = (typeof opts.rng === 'function') ? opts.rng : Math.random;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  // ✅ allow override: ?ai=0 disables, ?ai=1 enables
  const qAi = qs('ai', null);
  const enabled =
    (qAi === '0') ? false :
    (qAi === '1') ? true  :
    (mode === 'play');

  // --- rolling stats (simple + fair) ---
  const S = {
    enabled,
    tLastTip: 0,
    tipCooldownMs: 6500,

    // counters
    hitGood: 0,
    hitJunk: 0,
    miss: 0,          // (expired good) or other miss events
    comboMax: 0,

    // streaks
    missStreak: 0,
    goodStreak: 0,

    // EWMA skill
    skill: 0.55,      // 0..1
    stress: 0.20,     // 0..1 (higher => ease a bit)

    // last event time
    lastEvMs: 0
  };

  function nowMs(){
    try{ return performance.now(); }catch(_){ return Date.now(); }
  }

  function updateEWMA(prev, x, a){
    return prev*(1-a) + x*a;
  }

  // caller not required to call, but good for telemetry
  function onEvent(type, payload = {}){
    if(!S.enabled) return;

    const t = Number(payload.t || nowMs());
    S.lastEvMs = t;

    if(type === 'hitGood'){
      S.hitGood++;
      S.goodStreak++;
      S.missStreak = 0;

      // accuracy proxy: good => 1
      S.skill = updateEWMA(S.skill, 1.0, 0.06);
      S.stress = updateEWMA(S.stress, 0.10, 0.05);
    }
    else if(type === 'hitJunk'){
      S.hitJunk++;
      S.missStreak++;
      S.goodStreak = 0;

      // junk => 0
      S.skill = updateEWMA(S.skill, 0.0, 0.08);
      S.stress = updateEWMA(S.stress, 0.75, 0.08);
    }
    else if(type === 'miss'){
      S.miss++;
      S.missStreak++;
      S.goodStreak = 0;

      S.skill = updateEWMA(S.skill, 0.15, 0.07);
      S.stress = updateEWMA(S.stress, 0.85, 0.08);
    }
    else if(type === 'comboMax'){
      const cm = clamp(payload.value, 0, 999);
      S.comboMax = Math.max(S.comboMax, cm);
    }
  }

  // --- Difficulty Director (fair & smooth) ---
  function getDifficulty(tSec, base){
    // base: {spawnMs,pGood,pJunk,pStar,pShield}
    const B = Object.assign({}, base || {});
    if(!S.enabled) return B;

    const t = clamp(tSec, 0, 9999);

    // smooth ramp with time (0..1)
    const ramp = clamp((t - 6) / 24, 0, 1);

    // skill & stress shaping
    const skill = clamp(S.skill, 0.05, 0.95);
    const stress = clamp(S.stress, 0, 1);

    // aim: harder when skill high, easier when stress high
    const hardBias = clamp((skill - 0.55) * 0.9 - (stress - 0.25) * 0.7, -0.35, 0.35);

    // spawnMs adjust (cap changes)
    let spawnMs = Number(B.spawnMs || 900);
    spawnMs = spawnMs * (1 - 0.16*ramp) * (1 - 0.18*hardBias);

    // keep playable bounds
    spawnMs = clamp(spawnMs, 520, 1100);

    // probabilities adjust (small nudges)
    let pGood   = clamp(Number(B.pGood   ?? 0.70), 0.10, 0.90);
    let pJunk   = clamp(Number(B.pJunk   ?? 0.26), 0.05, 0.85);
    let pStar   = clamp(Number(B.pStar   ?? 0.02), 0.00, 0.20);
    let pShield = clamp(Number(B.pShield ?? 0.02), 0.00, 0.20);

    // when harder: slightly more junk, less good
    const delta = 0.06 * hardBias + 0.05*ramp;
    pJunk = clamp(pJunk + delta, 0.06, 0.60);
    pGood = clamp(pGood - delta, 0.35, 0.85);

    // stress safety: give more shield/star if struggling
    const help = clamp((stress - 0.35) * 0.12, 0, 0.08);
    if(help > 0){
      pShield = clamp(pShield + help*0.65, 0.01, 0.12);
      pStar   = clamp(pStar   + help*0.35, 0.01, 0.10);
      // compensate by taking from junk a bit
      pJunk   = clamp(pJunk - help*0.60, 0.06, 0.60);
    }

    return { spawnMs, pGood, pJunk, pStar, pShield };
  }

  // --- AI Coach tips (rate-limited) ---
  function getTip(tSec){
    if(!S.enabled) return null;

    const now = nowMs();
    if(now - S.tLastTip < S.tipCooldownMs) return null;

    // conditions
    if(S.missStreak >= 3){
      S.tLastTip = now;
      return { tag:'AI Coach', msg:'ลอง “หยุดเร็วครึ่งวิ” ก่อนยิงนะ 🎯 โฟกัสของดีทีละอัน จะลด MISS ได้มาก' };
    }
    if(S.hitJunk >= 3 && S.hitGood < 6){
      S.tLastTip = now;
      return { tag:'AI Coach', msg:'จำง่าย ๆ: ของดี “อาหารหลัก” ยิงเลย ✅ ของเสีย “ทอด/หวาน/น้ำอัดลม” เลี่ยงทันที' };
    }
    if(S.goodStreak >= 6){
      S.tLastTip = now;
      return { tag:'AI Coach', msg:'คอมโบกำลังมา! 🔥 รักษาจังหวะเดิม แล้วรอของดีชัด ๆ ไม่ต้องรีบ' };
    }

    // occasional neutral tip
    if(rng() < 0.14){
      S.tLastTip = now;
      return { tag:'AI Coach', msg:'ทริค: ถ้าเริ่มพลาดติด ๆ กัน ให้เน้น “ของดีใกล้กลางจอ” ก่อน จะคุมง่ายขึ้น' };
    }

    return null;
  }

  return {
    enabled,
    onEvent,
    getDifficulty,
    getTip
  };
}