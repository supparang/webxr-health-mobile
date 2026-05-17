// === /herohealth/vr-groups/groups-core.js ===
// HeroHealth • Groups Core
// Food-to-Gate Sorting Core for Solo / Race / Duet / Coop / Battle
// Core rule:
//   food appears -> player chooses/sends to gate 1–5 -> judge -> score/combo/mission/power/summary
// PATCH v20260517-GROUPS-CORE-V1

export const GROUPS_CORE_VERSION = 'v20260517-groups-core-v1';

export const FOOD_GROUPS = [
  {
    id: 1,
    key: 'protein',
    label: 'โปรตีน',
    short: 'PROTEIN',
    icon: '🐟',
    color: '#ff8e82',
    foods: ['🐟', '🥚', '🍗', '🥩', '🫘', '🥛']
  },
  {
    id: 2,
    key: 'carb',
    label: 'ข้าว/แป้ง',
    short: 'CARB',
    icon: '🍚',
    color: '#f7c948',
    foods: ['🍚', '🍞', '🥔', '🍠', '🌽', '🍜']
  },
  {
    id: 3,
    key: 'veg',
    label: 'ผัก',
    short: 'VEG',
    icon: '🥦',
    color: '#72d957',
    foods: ['🥦', '🥬', '🥕', '🥒', '🍅', '🫛']
  },
  {
    id: 4,
    key: 'fruit',
    label: 'ผลไม้',
    short: 'FRUIT',
    icon: '🍎',
    color: '#ff8fc8',
    foods: ['🍎', '🍌', '🍊', '🍇', '🍉', '🍓', '🥭', '🍍']
  },
  {
    id: 5,
    key: 'fat',
    label: 'ไขมัน',
    short: 'FAT',
    icon: '🥑',
    color: '#a98cff',
    foods: ['🥑', '🥜', '🧈', '🫒', '🥥']
  }
];

export const DECOYS = [
  { icon: '🍩', label: 'โดนัท' },
  { icon: '🥤', label: 'น้ำหวาน' },
  { icon: '🍬', label: 'ลูกอม' },
  { icon: '🍟', label: 'ของทอด' },
  { icon: '🍰', label: 'เค้ก' }
];

export const POWERS = [
  { type: 'shield', icon: '🛡️', label: 'Shield' },
  { type: 'slow', icon: '⏱️', label: 'Slow Time' },
  { type: 'boost', icon: '⚡', label: 'Boost' }
];

function clamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) n = min;
  return Math.max(min, Math.min(max, n));
}

function nowMs() {
  return Date.now();
}

function xmur3(str) {
  let h = 1779033703 ^ str.length;

  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;

    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;

    return (t >>> 0) / 4294967296;
  };
}

function makeRng(seedText) {
  const f = xmur3(String(seedText || 'groups-core'));
  return sfc32(f(), f(), f(), f());
}

function safeCall(fn, payload) {
  try {
    if (typeof fn === 'function') fn(payload);
  } catch (err) {
    console.warn('[GroupsCore] callback failed', err);
  }
}

