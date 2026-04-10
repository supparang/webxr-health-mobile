// /herohealth/germ-detective/js/germ-rush-data.js
// Germ Detective: Outbreak Rush
// MAIN GAME DATA MODULE
// PATCH v20260410a-germ-rush-data-mvp

export const PATCH_GERM_RUSH_DATA = 'v20260410a-germ-rush-data-mvp';

export const GAME_META = {
  gameId: 'germ-rush',
  game: 'germ-rush',
  theme: 'germ',
  zone: 'hygiene',
  cat: 'hygiene',
  title: 'Germ Detective: Outbreak Rush'
};

export const DEFAULT_QUERY = {
  pid: 'anon',
  name: 'Hero',
  diff: 'easy',
  time: 63,
  seed: 0,
  view: 'mobile',
  run: 'play',
  hub: '',
  next: '',
  zone: GAME_META.zone,
  cat: GAME_META.cat,
  game: GAME_META.game,
  gameId: GAME_META.gameId,
  theme: GAME_META.theme
};

export const TOOL_ORDER = ['wipe', 'spray', 'trash'];

export const TOOLS = {
  wipe: {
    id: 'wipe',
    label: 'ผ้าเช็ด',
    shortLabel: 'เช็ด',
    icon: '🧽',
    color: '#67c8ff',
    key: '1',
    description: 'ใช้เช็ดคราบบนพื้นผิวและรอยเปื้อนจากของดิบ',
    power: 1.0,
    speed: 1.1,
    spreadBlock: 0.20,
    scoreBonus: 50
  },

  spray: {
    id: 'spray',
    label: 'สเปรย์',
    shortLabel: 'สเปรย์',
    icon: '🫧',
    color: '#7ae582',
    key: '2',
    description: 'ใช้ลดการแพร่ของละอองและจัดการจุดที่ต้องฆ่าเชื้อ',
    power: 1.1,
    speed: 1.0,
    spreadBlock: 0.45,
    scoreBonus: 50
  },

  trash: {
    id: 'trash',
    label: 'ทิ้ง',
    shortLabel: 'ทิ้ง',
    icon: '🗑️',
    color: '#ffb84d',
    key: '3',
    description: 'ใช้ทิ้งอาหารหรือวัตถุที่ปนเปื้อนทั้งชิ้น',
    power: 1.3,
    speed: 0.9,
    spreadBlock: 0.30,
    scoreBonus: 60
  }
};

export const HAZARDS = {
  raw_spill: {
    id: 'raw_spill',
    label: 'คราบของดิบ',
    shortLabel: 'ของดิบ',
    tool: 'wipe',
    severity: 2,
    hp: 1,
    spreadRate: 0.40,
    spreadDelayMs: 2600,
    expireMs: 7200,
    score: 100,
    infectionOnSpread: 7,
    infectionOnMiss: 11,
    behavior: 'grow_area',
    visual: {
      color: '#ff7a8b',
      ring: '#ffffff',
      shape: 'spill'
    },
    feedback: {
      good: 'เช็ดคราบของดิบออกแล้ว',
      bad: 'คราบของดิบเริ่มลาม'
    }
  },

  sneeze_cloud: {
    id: 'sneeze_cloud',
    label: 'ละอองจาม',
    shortLabel: 'ละอองจาม',
    tool: 'spray',
    severity: 4,
    hp: 1,
    spreadRate: 0.90,
    spreadDelayMs: 1650,
    expireMs: 4600,
    score: 135,
    infectionOnSpread: 12,
    infectionOnMiss: 16,
    behavior: 'jump_spawn',
    visual: {
      color: '#72f0ff',
      ring: '#ffffff',
      shape: 'cloud'
    },
    feedback: {
      good: 'หยุดละอองจามได้แล้ว',
      bad: 'ละอองจามกำลังแตกไปจุดอื่น'
    }
  },

  mold_food: {
    id: 'mold_food',
    label: 'อาหารขึ้นรา',
    shortLabel: 'รา',
    tool: 'trash',
    severity: 3,
    hp: 1,
    spreadRate: 0.52,
    spreadDelayMs: 2900,
    expireMs: 7800,
    score: 145,
    infectionOnSpread: 9,
    infectionOnMiss: 13,
    behavior: 'spawn_minis',
    visual: {
      color: '#d58aff',
      ring: '#ffffff',
      shape: 'blob'
    },
    feedback: {
      good: 'ทิ้งอาหารขึ้นราแล้ว',
      bad: 'ราเริ่มปล่อยเชื้อเพิ่ม'
    }
  }
};

