// === /herohealth/vr-goodjunk/goodjunk.patterns.js ===
// GoodJunk Solo Master Pack
// FULL PATCH v20260313b-GJ-PATTERNS-SOLO-MASTER

'use strict';

export const PHASES = {
  WARM_OPEN: 'warm_open',
  WARM_PRESSURE: 'warm_pressure',
  TRICK_BURST: 'trick_burst',
  RELIEF: 'relief',
  FINAL_RUSH: 'final_rush',
  BOSS_INTRO: 'boss_intro',
  BOSS_PHASE_1: 'boss_phase_1',
  BOSS_PHASE_2: 'boss_phase_2',
  LAST_STAND: 'last_stand',
  ENDED: 'ended'
};

export const BOSS_PERSONAS = {
  shield_tank: {
    id: 'shield_tank',
    label: 'Shield Tank',
    introLine: 'บอสโล่มาแล้ว! ตีโล่ก่อนค่อยยิงแกนกลาง',
    hpMul: 1.18,
    shieldMul: 1.6,
    junkStormBias: 0.20,
    decoyBias: 0.05,
    precisionBias: 0.00,
    rageBias: 0.08
  },
  storm_chaos: {
    id: 'storm_chaos',
    label: 'Storm Chaos',
    introLine: 'พายุขยะกำลังมา! อย่าเสียสมาธิ',
    hpMul: 1.00,
    shieldMul: 1.00,
    junkStormBias: 1.00,
    decoyBias: 0.10,
    precisionBias: 0.00,
    rageBias: 0.15
  },
  decoy_trickster: {
    id: 'decoy_trickster',
    label: 'Decoy Trickster',
    introLine: 'อย่าหลงเป้าหลอก เลือกของจริงให้แม่น!',
    hpMul: 1.02,
    shieldMul: 1.00,
    junkStormBias: 0.30,
    decoyBias: 1.00,
    precisionBias: 0.10,
    rageBias: 0.20
  },
  mirror_reader: {
    id: 'mirror_reader',
    label: 'Mirror Reader',
    introLine: 'บอสกระจกมาแล้ว ซ้ายขวาจะหลอกกัน',
    hpMul: 1.06,
    shieldMul: 1.00,
    junkStormBias: 0.25,
    decoyBias: 0.40,
    precisionBias: 0.40,
    rageBias: 0.20
  },
  precision_sniper: {
    id: 'precision_sniper',
    label: 'Precision Sniper',
    introLine: 'ยิงเฉพาะตอนวงเปิดเท่านั้น!',
    hpMul: 0.96,
    shieldMul: 0.95,
    junkStormBias: 0.16,
    decoyBias: 0.12,
    precisionBias: 1.00,
    rageBias: 0.16
  },
  rage_beast: {
    id: 'rage_beast',
    label: 'Rage Beast',
    introLine: 'ยิ่งใกล้หมดเวลา ยิ่งเดือดขึ้น!',
    hpMul: 1.22,
    shieldMul: 0.92,
    junkStormBias: 0.55,
    decoyBias: 0.10,
    precisionBias: 0.00,
    rageBias: 1.00
  }
};

