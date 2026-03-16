// === /herohealth/hydration-vr/hydration.ai-policy.js ===
// Hydration AI Policy / Fairness Guard
// PATCH v20260315-HYD-AI-POLICY

function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

function round4(v){
  return +Number(v || 0).toFixed(4);
}

export const HYD_AI_POLICY_VERSION = 'hyd-policy-v1';

export function createHydrationAIPolicy(opts = {}){
  const version = String(opts.version || HYD_AI_POLICY_VERSION);

  const immutableFields = [
    'score',
    'waterPct',
    'combo',
    'bestCombo',
    'missBadHit',
    'missGoodExpired',
    'blockCount',
    'shield',
    'timeLeft',
    'bossHits',
    'finalHits'
  ];

  const adjustableKnobs = [
    'spawnMul',
    'badMul',
    'shieldMul',
    'bonusMul',
    'stormMul',
    'bossMul'
  ];

  const playBounds = {
    spawnMul:  { min: 0.88, max: 1.18 },
    badMul:    { min: 0.90, max: 1.15 },
    shieldMul: { min: 0.85, max: 1.20 },
    bonusMul:  { min: 0.85, max: 1.20 },
    stormMul:  { min: 0.90, max: 1.15 },
    bossMul:   { min: 0.90, max: 1.15 }
  };

  const researchBounds = {
    spawnMul:  { min: 0.94, max: 1.08 },
    badMul:    { min: 0.94, max: 1.08 },
    shieldMul: { min: 0.92, max: 1.10 },
    bonusMul:  { min: 0.92, max: 1.10 },
    stormMul:  { min: 0.95, max: 1.08 },
    bossMul:   { min: 0.95, max: 1.08 }
  };

  function neutralKnobs(){
    return {
      spawnMul: 1,
      badMul: 1,
      shieldMul: 1,
      bonusMul: 1,
      stormMul: 1,
      bossMul: 1
    };
  }

  function boundsForMode(mode){
    return String(mode || 'play').toLowerCase() === 'research'
      ? researchBounds
      : playBounds;
  }

  function clampKnobs(knobs = {}, mode = 'play'){
    const bounds = boundsForMode(mode);
    const out = {};
    for(const key of adjustableKnobs){
      const b = bounds[key];
      out[key] = round4(clamp(knobs[key] ?? 1, b.min, b.max));
    }
    return out;
  }

  function phaseLocks(features = {}){
    const phase = String(features.phase || '');
    const timeLeft = Number(features.timeLeft || 0);

    return {
      noAggressivePush:
        timeLeft < 8 ||
        phase === 'final',

      protectLowWater:
        Number(features.waterPct || 0) < 15,

      protectSevereStruggle:
        Number(features.frustrationProxy || 0) >= 0.75 ||
        Number(features.missRateRecent || 0) >= 0.85
    };
  }

  function enforceFairness({ proposedKnobs = {}, mode = 'play', features = {}, prediction = {} }){
    const bounds = boundsForMode(mode);
    const locks = phaseLocks(features);
    let knobs = clampKnobs(proposedKnobs, mode);

    // ห้ามเร่งแรงในช่วงท้ายหรือ final
    if(locks.noAggressivePush){
      knobs.spawnMul = Math.min(knobs.spawnMul, 1.04);
      knobs.badMul   = Math.min(knobs.badMul,   1.04);
      knobs.stormMul = Math.min(knobs.stormMul, 1.04);
      knobs.bossMul  = Math.min(knobs.bossMul,  1.04);
    }

    // ถ้าน้ำต่ำมาก ห้ามดันเกมให้ยากขึ้น
    if(locks.protectLowWater){
      knobs.spawnMul = Math.min(knobs.spawnMul, 1.00);
      knobs.badMul   = Math.min(knobs.badMul,   1.00);
      knobs.stormMul = Math.min(knobs.stormMul, 1.00);
      knobs.bossMul  = Math.min(knobs.bossMul,  1.00);

      knobs.shieldMul = Math.max(knobs.shieldMul, 1.05);
      knobs.bonusMul  = Math.max(knobs.bonusMul,  1.05);
    }

    // ถ้าผู้เล่น struggle มาก ห้าม push
    if(locks.protectSevereStruggle || Number(prediction.failRisk || 0) >= 0.80){
      knobs.spawnMul = Math.min(knobs.spawnMul, 0.98);
      knobs.badMul   = Math.min(knobs.badMul,   0.96);
      knobs.stormMul = Math.min(knobs.stormMul, 0.98);
      knobs.bossMul  = Math.min(knobs.bossMul,  0.98);

      knobs.shieldMul = Math.max(knobs.shieldMul, 1.08);
      knobs.bonusMul  = Math.max(knobs.bonusMul,  1.08);
    }

    // clamp ซ้ำอีกรอบหลังแก้ fairness
    knobs = clampKnobs(knobs, mode);

    return {
      version,
      fairnessGuard: 1,
      immutableFields,
      adjustableKnobs,
      locks,
      knobs,
      bounds
    };
  }

  function explainDecision({ before = {}, after = {}, mode = 'play' }){
    const notes = [];

    for(const key of adjustableKnobs){
      const b = Number(before[key] ?? 1);
      const a = Number(after[key] ?? 1);
      if(Math.abs(a - b) < 0.0001) continue;

      if(a > b) notes.push(`${key}:up`);
      else notes.push(`${key}:down`);
    }

    return {
      version,
      mode,
      notes,
      changed: notes.length ? 1 : 0
    };
  }

  return {
    version,
    immutableFields,
    adjustableKnobs,
    neutralKnobs,
    boundsForMode,
    clampKnobs,
    enforceFairness,
    explainDecision
  };
}