export const TOOL_MATCH = Object.freeze(
  Object.fromEntries(
    Object.values(HAZARDS).map((hazard) => [hazard.id, hazard.tool])
  )
);

export const DIFFICULTY = {
  easy: {
    id: 'easy',
    label: 'Easy',
    roundTime: 63,
    introMs: 3200,
    maxConcurrent: 2,
    spawnIntervalMs: 2200,
    spreadMultiplier: 0.85,
    bossHpMultiplier: 0.95,
    bossPressureMultiplier: 0.90,
    fastResponseWindowMs: 2200,
    infectionStart: 0,
    infectionLoseAt: 100
  },

  normal: {
    id: 'normal',
    label: 'Normal',
    roundTime: 75,
    introMs: 3000,
    maxConcurrent: 3,
    spawnIntervalMs: 1700,
    spreadMultiplier: 1.00,
    bossHpMultiplier: 1.00,
    bossPressureMultiplier: 1.00,
    fastResponseWindowMs: 1800,
    infectionStart: 0,
    infectionLoseAt: 100
  },

  hard: {
    id: 'hard',
    label: 'Hard',
    roundTime: 90,
    introMs: 2600,
    maxConcurrent: 4,
    spawnIntervalMs: 1350,
    spreadMultiplier: 1.18,
    bossHpMultiplier: 1.10,
    bossPressureMultiplier: 1.15,
    fastResponseWindowMs: 1450,
    infectionStart: 4,
    infectionLoseAt: 100
  }
};

export const PHASE_PLANS = {
  easy: [
    { id: 'intro', ms: 3200, label: 'READY' },
    { id: 'wave1', ms: 16000, label: 'SCAN' },
    { id: 'wave2', ms: 19000, label: 'CLEAN' },
    { id: 'boss', ms: 14000, label: 'BOSS' },
    { id: 'final_rush', ms: 13000, label: 'RUSH' },
    { id: 'summary', ms: 0, label: 'RESULT' }
  ],

  normal: [
    { id: 'intro', ms: 3000, label: 'READY' },
    { id: 'wave1', ms: 18000, label: 'SCAN' },
    { id: 'wave2', ms: 22000, label: 'CLEAN' },
    { id: 'boss', ms: 14000, label: 'BOSS' },
    { id: 'final_rush', ms: 15000, label: 'RUSH' },
    { id: 'summary', ms: 0, label: 'RESULT' }
  ],

  hard: [
    { id: 'intro', ms: 2600, label: 'READY' },
    { id: 'wave1', ms: 19000, label: 'SCAN' },
    { id: 'wave2', ms: 24000, label: 'CLEAN' },
    { id: 'boss', ms: 16000, label: 'BOSS' },
    { id: 'final_rush', ms: 17000, label: 'RUSH' },
    { id: 'summary', ms: 0, label: 'RESULT' }
  ]
};

export const BOSSES = {
  cross_contam: {
    id: 'cross_contam',
    label: 'Cross-Contam Panic',
    durationMs: 14000,
    scoreBonus: 320,
    infectionPenaltyOnFail: 26,
    infectionRewardOnClear: 12,
    pattern: [
      { t: 0,    type: 'raw_spill',    spot: 'counter_left' },
      { t: 600,  type: 'sneeze_cloud', spot: 'counter_mid', priority: true, priorityText: 'เก็บละอองกลางฉากก่อน!' },
      { t: 1300, type: 'raw_spill',    spot: 'counter_right' },
      { t: 2400, type: 'mold_food',    spot: 'table_mid' },
      { t: 4200, type: 'sneeze_cloud', spot: 'table_left', priority: true, priorityText: 'ละอองกำลังแตก รีบเก็บ!' },
      { t: 5800, type: 'raw_spill',    spot: 'table_right' }
    ],
    successText: 'หยุดการปนเปื้อนข้ามได้แล้ว!',
    failText: 'ของดิบเริ่มปนกับของพร้อมกิน!'
  }
};

