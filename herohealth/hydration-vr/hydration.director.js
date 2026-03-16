// === /herohealth/hydration-vr/hydration.director.js ===
// Hydration AI Difficulty Director
// PATCH v20260315-HYD-DIRECTOR

function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

function round4(v){
  return +Number(v || 0).toFixed(4);
}

export function createHydrationDirector(opts = {}){
  const version = String(opts.version || 'hyd-director-v1');
  const mode = String(opts.mode || 'off').toLowerCase(); // off | play | research
  const decisionCooldownMs = Math.max(1500, Number(opts.decisionCooldownMs || 3000));

  // fairness guard = ขอบเขตที่อนุญาตให้ director ขยับได้
  const bounds = {
    spawnMul: { min: 0.88, max: 1.18 },
    badMul: { min: 0.90, max: 1.15 },
    shieldMul: { min: 0.85, max: 1.20 },
    bonusMul: { min: 0.85, max: 1.20 },
    stormMul: { min: 0.90, max: 1.15 },
    bossMul: { min: 0.90, max: 1.15 }
  };

  let lastDecisionTs = 0;

  function neutralKnobs(){
    return {
      spawnMul: 1.0,
      badMul: 1.0,
      shieldMul: 1.0,
      bonusMul: 1.0,
      stormMul: 1.0,
      bossMul: 1.0
    };
  }

  function clampKnobs(knobs){
    return {
      spawnMul: clamp(knobs.spawnMul, bounds.spawnMul.min, bounds.spawnMul.max),
      badMul: clamp(knobs.badMul, bounds.badMul.min, bounds.badMul.max),
      shieldMul: clamp(knobs.shieldMul, bounds.shieldMul.min, bounds.shieldMul.max),
      bonusMul: clamp(knobs.bonusMul, bounds.bonusMul.min, bounds.bonusMul.max),
      stormMul: clamp(knobs.stormMul, bounds.stormMul.min, bounds.stormMul.max),
      bossMul: clamp(knobs.bossMul, bounds.bossMul.min, bounds.bossMul.max)
    };
  }

  function decidePlay(features, prediction){
    const knobs = neutralKnobs();
    let reasonCode = 'steady';
    let intensity = 0;

    // ช่วยเมื่อกำลังพลาดหนัก
    if(prediction.failRisk >= 0.72 || (features.waterPct < 22 && prediction.needHelp >= 0.65)){
      knobs.spawnMul *= 0.94;
      knobs.badMul *= 0.92;
      knobs.shieldMul *= 1.14;
      knobs.bonusMul *= 1.12;
      knobs.stormMul *= 0.93;
      knobs.bossMul *= 0.94;
      reasonCode = 'assist_fail_risk';
      intensity = 2;
    }
    // ช่วยเมื่อ frustration / miss สูง
    else if(features.frustrationProxy >= 0.58 || prediction.missRisk >= 0.66){
      knobs.spawnMul *= 0.97;
      knobs.badMul *= 0.94;
      knobs.shieldMul *= 1.10;
      knobs.bonusMul *= 1.08;
      reasonCode = 'assist_high_miss';
      intensity = 1;
    }
    // เร่งเล็กน้อยถ้าผู้เล่นเล่นดีมาก
    else if(
      prediction.needHelp <= 0.30 &&
      features.combo >= 8 &&
      features.waterPct >= 55 &&
      features.hitQualityRatio >= 0.68
    ){
      knobs.spawnMul *= 1.06;
      knobs.badMul *= 1.06;
      knobs.shieldMul *= 0.95;
      knobs.bonusMul *= 0.96;

      if(features.phase === 'storm') knobs.stormMul *= 1.05;
      if(String(features.phase || '').startsWith('boss') || features.phase === 'final'){
        knobs.bossMul *= 1.05;
      }

      reasonCode = 'push_high_skill';
      intensity = 1;
    }

    return {
      reasonCode,
      intensity,
      knobs: clampKnobs(knobs)
    };
  }

  function decideResearch(features, prediction){
    // research mode: deterministic + conservative
    // ใช้ policy เดิม แต่บีบช่วงแคบกว่า เพื่อคุมความแปรปรวน
    const out = decidePlay(features, prediction);
    const k = out.knobs;

    out.knobs = clampKnobs({
      spawnMul: clamp(k.spawnMul, 0.94, 1.08),
      badMul: clamp(k.badMul, 0.94, 1.08),
      shieldMul: clamp(k.shieldMul, 0.92, 1.10),
      bonusMul: clamp(k.bonusMul, 0.92, 1.10),
      stormMul: clamp(k.stormMul, 0.95, 1.08),
      bossMul: clamp(k.bossMul, 0.95, 1.08)
    });

    return out;
  }

  function decide({ features, prediction, mode: runtimeMode }){
    const nowTs = Number(features?.ts || 0);
    const effectiveMode = String(runtimeMode || mode || 'off').toLowerCase();

    if(effectiveMode === 'off') return null;
    if(!features?.valid || !prediction) return null;
    if(nowTs - lastDecisionTs < decisionCooldownMs) return null;

    lastDecisionTs = nowTs;

    const base = effectiveMode === 'research'
      ? decideResearch(features, prediction)
      : decidePlay(features, prediction);

    return {
      ts: nowTs,
      mode: effectiveMode,
      reasonCode: base.reasonCode,
      intensity: base.intensity,
      fairnessGuard: 1,
      knobs: {
        spawnMul: round4(base.knobs.spawnMul),
        badMul: round4(base.knobs.badMul),
        shieldMul: round4(base.knobs.shieldMul),
        bonusMul: round4(base.knobs.bonusMul),
        stormMul: round4(base.knobs.stormMul),
        bossMul: round4(base.knobs.bossMul)
      },
      version
    };
  }

  return {
    version,
    decide,
    neutralKnobs
  };
}