export const SOLO_PATTERNS = {
  warm_open_good_arc: {
    id: 'warm_open_good_arc',
    phase: PHASES.WARM_OPEN,
    label: 'Good Arc',
    weight: 1.0
  },
  warm_open_green_focus: {
    id: 'warm_open_green_focus',
    phase: PHASES.WARM_OPEN,
    label: 'Green Focus',
    weight: 0.9
  },
  warm_pressure_split_decision: {
    id: 'warm_pressure_split_decision',
    phase: PHASES.WARM_PRESSURE,
    label: 'Split Decision',
    weight: 1.1
  },
  warm_pressure_fake_wall: {
    id: 'warm_pressure_fake_wall',
    phase: PHASES.WARM_PRESSURE,
    label: 'Fake Wall',
    weight: 0.95
  },
  trick_bonus_corridor: {
    id: 'trick_bonus_corridor',
    phase: PHASES.TRICK_BURST,
    label: 'Bonus Corridor',
    weight: 1.0
  },
  trick_lane_rush: {
    id: 'trick_lane_rush',
    phase: PHASES.TRICK_BURST,
    label: 'Lane Rush',
    weight: 1.0
  },
  relief_easy_read: {
    id: 'relief_easy_read',
    phase: PHASES.RELIEF,
    label: 'Relief Read',
    weight: 1.0
  },
  relief_bonus_breath: {
    id: 'relief_bonus_breath',
    phase: PHASES.RELIEF,
    label: 'Bonus Breath',
    weight: 0.85
  },
  final_rush_panic_cluster: {
    id: 'final_rush_panic_cluster',
    phase: PHASES.FINAL_RUSH,
    label: 'Panic Cluster',
    weight: 1.2
  },
  final_rush_zigzag: {
    id: 'final_rush_zigzag',
    phase: PHASES.FINAL_RUSH,
    label: 'Zigzag Rush',
    weight: 1.1
  },
  boss_shield_break: {
    id: 'boss_shield_break',
    phase: PHASES.BOSS_PHASE_1,
    label: 'Shield Break',
    weight: 1.0
  },
  boss_storm_arc: {
    id: 'boss_storm_arc',
    phase: PHASES.BOSS_PHASE_1,
    label: 'Storm Arc',
    weight: 1.0
  },
  boss_decoy_cross: {
    id: 'boss_decoy_cross',
    phase: PHASES.BOSS_PHASE_1,
    label: 'Decoy Cross',
    weight: 1.0
  },
  boss_mirror_pair: {
    id: 'boss_mirror_pair',
    phase: PHASES.BOSS_PHASE_1,
    label: 'Mirror Pair',
    weight: 1.0
  },
  boss_precision_ring: {
    id: 'boss_precision_ring',
    phase: PHASES.BOSS_PHASE_2,
    label: 'Precision Ring',
    weight: 1.0
  },
  boss_rage_burst: {
    id: 'boss_rage_burst',
    phase: PHASES.BOSS_PHASE_2,
    label: 'Rage Burst',
    weight: 1.0
  },
  last_stand_all_in: {
    id: 'last_stand_all_in',
    phase: PHASES.LAST_STAND,
    label: 'All In',
    weight: 1.4
  }
};

export function createPhaseMachine({
  plannedSec = 80,
  goodTarget = 32
} = {}) {
  return {
    phase: PHASES.WARM_OPEN,
    phaseElapsed: 0,
    phaseIndex: 0,
    plannedSec,
    goodTarget
  };
}

export function tickPhaseMachine(machine, dt) {
  machine.phaseElapsed += Math.max(0, Number(dt || 0));
}

export function resetPhaseElapsed(machine) {
  machine.phaseElapsed = 0;
  machine.phaseIndex += 1;
}

export function chooseBossPersona({ diff = 'normal', rng = Math.random } = {}) {
  const ids = Object.keys(BOSS_PERSONAS);
  if (!ids.length) return BOSS_PERSONAS.shield_tank;

  if (diff === 'easy') {
    const pool = ['shield_tank', 'storm_chaos', 'decoy_trickster'];
    return BOSS_PERSONAS[pool[(rng() * pool.length) | 0]];
  }
  if (diff === 'hard') {
    const pool = ['storm_chaos', 'decoy_trickster', 'precision_sniper', 'rage_beast', 'mirror_reader'];
    return BOSS_PERSONAS[pool[(rng() * pool.length) | 0]];
  }
  return BOSS_PERSONAS[ids[(rng() * ids.length) | 0]];
}

export function createPacingState({
  diff = 'normal',
  bossPersona = null
} = {}) {
  return {
    diff,
    bossPersona: bossPersona || BOSS_PERSONAS.shield_tank,
    currentPatternId: '',
    spawnMul: 1,
    ttlMul: 1,
    junkBias: 0,
    bonusBias: 0,
    reliefBias: 0,
    finalRushOn: false
  };
}