export const SPOTS = {
  mobile: {
    counter_left:  { x: -0.95, y: 0.98, z: -2.00 },
    counter_mid:   { x:  0.00, y: 1.00, z: -2.00 },
    counter_right: { x:  0.95, y: 0.98, z: -2.00 },
    table_left:    { x: -0.90, y: 0.98, z:  1.25 },
    table_mid:     { x:  0.00, y: 0.98, z:  1.30 },
    table_right:   { x:  0.90, y: 0.98, z:  1.25 }
  },

  pc: {
    counter_left:  { x: -0.95, y: 0.98, z: -2.00 },
    counter_mid:   { x:  0.00, y: 1.00, z: -2.00 },
    counter_right: { x:  0.95, y: 0.98, z: -2.00 },
    table_left:    { x: -0.90, y: 0.98, z:  1.25 },
    table_mid:     { x:  0.00, y: 0.98, z:  1.30 },
    table_right:   { x:  0.90, y: 0.98, z:  1.25 }
  },

  cvr: {
    counter_left:  { x: -1.10, y: 1.02, z: -2.00 },
    counter_mid:   { x: -0.35, y: 1.02, z: -2.00 },
    counter_right: { x:  0.40, y: 1.02, z: -2.00 },
    table_left:    { x: -0.95, y: 1.05, z: -4.65 },
    table_mid:     { x:  0.00, y: 1.12, z: -4.85 },
    table_right:   { x:  0.95, y: 1.05, z: -4.65 }
  }
};

export const UI_TEXT = {
  introTitle: 'Germ Detective: Outbreak Rush',
  introShort: 'เลือกเครื่องมือให้ถูก แล้วรีบหยุดการแพร่เชื้อ',
  promptDefault: 'เลือกเครื่องมือ แล้วแตะจุดเสี่ยง',
  promptBoss: 'จัดการด่วน! อย่าให้ของดิบปนของพร้อมกิน',
  promptFever: 'SUPER CLEAN! เก็บให้ต่อเนื่อง',
  promptLose: 'เชื้อแพร่เกินควบคุมแล้ว',
  promptWin: 'เยี่ยม! ห้องเริ่มปลอดภัยแล้ว',

  toolSelectedPrefix: 'เลือกเครื่องมือ:',
  comboNice: 'ดีมาก!',
  comboGreat: 'ยอดเยี่ยม!',
  comboSuper: 'สุดยอด!',

  summaryGoodTitle: 'จุดเด่น',
  summaryImproveTitle: 'ควรปรับ',
  summaryReplay: 'เล่นอีกครั้ง',
  summaryHub: 'กลับ HUB'
};

export const SUMMARY_RULES = {
  score3Star: 900,
  score2Star: 520,
  infection3StarMax: 28,
  infection2StarMax: 60,
  wrongTool3StarMax: 1,
  wrongTool2StarMax: 3
};

