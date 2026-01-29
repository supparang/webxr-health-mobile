// === /herohealth/vr/ai-hooks.js ===
// AI Hooks (PRODUCTION MIN)
// ✅ createAIHooks({game, mode, rng})
// ✅ Methods: onEvent(type,payload), getTip(playedSec), getDifficulty(playedSec, base)
// Notes: default "fair & explainable", no ML/DL inference yet (future plug-in)

'use strict';

export function createAIHooks(cfg={}){
  const game = String(cfg.game || 'HHA').trim();
  const mode = String(cfg.mode || 'play').trim(); // play | research
  const rng  = (typeof cfg.rng === 'function') ? cfg.rng : null;

  // --- simple running stats ---
  const S = {
    t0: (performance.now ? performance.now() : Date.now()),
    hitGood: 0,
    hitJunk: 0,
    miss: 0,
    comboMax: 0,
    lastTipAt: -1,
    // EMA (explainable)
    emaAcc: 0.72,   // higher = better
    emaMiss: 0.12,  // higher = worse
  };

  const clamp=(v,a,b)=>Math.max(a, Math.min(b, v));
  const lerp=(a,b,t)=>a+(b-a)*t;

  function updateEMA(){
    const total = S.hitGood + S.hitJunk + S.miss;
    if(total <= 0) return;
    const acc = S.hitGood / total;
    const miss = S.miss / total;
    // slow EMA
    S.emaAcc  = lerp(S.emaAcc,  acc,  0.08);
    S.emaMiss = lerp(S.emaMiss, miss, 0.10);
  }

  function onEvent(type, payload={}){
    switch(String(type||'')){
      case 'hitGood': S.hitGood++; break;
      case 'hitJunk': S.hitJunk++; break;
      case 'miss':    S.miss++; break;
      case 'comboMax':
        S.comboMax = Math.max(S.comboMax, Number(payload?.value)||0);
        break;
      default: break;
    }
    updateEMA();
  }

  // --- micro tips (rate limit) ---
  function getTip(playedSec){
    // rate-limit 1 tip / ~7s
    const t = Math.floor(playedSec || 0);
    if(t < 6) return null;
    if(S.lastTipAt >= 0 && (t - S.lastTipAt) < 7) return null;

    // choose tip from stats (explainable)
    let msg = '';
    if(S.emaMiss > 0.18) msg = 'ลอง “รอให้เป้าเข้ากลาง” แล้วค่อยยิง จะพลาดน้อยลง 👀';
    else if(S.emaAcc > 0.78) msg = 'แม่นมาก! ลองเน้นคอมโบของดีต่อเนื่อง 🔥';
    else msg = 'จำไว้: ของดี = หมู่ 1–5 / ของเสีย = หวาน-ทอด-น้ำอัดลม 🍟🥤';

    S.lastTipAt = t;
    return { msg, tag:'AI Coach' };
  }

  // --- difficulty director (explainable) ---
  // base = {spawnMs,pGood,pJunk,pStar,pShield}
  function getDifficulty(playedSec, base){
    // default: return base if invalid
    const B = Object.assign({ spawnMs:900, pGood:.70, pJunk:.26, pStar:.02, pShield:.02 }, base||{});

    // factor in performance (fair): more miss => ease a bit; better acc => harder a bit
    const miss = clamp(S.emaMiss, 0, 0.40);
    const acc  = clamp(S.emaAcc,  0.40, 0.92);

    // target difficulty ramps with time
    const ramp = clamp((Number(playedSec)||0) / 45, 0, 1); // 0..1 in ~45s

    // compute adjustments
    const ease = clamp((miss - 0.12) * 1.6, -0.18, 0.22); // + = easier
    const hard = clamp((acc  - 0.72) * 1.2, -0.16, 0.18); // + = harder
    const k = (hard - ease); // + harder

    // spawn speed: harder => lower spawnMs
    let spawnMs = B.spawnMs * (1 - 0.18*ramp*k);
    spawnMs = clamp(spawnMs, 520, 1200);

    // distributions: harder => more junk, less good (small, fair)
    let pJunk = B.pJunk + clamp(0.10*ramp*k, -0.08, 0.10);
    let pGood = B.pGood - clamp(0.10*ramp*k, -0.10, 0.08);

    // help powerups when miss high
    let help = clamp((miss - 0.14) * 0.12, 0, 0.03); // 0..0.03
    let pShield = B.pShield + help;
    let pStar   = B.pStar   + help*0.6;

    // normalize guard
    let s = pGood + pJunk + pStar + pShield;
    if(s <= 0) s = 1;
    pGood/=s; pJunk/=s; pStar/=s; pShield/=s;

    return { spawnMs, pGood, pJunk, pStar, pShield };
  }

  return { game, mode, onEvent, getTip, getDifficulty };
}