export function evaluatePhaseTransition(S) {
  if (!S || S.ended) return null;

  if (S.phase === PHASES.WARM_OPEN && S.phaseElapsed >= 8) {
    return PHASES.WARM_PRESSURE;
  }

  if (S.phase === PHASES.WARM_PRESSURE && S.goodHitCount >= Math.ceil((S.goodTarget || 32) * 0.40)) {
    return PHASES.TRICK_BURST;
  }

  if (S.phase === PHASES.TRICK_BURST && S.phaseElapsed >= 10) {
    return PHASES.RELIEF;
  }

  if (S.phase === PHASES.RELIEF && S.phaseElapsed >= 5) {
    return PHASES.FINAL_RUSH;
  }

  if (S.phase === PHASES.FINAL_RUSH && S.goodHitCount >= (S.goodTarget || 32)) {
    return PHASES.BOSS_INTRO;
  }

  if (S.phase === PHASES.BOSS_INTRO && S.phaseElapsed >= 2) {
    return PHASES.BOSS_PHASE_1;
  }

  if (S.phase === PHASES.BOSS_PHASE_1 && S.bossHpMax > 0 && (S.bossHp / S.bossHpMax) <= 0.5) {
    return PHASES.BOSS_PHASE_2;
  }

  if (S.phase === PHASES.BOSS_PHASE_2 && S.tLeft <= 10) {
    return PHASES.LAST_STAND;
  }

  return null;
}

export function applyPhaseEntry(S, pacing) {
  const persona = pacing?.bossPersona || BOSS_PERSONAS.shield_tank;

  if (S.phase === PHASES.WARM_OPEN) {
    pacing.spawnMul = 0.92;
    pacing.ttlMul = 1.08;
    pacing.junkBias = -0.06;
    pacing.bonusBias = 0.00;
    pacing.reliefBias = 0.10;
    pacing.finalRushOn = false;
  } else if (S.phase === PHASES.WARM_PRESSURE) {
    pacing.spawnMul = 1.00;
    pacing.ttlMul = 1.00;
    pacing.junkBias = 0.00;
    pacing.bonusBias = 0.02;
    pacing.reliefBias = 0.00;
    pacing.finalRushOn = false;
  } else if (S.phase === PHASES.TRICK_BURST) {
    pacing.spawnMul = 1.12;
    pacing.ttlMul = 0.95;
    pacing.junkBias = 0.07;
    pacing.bonusBias = 0.10;
    pacing.reliefBias = 0.00;
    pacing.finalRushOn = false;
  } else if (S.phase === PHASES.RELIEF) {
    pacing.spawnMul = 0.88;
    pacing.ttlMul = 1.10;
    pacing.junkBias = -0.10;
    pacing.bonusBias = 0.12;
    pacing.reliefBias = 0.35;
    pacing.finalRushOn = false;
  } else if (S.phase === PHASES.FINAL_RUSH) {
    pacing.spawnMul = 1.20;
    pacing.ttlMul = 0.92;
    pacing.junkBias = 0.10;
    pacing.bonusBias = 0.08;
    pacing.reliefBias = 0.00;
    pacing.finalRushOn = true;
  } else if (S.phase === PHASES.BOSS_INTRO) {
    pacing.spawnMul = 0.78;
    pacing.ttlMul = 1.00;
    pacing.junkBias = 0.00;
    pacing.bonusBias = 0.00;
    pacing.reliefBias = 0.00;
    pacing.finalRushOn = false;
  } else if (S.phase === PHASES.BOSS_PHASE_1) {
    pacing.spawnMul = 1.00 + (persona.junkStormBias * 0.10);
    pacing.ttlMul = 1.00;
    pacing.junkBias = 0.05 + (persona.junkStormBias * 0.12);
    pacing.bonusBias = 0.02;
    pacing.reliefBias = 0.00;
    pacing.finalRushOn = false;
  } else if (S.phase === PHASES.BOSS_PHASE_2) {
    pacing.spawnMul = 1.08 + (persona.rageBias * 0.10);
    pacing.ttlMul = 0.95;
    pacing.junkBias = 0.08 + (persona.junkStormBias * 0.10);
    pacing.bonusBias = 0.04;
    pacing.reliefBias = 0.00;
    pacing.finalRushOn = false;
  } else if (S.phase === PHASES.LAST_STAND) {
    pacing.spawnMul = 1.24 + (persona.rageBias * 0.12);
    pacing.ttlMul = 0.90;
    pacing.junkBias = 0.12 + (persona.junkStormBias * 0.10);
    pacing.bonusBias = 0.10;
    pacing.reliefBias = 0.00;
    pacing.finalRushOn = true;
  }
}

