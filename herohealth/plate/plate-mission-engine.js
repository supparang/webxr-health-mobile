// === /herohealth/plate/plate-mission-engine.js ===
// Plate Mission + Auto Role Assignment Engine
// PATCH v20260502-PLATE-MISSION-ENGINE-MULTIMODE-ROLE-BALANCE
//
// ใช้ร่วมกับ Plate ทุกโหมด:
// - solo
// - duet
// - battle
// - race
// - coop
//
// แนวคิดหลัก:
// Plate = จัดจานให้ครบหมู่ + สัดส่วนเหมาะสม + ไม่มี junk + แก้จานได้

'use strict';

/**
 * Canonical Thai 5 Food Groups
 * หมู่ 1 โปรตีน
 * หมู่ 2 คาร์โบไฮเดรต
 * หมู่ 3 ผัก
 * หมู่ 4 ผลไม้
 * หมู่ 5 ไขมัน
 */
export const PLATE_GROUPS = {
  1: {
    id: 1,
    key: 'protein',
    label: 'โปรตีน',
    shortLabel: 'โปรตีน',
    icon: '🐟',
    examples: ['ปลา', 'ไข่', 'ไก่', 'ถั่ว', 'นม'],
    color: '#ffe7ef'
  },

  2: {
    id: 2,
    key: 'carb',
    label: 'ข้าว/แป้ง',
    shortLabel: 'คาร์บ',
    icon: '🍚',
    examples: ['ข้าว', 'ขนมปัง', 'เส้น', 'มัน', 'ข้าวโพด'],
    color: '#fff4cc'
  },

  3: {
    id: 3,
    key: 'veg',
    label: 'ผัก',
    shortLabel: 'ผัก',
    icon: '🥦',
    examples: ['ผักใบเขียว', 'บรอกโคลี', 'แครอท', 'แตงกวา'],
    color: '#e6f8df'
  },

  4: {
    id: 4,
    key: 'fruit',
    label: 'ผลไม้',
    shortLabel: 'ผลไม้',
    icon: '🍎',
    examples: ['กล้วย', 'ส้ม', 'แอปเปิล', 'แตงโม'],
    color: '#e7f1ff'
  },

  5: {
    id: 5,
    key: 'fat',
    label: 'ไขมันดี',
    shortLabel: 'ไขมันดี',
    icon: '🥑',
    examples: ['อะโวคาโด', 'ถั่วเปลือกแข็ง', 'มะกอก', 'งา'],
    color: '#fff0d9'
  }
};

export const PLATE_GROUP_LIST = Object.values(PLATE_GROUPS);

/**
 * Portion Target สำหรับ Plate
 *
 * ใช้แบบเกม:
 * - ผักควรเด่นกว่าเล็กน้อย
 * - โปรตีน 1
 * - คาร์บ 1
 * - ผลไม้ 1
 * - ไขมันดี 0–1 หรือ 1 แบบ bonus/ideal
 *
 * หากต้องการ strict full plate ให้ใช้ ideal:
 * ผัก 2, โปรตีน 1, คาร์บ 1, ผลไม้ 1, ไขมันดี 1
 */
export const PLATE_PORTION_TARGET = {
  1: {
    id: 1,
    key: 'protein',
    label: 'โปรตีน',
    icon: '🐟',
    min: 1,
    ideal: 1,
    max: 1,
    importance: 1
  },

  2: {
    id: 2,
    key: 'carb',
    label: 'ข้าว/แป้ง',
    icon: '🍚',
    min: 1,
    ideal: 1,
    max: 1,
    importance: 1
  },

  3: {
    id: 3,
    key: 'veg',
    label: 'ผัก',
    icon: '🥦',
    min: 2,
    ideal: 2,
    max: 3,
    importance: 1.25
  },

  4: {
    id: 4,
    key: 'fruit',
    label: 'ผลไม้',
    icon: '🍎',
    min: 1,
    ideal: 1,
    max: 1,
    importance: 1
  },

  5: {
    id: 5,
    key: 'fat',
    label: 'ไขมันดี',
    icon: '🥑',
    min: 0,
    ideal: 1,
    max: 1,
    importance: 0.8
  }
};

/**
 * Role templates แยกตาม mode/จำนวนผู้เล่น
 */
