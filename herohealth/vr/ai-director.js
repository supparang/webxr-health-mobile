// === /herohealth/vr/ai-director.js ===
// AI Difficulty Director — HHA Standard (Hydration-ready)
// ✅ Input: live metrics (acc, combo, missesRate, zone, storm, timeK)
// ✅ Output: multipliers for spawn/size/waterForce/aimAssist
// ✅ Research-safe: if runMode=research => returns neutral (1.0) deterministic

export function createAIDirector(opts={}){
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const state = {
    emaSkill: 0.45,
    emaStress: 0.25,
    lastOut: { spawnMul:1, sizeMul:1, waterMul:1, aimMul:1 }
  };

  const cfg = Object.assign({
    // smoothing
    alphaSkill: 0.10,
    alphaStress: 0.12,

    // bounds
    spawnMulMin: 0.80,
    spawnMulMax: 1.22,
    sizeMulMin:  0.82,
    sizeMulMax:  1.12,

    // water dynamics help (kids-friendly)
    waterMulMin: 0.80,
    waterMulMax: 1.18,

    // aim assist help (cvr)
    aimMulMin: 0.85,
    aimMulMax: 1.20,

    // fairness gates
    protectOnHighMiss: true,
    missRateSoft: 0.22,   // misses per second-ish (normalized)
    missRateHard: 0.40,

    kidsBoost: 0.10
  }, opts);

  function update(input){
    const {
      runMode='play',
      kids=false,
      acc=0.6,         // 0..1
      comboK=0.0,      // 0..1
      missRate=0.0,    // 0..1
      frustration=0.0, // 0..1
      fatigue=0.0,     // 0..1
      inStorm=false,
      zone='GREEN',    // 'GREEN'|'LOW'|'HIGH'
      timeK=0.0        // 0..1 progress in run
    } = (input||{});

    // research => neutral
    if (String(runMode).toLowerCase()==='research'){
      return { spawnMul:1, sizeMul:1, waterMul:1, aimMul:1, reason:'research-neutral' };
    }

    const A = clamp(acc,0,1);
    const C = clamp(comboK,0,1);
    const S = clamp(frustration*0.55 + missRate*0.45, 0, 1);
    const F = clamp(fatigue,0,1);

    const skill = clamp(A*0.75 + C*0.25, 0, 1);
    const stress = clamp(S*0.70 + F*0.30, 0, 1);

    state.emaSkill = state.emaSkill*(1-cfg.alphaSkill) + skill*cfg.alphaSkill;
    state.emaStress = state.emaStress*(1-cfg.alphaStress) + stress*cfg.alphaStress;

    // base mapping:
    // - skill สูง => spawn เร็วขึ้น / size เล็กลง
    // - stress สูง => ช่วยผ่อน: spawn ช้าลง / size ใหญ่ขึ้น / water ช่วยคุม
    let spawnMul = 1.00 + (state.emaSkill-0.5)*0.34 - (state.emaStress-0.3)*0.26;
    let sizeMul  = 1.00 - (state.emaSkill-0.5)*0.22 + (state.emaStress-0.3)*0.18;

    // water: ถ้าเด็ก/เครียด ช่วยคุมน้ำให้เสถียรขึ้น (ลด drift และลดแรงพายุ)
    let waterMul = 1.00 - (state.emaStress-0.3)*0.22 + (kids? cfg.kidsBoost : 0);

    // aim assist: ถ้า stress สูง ช่วย lock ใหญ่ขึ้น (aimMul > 1)
    let aimMul = 1.00 + (state.emaStress-0.25)*0.22 + (kids? 0.06 : 0);

    // storm fairness: storm = ยากขึ้นนิด แต่ถ้า stress สูงให้ลดความโหด
    if (inStorm){
      spawnMul *= 1.06;
      sizeMul  *= 0.96;
      waterMul *= 0.94;
      if (state.emaStress > 0.55){
        spawnMul *= 0.92;
        sizeMul  *= 1.05;
        waterMul *= 1.06;
      }
    }

    // zone fairness: ถ้า “ติด GREEN” นานเกิน ให้ช่วยผลักออกตอน storm เท่านั้น (ไม่โกงในปกติ)
    if (inStorm && zone==='GREEN') waterMul *= 1.10;

    // high miss protection
    if (cfg.protectOnHighMiss){
      if (missRate >= cfg.missRateHard){
        spawnMul *= 0.88;
        sizeMul  *= 1.08;
        waterMul *= 1.10;
        aimMul   *= 1.12;
      } else if (missRate >= cfg.missRateSoft){
        spawnMul *= 0.94;
        sizeMul  *= 1.04;
        waterMul *= 1.06;
        aimMul   *= 1.06;
      }
    }

    spawnMul = clamp(spawnMul, cfg.spawnMulMin, cfg.spawnMulMax);
    sizeMul  = clamp(sizeMul,  cfg.sizeMulMin,  cfg.sizeMulMax);
    waterMul = clamp(waterMul, cfg.waterMulMin, cfg.waterMulMax);
    aimMul   = clamp(aimMul,   cfg.aimMulMin,   cfg.aimMulMax);

    state.lastOut = { spawnMul, sizeMul, waterMul, aimMul };
    return { spawnMul, sizeMul, waterMul, aimMul, reason:'adaptive' };
  }

  function getLast(){ return state.lastOut; }

  return { update, getLast };
}