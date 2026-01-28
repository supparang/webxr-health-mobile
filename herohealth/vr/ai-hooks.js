// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (Lightweight, Deterministic-friendly)
// ✅ createAIHooks({ game, mode, rng, diff? })
// ✅ Methods: onEvent(name,payload), getTip(playedSec), getDifficulty(playedSec, base)
// ✅ Play mode: adaptive ON (fair + smooth)
// ✅ Study/Research: adaptive OFF (returns base) for determinism
// Notes: This is "AI prediction" style (risk/streak/miss trend) not heavy ML.

'use strict';

const clamp = (v, a, b)=> Math.max(a, Math.min(b, Number(v)||0));

function nowMs(){
  try{ return performance.now(); }catch(_){ return Date.now(); }
}

function pick(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return null;
  const r = (typeof rng === 'function') ? rng() : Math.random();
  const i = Math.max(0, Math.min(a.length-1, Math.floor(r * a.length)));
  return a[i];
}

// EWMA helper (exponential moving average)
function ewma(prev, x, alpha){
  if(!isFinite(prev)) return x;
  return prev + alpha * (x - prev);
}

export function createAIHooks(cfg = {}){
  const game = String(cfg.game || 'HHA').trim();
  const mode = String(cfg.mode || cfg.run || 'play').toLowerCase(); // play | study | research
  const rng  = (typeof cfg.rng === 'function') ? cfg.rng : null;
  const diff = String(cfg.diff || 'normal').toLowerCase();

  const adaptiveOn = (mode === 'play'); // critical: research should be deterministic

  // --- internal state ---
  const S = {
    startedAtMs: nowMs(),
    lastEventMs: 0,

    // performance signals
    hitsGood: 0,
    hitsJunk: 0,
    miss: 0,          // includes expired good in your engine
    streakGood: 0,
    streakBad: 0,

    // trend estimates (EWMA)
    ewmaBadRate: 0,   // bad events / recent
    ewmaSpeed: 0,     // how fast events happen
    ewmaCombo: 0,

    // tip throttling
    lastTipMs: 0,
    tipEveryMs: 1900,

    // difficulty memory
    lastD: null,
  };

  function onEvent(name, payload = {}){
    const t = Number(payload.t || nowMs());
    const dt = (S.lastEventMs>0) ? (t - S.lastEventMs) : 0;
    if(dt>0 && dt<15000){
      // speed: events per second
      const sp = 1000 / dt;
      S.ewmaSpeed = ewma(S.ewmaSpeed, sp, 0.15);
    }
    S.lastEventMs = t;

    const n = String(name || '').toLowerCase();

    if(n === 'hitgood'){
      S.hitsGood++;
      S.streakGood++;
      S.streakBad = 0;
      S.ewmaCombo = ewma(S.ewmaCombo, S.streakGood, 0.20);
      S.ewmaBadRate = ewma(S.ewmaBadRate, 0, 0.18);
    }else if(n === 'hitjunk'){
      S.hitsJunk++;
      S.miss++; // treated as mistake
      S.streakBad++;
      S.streakGood = 0;
      S.ewmaBadRate = ewma(S.ewmaBadRate, 1, 0.22);
    }else if(n === 'miss'){
      S.miss++;
      S.streakBad++;
      S.streakGood = 0;
      S.ewmaBadRate = ewma(S.ewmaBadRate, 1, 0.22);
    }else{
      // other events can be added later
    }
  }

  // simple “coach tip” (rate-limited, explainable)
  function getTip(playedSec = 0){
    if(!adaptiveOn) return null;
    const t = nowMs();
    if(t - S.lastTipMs < S.tipEveryMs) return null;

    // only give tips when there's a clear signal
    const risk = clamp(S.ewmaBadRate, 0, 1);
    const speed = clamp(S.ewmaSpeed, 0, 6);
    const combo = clamp(S.ewmaCombo, 0, 20);

    let msg = null;

    if(risk > 0.55){
      msg = 'โฟกัส “ของดี” ก่อนนะ 🎯 ลดพลาดแล้วคะแนนจะพุ่ง';
    }else if(S.streakBad >= 2){
      msg = 'ใจเย็น ๆ 👀 เล็งกลางจอแล้วค่อยยิง จะพลาดน้อยลง';
    }else if(combo >= 6 && risk < 0.25){
      msg = 'คอมโบดีมาก! 🔥 รักษาจังหวะเดิมไว้ คะแนนจะไหล';
    }else if(speed > 3.0 && risk > 0.35){
      msg = 'จังหวะเร็วขึ้นแล้วนะ ⏱️ เลือกยิงเฉพาะที่มั่นใจ';
    }

    if(!msg) return null;

    S.lastTipMs = t;
    return { msg, tag: `${game} AI` };
  }

  // ✅ MAIN: difficulty suggestion (fixes getDifficulty missing)
  // base: { spawnMs, pGood, pJunk, pStar, pShield }
  function getDifficulty(playedSec = 0, base = {}){
    // research/study: keep deterministic by returning base unchanged
    const B = Object.assign(
      { spawnMs: 900, pGood:0.70, pJunk:0.26, pStar:0.02, pShield:0.02 },
      base || {}
    );

    if(!adaptiveOn){
      return { ...B };
    }

    // signals
    const risk = clamp(S.ewmaBadRate, 0, 1);          // 0..1
    const combo = clamp(S.ewmaCombo, 0, 16);          // 0..16
    const badStreak = clamp(S.streakBad, 0, 6);
    const goodStreak = clamp(S.streakGood, 0, 10);

    // predict near-future risk (simple prediction)
    // more risk if bad streak, less if good streak & combo
    let predRisk =
      0.55 * risk +
      0.12 * (badStreak/6) +
      0.08 * (1 - Math.min(1, goodStreak/8)) -
      0.10 * Math.min(1, combo/10);

    predRisk = clamp(predRisk, 0, 1);

    // fairness: don't swing too hard
    // If player struggling, ease slightly (more good, slower spawn).
    // If player stable, gradually challenge (more junk, slightly faster).
    const ease = clamp((predRisk - 0.45) / 0.55, 0, 1);      // 0..1 => struggling
    const push = clamp((0.40 - predRisk) / 0.40, 0, 1);      // 0..1 => doing well

    // diff scaling
    const diffMul =
      (diff === 'easy') ? 0.92 :
      (diff === 'hard') ? 1.08 : 1.00;

    // spawnMs adjustment
    // struggling => slower; doing well => faster (but capped)
    const spawnDelta =
      (+160 * ease) + (-140 * push); // ms
    let spawnMs = clamp(Math.round((B.spawnMs + spawnDelta) / diffMul), 520, 1120);

    // probability adjustment
    // struggling => shift toward good + boost shield slightly
    // doing well => shift toward junk a bit
    let pGood = B.pGood + (0.10 * ease) - (0.07 * push);
    let pJunk = B.pJunk - (0.08 * ease) + (0.09 * push);
    let pStar = B.pStar + (0.01 * push) + (0.00 * ease);
    let pShield = B.pShield + (0.03 * ease) + (0.01 * push);

    // protect bounds
    pGood   = clamp(pGood,   0.40, 0.86);
    pJunk   = clamp(pJunk,   0.10, 0.56);
    pStar   = clamp(pStar,   0.01, 0.06);
    pShield = clamp(pShield, 0.01, 0.10);

    // smooth changes (avoid jitter)
    if(S.lastD){
      const a = 0.35; // smoothing
      spawnMs = Math.round(ewma(S.lastD.spawnMs, spawnMs, a));
      pGood   = ewma(S.lastD.pGood,   pGood,   a);
      pJunk   = ewma(S.lastD.pJunk,   pJunk,   a);
      pStar   = ewma(S.lastD.pStar,   pStar,   a);
      pShield = ewma(S.lastD.pShield, pShield, a);
    }

    // normalize
    let s = pGood + pJunk + pStar + pShield;
    if(s <= 0) s = 1;
    pGood/=s; pJunk/=s; pStar/=s; pShield/=s;

    const D = { spawnMs, pGood, pJunk, pStar, pShield, predRisk };
    S.lastD = { spawnMs, pGood, pJunk, pStar, pShield };

    return D;
  }

  return Object.freeze({
    onEvent,
    getTip,
    getDifficulty
  });
}