export const PLATE_ROLES = {
  solo: [
    {
      roleId: 'solo_builder',
      role: 'Plate Builder',
      icon: '🍽️',
      groups: [1, 2, 3, 4, 5],
      mission: 'จัดจานให้ครบ 5 หมู่และสมดุล',
      shortMission: 'ทำจานให้ครบและสมดุล'
    }
  ],

  duet: [
    {
      roleId: 'main_dish_builder',
      role: 'Main Dish Builder',
      icon: '🍚',
      groups: [1, 2],
      mission: 'ดูแลโปรตีนและข้าว/แป้ง',
      shortMission: 'โปรตีน + ข้าว/แป้ง'
    },
    {
      roleId: 'fresh_balance_builder',
      role: 'Fresh Balance Builder',
      icon: '🥦',
      groups: [3, 4, 5],
      mission: 'ดูแลผัก ผลไม้ และไขมันดี',
      shortMission: 'ผัก + ผลไม้ + ไขมันดี'
    }
  ],

  battle: [
    {
      roleId: 'balance_challenger_a',
      role: 'Balance Challenger',
      icon: '🏆',
      groups: [1, 2, 3, 4, 5],
      mission: 'สร้างจานให้สมดุลที่สุดเพื่อแข่งกับคู่แข่ง',
      shortMission: 'จานสมดุลที่สุด'
    },
    {
      roleId: 'speed_balance_challenger_b',
      role: 'Speed Balance Challenger',
      icon: '⚡',
      groups: [1, 2, 3, 4, 5],
      mission: 'สร้างจานให้เร็วและยังคงสมดุล',
      shortMission: 'เร็ว + สมดุล'
    }
  ],

  race: [
    {
      roleId: 'race_runner',
      role: 'Plate Runner',
      icon: '🏁',
      groups: [1, 2, 3, 4, 5],
      mission: 'ผ่าน checkpoint และสร้างจานให้ครบก่อนหมดเวลา',
      shortMission: 'ทำจานให้ครบก่อนเวลา'
    }
  ],

  coop2: [
    {
      roleId: 'coop_main_builder',
      role: 'Main Dish Builder',
      icon: '🍚',
      groups: [1, 2],
      mission: 'ดูแลโปรตีนและข้าว/แป้งของจานทีม',
      shortMission: 'โปรตีน + ข้าว/แป้ง'
    },
    {
      roleId: 'coop_fresh_builder',
      role: 'Fresh Balance Builder',
      icon: '🥦',
      groups: [3, 4, 5],
      mission: 'ดูแลผัก ผลไม้ และไขมันดีของจานทีม',
      shortMission: 'ผัก + ผลไม้ + ไขมันดี'
    }
  ],

  coop3: [
    {
      roleId: 'protein_captain',
      role: 'Protein Captain',
      icon: '🐟',
      groups: [1],
      mission: 'รับผิดชอบโปรตีนของจานทีม',
      shortMission: 'โปรตีน'
    },
    {
      roleId: 'energy_keeper',
      role: 'Energy Keeper',
      icon: '🍚',
      groups: [2, 5],
      mission: 'รับผิดชอบข้าว/แป้งและไขมันดี',
      shortMission: 'ข้าว/แป้ง + ไขมันดี'
    },
    {
      roleId: 'fresh_hero',
      role: 'Fresh Hero',
      icon: '🥦',
      groups: [3, 4],
      mission: 'รับผิดชอบผักและผลไม้',
      shortMission: 'ผัก + ผลไม้'
    }
  ],

  coop4: [
    {
      roleId: 'protein_captain',
      role: 'Protein Captain',
      icon: '🐟',
      groups: [1],
      mission: 'รับผิดชอบโปรตีน',
      shortMission: 'โปรตีน'
    },
    {
      roleId: 'carb_keeper',
      role: 'Energy Keeper',
      icon: '🍚',
      groups: [2],
      mission: 'รับผิดชอบข้าว/แป้ง',
      shortMission: 'ข้าว/แป้ง'
    },
    {
      roleId: 'veg_guardian',
      role: 'Veg Guardian',
      icon: '🥦',
      groups: [3],
      mission: 'รับผิดชอบผัก',
      shortMission: 'ผัก'
    },
    {
      roleId: 'fruit_fat_helper',
      role: 'Fruit & Fat Helper',
      icon: '🍎',
      groups: [4, 5],
      mission: 'รับผิดชอบผลไม้และไขมันดี',
      shortMission: 'ผลไม้ + ไขมันดี'
    }
  ],

  coop5: [
    {
      roleId: 'protein_captain',
      role: 'Protein Captain',
      icon: '🐟',
      groups: [1],
      mission: 'รับผิดชอบโปรตีน',
      shortMission: 'โปรตีน'
    },
    {
      roleId: 'carb_keeper',
      role: 'Energy Keeper',
      icon: '🍚',
      groups: [2],
      mission: 'รับผิดชอบข้าว/แป้ง',
      shortMission: 'ข้าว/แป้ง'
    },
    {
      roleId: 'veg_guardian',
      role: 'Veg Guardian',
      icon: '🥦',
      groups: [3],
      mission: 'รับผิดชอบผัก',
      shortMission: 'ผัก'
    },
    {
      roleId: 'fruit_hero',
      role: 'Fruit Hero',
      icon: '🍎',
      groups: [4],
      mission: 'รับผิดชอบผลไม้',
      shortMission: 'ผลไม้'
    },
    {
      roleId: 'fat_helper',
      role: 'Fat Helper',
      icon: '🥑',
      groups: [5],
      mission: 'รับผิดชอบไขมันดี',
      shortMission: 'ไขมันดี'
    }
  ]
};

