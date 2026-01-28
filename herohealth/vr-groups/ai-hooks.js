// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (Stable API)
// ✅ createAIHooks({game, mode, rng}) -> { onEvent, getTip, getDifficulty }
// ✅ In research/study mode (mode !== 'play'): AI returns base difficulty + no tips (deterministic)
// ✅ In play mode: light adaptive difficulty + explainable micro-tips (rate-limited)

'use strict';

export function createAIHooks(opts = {}){
  const game = String(opts.game || 'HHA').trim();
  const mode = String(opts.mode || 'play').trim().toLowerCase();
  const rng  = (typeof opts.rng === 'function') ? opts.rng : Math.random;

  const enabled = (mode === 'play');

  // --- state ---
  const S = {
    game,
    enabled,
    // counters
    hitGood: 0,
    hitJunk: 0,
    miss: 0,
    star: 0,
    shield: 0,
    // rolling
    lastEventAt: 0,
    lastTipAt: 0,
    tipCount: 0,
    // last 12 events
    recent: []
  };

  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const pushRecent = (name)=>{
    S.recent.push(name);
    if(S.recent.length > 12) S.recent.shift();
  };

  function onEvent(name, payload = {}){
    if(!enabled) return;
    const n = String(name||'').trim();

    if(n === 'hitGood') S.hitGood++;
    else if(n === 'hitJunk') S.hitJunk++;
    else if(n === 'miss') S.miss++;
    else if(n === 'star') S.star++;
    else if(n === 'shield') S.shield++;

    S.lastEventAt = nowMs();
    pushRecent(n);
  }

  // ---- Micro tips (explainable + rate-limited) ----
  function getTip(playedSec = 0){
    if(!enabled) return null;

    const t = nowMs();
    if(t - S.lastTipAt < 4200) return null;      // min gap
    if(S.tipCount >= 7) return null;             // cap per run
    if(playedSec < 6) return null;               // don’t spam at start

    // simple signals
    const total = Math.max(1, S.hitGood + S.hitJunk + S.miss);
    const missRate = S.miss / total;
    const junkRate = S.hitJunk / total;

    // recent patterns
    const last5 = S.recent.slice(-5).join(',');

    let msg = null;

    if(missRate > 0.28){
      msg = 'โฟกัส “เป้าดี” ก่อนนะ 🎯 ถ้าเริ่มพลาดถี่ ให้ช้าลงนิดเดียวแล้วค่อยเร่ง';
    }else if(junkRate > 0.24){
      msg = 'พยายามเลี่ยงของทอด/หวาน 🍟🍩 ถ้าเห็นคู่กับของดี ให้เล็งของดีก่อนเสมอ';
    }else if(last5.includes('hitGood,hitGood,hitGood') && missRate < 0.12){
      msg = 'กำลังนิ่งมาก! ลองลากคอมโบให้ยาวขึ้นอีกหน่อย 🔥';
    }else if(playedSec > 0.65 * 80 && (S.miss <= 1)){
      msg = 'ใกล้ท้ายเกมแล้ว! รักษาความนิ่งไว้ ✅ อย่ารีบเกินไป';
    }

    if(!msg) return null;

    S.lastTipAt = t;
    S.tipCount++;

    return { msg, tag: 'AI Coach', game };
  }

  // ---- Adaptive difficulty (lightweight + bounded) ----
  // input: playedSec, base = { spawnMs, pGood, pJunk, pStar, pShield }
  function getDifficulty(playedSec = 0, base = {}){
    // In research/study: return base exactly (deterministic + no adaptation)
    if(!enabled) return { ...base };

    const b = {
      spawnMs: Number(base.spawnMs) || 900,
      pGood:   Number(base.pGood)   || 0.70,
      pJunk:   Number(base.pJunk)   || 0.26,
      pStar:   Number(base.pStar)   || 0.02,
      pShield: Number(base.pShield) || 0.02
    };

    const total = Math.max(1, S.hitGood + S.hitJunk + S.miss);
    const acc = S.hitGood / total;          // rough “skill”
    const missRate = S.miss / total;

    // target intensity ramps with time
    const ramp = clamp(playedSec / 60, 0, 1);

    // skill factor: (0.35..0.85) typical
    const skill = clamp(acc - 0.15*missRate, 0.20, 0.95);

    // adjust spawn: better skill -> faster, worse -> slower
    const spawnAdj = (skill - 0.55) * 240;           // -? .. +?
    const rampAdj  = ramp * 160;

    let spawnMs = b.spawnMs - spawnAdj - rampAdj;

    // guard rails
    spawnMs = clamp(spawnMs, 520, 1100);

    // probabilities: if struggling, give slightly more good/shield
    let pGood = b.pGood;
    let pJunk = b.pJunk;
    let pStar = b.pStar;
    let pShield = b.pShield;

    if(missRate > 0.25){
      pGood   += 0.05;
      pJunk   -= 0.04;
      pShield += 0.02;
    }else if(skill > 0.70){
      pJunk   += 0.04;
      pGood   -= 0.04;
      // tiny bonus to star for excitement
      pStar   += 0.005;
    }

    // keep bounds
    pGood   = clamp(pGood,   0.38, 0.82);
    pJunk   = clamp(pJunk,   0.16, 0.55);
    pStar   = clamp(pStar,   0.01, 0.06);
    pShield = clamp(pShield, 0.01, 0.08);

    return { spawnMs, pGood, pJunk, pStar, pShield };
  }

  return { onEvent, getTip, getDifficulty };
}