export function getPhaseBannerText(phase) {
  if (phase === PHASES.WARM_OPEN) return 'READY!';
  if (phase === PHASES.WARM_PRESSURE) return 'WARM PRESSURE';
  if (phase === PHASES.TRICK_BURST) return 'TRICK BURST';
  if (phase === PHASES.RELIEF) return 'BREATH WINDOW';
  if (phase === PHASES.FINAL_RUSH) return 'FINAL RUSH';
  if (phase === PHASES.BOSS_INTRO) return 'BOSS INCOMING';
  if (phase === PHASES.BOSS_PHASE_1) return 'BOSS PHASE 1';
  if (phase === PHASES.BOSS_PHASE_2) return 'BOSS PHASE 2';
  if (phase === PHASES.LAST_STAND) return 'LAST STAND';
  return 'MODE';
}

export function getCoachLineForPhase(phase, persona) {
  if (phase === PHASES.WARM_OPEN) return 'เริ่มเบา ๆ ก่อน เลือกของดีให้แม่น';
  if (phase === PHASES.WARM_PRESSURE) return 'เริ่มกดดันแล้ว อ่านเป้าให้ไวขึ้น';
  if (phase === PHASES.TRICK_BURST) return 'ช่วงเดือดมาแล้ว! เร่งคอมโบให้ติด';
  if (phase === PHASES.RELIEF) return 'พักหายใจสั้น ๆ เก็บแต้มให้เนียน';
  if (phase === PHASES.FINAL_RUSH) return 'ช่วงท้ายแล้ว! เร่งแต้มก่อนเข้าบอส';
  if (phase === PHASES.BOSS_INTRO) return persona?.introLine || 'บอสมาแล้ว!';
  if (phase === PHASES.BOSS_PHASE_1) return 'อ่านแพตเทิร์นบอสก่อน แล้วค่อยบุก';
  if (phase === PHASES.BOSS_PHASE_2) return 'ครึ่งหลังแล้ว ระวังจังหวะหลอก';
  if (phase === PHASES.LAST_STAND) return 'หมดหน้าตักแล้ว ลุยเต็มที่!';
  return 'ลุยต่อ!';
}

export function getPatternPoolForPhase(phase, persona) {
  if (phase === PHASES.WARM_OPEN) {
    return ['warm_open_good_arc', 'warm_open_green_focus'];
  }
  if (phase === PHASES.WARM_PRESSURE) {
    return ['warm_pressure_split_decision', 'warm_pressure_fake_wall'];
  }
  if (phase === PHASES.TRICK_BURST) {
    return ['trick_bonus_corridor', 'trick_lane_rush'];
  }
  if (phase === PHASES.RELIEF) {
    return ['relief_easy_read', 'relief_bonus_breath'];
  }
  if (phase === PHASES.FINAL_RUSH) {
    return ['final_rush_panic_cluster', 'final_rush_zigzag'];
  }
  if (phase === PHASES.BOSS_PHASE_1) {
    if (persona?.id === 'shield_tank') return ['boss_shield_break'];
    if (persona?.id === 'storm_chaos') return ['boss_storm_arc'];
    if (persona?.id === 'decoy_trickster') return ['boss_decoy_cross'];
    if (persona?.id === 'mirror_reader') return ['boss_mirror_pair'];
    if (persona?.id === 'precision_sniper') return ['boss_precision_ring'];
    if (persona?.id === 'rage_beast') return ['boss_rage_burst'];
    return ['boss_shield_break', 'boss_storm_arc', 'boss_decoy_cross'];
  }
  if (phase === PHASES.BOSS_PHASE_2) {
    if (persona?.id === 'precision_sniper') return ['boss_precision_ring'];
    if (persona?.id === 'rage_beast') return ['boss_rage_burst'];
    if (persona?.id === 'mirror_reader') return ['boss_mirror_pair', 'boss_precision_ring'];
    if (persona?.id === 'decoy_trickster') return ['boss_decoy_cross', 'boss_rage_burst'];
    if (persona?.id === 'storm_chaos') return ['boss_storm_arc', 'boss_rage_burst'];
    return ['boss_precision_ring', 'boss_rage_burst'];
  }
  if (phase === PHASES.LAST_STAND) {
    return ['last_stand_all_in'];
  }
  return ['warm_open_good_arc'];
}