/**
 * Mission templates แยกตาม mode
 */
export const PLATE_MODE_MISSIONS = {
  solo: {
    mode: 'solo',
    title: 'สร้างจานสุขภาพของฉัน',
    subtitle: 'จัดจานให้ครบหมู่และสมดุลด้วยตัวเอง',
    winText: 'จานครบหมู่และสมดุล',
    failText: 'ยังต้องปรับจานอีกนิด',
    primaryMetric: 'balanceScore',
    teamBased: false,
    competitive: false,
    timed: false
  },

  duet: {
    mode: 'duet',
    title: 'คู่หูจัดจานสุขภาพ',
    subtitle: 'สองคนแบ่งหน้าที่ ช่วยกันทำจานเดียวให้สมดุล',
    winText: 'คู่หูทำจานครบและสมดุล',
    failText: 'คู่หูยังต้องช่วยกันแก้จาน',
    primaryMetric: 'teamBalanceScore',
    teamBased: true,
    competitive: false,
    timed: false
  },

  battle: {
    mode: 'battle',
    title: 'Plate Battle',
    subtitle: 'แข่งกันว่าใครจัดจานได้สมดุลกว่า',
    winText: 'จานของคุณสมดุลกว่าคู่แข่ง',
    failText: 'คู่แข่งทำจานได้ดีกว่าในรอบนี้',
    primaryMetric: 'battleScore',
    teamBased: false,
    competitive: true,
    timed: true
  },

  race: {
    mode: 'race',
    title: 'Plate Race',
    subtitle: 'ทำจานให้ครบตาม checkpoint ก่อนหมดเวลา',
    winText: 'ผ่าน checkpoint และทำจานครบทันเวลา',
    failText: 'ยังไม่ครบ checkpoint ก่อนหมดเวลา',
    primaryMetric: 'raceTime',
    teamBased: false,
    competitive: false,
    timed: true
  },

  coop: {
    mode: 'coop',
    title: 'Team Plate Coop',
    subtitle: 'ทุกคนมีหน้าที่ ช่วยกันสร้างจานกลางของทีม',
    winText: 'ทีมสร้างจานครบและสมดุล',
    failText: 'ทีมยังต้องช่วยกันเติมหรือแก้จาน',
    primaryMetric: 'teamBalanceScore',
    teamBased: true,
    competitive: false,
    timed: true
  }
};

/**
 * Race checkpoints
 */
export const PLATE_RACE_CHECKPOINTS = [
  {
    checkpointId: 'carb_1',
    groupId: 2,
    need: 1,
    label: 'เติมข้าว/แป้ง 1 ส่วน',
    icon: '🍚'
  },
  {
    checkpointId: 'protein_1',
    groupId: 1,
    need: 1,
    label: 'เติมโปรตีน 1 ส่วน',
    icon: '🐟'
  },
  {
    checkpointId: 'veg_2',
    groupId: 3,
    need: 2,
    label: 'เติมผัก 2 ส่วน',
    icon: '🥦'
  },
  {
    checkpointId: 'fruit_1',
    groupId: 4,
    need: 1,
    label: 'เติมผลไม้ 1 ส่วน',
    icon: '🍎'
  },
  {
    checkpointId: 'no_junk',
    groupId: 0,
    need: 0,
    label: 'ตรวจว่าไม่มี junk ในจาน',
    icon: '✅'
  }
];

/**
 * Utility
 */