export const WAVE_SCRIPTS = {
  easy: {
    wave1: [
      { t: 1400, type: 'raw_spill',    spot: 'counter_left' },
      { t: 5000, type: 'sneeze_cloud', spot: 'table_mid' },
      { t: 9200, type: 'mold_food',    spot: 'table_right' },
      { t: 12800, type: 'raw_spill',   spot: 'counter_right' }
    ],
    wave2: [
      { t: 900,  type: 'sneeze_cloud', spot: 'counter_mid' },
      { t: 3100, type: 'raw_spill',    spot: 'counter_left' },
      { t: 5600, type: 'mold_food',    spot: 'table_mid' },
      { t: 8200, type: 'sneeze_cloud', spot: 'table_left' },
      { t: 10900, type: 'raw_spill',   spot: 'counter_right' },
      { t: 13600, type: 'sneeze_cloud', spot: 'table_right' }
    ],
    final_rush: [
      { t: 700,  type: 'sneeze_cloud', spot: 'counter_mid' },
      { t: 1800, type: 'raw_spill',    spot: 'counter_left' },
      { t: 3100, type: 'mold_food',    spot: 'table_mid' },
      { t: 4700, type: 'sneeze_cloud', spot: 'counter_right' },
      { t: 6200, type: 'raw_spill',    spot: 'table_left' },
      { t: 7900, type: 'sneeze_cloud', spot: 'table_right' }
    ]
  },

  normal: {
    wave1: [
      { t: 1000, type: 'raw_spill',    spot: 'counter_left' },
      { t: 3300, type: 'sneeze_cloud', spot: 'table_mid' },
      { t: 5900, type: 'mold_food',    spot: 'table_right' },
      { t: 8400, type: 'sneeze_cloud', spot: 'counter_mid' },
      { t: 10800, type: 'raw_spill',   spot: 'counter_right' }
    ],
    wave2: [
      { t: 700,  type: 'sneeze_cloud', spot: 'counter_mid' },
      { t: 2200, type: 'raw_spill',    spot: 'counter_left' },
      { t: 3900, type: 'mold_food',    spot: 'table_mid' },
      { t: 5600, type: 'sneeze_cloud', spot: 'table_left' },
      { t: 7350, type: 'raw_spill',    spot: 'counter_right' },
      { t: 9100, type: 'mold_food',    spot: 'table_right' },
      { t: 10850, type: 'sneeze_cloud', spot: 'counter_mid' }
    ],
    final_rush: [
      { t: 500,  type: 'sneeze_cloud', spot: 'counter_mid' },
      { t: 1450, type: 'raw_spill',    spot: 'counter_left' },
      { t: 2600, type: 'mold_food',    spot: 'table_mid' },
      { t: 3800, type: 'sneeze_cloud', spot: 'counter_right' },
      { t: 4950, type: 'raw_spill',    spot: 'table_left' },
      { t: 6200, type: 'sneeze_cloud', spot: 'table_right' },
      { t: 7600, type: 'mold_food',    spot: 'counter_mid' }
    ]
  },

  hard: {
    wave1: [
      { t: 900,  type: 'raw_spill',    spot: 'counter_left' },
      { t: 2500, type: 'sneeze_cloud', spot: 'table_mid' },
      { t: 4300, type: 'mold_food',    spot: 'table_right' },
      { t: 6100, type: 'sneeze_cloud', spot: 'counter_mid' },
      { t: 7900, type: 'raw_spill',    spot: 'counter_right' },
      { t: 9800, type: 'sneeze_cloud', spot: 'table_left' }
    ],
    wave2: [
      { t: 650,  type: 'sneeze_cloud', spot: 'counter_mid' },
      { t: 1800, type: 'raw_spill',    spot: 'counter_left' },
      { t: 3100, type: 'mold_food',    spot: 'table_mid' },
      { t: 4500, type: 'sneeze_cloud', spot: 'table_left' },
      { t: 5850, type: 'raw_spill',    spot: 'counter_right' },
      { t: 7200, type: 'mold_food',    spot: 'table_right' },
      { t: 8600, type: 'sneeze_cloud', spot: 'counter_mid' },
      { t: 10000, type: 'raw_spill',   spot: 'table_mid' }
    ],
    final_rush: [
      { t: 450,  type: 'sneeze_cloud', spot: 'counter_mid' },
      { t: 1250, type: 'raw_spill',    spot: 'counter_left' },
      { t: 2200, type: 'mold_food',    spot: 'table_mid' },
      { t: 3200, type: 'sneeze_cloud', spot: 'counter_right' },
      { t: 4200, type: 'raw_spill',    spot: 'table_left' },
      { t: 5200, type: 'mold_food',    spot: 'table_right' },
      { t: 6300, type: 'sneeze_cloud', spot: 'counter_mid' },
      { t: 7600, type: 'raw_spill',    spot: 'table_mid' }
    ]
  }
};

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function safeDiff(diff) {
  return DIFFICULTY[diff] ? diff : 'easy';
}

export function safeView(view) {
  return SPOTS[view] ? view : 'mobile';
}

export function getDifficultyConfig(diff) {
  return DIFFICULTY[safeDiff(diff)];
}

export function getPhasePlan(diff) {
  return PHASE_PLANS[safeDiff(diff)].map((item) => ({ ...item }));
}

export function getToolDef(toolId) {
  return TOOLS[toolId] || TOOLS.wipe;
}

export function getHazardDef(hazardId) {
  return HAZARDS[hazardId] || HAZARDS.raw_spill;
}

export function getSpotMap(view) {
  return SPOTS[safeView(view)];
}

export function getSpot(view, spotId) {
  const map = getSpotMap(view);
  return map[spotId] || map.counter_mid;
}

export function getWaveScript(diff, phaseId) {
  const pack = WAVE_SCRIPTS[safeDiff(diff)] || WAVE_SCRIPTS.easy;
  const list = pack[phaseId] || [];
  return list.map((item) => ({ ...item }));
}

