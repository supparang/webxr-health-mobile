// === /fitness/js/ai-director.js ===
// Shadow Breaker — AI Intensity Director (A-20)
// ✅ Smooth difficulty shaping (spawn/ttl/size/weights)
// ✅ Pattern memory (avoid repeats / unfair streaks)
// ✅ Anti-row spawn (Poisson-ish attempts + zone alternation)
'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function softstep(x){
  x = clamp(x, 0, 1);
  return x*x*(3 - 2*x);
}

export function createAIDirector(opts = {}){
  const cfg = Object.assign({
    // smoothing
    intensityEwmaAlpha: 0.10,

    // spawn position rules
    attempts: 12,
    minDistPx: 90,          // minimum distance from recent targets
    edgePadPx: 18,          // safe padding from edges
    zoneBias: 0.55,         // alternate L/R zones ~55%

    // memory
    memoryN: 7,
    repeatPenalty: 0.55,    // reduce weight if recently used

    // fairness constraints
    maxBombStreak: 1,
    maxDecoyStreak: 2,

    // intensity mapping (0..1)
    spawnMulMin: 0.85,
    spawnMulMax: 1.25,
    ttlMulMin: 0.85,
    ttlMulMax: 1.10,
    sizeMulMin: 0.86,
    sizeMulMax: 1.10,

    // weights adjustment
    bombBoostAtHigh: 1.25,
    decoyBoostAtHigh: 1.20,
    healBoostAtLow:  1.20,
    shieldBoostAtLow:1.15
  }, opts);

  const st = {
    intensity: 0.45,
    lastKinds: [],
    lastPos: [],
    lastZone: 'L',
    bombStreak: 0,
    decoyStreak: 0
  };

  function pushMem(arr, v, n){
    arr.push(v);
    while(arr.length > n) arr.shift();
  }

  function computeIntensity(metrics){
    // metrics: { missRate, acc, hp, avgRtNormMs, feverOn, inCheckpoint }
    const missRate = clamp(metrics.missRate ?? 0, 0, 1);     // higher => harder? no => lower intensity
    const acc      = clamp((metrics.acc ?? 80) / 100, 0, 1);
    const hp       = clamp(metrics.hp ?? 1, 0, 1);
    const rt       = clamp((metrics.avgRtNormMs ?? 420) / 800, 0, 1); // 0 fast, 1 slow

    // “ฟอร์มดี” => intensity สูงขึ้น
    const form = (
      0.45 * acc +
      0.25 * (1 - missRate) +
      0.20 * hp +
      0.10 * (1 - rt)
    );

    // checkpoint ทำให้เข้มขึ้นนิด แต่ไม่แรง
    const cpBoost = metrics.inCheckpoint ? 0.08 : 0;

    // fever on => ถือว่าผู้เล่นกำลังมั่นใจ ให้เกมเร้าใจขึ้นนิด
    const feverBoost = metrics.feverOn ? 0.06 : 0;

    return clamp(form + cpBoost + feverBoost, 0, 1);
  }

  function tick(metrics){
    const targetI = computeIntensity(metrics || {});
    // EWMA smoothing
    st.intensity = lerp(st.intensity, targetI, cfg.intensityEwmaAlpha);

    // map intensity to multipliers (soft)
    const t = softstep(st.intensity);

    const spawnMul = lerp(cfg.spawnMulMin, cfg.spawnMulMax, t); // >1 = spawn more frequently
    const ttlMul   = lerp(cfg.ttlMulMax, cfg.ttlMulMin, t);     // high intensity => ttl shorter
    const sizeMul  = lerp(cfg.sizeMulMax, cfg.sizeMulMin, t);   // high intensity => size smaller

    return { intensity: st.intensity, spawnMul, ttlMul, sizeMul };
  }

  function weightWithMemory(baseWeights){
    // baseWeights: [{v, w}]
    const mem = st.lastKinds;
    const out = baseWeights.map(x => ({ v: x.v, w: x.w }));

    for (const item of out){
      const recentCount = mem.filter(k => k === item.v).length;
      if (recentCount > 0){
        item.w *= Math.pow(cfg.repeatPenalty, recentCount);
      }
    }

    // fairness constraints
    for (const item of out){
      if (item.v === 'bomb' && st.bombStreak >= cfg.maxBombStreak) item.w *= 0.15;
      if (item.v === 'decoy' && st.decoyStreak >= cfg.maxDecoyStreak) item.w *= 0.20;
    }

    return out;
  }

  function applyIntensityToWeights(weights, metrics){
    // intensity high -> more bomb/decoy (mild)
    // intensity low  -> more heal/shield (mild)
    const i = st.intensity;
    const tHi = softstep(clamp((i - 0.55) / 0.45, 0, 1));
    const tLo = softstep(clamp((0.55 - i) / 0.55, 0, 1));

    const out = weights.map(x => ({...x}));

    for (const item of out){
      if (item.v === 'bomb')  item.w *= lerp(1, cfg.bombBoostAtHigh, tHi);
      if (item.v === 'decoy') item.w *= lerp(1, cfg.decoyBoostAtHigh, tHi);
      if (item.v === 'heal')  item.w *= lerp(1, cfg.healBoostAtLow, tLo);
      if (item.v === 'shield')item.w *= lerp(1, cfg.shieldBoostAtLow, tLo);
    }

    // checkpoint => slightly more bomb/decoy
    if (metrics && metrics.inCheckpoint){
      for (const item of out){
        if (item.v === 'bomb') item.w *= 1.12;
        if (item.v === 'decoy') item.w *= 1.10;
      }
    }

    return out;
  }

  function pickWeighted(weights, rng=Math.random){
    const total = weights.reduce((s, x) => s + x.w, 0);
    let r = rng() * total;
    for (const it of weights){
      if (r < it.w) return it.v;
      r -= it.w;
    }
    return weights[weights.length - 1].v;
  }

  function chooseKind(baseWeights, metrics, rng=Math.random){
    let weights = weightWithMemory(baseWeights);
    weights = applyIntensityToWeights(weights, metrics);
    const kind = pickWeighted(weights, rng);

    // update streaks & memory
    if (kind === 'bomb') st.bombStreak++; else st.bombStreak = 0;
    if (kind === 'decoy') st.decoyStreak++; else st.decoyStreak = 0;

    pushMem(st.lastKinds, kind, cfg.memoryN);
    return kind;
  }

  function dist(a, b){
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function choosePos(areaRect, sizePx, rng=Math.random){
    // areaRect: {left, top, width, height}
    const pad = cfg.edgePadPx + sizePx * 0.55;
    const minDist = cfg.minDistPx + sizePx * 0.15;

    const xMin = areaRect.left + pad;
    const xMax = areaRect.left + areaRect.width - pad;
    const yMin = areaRect.top + pad;
    const yMax = areaRect.top + areaRect.height - pad;

    // zone alternation (L/R)
    const preferZone = (st.lastZone === 'L') ? 'R' : 'L';
    const zoneSplit = areaRect.left + areaRect.width * 0.5;

    function randX(zone){
      if (zone === 'L'){
        const a = xMin, b = Math.min(zoneSplit - pad*0.25, xMax);
        return a + rng() * Math.max(10, (b - a));
      }
      const a = Math.max(zoneSplit + pad*0.25, xMin), b = xMax;
      return a + rng() * Math.max(10, (b - a));
    }

    let best = null;
    let bestScore = -1;

    for (let k=0; k<cfg.attempts; k++){
      const zone = (rng() < cfg.zoneBias) ? preferZone : st.lastZone;
      const x = randX(zone);
      const y = yMin + rng() * Math.max(10, (yMax - yMin));

      const p = { x, y, zone };
      // score = min distance to recent points
      let minD = 99999;
      for (const q of st.lastPos){
        minD = Math.min(minD, dist(p, q));
      }

      const ok = (st.lastPos.length === 0) ? true : (minD >= minDist);
      const score = ok ? minD : (minD * 0.35);

      if (score > bestScore){
        best = p;
        bestScore = score;
      }
      if (ok) break;
    }

    if (!best){
      best = {
        x: (xMin + xMax) * 0.5,
        y: (yMin + yMax) * 0.5,
        zone: preferZone
      };
    }

    // store pos memory
    pushMem(st.lastPos, { x: best.x, y: best.y }, 6);
    st.lastZone = best.zone;

    return { x: best.x, y: best.y };
  }

  return {
    tick,
    chooseKind,
    choosePos,
    get intensity(){ return st.intensity; }
  };
}