export function clampNumber(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function normalizeMode(mode = 'solo') {
  const m = String(mode || 'solo').toLowerCase().trim();

  if (m === 'duo') return 'duet';
  if (m === 'team') return 'coop';
  if (m === 'co-op') return 'coop';
  if (m === 'cooperative') return 'coop';

  if (['solo', 'duet', 'battle', 'race', 'coop'].includes(m)) return m;
  return 'solo';
}

export function normalizePlayers(players = [], fallbackCount = 1) {
  if (Array.isArray(players) && players.length) {
    return players.map((p, index) => ({
      id: String(p.id || p.playerId || `p${index + 1}`),
      name: String(p.name || p.nick || p.displayName || `Player ${index + 1}`),
      team: String(p.team || p.side || ''),
      index
    }));
  }

  const n = clampNumber(fallbackCount, 1, 8, 1);
  return Array.from({ length: n }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    team: '',
    index
  }));
}

export function roleKeyForMode(mode, playerCount = 1) {
  const m = normalizeMode(mode);
  const n = clampNumber(playerCount, 1, 8, 1);

  if (m === 'solo') return 'solo';
  if (m === 'duet') return 'duet';
  if (m === 'battle') return 'battle';
  if (m === 'race') return 'race';

  if (m === 'coop') {
    return `coop${Math.min(5, Math.max(2, n))}`;
  }

  return 'solo';
}

export function groupLabel(groupId) {
  const g = PLATE_GROUPS[Number(groupId)];
  return g ? g.label : 'ไม่ทราบหมู่';
}

export function groupIcon(groupId) {
  const g = PLATE_GROUPS[Number(groupId)];
  return g ? g.icon : '❓';
}

/**
 * Auto Role Assignment
 */
export function assignPlateRoles({
  mode = 'solo',
  players = [],
  playerCount = 1,
  seed = '',
  rotate = false,
  round = 0
} = {}) {
  const normalizedMode = normalizeMode(mode);
  const normalizedPlayers = normalizePlayers(players, playerCount);
  const key = roleKeyForMode(normalizedMode, normalizedPlayers.length);
  const roleList = PLATE_ROLES[key] || PLATE_ROLES.solo;

  let offset = 0;
  if (rotate) {
    const base = String(seed || '');
    let sum = Number(round || 0);
    for (let i = 0; i < base.length; i += 1) sum += base.charCodeAt(i);
    offset = sum % roleList.length;
  }

  return normalizedPlayers.map((player, index) => {
    const role = roleList[(index + offset) % roleList.length];

    return {
      playerId: player.id,
      name: player.name,
      team: player.team,
      playerIndex: index,
      mode: normalizedMode,
      roleId: role.roleId,
      role: role.role,
      roleIcon: role.icon,
      groups: role.groups.slice(),
      groupLabels: role.groups.map(groupLabel),
      groupIcons: role.groups.map(groupIcon),
      mission: role.mission,
      shortMission: role.shortMission,
      isTeamRole: normalizedMode === 'duet' || normalizedMode === 'coop'
    };
  });
}

/**
 * Build mission by mode
 */