export function getBossConfig(bossId = 'cross_contam') {
  const boss = BOSSES[bossId] || BOSSES.cross_contam;
  return {
    ...boss,
    pattern: boss.pattern.map((item) => ({ ...item }))
  };
}

export function getCorrectToolId(hazardId) {
  return TOOL_MATCH[hazardId] || 'wipe';
}

export function isCorrectTool(hazardId, toolId) {
  return getCorrectToolId(hazardId) === toolId;
}

export function calcStars(summary) {
  const score = Number(summary?.score || 0);
  const infection = Number(summary?.infection || 0);
  const wrongTool = Number(summary?.wrongTool || 0);
  const bossCleared = !!summary?.bossCleared;

  if (
    score >= SUMMARY_RULES.score3Star &&
    infection <= SUMMARY_RULES.infection3StarMax &&
    wrongTool <= SUMMARY_RULES.wrongTool3StarMax &&
    bossCleared
  ) {
    return 3;
  }

  if (
    score >= SUMMARY_RULES.score2Star &&
    infection <= SUMMARY_RULES.infection2StarMax &&
    wrongTool <= SUMMARY_RULES.wrongTool2StarMax
  ) {
    return 2;
  }

  return 1;
}

export function calcRank(summary) {
  const score = Number(summary?.score || 0);
  if (score >= 1200) return 'Expert';
  if (score >= 850) return 'Scout';
  return 'Rookie';
}

export function calcBadge(summary) {
  const infection = Number(summary?.infection || 0);
  const wrongTool = Number(summary?.wrongTool || 0);
  const bestCombo = Number(summary?.bestCombo || 0);
  const cleared = Number(summary?.cleared || 0);
  const bossCleared = !!summary?.bossCleared;

  if (wrongTool === 0 && cleared >= 8) return 'Perfect Tool Match';
  if (infection <= 18 && bossCleared) return 'Room Saver';
  if (bestCombo >= 6) return 'Fast Cleaner';
  return 'Germ Scout';
}

export function buildSummaryAdvice(summary) {
  const advice = [];
  const infection = Number(summary?.infection || 0);
  const wrongTool = Number(summary?.wrongTool || 0);
  const bestCombo = Number(summary?.bestCombo || 0);
  const bossCleared = !!summary?.bossCleared;

  if (bestCombo >= 5) {
    advice.push('คอมโบดีมาก แปลว่าคุณจัดการจุดเสี่ยงได้ต่อเนื่อง');
  } else {
    advice.push('ลองรีบเก็บจุดที่เสี่ยงแพร่เร็วก่อน เพื่อให้คอมโบต่อเนื่องขึ้น');
  }

  if (wrongTool >= 3) {
    advice.push('ยังเลือกเครื่องมือผิดบ่อย ลองจำให้ชัดว่า ของดิบ=เช็ด ละอองจาม=สเปรย์ ราขึ้น=ทิ้ง');
  } else {
    advice.push('เลือกเครื่องมือได้ค่อนข้างดีแล้ว');
  }

  if (!bossCleared) {
    advice.push('ช่วง Cross-Contam Panic ยังช้าไปนิด รอบหน้าควรเก็บละอองกลางฉากเร็วขึ้น');
  } else {
    advice.push('คุณผ่านช่วงวิกฤตได้ดีมาก');
  }

  if (infection > 60) {
    advice.push('ควรรีบจัดการจุดที่แพร่เร็ว ก่อน infection meter จะพุ่ง');
  } else if (infection <= 25) {
    advice.push('คุณควบคุมการแพร่เชื้อได้ดีมาก');
  }

  return advice.slice(0, 3);
}

export function buildSummarySnapshot(state) {
  const summary = {
    score: Number(state?.score || 0),
    hp: Number(state?.hp || 100),
    infection: Number(state?.infection || 0),
    cleared: Number(state?.cleared || 0),
    missed: Number(state?.missed || 0),
    wrongTool: Number(state?.wrongTool || 0),
    bestCombo: Number(state?.bestCombo || 0),
    bossCleared: !!state?.bossCleared
  };

  return {
    ...summary,
    stars: calcStars(summary),
    rank: calcRank(summary),
    badge: calcBadge(summary),
    advice: buildSummaryAdvice(summary)
  };
}