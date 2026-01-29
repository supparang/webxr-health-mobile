// === /fitness/js/ai-lite.js — AI Prediction (Lite) + Dynamic Director + Explainable Coach ===
// ✅ Deterministic (uses provided rng())
// ✅ Research-safe: you control enabling from engine (aiOn true/false)
// ✅ Purpose:
//   - predict "miss risk" from recent RT / misses
//   - adjust spawn weights & TTL slightly (fair, not cheating)
//   - explainable micro-tips (rate-limited)

'use strict';

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

export function createAIDirector(opts = {}){
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const nowMs = () => { try { return performance.now(); } catch(_) { return Date.now(); } };

  const cfg = Object.assign({
    // windows
    rtWindow: 14,
    missWindowMs: 9000,
    tipCooldownMs: 2600,

    // director strength
    ttlBoostMax: 0.22,     // +22% TTL when struggling
    bombReduceMax: 0.45,   // reduce bomb weight up to 45%
    healBoostMax: 0.65,    // boost heal weight up to 65%
    shieldBoostMax: 0.55,  // boost shield weight up to 55%

    // risk thresholds
    rtBadMs: 520,          // avg rt above => risk
    rtVeryBadMs: 690,
    missBurstN: 2          // misses in last missWindowMs
  }, opts);

  // rolling RT stats
  const rtArr = [];
  let lastMissTs = 0;
  const missTimes = [];

  // derived
  let risk = 0;       // 0..1
  let fatigue = 0;    // 0..1 (slow rise, slow decay)
  let lastTipAt = 0;

  // counts for explainable tips
  let bombHits = 0;
  let decoyHits = 0;

  function pushRT(rt){
    if (!Number.isFinite(rt)) return;
    rtArr.push(rt);
    while (rtArr.length > cfg.rtWindow) rtArr.shift();
  }

  function markMiss(ts){
    lastMissTs = ts;
    missTimes.push(ts);
    // prune
    const cut = ts - cfg.missWindowMs;
    while (missTimes.length && missTimes[0] < cut) missTimes.shift();
  }

  function compute(){
    const avg = rtArr.length ? rtArr.reduce((a,b)=>a+b,0)/rtArr.length : 0;
    const missBurst = missTimes.length >= cfg.missBurstN;

    // rt component
    let rtScore = 0;
    if (avg > cfg.rtBadMs) rtScore = clamp((avg - cfg.rtBadMs) / (cfg.rtVeryBadMs - cfg.rtBadMs), 0, 1);

    // miss component
    const missScore = missBurst ? 1 : 0;

    // combine (simple, explainable)
    const raw = clamp(0.62 * rtScore + 0.38 * missScore, 0, 1);

    // fatigue smoothing (so it doesn't jump wildly)
    // fatigue rises if raw high, decays slowly otherwise
    if (raw > fatigue) fatigue = clamp(fatigue + (raw - fatigue) * 0.18, 0, 1);
    else fatigue = clamp(fatigue - (fatigue - raw) * 0.06, 0, 1);

    risk = clamp(raw * 0.70 + fatigue * 0.30, 0, 1);

    return { avgRt: avg, missCount: missTimes.length, risk, fatigue };
  }

  // director output used by engine spawn system
  function getTuning(base){
    // base = { ttl, weights:{normal,decoy,bomb,heal,shield}, spawnIntervalMin, spawnIntervalMax }
    const s = compute();

    // fairness rules:
    // - if risk high => slightly increase TTL, reduce bomb/decoy a bit, increase heal/shield a bit
    // - never eliminate any type completely
    const ttlMul = 1 + cfg.ttlBoostMax * s.risk;

    const w = Object.assign({}, base.weights);

    // scale factors
    const bombMul = 1 - cfg.bombReduceMax * s.risk;          // down
    const healMul = 1 + cfg.healBoostMax * s.risk;           // up
    const shieldMul = 1 + cfg.shieldBoostMax * s.risk;       // up
    const decoyMul = 1 - (cfg.bombReduceMax * 0.55) * s.risk; // down slightly

    w.bomb = Math.max(1, Math.round(w.bomb * bombMul));
    w.decoy = Math.max(1, Math.round(w.decoy * decoyMul));
    w.heal = Math.max(1, Math.round(w.heal * healMul));
    w.shield = Math.max(1, Math.round(w.shield * shieldMul));

    // keep normal as anchor, but also very slightly reduce if risk high to make room
    w.normal = Math.max(20, Math.round(w.normal * (1 - 0.08 * s.risk)));

    // optional: when risk extremely high, slow spawns a tiny bit
    const spawnSlow = 1 + 0.10 * s.risk;

    return {
      stats: s,
      ttlMul,
      weights: w,
      spawnIntervalMin: Math.round(base.spawnIntervalMin * spawnSlow),
      spawnIntervalMax: Math.round(base.spawnIntervalMax * spawnSlow)
    };
  }

  function maybeTip(ctx){
    // ctx: { now, risk, avgRt, missCount, lastHitGrade, lastHitType }
    const now = ctx.now || nowMs();
    if (now - lastTipAt < cfg.tipCooldownMs) return null;

    const r = ctx.risk ?? risk;
    const avgRt = ctx.avgRt ?? 0;

    let tip = null;

    if (r > 0.82 && ctx.missCount >= cfg.missBurstN){
      tip = 'โหมดโฟกัส: มอง “กลางจอ” แล้วค่อยชกตามจังหวะนะ 👀';
    } else if (avgRt > cfg.rtVeryBadMs){
      tip = 'ลอง “ชกสั้น ๆ เร็ว ๆ” ไม่ต้องแรงมาก จะทันขึ้น 💥';
    } else if ((bombHits + decoyHits) >= 2 && r > 0.45){
      tip = 'ระวังเป้าลวง/ระเบิด: ถ้าไม่ชัวร์ “ปล่อยผ่าน” ดีกว่า 🧠';
    } else if (r < 0.22 && rng() < 0.35){
      tip = 'ดีมาก! ตอนนี้จังหวะนิ่งแล้ว ลองล่า PERFECT ต่อเลย 🎯';
    } else if (rng() < 0.18){
      tip = 'เคล็ดลับ: มองล่วงหน้า 0.2 วิ แล้วชกทันทีเมื่อเป้าโผล่ ⚡️';
    }

    if (tip){
      lastTipAt = now;
      return tip;
    }
    return null;
  }

  function onEvent(e){
    // e: { type:'hit'|'timeout'|'quest_*', targetType, grade, rtMs, ts }
    const ts = Number.isFinite(e.ts) ? e.ts : nowMs();
    if (e.type === 'hit'){
      pushRT(e.rtMs);
      if (e.targetType === 'bomb') bombHits++;
      if (e.targetType === 'decoy') decoyHits++;
    } else if (e.type === 'timeout'){
      markMiss(ts);
    }
    // keep compute warm
    compute();
  }

  function getSnapshot(){
    const s = compute();
    return Object.assign({ bombHits, decoyHits }, s);
  }

  return {
    onEvent,
    getTuning,
    maybeTip,
    getSnapshot
  };
}