export function buildPlateMission({
  mode = 'solo',
  players = [],
  playerCount = 1,
  assignedRoles = null,
  difficulty = 'normal',
  seed = '',
  round = 0,
  timeSec = null
} = {}) {
  const normalizedMode = normalizeMode(mode);
  const roles = assignedRoles || assignPlateRoles({
    mode: normalizedMode,
    players,
    playerCount,
    seed,
    round,
    rotate: normalizedMode === 'duet' || normalizedMode === 'coop'
  });

  const template = PLATE_MODE_MISSIONS[normalizedMode] || PLATE_MODE_MISSIONS.solo;

  const diff = String(difficulty || 'normal').toLowerCase();
  const defaultTime = normalizedMode === 'race'
    ? 75
    : normalizedMode === 'battle'
      ? 90
      : normalizedMode === 'coop'
        ? 120
        : 90;

  const missionTimeSec = Number.isFinite(Number(timeSec))
    ? Number(timeSec)
    : defaultTime;

  const portionTarget = buildPortionTargetForDifficulty(diff);

  const mission = {
    missionId: `plate_${normalizedMode}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    mode: normalizedMode,
    title: template.title,
    subtitle: template.subtitle,
    winText: template.winText,
    failText: template.failText,
    primaryMetric: template.primaryMetric,
    teamBased: template.teamBased,
    competitive: template.competitive,
    timed: template.timed,
    difficulty: diff,
    timeSec: missionTimeSec,
    portionTarget,
    roles,
    raceCheckpoints: normalizedMode === 'race' ? PLATE_RACE_CHECKPOINTS.slice() : [],
    winCondition: {
      completeGroups: true,
      balancedPortion: diff !== 'easy',
      noJunk: true,
      roleTasksComplete: normalizedMode !== 'solo'
    },
    missionText: buildMissionText(normalizedMode, roles, diff),
    roleSummaryText: buildRoleSummaryText(roles),
    createdAt: new Date().toISOString()
  };

  return mission;
}

export function buildPortionTargetForDifficulty(diff = 'normal') {
  const d = String(diff || 'normal').toLowerCase();

  const base = JSON.parse(JSON.stringify(PLATE_PORTION_TARGET));

  if (d === 'easy') {
    base[3].min = 1;
    base[3].ideal = 1;
    base[5].min = 0;
    base[5].ideal = 0;
    base[5].max = 1;
  }

  if (d === 'hard' || d === 'challenge') {
    base[3].min = 2;
    base[3].ideal = 2;
    base[3].max = 2;
    base[5].min = 1;
    base[5].ideal = 1;
    base[5].max = 1;
  }

  return base;
}

export function buildMissionText(mode, roles = [], diff = 'normal') {
  const m = normalizeMode(mode);

  if (m === 'solo') {
    return diff === 'easy'
      ? 'จัดจานให้ครบอย่างน้อย 5 หมู่ และหลบ junk'
      : 'จัดจานให้ครบ 5 หมู่ มีผัก 2 ส่วน และไม่มี junk';
  }

  if (m === 'duet') {
    return 'คู่หูต้องแบ่งหน้าที่และช่วยกันทำจานเดียวให้ครบและสมดุล';
  }

  if (m === 'battle') {
    return 'แข่งกันสร้างจานที่ครบหมู่ สมดุล และไม่มี junk';
  }

  if (m === 'race') {
    return 'ผ่าน checkpoint ให้ครบและสร้างจานให้ทันเวลา';
  }

  if (m === 'coop') {
    return 'ทีมต้องใช้หน้าที่ของแต่ละคน เติมจานกลางให้ครบและสมดุล';
  }

  return 'จัดจานให้ครบและสมดุล';
}

export function buildRoleSummaryText(roles = []) {
  if (!roles.length) return 'ผู้เล่นรับผิดชอบทุกหมู่';

  return roles
    .map(r => `${r.roleIcon || '👤'} ${r.name}: ${r.shortMission}`)
    .join(' • ');
}

/**
 * Normalize plate items
 *
 * รับข้อมูลได้หลายแบบ เช่น:
 * [
 *   { groupId: 1, junk:false },
 *   { group: 'protein' },
 *   { id:'cake', groupId:0, junk:true }
 * ]
 */
export function normalizePlateItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => {
    const rawGroup =
      item.groupId ??
      item.group_id ??
      item.group ??
      item.gid ??
      0;

    const groupId = groupIdFromAny(rawGroup);
    const junk = !!item.junk || !!item.isJunk || groupId === 0 || String(item.group || '').toLowerCase() === 'junk';

    return {
      index,
      id: String(item.id || item.foodId || `item_${index + 1}`),
      label: String(item.label || item.name || item.foodLabel || ''),
      emoji: String(item.emoji || item.icon || ''),
      groupId,
      groupLabel: groupId ? groupLabel(groupId) : 'junk',
      junk,
      ownerId: String(item.ownerId || item.playerId || ''),
      roleId: String(item.roleId || '')
    };
  });
}

export function groupIdFromAny(value) {
  if (typeof value === 'number') {
    return PLATE_GROUPS[value] ? value : 0;
  }

  const v = String(value || '').toLowerCase().trim();

  if (!v) return 0;

  if (['1', 'protein', 'g1', 'หมู่1', 'โปรตีน'].includes(v)) return 1;
  if (['2', 'carb', 'carbs', 'g2', 'หมู่2', 'ข้าว', 'แป้ง', 'ข้าว/แป้ง'].includes(v)) return 2;
  if (['3', 'veg', 'vegetable', 'vegetables', 'g3', 'หมู่3', 'ผัก'].includes(v)) return 3;
  if (['4', 'fruit', 'fruits', 'g4', 'หมู่4', 'ผลไม้'].includes(v)) return 4;
  if (['5', 'fat', 'goodfat', 'healthyfat', 'g5', 'หมู่5', 'ไขมัน', 'ไขมันดี'].includes(v)) return 5;

  return 0;
}

/**
 * Count groups from plate items
 */
export function countPlateGroups(items = []) {
  const normalized = normalizePlateItems(items);
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let junkCount = 0;

  normalized.forEach(item => {
    if (item.junk || !item.groupId) {
      junkCount += 1;
      return;
    }

    if (counts[item.groupId] != null) {
      counts[item.groupId] += 1;
    }
  });

  return {
    counts,
    junkCount,
    items: normalized,
    totalHealthyItems: Object.values(counts).reduce((a, b) => a + b, 0),
    totalItems: normalized.length
  };
}

/**
 * Analyze plate balance
 */
export function analyzePlateBalance({
  items = [],
  counts = null,
  junkCount = null,
  portionTarget = PLATE_PORTION_TARGET,
  difficulty = 'normal'
} = {}) {
  let groupCounts = counts;
  let computedJunkCount = junkCount;

  if (!groupCounts) {
    const c = countPlateGroups(items);
    groupCounts = c.counts;
    computedJunkCount = c.junkCount;
  }

  if (computedJunkCount == null) computedJunkCount = 0;

  const result = {
    complete: true,
    balanced: true,
    noJunk: computedJunkCount === 0,
    missing: [],
    low: [],
    over: [],
    ideal: [],
    present: [],
    junkCount: computedJunkCount,
    counts: { ...groupCounts },
    portionScore: 0,
    completeScore: 0,
    junkScore: 0,
    balanceScore: 0,
    grade: 'D',
    feedback: [],
    childFeedback: [],
    nextHint: '',
    passed: false
  };

  const target = portionTarget || buildPortionTargetForDifficulty(difficulty);
  const groupIds = Object.keys(target).map(Number);

  let idealWeighted = 0;
  let maxWeighted = 0;
  let completeHits = 0;

  groupIds.forEach(groupId => {
    const rule = target[groupId];
    const count = Number(groupCounts[groupId] || 0);
    const weight = Number(rule.importance || 1);

    maxWeighted += weight;

    if (count > 0) {
      result.present.push(groupId);
    }

    if (count < rule.min) {
      result.complete = false;
      result.balanced = false;
      result.missing.push(groupId);
      result.low.push(groupId);
      result.feedback.push(`ยังขาด${rule.label}`);
      result.childFeedback.push(`เติม${rule.icon} ${rule.label}อีกนิดนะ`);
    } else {
      completeHits += 1;
    }

    if (count > rule.max) {
      result.balanced = false;
      result.over.push(groupId);
      result.feedback.push(`${rule.label}มากเกินไป`);
      result.childFeedback.push(`${rule.icon} ${rule.label}เยอะไปนิด ลองปรับให้พอดี`);
    }

    if (count === rule.ideal) {
      result.ideal.push(groupId);
      idealWeighted += weight;
    } else if (count > 0 && count >= rule.min && count <= rule.max) {
      idealWeighted += weight * 0.75;
    }
  });

  if (computedJunkCount > 0) {
    result.balanced = false;
    result.feedback.push(`มี junk ${computedJunkCount} ชิ้น`);
    result.childFeedback.push('มีอาหารตัวหลอกอยู่ในจาน ลองเอาออกก่อนนะ');
  }

  result.completeScore = Math.round((completeHits / groupIds.length) * 100);
  result.portionScore = Math.round((idealWeighted / Math.max(1, maxWeighted)) * 100);
  result.junkScore = computedJunkCount === 0 ? 100 : Math.max(0, 100 - computedJunkCount * 25);

  result.balanceScore = Math.round(
    result.completeScore * 0.38 +
    result.portionScore * 0.42 +
    result.junkScore * 0.20
  );

  result.grade = gradeFromScore(result.balanceScore);

  result.passed = result.complete && result.balanced && result.noJunk;

  if (result.passed) {
    result.feedback.push('จานนี้ครบหมู่และสัดส่วนดีมาก');
    result.childFeedback.push('เยี่ยมมาก! จานนี้ครบหมู่และสมดุลแล้ว');
  }

  if (!result.childFeedback.length) {
    result.childFeedback.push('ทำได้ดีมาก ลองดูว่าสัดส่วนผักพอหรือยัง');
  }

  result.nextHint = buildNextHint(result);

  return result;
}

export function gradeFromScore(score) {
  const s = Number(score || 0);
  if (s >= 92) return 'S';
  if (s >= 80) return 'A';
  if (s >= 65) return 'B';
  if (s >= 50) return 'C';
  return 'D';
}

export function buildNextHint(result) {
  if (!result) return 'ลองจัดจานให้ครบ 5 หมู่';

  if (result.junkCount > 0) return 'เอา junk ออกจากจานก่อน';
  if (result.missing.length) {
    const g = result.missing[0];
    return `เติม${groupIcon(g)} ${groupLabel(g)}`;
  }
  if (result.over.length) {
    const g = result.over[0];
    return `ลด${groupIcon(g)} ${groupLabel(g)}ให้พอดี`;
  }
  if (!result.balanced) return 'ปรับสัดส่วนให้ใกล้จานสุขภาพ';
  return 'จานพร้อมแล้ว!';
}

/**
 * Analyze role completion
 */
export function analyzeRoleCompletion({
  items = [],
  roles = [],
  portionTarget = PLATE_PORTION_TARGET
} = {}) {
  const normalizedItems = normalizePlateItems(items);
  const out = [];

  roles.forEach(role => {
    const groups = Array.isArray(role.groups) ? role.groups.map(Number) : [];
    const roleItems = normalizedItems.filter(item => {
      if (item.junk) return false;
      if (!groups.includes(Number(item.groupId))) return false;

      if (item.ownerId) {
        return item.ownerId === role.playerId;
      }

      return true;
    });

    const roleCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    roleItems.forEach(item => {
      if (roleCounts[item.groupId] != null) roleCounts[item.groupId] += 1;
    });

    const required = groups.map(gid => {
      const rule = portionTarget[gid] || PLATE_PORTION_TARGET[gid];
      return {
        groupId: gid,
        label: groupLabel(gid),
        icon: groupIcon(gid),
        need: rule ? rule.min : 1,
        have: roleCounts[gid] || 0,
        complete: (roleCounts[gid] || 0) >= (rule ? rule.min : 1)
      };
    });

    const complete = required.every(x => x.complete);

    out.push({
      playerId: role.playerId,
      name: role.name,
      roleId: role.roleId,
      role: role.role,
      roleIcon: role.roleIcon,
      groups,
      required,
      complete,
      progress: required.length
        ? Math.round((required.filter(x => x.complete).length / required.length) * 100)
        : 100,
      hint: complete
        ? `${role.roleIcon || '✅'} ${role.name} ทำหน้าที่ครบแล้ว`
        : buildRoleHint(role, required)
    });
  });

  return out;
}

export function buildRoleHint(role, required = []) {
  const firstMissing = required.find(x => !x.complete);
  if (!firstMissing) return `${role.name} ทำหน้าที่ครบแล้ว`;

  return `${role.name}: เติม${firstMissing.icon} ${firstMissing.label}อีก ${Math.max(0, firstMissing.need - firstMissing.have)} ส่วน`;
}

/**
 * Full mission evaluation
 */
export function evaluatePlateMission({
  mode = 'solo',
  items = [],
  mission = null,
  roles = [],
  difficulty = 'normal',
  timeLeft = 0,
  maxTime = 90,
  opponentScore = null
} = {}) {
  const normalizedMode = normalizeMode(mode);
  const target = mission?.portionTarget || buildPortionTargetForDifficulty(difficulty);
  const missionRoles = roles.length ? roles : (mission?.roles || []);

  const balance = analyzePlateBalance({
    items,
    portionTarget: target,
    difficulty
  });

  const roleStatus = missionRoles.length
    ? analyzeRoleCompletion({
        items,
        roles: missionRoles,
        portionTarget: target
      })
    : [];

  const roleComplete = roleStatus.length
    ? roleStatus.every(r => r.complete)
    : true;

  const timeBonus = calculateTimeBonus(timeLeft, maxTime);
  const modeBonus = calculateModeBonus(normalizedMode, balance, roleStatus, timeBonus);

  const finalScore = Math.round(
    balance.balanceScore +
    timeBonus +
    modeBonus
  );

  let passed = balance.passed;

  if (normalizedMode === 'duet' || normalizedMode === 'coop') {
    passed = passed && roleComplete;
  }

  if (normalizedMode === 'race') {
    passed = passed && Number(timeLeft) > 0;
  }

  if (normalizedMode === 'battle' && opponentScore != null) {
    passed = finalScore > Number(opponentScore || 0);
  }

  return {
    mode: normalizedMode,
    passed,
    finalScore,
    balanceScore: balance.balanceScore,
    completeScore: balance.completeScore,
    portionScore: balance.portionScore,
    junkScore: balance.junkScore,
    timeBonus,
    modeBonus,
    grade: gradeFromScore(finalScore),
    balance,
    roleStatus,
    roleComplete,
    opponentScore,
    summaryText: buildEvaluationSummaryText(normalizedMode, passed, balance, roleStatus),
    childFeedback: buildMissionChildFeedback(normalizedMode, passed, balance, roleStatus)
  };
}

export function calculateTimeBonus(timeLeft = 0, maxTime = 90) {
  const left = Number(timeLeft || 0);
  const max = Math.max(1, Number(maxTime || 90));
  return Math.round(clampNumber(left / max, 0, 1, 0) * 15);
}

export function calculateModeBonus(mode, balance, roleStatus, timeBonus) {
  const m = normalizeMode(mode);
  let bonus = 0;

  if (balance?.passed) bonus += 10;

  if (m === 'race') {
    bonus += Math.min(15, timeBonus);
  }

  if (m === 'duet' || m === 'coop') {
    const allRoles = roleStatus.length && roleStatus.every(r => r.complete);
    if (allRoles) bonus += 12;
  }

  if (m === 'battle') {
    if (balance?.junkCount === 0) bonus += 8;
    if (balance?.portionScore >= 90) bonus += 8;
  }

  return bonus;
}

export function buildEvaluationSummaryText(mode, passed, balance, roleStatus = []) {
  const m = normalizeMode(mode);

  if (passed) {
    if (m === 'solo') return 'จานของคุณครบหมู่และสมดุลแล้ว';
    if (m === 'duet') return 'คู่หูช่วยกันทำจานได้ดีมาก';
    if (m === 'battle') return 'จานนี้มีคุณภาพดีและพร้อมแข่ง';
    if (m === 'race') return 'ผ่าน checkpoint และทำจานครบตามเวลา';
    if (m === 'coop') return 'ทีมช่วยกันทำจานกลางได้สำเร็จ';
  }

  const hint = balance?.nextHint || 'ลองปรับจานอีกนิด';
  return hint;
}

export function buildMissionChildFeedback(mode, passed, balance, roleStatus = []) {
  const lines = [];

  if (passed) {
    lines.push('ยอดเยี่ยมมาก! จานนี้พร้อมแล้ว');
  } else {
    lines.push(...(balance?.childFeedback || ['ลองปรับจานอีกนิดนะ']));
  }

  const incompleteRole = roleStatus.find(r => !r.complete);
  if (incompleteRole) {
    lines.push(incompleteRole.hint);
  }

  if (normalizeMode(mode) === 'race' && !passed) {
    lines.push('Race ต้องครบหมู่และทันเวลาด้วยนะ');
  }

  if (normalizeMode(mode) === 'battle') {
    lines.push('Battle ชนะด้วยจานที่สมดุล ไม่ใช่แค่เร็วอย่างเดียว');
  }

  return lines.slice(0, 4);
}

/**
 * Checkpoint progress for Race
 */
export function evaluateRaceCheckpoints({
  items = [],
  checkpoints = PLATE_RACE_CHECKPOINTS
} = {}) {
  const c = countPlateGroups(items);
  const counts = c.counts;
  const junkCount = c.junkCount;

  const list = checkpoints.map(cp => {
    if (cp.checkpointId === 'no_junk') {
      return {
        ...cp,
        have: junkCount,
        complete: junkCount === 0,
        text: junkCount === 0 ? 'ไม่มี junk แล้ว' : `ยังมี junk ${junkCount} ชิ้น`
      };
    }

    const have = counts[cp.groupId] || 0;
    return {
      ...cp,
      have,
      complete: have >= cp.need,
      text: have >= cp.need
        ? `${cp.label} ผ่านแล้ว`
        : `${cp.label} (${have}/${cp.need})`
    };
  });

  return {
    checkpoints: list,
    completeCount: list.filter(x => x.complete).length,
    total: list.length,
    allComplete: list.every(x => x.complete),
    next: list.find(x => !x.complete) || null,
    progress: Math.round((list.filter(x => x.complete).length / Math.max(1, list.length)) * 100)
  };
}

/**
 * Simple API bundle for non-module usage
 */
export const PlateMissionEngine = {
  PLATE_GROUPS,
  PLATE_GROUP_LIST,
  PLATE_PORTION_TARGET,
  PLATE_ROLES,
  PLATE_MODE_MISSIONS,
  PLATE_RACE_CHECKPOINTS,

  normalizeMode,
  normalizePlayers,
  roleKeyForMode,
  groupLabel,
  groupIcon,
  assignPlateRoles,
  buildPlateMission,
  buildPortionTargetForDifficulty,
  normalizePlateItems,
  groupIdFromAny,
  countPlateGroups,
  analyzePlateBalance,
  analyzeRoleCompletion,
  evaluatePlateMission,
  evaluateRaceCheckpoints,
  gradeFromScore
};

if (typeof window !== 'undefined') {
  window.PlateMissionEngine = PlateMissionEngine;
}
