// === /herohealth/vr/ai-director.js ===
// AI Difficulty Director — FAIR + FUN (HHA)
// ✅ Adjust difficulty smoothly (no sudden spikes)
// ✅ Research/practice: deterministic + adaptive OFF by default
// ✅ Play: adaptive ON (optional)
// ✅ Outputs: { spawnMs, ttlMs, pJunk, pPower, patternBias, bossOn }
// ✅ Emits: hha:diff { level, why[], params }

'use strict';

const clamp = (v,min,max)=>Math.max(min,Math.min(max, v));
const lerp  = (a,b,t)=> a + (b-a)*t;

export function createDirector({
  mode='play',            // play | research | practice
  diff='normal',          // easy | normal | hard
  adaptive=true,          // play only recommended
  emit=()=>{},
} = {}){

  const adaptiveOn = (mode === 'play') && !!adaptive;

  const base = {
    easy:   { spawnMs: 980, ttlMs: 1850, pJunk: 0.22, pPower: 0.06 },
    normal: { spawnMs: 900, ttlMs: 1650, pJunk: 0.26, pPower: 0.04 },
    hard:   { spawnMs: 820, ttlMs: 1500, pJunk: 0.30, pPower: 0.03 },
  }[String(diff||'normal').toLowerCase()] || { spawnMs:900, ttlMs:1650, pJunk:0.26, pPower:0.04 };

  const S = {
    level: 0.18,          // 0..1
    targetLevel: 0.18,
    lastEmitAt: 0,
    // performance EWMA
    hitRate: 0.55,        // good hits /(good hits+miss) approx
    missRate: 0.00,       // miss per sec
    comboN: 0.0,
    feverN: 0.18,
    lastMiss: 0,
    lastTimeLeft: null,
    lastTickMs: 0,
  };

  function normCombo(combo){ return clamp((combo||0)/18, 0, 1); }
  function normFever(fever){ return clamp((fever||0)/100, 0, 1); }

  function updateTelemetry({ timeLeft, score, miss, hitGood, hitJunk, expireGood, combo, fever } = {}, tsMs=performance.now()){
    const dt = Math.max(0.001, ((tsMs - (S.lastTickMs||tsMs))/1000));
    S.lastTickMs = tsMs;

    const dMiss = Math.max(0, (miss||0) - (S.lastMiss||0));
    const rate  = dMiss / dt;
    S.missRate  = (S.missRate*0.75) + (rate*0.25);
    S.lastMiss  = (miss||0);

    // hitRate heuristic
    const good = (hitGood||0);
    const bad  = (hitJunk||0) + (expireGood||0);
    const denom = Math.max(1, good + bad);
    const hr = clamp(good/denom, 0, 1);
    S.hitRate = (S.hitRate*0.72) + (hr*0.28);

    S.comboN = (S.comboN*0.70) + (normCombo(combo)*0.30);
    S.feverN = (S.feverN*0.70) + (normFever(fever)*0.30);
  }

  function computeTargetLevel(){
    // Curriculum (เวลาเดิน = โหดขึ้นช้า ๆ)
    // ถ้าเล่นเก่ง -> เร่งขึ้น, ถ้าเริ่มพลาด -> ผ่อนลง
    const skill = clamp(
      0.55*S.hitRate +
      0.25*S.comboN +
      0.20*(1 - clamp(S.missRate/1.2, 0, 1)),
      0, 1
    );

    const stress = clamp(
      0.55*S.feverN +
      0.45*clamp(S.missRate/1.1, 0, 1),
      0, 1
    );

    // แฟร์: ถ้า stress สูง จะไม่ดันขึ้นแรง
    let tgt = clamp(0.20 + 0.75*skill - 0.55*stress, 0, 1);

    // โหดขึ้นแบบ “ค่อย ๆ”
    // (ระดับสูงสุดถูกจำกัดไว้เพื่อเด็ก ป.5)
    const cap = 0.78;
    tgt = Math.min(cap, tgt);

    return { tgt, skill, stress };
  }

  function stepLevel(tsMs){
    const { tgt, skill, stress } = computeTargetLevel();
    S.targetLevel = tgt;

    // Smooth change: ขึ้นช้า ลงเร็วกว่า (กัน frustration)
    const upSpeed   = 0.012;   // per tick
    const downSpeed = 0.020;

    const dir = (S.targetLevel >= S.level) ? 1 : -1;
    const spd = (dir>0) ? upSpeed : downSpeed;

    S.level = clamp(S.level + dir*spd, 0, 1);

    if(tsMs - S.lastEmitAt > 900){
      S.lastEmitAt = tsMs;
      const why = [];
      if(skill > 0.64) why.push('เล่นแม่นขึ้น');
      if(stress > 0.55) why.push('เริ่มกดดัน/พลาดถี่');
      if(S.feverN > 0.55) why.push('FEVER สูง');
      emit('hha:diff', { level: S.level, target: S.targetLevel, why });
    }
  }

  function params(){
    // baseline + level scaling
    const L = S.level;

    // spawn faster with level (but capped)
    const spawnMs = Math.round(clamp(base.spawnMs - 220*L, 640, 1100));

    // ttl shorter with level (but not too short = fair)
    const ttlMs   = Math.round(clamp(base.ttlMs - 260*L, 1100, 2100));

    // more junk with level
    const pJunk   = clamp(base.pJunk + 0.14*L, 0.12, 0.42);

    // powerups: if stress high -> give slightly more
    const stressBoost = 0.035 * clamp(S.feverN + clamp(S.missRate/1.2,0,1), 0, 1);
    const pPower = clamp(base.pPower + stressBoost - 0.02*L, 0.02, 0.10);

    // pattern bias: more difficult patterns at higher level
    const patternBias = clamp(0.25 + 0.70*L, 0.25, 0.95);

    // boss on when high level AND stable enough
    const bossOn = (L > 0.62) && (S.hitRate > 0.52) && (S.feverN < 0.75);

    return { spawnMs, ttlMs, pJunk, pPower, patternBias, bossOn, level:L };
  }

  function tick(tsMs=performance.now()){
    if(!adaptiveOn) return params(); // fixed-ish outputs (still computed) but no level step
    stepLevel(tsMs);
    return params();
  }

  return { updateTelemetry, tick, params, get level(){ return S.level; }, get targetLevel(){ return S.targetLevel; } };
}