export function choosePatternId({
  phase,
  persona,
  rng = Math.random,
  lastPatternId = ''
} = {}) {
  const pool = getPatternPoolForPhase(phase, persona);
  if (!pool.length) return 'warm_open_good_arc';
  if (pool.length === 1) return pool[0];

  let tries = 6;
  while (tries-- > 0) {
    const id = pool[(rng() * pool.length) | 0];
    if (id !== lastPatternId) return id;
  }
  return pool[0];
}

export function getPatternSpec(patternId) {
  return SOLO_PATTERNS[patternId] || SOLO_PATTERNS.warm_open_good_arc;
}

export function getBossConfig({
  diff = 'normal',
  baseBossHp = 18,
  baseShield = 5,
  persona = BOSS_PERSONAS.shield_tank
} = {}) {
  let hp = baseBossHp;
  let shield = baseShield;

  if (diff === 'easy') {
    hp -= 2;
    shield -= 1;
  } else if (diff === 'hard') {
    hp += 4;
    shield += 1;
  }

  hp = Math.max(10, Math.round(hp * (persona?.hpMul || 1)));
  shield = Math.max(0, Math.round(shield * (persona?.shieldMul || 1)));

  return {
    bossHpMax: hp,
    bossShieldHp: shield,
    bossPersonaId: persona?.id || 'shield_tank',
    bossPersonaLabel: persona?.label || 'Shield Tank'
  };
}

export function buildPatternPlan({
  phase,
  patternId,
  persona,
  pacing,
  tLeft = 80
} = {}) {
  const plan = {
    phase,
    patternId,
    personaId: persona?.id || '',
    spawnMul: pacing?.spawnMul || 1,
    ttlMul: pacing?.ttlMul || 1,
    junkBias: pacing?.junkBias || 0,
    bonusBias: pacing?.bonusBias || 0,
    finalRushOn: !!pacing?.finalRushOn,

    // directives for main loop
    useLaneRush: false,
    useCenterBurst: false,
    useBonusCorridor: false,
    useReliefAssist: false,
    usePanicCluster: false,
    useBossShieldPattern: false,
    useBossStormPattern: false,
    useBossDecoyPattern: false,
    useBossMirrorPattern: false,
    useBossPrecisionPattern: false,
    useBossRagePattern: false,
    bonusWindow: 0,
    dangerBoost: false
  };

  if (patternId === 'warm_open_good_arc') {
    plan.bonusWindow = 0.0;
  } else if (patternId === 'warm_open_green_focus') {
    plan.bonusWindow = 0.08;
  } else if (patternId === 'warm_pressure_split_decision') {
    plan.dangerBoost = true;
  } else if (patternId === 'warm_pressure_fake_wall') {
    plan.dangerBoost = true;
  } else if (patternId === 'trick_bonus_corridor') {
    plan.useBonusCorridor = true;
    plan.bonusWindow = 0.16;
  } else if (patternId === 'trick_lane_rush') {
    plan.useLaneRush = true;
  } else if (patternId === 'relief_easy_read') {
    plan.useReliefAssist = true;
  } else if (patternId === 'relief_bonus_breath') {
    plan.useReliefAssist = true;
    plan.bonusWindow = 0.20;
  } else if (patternId === 'final_rush_panic_cluster') {
    plan.usePanicCluster = true;
    plan.dangerBoost = true;
  } else if (patternId === 'final_rush_zigzag') {
    plan.useCenterBurst = true;
    plan.dangerBoost = true;
  } else if (patternId === 'boss_shield_break') {
    plan.useBossShieldPattern = true;
  } else if (patternId === 'boss_storm_arc') {
    plan.useBossStormPattern = true;
  } else if (patternId === 'boss_decoy_cross') {
    plan.useBossDecoyPattern = true;
  } else if (patternId === 'boss_mirror_pair') {
    plan.useBossMirrorPattern = true;
  } else if (patternId === 'boss_precision_ring') {
    plan.useBossPrecisionPattern = true;
  } else if (patternId === 'boss_rage_burst') {
    plan.useBossRagePattern = true;
    plan.dangerBoost = true;
  } else if (patternId === 'last_stand_all_in') {
    plan.usePanicCluster = true;
    plan.useCenterBurst = true;
    plan.dangerBoost = true;
    plan.bonusWindow = tLeft <= 6 ? 0.12 : 0.06;
  }

  return plan;
}