function copy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function createGroupsCore(options = {}) {
  const listeners = new Set();

  const config = {
    mode: options.mode || 'solo',
    diff: options.diff || 'normal',
    durationSec: clamp(options.durationSec || options.duration || 90, 30, 300),
    seed: options.seed || `groups-core-${Date.now()}`,
    hearts: clamp(options.hearts || 3, 1, 10),
    autoSpawn: options.autoSpawn !== false,
    decoyHardCap: options.decoyHardCap !== false,
    allowPower: options.allowPower !== false,
    allowGolden: options.allowGolden !== false,
    allowDecoy: options.allowDecoy !== false,
    missionEnabled: options.missionEnabled !== false,
    onEvent: options.onEvent || null
  };

  const state = {
    version: GROUPS_CORE_VERSION,
    mode: 'idle',

    startedAt: 0,
    endedAt: 0,
    reason: '',

    rng: makeRng(config.seed),

    current: null,
    itemIndex: 0,
    itemDeadline: 0,
    itemDurationMs: 3600,

    score: 0,
    correct: 0,
    miss: 0,
    skippedDecoy: 0,
    combo: 0,
    bestCombo: 0,
    hearts: config.hearts,

    shield: 0,
    slowUntil: 0,
    boostUntil: 0,

    mission: null,
    missionClear: 0,

    decoyTotal: 0,
    decoyCooldown: 0,
    decoyHardCooldown: 0,
    decoyStreak: 0,
    lastKinds: [],

    groupHits: {
      protein: 0,
      carb: 0,
      veg: 0,
      fruit: 0,
      fat: 0
    },

    events: []
  };

  function emit(type, detail = {}) {
    const event = {
      type,
      ts: new Date().toISOString(),
      t: nowMs(),
      detail,
      state: getPublicState()
    };

    state.events.push({
      type,
      ts: event.ts,
      detail
    });

    if (state.events.length > 120) state.events.shift();

    listeners.forEach((fn) => safeCall(fn, event));
    safeCall(config.onEvent, event);

    return event;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function pick(arr) {
    return arr[Math.floor(state.rng() * arr.length) % arr.length];
  }

  function getElapsedSec() {
    if (!state.startedAt) return 0;
    return Math.max(0, Math.floor((nowMs() - state.startedAt) / 1000));
  }

  function getRemainingSec() {
    if (state.mode !== 'playing') return config.durationSec;
    return Math.max(0, config.durationSec - getElapsedSec());
  }

  function getItemProgress() {
    if (!state.current || state.mode !== 'playing') return 0;

    const total = Math.max(1, state.itemDurationMs);
    const left = Math.max(0, state.itemDeadline - nowMs());

    return clamp(left / total, 0, 1);
  }

  function accuracy() {
    const total = Math.max(1, state.correct + state.miss);
    return Math.round((state.correct / total) * 100);
  }

  function hitRate() {
    const total = Math.max(1, state.correct + state.miss + state.skippedDecoy);
    return Math.round(((state.correct + state.skippedDecoy) / total) * 100);
  }

  function itemTimeMs() {
    let base = 3600;

    if (config.diff === 'easy') base = 4300;
    if (config.diff === 'normal') base = 3600;
    if (config.diff === 'hard') base = 3000;
    if (config.diff === 'challenge') base = 2600;

    const elapsed = getElapsedSec();

    if (elapsed > config.durationSec * 0.68) base *= 0.86;
    else if (elapsed > config.durationSec * 0.36) base *= 0.94;

    if (nowMs() < state.slowUntil) base *= 1.35;

    return Math.round(base);
  }

  function getMaxDecoys() {
    if (config.durationSec <= 90) return 3;
    if (config.durationSec <= 120) return 4;
    return 5;
  }

  function chooseItem() {
    let decoyRate = 0.05;
    let goldenRate = 0.11;
    let powerRate = 0.08;

    if (config.diff === 'easy') {
      decoyRate = 0.03;
      goldenRate = 0.13;
      powerRate = 0.09;
    }

    if (config.diff === 'hard') {
      decoyRate = 0.07;
      goldenRate = 0.10;
      powerRate = 0.08;
    }

    if (config.diff === 'challenge') {
      decoyRate = 0.09;
      goldenRate = 0.09;
      powerRate = 0.08;
    }

    if (!config.allowPower) powerRate = 0;
    if (!config.allowGolden) goldenRate = 0;
    if (!config.allowDecoy) decoyRate = 0;

    const missionNeedsDecoy =
      state.mission &&
      state.mission.type === 'dodge' &&
      Number(state.mission.got || 0) < Number(state.mission.need || 0);

    if (missionNeedsDecoy) decoyRate = Math.max(decoyRate, 0.10);

    if (config.decoyHardCap) {
      if (state.decoyTotal >= getMaxDecoys()) decoyRate = 0;
      if (state.decoyCooldown > 0) decoyRate = 0;
      if (state.decoyHardCooldown > 0) decoyRate = 0;
      if (state.decoyStreak >= 1) decoyRate = 0;
      if (state.lastKinds.filter((k) => k === 'decoy').length >= 1) decoyRate = 0;
      if (getRemainingSec() <= 20) decoyRate = 0;
    }

    decoyRate = clamp(decoyRate, 0, 0.10);

    const roll = state.rng();
    let item;

    if (roll < powerRate) {
      const p = pick(POWERS);
      item = {
        kind: 'power',
        icon: p.icon,
        label: p.label,
        power: p.type,
        group: null
      };
    } else if (roll < powerRate + decoyRate) {
      const d = pick(DECOYS);
      item = {
        kind: 'decoy',
        icon: d.icon,
        label: d.label,
        group: null
      };
    } else {
      const group = pick(FOOD_GROUPS);
      const icon = pick(group.foods);

      if (roll < powerRate + decoyRate + goldenRate) {
        item = {
          kind: 'golden',
          icon,
          label: group.label,
          group
        };
      } else {
        item = {
          kind: 'food',
          icon,
          label: group.label,
          group
        };
      }
    }

    if (item.kind === 'decoy') {
      state.decoyTotal += 1;
      state.decoyStreak = 1;
      state.decoyCooldown = missionNeedsDecoy ? 2 : 5;
      state.decoyHardCooldown = 4;
    } else {
      state.decoyStreak = 0;
      state.decoyCooldown = Math.max(0, Number(state.decoyCooldown || 0) - 1);
      state.decoyHardCooldown = Math.max(0, Number(state.decoyHardCooldown || 0) - 1);
    }

    state.lastKinds = state.lastKinds.concat(item.kind).slice(-6);

    return item;
  }

  function newMission() {
    if (!config.missionEnabled) {
      state.mission = null;
      return null;
    }

    const group = pick(FOOD_GROUPS);

    const pool = [
      {
        type: 'combo',
        icon: '🔥',
        label: 'ทำคอมโบ 4 ครั้ง',
        need: 4,
        got: 0
      },
      {
        type: 'group',
        icon: group.icon,
        label: `ส่งหมู่ ${group.id} ${group.label} ให้ถูก 2 ครั้ง`,
        groupKey: group.key,
        need: 2,
        got: 0
      },
      {
        type: 'speed',
        icon: '⚡',
        label: 'ตอบถูก 5 ครั้ง',
        need: 5,
        got: 0
      }
    ];

    if (config.durationSec >= 90) {
      pool.push({
        type: 'golden',
        icon: '⭐',
        label: 'เก็บ Golden 1 ครั้ง',
        need: 1,
        got: 0
      });
    }

    state.mission = pick(pool);
    emit('mission:new', { mission: copy(state.mission) });

    return state.mission;
  }

  function missionProgress(action, item) {
    const m = state.mission;
    if (!m) return;

    let changed = false;

    if (action === 'correct') {
      if (m.type === 'combo') {
        m.got = Math.max(m.got, Math.min(m.need, state.combo));
        changed = true;
      }

      if (m.type === 'speed') {
        m.got += 1;
        changed = true;
      }

      if (m.type === 'group' && item.group && item.group.key === m.groupKey) {
        m.got += 1;
        changed = true;
      }

      if (m.type === 'golden' && item.kind === 'golden') {
        m.got += 1;
        changed = true;
      }
    }

    if (action === 'dodge' && m.type === 'dodge') {
      m.got += 1;
      changed = true;
    }

    if (!changed) return;

    m.got = clamp(m.got, 0, m.need);

    emit('mission:progress', { mission: copy(m) });

    if (m.got >= m.need) {
      state.missionClear += 1;
      state.score += 35;

      emit('mission:clear', {
        bonus: 35,
        mission: copy(m),
        missionClear: state.missionClear
      });

      newMission();
    }
  }

  function spawnItem() {
    if (state.mode !== 'playing') return null;

    state.current = chooseItem();
    state.itemDurationMs = itemTimeMs();
    state.itemDeadline = nowMs() + state.itemDurationMs;
    state.itemIndex += 1;

    emit('item:spawn', {
      item: copy(state.current),
      itemIndex: state.itemIndex,
      itemDurationMs: state.itemDurationMs
    });

    return state.current;
  }

  function start(overrides = {}) {
    if (overrides.diff) config.diff = overrides.diff;
    if (overrides.durationSec || overrides.duration) {
      config.durationSec = clamp(overrides.durationSec || overrides.duration, 30, 300);
    }

    if (overrides.seed) {
      config.seed = overrides.seed;
      state.rng = makeRng(config.seed);
    }

    state.mode = 'playing';
    state.startedAt = overrides.startedAt || nowMs();
    state.endedAt = 0;
    state.reason = '';

    state.current = null;
    state.itemIndex = 0;
    state.itemDeadline = 0;

    state.score = 0;
    state.correct = 0;
    state.miss = 0;
    state.skippedDecoy = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.hearts = overrides.hearts || config.hearts;

    state.shield = 0;
    state.slowUntil = 0;
    state.boostUntil = 0;

    state.missionClear = 0;
    state.groupHits = {
      protein: 0,
      carb: 0,
      veg: 0,
      fruit: 0,
      fat: 0
    };

    state.decoyTotal = 0;
    state.decoyCooldown = 0;
    state.decoyHardCooldown = 0;
    state.decoyStreak = 0;
    state.lastKinds = [];

    state.events = [];

    newMission();

    emit('game:start', {
      mode: config.mode,
      diff: config.diff,
      durationSec: config.durationSec,
      seed: config.seed
    });

    if (config.autoSpawn) spawnItem();

    return getPublicState();
  }

  function stop(reason = 'stopped') {
    if (state.mode === 'ended') return getSummary(reason);

    state.mode = 'ended';
    state.endedAt = nowMs();
    state.reason = reason;

    const summary = getSummary(reason);

    emit('game:end', { reason, summary });

    return summary;
  }

  function applyCorrect(item, meta = {}) {
    state.correct += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);

    if (item.group && item.group.key) {
      state.groupHits[item.group.key] = (state.groupHits[item.group.key] || 0) + 1;
    }

    let gain = 12 + Math.min(state.combo, 12) * 2;

    if (item.kind === 'golden') gain += 28;
    if (nowMs() < state.boostUntil) gain = Math.round(gain * 1.35);

    state.score += gain;

    missionProgress('correct', item);

    emit('judge:correct', {
      item: copy(item),
      gain,
      score: state.score,
      combo: state.combo,
      meta
    });

    spawnItem();

    return {
      ok: true,
      action: 'correct',
      gain,
      state: getPublicState()
    };
  }

  function applyMiss(reason = 'miss', meta = {}) {
    if (state.shield > 0) {
      state.shield -= 1;
      state.combo = 0;

      emit('judge:shield', {
        reason,
        shield: state.shield,
        meta
      });

      spawnItem();

      return {
        ok: false,
        action: 'shield',
        reason,
        state: getPublicState()
      };
    }

    state.miss += 1;
    state.combo = 0;
    state.hearts -= 1;

    emit('judge:miss', {
      reason,
      miss: state.miss,
      hearts: state.hearts,
      meta
    });

    if (state.hearts <= 0) {
      stop('no-heart');
    } else {
      spawnItem();
    }

    return {
      ok: false,
      action: 'miss',
      reason,
      state: getPublicState()
    };
  }

  function judgeGate(groupKey, meta = {}) {
    if (state.mode !== 'playing') {
      return { ok: false, action: 'not-playing', state: getPublicState() };
    }

    const item = state.current;

    if (!item) {
      return { ok: false, action: 'no-item', state: getPublicState() };
    }

    if (item.kind === 'power') {
      emit('judge:block', {
        reason: 'power-needs-item-click',
        item: copy(item),
        meta
      });

      return {
        ok: false,
        action: 'block',
        reason: 'power-needs-item-click',
        state: getPublicState()
      };
    }

    if (item.kind === 'decoy') {
      return applyMiss('hit-decoy', meta);
    }

    const ok = item.group && item.group.key === groupKey;

    if (ok) return applyCorrect(item, meta);

    return applyMiss('wrong-group', {
      ...meta,
      selectedGroup: groupKey,
      correctGroup: item.group ? item.group.key : ''
    });
  }

  function collectPower(meta = {}) {
    if (state.mode !== 'playing') {
      return { ok: false, action: 'not-playing', state: getPublicState() };
    }

    const item = state.current;

    if (!item || item.kind !== 'power') {
      return {
        ok: false,
        action: 'not-power',
        state: getPublicState()
      };
    }

    if (item.power === 'shield') {
      state.shield = clamp(state.shield + 1, 0, 2);
      state.score += 8;
    } else if (item.power === 'slow') {
      state.slowUntil = nowMs() + 5200;
      state.score += 8;
    } else if (item.power === 'boost') {
      state.boostUntil = nowMs() + 5800;
      state.score += 8;
    }

    emit('power:collect', {
      item: copy(item),
      power: item.power,
      score: state.score,
      shield: state.shield,
      slowUntil: state.slowUntil,
      boostUntil: state.boostUntil,
      meta
    });

    spawnItem();

    return {
      ok: true,
      action: 'power',
      power: item.power,
      state: getPublicState()
    };
  }

  function passDecoy(meta = {}) {
    if (state.mode !== 'playing') {
      return { ok: false, action: 'not-playing', state: getPublicState() };
    }

    const item = state.current;

    if (!item || item.kind !== 'decoy') {
      return {
        ok: false,
        action: 'not-decoy',
        state: getPublicState()
      };
    }

    state.skippedDecoy += 1;
    state.score += 8;

    missionProgress('dodge', item);

    emit('decoy:pass', {
      item: copy(item),
      score: state.score,
      skippedDecoy: state.skippedDecoy,
      meta
    });

    spawnItem();

    return {
      ok: true,
      action: 'pass-decoy',
      state: getPublicState()
    };
  }

  function timeoutCurrent(meta = {}) {
    if (state.mode !== 'playing') {
      return { ok: false, action: 'not-playing', state: getPublicState() };
    }

    const item = state.current;

    if (!item) {
      spawnItem();
      return { ok: false, action: 'no-item', state: getPublicState() };
    }

    if (item.kind === 'decoy') return passDecoy(meta);

    if (item.kind === 'power') {
      emit('power:miss', {
        item: copy(item),
        meta
      });

      spawnItem();

      return {
        ok: false,
        action: 'power-timeout',
        state: getPublicState()
      };
    }

    return applyMiss('timeout', meta);
  }

  function tick(meta = {}) {
    if (state.mode !== 'playing') return getPublicState();

    if (getRemainingSec() <= 0) {
      stop('time');
      return getPublicState();
    }

    if (state.current && state.itemDeadline && nowMs() >= state.itemDeadline) {
      timeoutCurrent(meta);
    }

    emit('game:tick', {
      remainingSec: getRemainingSec(),
      itemProgress: getItemProgress()
    });

    return getPublicState();
  }

  function rankName() {
    const acc = accuracy();

    if (state.correct >= 24 && acc >= 88 && state.bestCombo >= 8) return 'Food Groups Hero';
    if (state.correct >= 16 && acc >= 78) return 'Smart Food Sorter';
    if (state.correct >= 8 && acc >= 62) return 'Food Group Explorer';
    return 'Food Group Rookie';
  }

  function getSummary(reason = state.reason || '') {
    return {
      version: GROUPS_CORE_VERSION,
      game: 'groups',
      core: 'food-to-gate-sorting',
      mode: config.mode,
      reason,
      diff: config.diff,
      durationSec: config.durationSec,
      startedAt: state.startedAt,
      endedAt: state.endedAt || nowMs(),
      score: state.score,
      correct: state.correct,
      miss: state.miss,
      skippedDecoy: state.skippedDecoy,
      accuracy: accuracy(),
      hitRate: hitRate(),
      combo: state.combo,
      bestCombo: state.bestCombo,
      hearts: state.hearts,
      missionClear: state.missionClear,
      decoyTotal: state.decoyTotal,
      groupHits: copy(state.groupHits),
      rank: rankName()
    };
  }

  function getPublicState() {
    return {
      version: GROUPS_CORE_VERSION,
      core: 'food-to-gate-sorting',
      mode: state.mode,
      config: {
        mode: config.mode,
        diff: config.diff,
        durationSec: config.durationSec,
        seed: config.seed
      },
      remainingSec: getRemainingSec(),
      elapsedSec: getElapsedSec(),
      current: state.current ? copy(state.current) : null,
      itemIndex: state.itemIndex,
      itemProgress: getItemProgress(),
      itemDeadline: state.itemDeadline,
      itemDurationMs: state.itemDurationMs,
      score: state.score,
      correct: state.correct,
      miss: state.miss,
      skippedDecoy: state.skippedDecoy,
      accuracy: accuracy(),
      hitRate: hitRate(),
      combo: state.combo,
      bestCombo: state.bestCombo,
      hearts: state.hearts,
      shield: state.shield,
      slowUntil: state.slowUntil,
      boostUntil: state.boostUntil,
      mission: state.mission ? copy(state.mission) : null,
      missionClear: state.missionClear,
      decoyTotal: state.decoyTotal,
      decoyCooldown: state.decoyCooldown,
      decoyHardCooldown: state.decoyHardCooldown,
      groupHits: copy(state.groupHits),
      rank: rankName()
    };
  }

  function destroy() {
    listeners.clear();
    state.mode = 'destroyed';
    emit('core:destroy', {});
  }

  return {
    version: GROUPS_CORE_VERSION,

    groups: FOOD_GROUPS,
    decoys: DECOYS,
    powers: POWERS,

    start,
    stop,
    tick,
    spawnItem,

    judgeGate,
    collectPower,
    passDecoy,
    timeoutCurrent,

    newMission,
    getState: getPublicState,
    getSummary,
    subscribe,
    destroy
  };
}

export default createGroupsCore;
