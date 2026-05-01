// === /herohealth/vr-goodjunk/goodjunk-battle-room.js ===
// FULL PATCH v20260430e-GJ-BATTLE-ROOM-ATTACK-FIREBASE-ADAPTER
// ✅ Battle 1v1 room guard
// ✅ Firebase shared adapter priority
// ✅ Local room adapter fallback
// ✅ Stable player list
// ✅ Battle attack queue
// ✅ Shield block
// ✅ Player score/combo/hp/attackMeter sync
// ✅ Soft child-friendly attacks: junkStorm / slowTrap / confuseSwap

const STORAGE = {
  localRoomPrefix: 'GJ_ROOM_LOCAL:',
  recentRoomPrefix: 'GJ_RECENT_ROOM:'
};

const BATTLE_REQUIRED_PLAYERS = 2;
const BATTLE_MAX_PLAYERS = 2;

const BATTLE_ATTACK_TYPES = {
  junkStorm: {
    id: 'junkStorm',
    emoji: '🌪️',
    label: 'Junk Storm',
    labelTh: 'พายุ Junk',
    durationMs: 5000,
    cost: 3,
    power: 1,
    description: 'ส่ง Junk เพิ่มไปกวนคู่แข่งชั่วคราว'
  },
  slowTrap: {
    id: 'slowTrap',
    emoji: '🐌',
    label: 'Slow Trap',
    labelTh: 'กับดักช้า',
    durationMs: 4500,
    cost: 3,
    power: 1,
    description: 'ทำให้จังหวะฝั่งคู่แข่งช้าหรือหน่วงขึ้นเล็กน้อย'
  },
  confuseSwap: {
    id: 'confuseSwap',
    emoji: '🌀',
    label: 'Confuse Swap',
    labelTh: 'สลับชวนงง',
    durationMs: 4200,
    cost: 3,
    power: 1,
    description: 'ทำให้คู่แข่งต้องดู Good/Junk ให้ตั้งใจขึ้น'
  }
};

function clean(v, d = '') {
  const s = String(v ?? '').trim();
  return s || d;
}

function clamp(n, min, max) {
  n = Number(n) || 0;
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}

function storageGet(key, fallback = '') {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (_) {}
}

function localRoomKey(roomId) {
  return `${STORAGE.localRoomPrefix}${roomId}`;
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch (_) {
    return '';
  }
}

function nowMs() {
  return Date.now();
}

function makeId(prefix = 'id') {
  const r = Math.random().toString(36).slice(2, 8);
  const t = String(Date.now()).slice(-6);
  return `${prefix}-${r}-${t}`;
}

function normalizeAttackType(type) {
  const t = clean(type, 'junkStorm');
  return BATTLE_ATTACK_TYPES[t] ? t : 'junkStorm';
}

function createBattlePlayer(pid, payload = {}, fallbackRole = 'player') {
  const safePid = clean(payload.pid || pid, pid || 'anon');
  const safeName = clean(payload.name || payload.nick || safePid, 'Player');
  const now = nowMs();

  return {
    pid: safePid,
    name: safeName,
    nick: clean(payload.nick || payload.name || safeName, safeName),
    role: clean(payload.role, fallbackRole),
    joinedAt: Number(payload.joinedAt || 0) || now,
    ready: payload.ready === true,

    score: Number(payload.score || 0) || 0,
    combo: Number(payload.combo || 0) || 0,
    hp: clamp(payload.hp ?? 3, 0, 3),
    shield: clamp(payload.shield ?? 0, 0, 1),
    attackMeter: clamp(payload.attackMeter ?? 0, 0, 3),

    goodHits: Number(payload.goodHits || 0) || 0,
    junkHits: Number(payload.junkHits || 0) || 0,
    attacksSent: Number(payload.attacksSent || 0) || 0,
    attacksBlocked: Number(payload.attacksBlocked || 0) || 0,
    attacksReceived: Number(payload.attacksReceived || 0) || 0,

    online: payload.online !== false,
    lastSeenAt: Number(payload.lastSeenAt || 0) || now,
    updatedAt: Number(payload.updatedAt || 0) || now
  };
}

function normalizeAttacks(room) {
  const attacks = Array.isArray(room?.attacks) ? room.attacks : [];

  return attacks
    .filter(Boolean)
    .map((a) => ({
      id: clean(a.id, makeId('atk')),
      fromPid: clean(a.fromPid, ''),
      toPid: clean(a.toPid, ''),
      type: normalizeAttackType(a.type),
      power: Number(a.power || 1) || 1,
      durationMs: Number(a.durationMs || BATTLE_ATTACK_TYPES[normalizeAttackType(a.type)].durationMs) || 4000,
      createdAt: Number(a.createdAt || 0) || nowMs(),
      appliedAt: Number(a.appliedAt || 0) || 0,
      blockedAt: Number(a.blockedAt || 0) || 0,
      consumedAt: Number(a.consumedAt || 0) || 0,
      status: clean(a.status, 'pending')
    }))
    .slice(-30);
}

function normalizeEffects(room) {
  const effects = Array.isArray(room?.effects) ? room.effects : [];

  return effects
    .filter(Boolean)
    .map((e) => ({
      id: clean(e.id, makeId('fx')),
      pid: clean(e.pid, ''),
      type: normalizeAttackType(e.type),
      fromPid: clean(e.fromPid, ''),
      power: Number(e.power || 1) || 1,
      startedAt: Number(e.startedAt || 0) || nowMs(),
      expiresAt: Number(e.expiresAt || 0) || nowMs(),
      sourceAttackId: clean(e.sourceAttackId, '')
    }))
    .filter((e) => e.expiresAt > nowMs())
    .slice(-20);
}

function normalizeRoom(roomId, room) {
  if (!room || typeof room !== 'object') return null;

  const playersObj = room.players && typeof room.players === 'object' ? room.players : {};
  const players = {};

  Object.entries(playersObj).forEach(([pid, p]) => {
    if (!p || typeof p !== 'object') return;
    players[pid] = createBattlePlayer(pid, p, p.role || 'player');
  });

  return {
    roomId: clean(room.roomId || roomId, roomId),
    mode: clean(room.mode, 'battle'),
    status: clean(room.status, 'waiting'),
    hostPid: clean(room.hostPid, ''),
    createdAt: Number(room.createdAt || 0) || nowMs(),
    updatedAt: Number(room.updatedAt || 0) || nowMs(),
    startedAt: Number(room.startedAt || 0) || 0,
    players,
    attacks: normalizeAttacks(room),
    effects: normalizeEffects(room),
    lastAttackAt: Number(room.lastAttackAt || 0) || 0
  };
}

function makeEmptyRoom(roomId) {
  const now = nowMs();

  return {
    roomId,
    mode: 'battle',
    status: 'waiting',
    hostPid: '',
    createdAt: now,
    updatedAt: now,
    startedAt: 0,
    players: {},
    attacks: [],
    effects: [],
    lastAttackAt: 0
  };
}

function makeLocalRoomAdapter() {
  function loadRoom(roomId) {
    const raw = storageGet(localRoomKey(roomId), '');
    const parsed = safeJsonParse(raw, null);
    return normalizeRoom(roomId, parsed);
  }

  function saveRoom(roomId, payload) {
    const next = normalizeRoom(roomId, payload) || makeEmptyRoom(roomId);
    next.updatedAt = nowMs();
    storageSet(localRoomKey(roomId), JSON.stringify(next));
    return next;
  }

  function patchRoom(roomId, patch) {
    const prev = loadRoom(roomId) || makeEmptyRoom(roomId);

    const merged = {
      ...prev,
      ...patch,
      players:
        patch?.players && typeof patch.players === 'object'
          ? { ...prev.players, ...patch.players }
          : prev.players,
      attacks:
        Array.isArray(patch?.attacks)
          ? patch.attacks
          : prev.attacks,
      effects:
        Array.isArray(patch?.effects)
          ? patch.effects
          : prev.effects
    };

    return saveRoom(roomId, merged);
  }

  function subscribeRoom(roomId, callback) {
    const emit = () => {
      try {
        callback(loadRoom(roomId));
      } catch (_) {}
    };

    const onStorage = (ev) => {
      if (!ev || ev.key === localRoomKey(roomId)) emit();
    };

    window.addEventListener('storage', onStorage);

    const timer = setInterval(emit, 650);
    emit();

    return () => {
      try {
        window.removeEventListener('storage', onStorage);
      } catch (_) {}
      try {
        clearInterval(timer);
      } catch (_) {}
    };
  }

  return {
    type: 'local-room-adapter',
    loadRoom,
    saveRoom,
    patchRoom,
    subscribeRoom
  };
}

export function makeRoomAdapter() {
  const g = window;

  if (
    g.HHA_BATTLE_ROOM_ADAPTER &&
    typeof g.HHA_BATTLE_ROOM_ADAPTER.loadRoom === 'function' &&
    typeof g.HHA_BATTLE_ROOM_ADAPTER.saveRoom === 'function' &&
    typeof g.HHA_BATTLE_ROOM_ADAPTER.patchRoom === 'function' &&
    typeof g.HHA_BATTLE_ROOM_ADAPTER.subscribeRoom === 'function'
  ) {
    return g.HHA_BATTLE_ROOM_ADAPTER;
  }

  if (
    g.GJRoomAPI &&
    typeof g.GJRoomAPI.loadRoom === 'function' &&
    typeof g.GJRoomAPI.saveRoom === 'function' &&
    typeof g.GJRoomAPI.patchRoom === 'function' &&
    typeof g.GJRoomAPI.subscribeRoom === 'function'
  ) {
    return g.GJRoomAPI;
  }

  if (
    g.HHRoomAPI &&
    typeof g.HHRoomAPI.loadRoom === 'function' &&
    typeof g.HHRoomAPI.saveRoom === 'function' &&
    typeof g.HHRoomAPI.patchRoom === 'function' &&
    typeof g.HHRoomAPI.subscribeRoom === 'function'
  ) {
    return g.HHRoomAPI;
  }

  return makeLocalRoomAdapter();
}

export function getBattleAttackTypes() {
  return JSON.parse(JSON.stringify(BATTLE_ATTACK_TYPES));
}

export function getPlayers(room) {
  const players = room?.players || {};
  return Object.values(players)
    .filter(Boolean)
    .filter((p) => p.online !== false)
    .sort((a, b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0));
}

export function getPlayerCount(room) {
  return getPlayers(room).length;
}

export function getPlayerByPid(room, pid = '') {
  const players = room?.players || {};
  return players?.[pid] || null;
}

export function getBattleMaxPlayers() {
  return BATTLE_MAX_PLAYERS;
}

export function getBattleOpponent(room, pid = '') {
  const safePid = clean(pid, '');
  return getPlayers(room).find((p) => p.pid !== safePid) || null;
}

export function saveRecentRoom(mode = 'battle', roomId = '') {
  if (!mode || !roomId) return;
  storageSet(`${STORAGE.recentRoomPrefix}${mode}`, roomId);
}

export function loadRecentRoom(mode = 'battle') {
  return storageGet(`${STORAGE.recentRoomPrefix}${mode}`, '');
}

export function buildBattleEngineQuery(ctx = {}, extra = {}) {
  const payload = {
    mode: 'battle',
    entry: 'battle',
    recommendedMode: 'battle',
    multiplayer: '1',
    modeLocked: '1',
    fromLobby: '1',
    lobby: '1',

    room: clean(ctx.room, ''),
    pid: clean(ctx.pid, 'anon'),
    name: clean(ctx.name || ctx.nick, 'Hero'),
    nick: clean(ctx.nick || ctx.name, 'Hero'),
    diff: clean(ctx.diff, 'normal'),
    time: clean(ctx.time, '150'),
    view: clean(ctx.view, 'mobile'),
    hub: clean(ctx.hub, './hub-v2.html'),
    run: clean(ctx.run, 'play'),
    seed: clean(ctx.seed, String(Date.now())),
    zone: clean(ctx.zone, 'nutrition'),
    cat: clean(ctx.cat, 'nutrition'),
    game: clean(ctx.game, 'goodjunk'),
    gameId: clean(ctx.gameId, 'goodjunk'),
    theme: clean(ctx.theme, 'goodjunk'),
    studyId: clean(ctx.studyId, ''),
    conditionGroup: clean(ctx.conditionGroup, ''),
    role: clean(ctx.role, 'player'),
    maxPlayers: 2,
    ...extra
  };

  const q = new URLSearchParams();
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== '' && v != null) q.set(k, String(v));
  });

  return q;
}

export function classifyBattleRoom(ctx = {}, room = null) {
  const pid = clean(ctx.pid, 'anon');
  const mode = clean(ctx.mode, 'solo');
  const roomId = clean(ctx.room, '');

  if (mode !== 'battle') {
    return {
      ok: false,
      code: 'MODE_NOT_BATTLE',
      title: 'โหมดไม่ถูกต้อง',
      message: 'หน้านี้ใช้สำหรับ battle เท่านั้น',
      room
    };
  }

  if (!roomId) {
    return {
      ok: false,
      code: 'ROOM_MISSING',
      title: 'ไม่พบ Room Code',
      message: 'ต้องมี room ก่อนเข้าเล่นโหมด battle',
      room
    };
  }

  if (!room) {
    return {
      ok: false,
      code: 'ROOM_NOT_FOUND',
      title: 'ยังไม่พบห้อง',
      message: 'ไม่พบข้อมูลห้องนี้ หรือ backend ยังซิงก์ไม่เสร็จ',
      room: null
    };
  }

  if (clean(room.mode, '') !== 'battle') {
    return {
      ok: false,
      code: 'ROOM_MODE_MISMATCH',
      title: 'ห้องนี้ไม่ใช่ battle',
      message: 'room นี้ถูกสร้างด้วยโหมดอื่น',
      room
    };
  }

  const me = getPlayerByPid(room, pid);
  if (!me) {
    return {
      ok: false,
      code: 'PLAYER_NOT_IN_ROOM',
      title: 'ผู้เล่นนี้ไม่ได้อยู่ในห้อง',
      message: 'กรุณากลับไป lobby แล้วเข้าห้องด้วย PID เดิม',
      room
    };
  }

  const count = getPlayerCount(room);

  if (count < BATTLE_REQUIRED_PLAYERS) {
    return {
      ok: false,
      code: 'WAITING_PLAYER',
      title: 'รอผู้เล่นอีก 1 คน',
      message: `ตอนนี้มี ${count}/2 คน`,
      room
    };
  }

  if (count > BATTLE_MAX_PLAYERS) {
    return {
      ok: false,
      code: 'ROOM_OVERFLOW',
      title: 'จำนวนผู้เล่นเกิน',
      message: `ห้อง battle ต้องมีแค่ 2 คน แต่ตอนนี้มี ${count} คน`,
      room
    };
  }

  if (clean(room.status, 'waiting') !== 'started') {
    return {
      ok: false,
      code: 'WAITING_START',
      title: 'รอเริ่มเกม',
      message: 'ครบ 2/2 แล้ว แต่ห้องยังไม่ถูกสั่งเริ่ม',
      room
    };
  }

  return {
    ok: true,
    code: 'READY',
    title: 'ห้องพร้อมแล้ว',
    message: 'ตรวจสอบผ่านทั้งหมด',
    room,
    me,
    role: clean(me.role, 'player'),
    playerCount: count,
    maxPlayers: 2,
    checkedAt: nowIso()
  };
}

export async function ensureBattleSession(ctx = {}, options = {}) {
  const adapter = options.adapter || makeRoomAdapter();
  const roomId = clean(ctx.room, '');

  if (!roomId) {
    const err = new Error('BATTLE_ROOM_MISSING');
    err.code = 'BATTLE_ROOM_MISSING';
    err.title = 'ไม่พบ Room Code';
    err.messageUser = 'ต้องมี room ก่อนเข้าเล่นโหมด battle';
    throw err;
  }

  saveRecentRoom('battle', roomId);

  const room = await adapter.loadRoom(roomId);
  const result = classifyBattleRoom(ctx, room);

  if (!result.ok) {
    const err = new Error(result.code);
    err.code = result.code;
    err.title = result.title;
    err.messageUser = result.message;
    err.room = room;
    throw err;
  }

  return result;
}

export function watchBattleSession(ctx = {}, callback, options = {}) {
  const adapter = options.adapter || makeRoomAdapter();
  const roomId = clean(ctx.room, '');

  if (!roomId || typeof callback !== 'function') {
    return () => {};
  }

  return adapter.subscribeRoom(roomId, (room) => {
    callback(classifyBattleRoom(ctx, room));
  });
}

export async function updateBattlePlayerStats(ctx = {}, patch = {}, options = {}) {
  const adapter = options.adapter || makeRoomAdapter();
  const roomId = clean(ctx.room, '');

  if (!roomId) return null;

  const pid = clean(ctx.pid, 'anon');
  const room = await adapter.loadRoom(roomId);
  if (!room || !room.players || !room.players[pid]) return null;

  const player = createBattlePlayer(pid, room.players[pid]);

  const nextPlayer = {
    ...player,
    score: Number(patch.score ?? player.score) || 0,
    combo: Number(patch.combo ?? player.combo) || 0,
    hp: clamp(patch.hp ?? player.hp, 0, 3),
    shield: clamp(patch.shield ?? player.shield, 0, 1),
    attackMeter: clamp(patch.attackMeter ?? player.attackMeter, 0, 3),
    goodHits: Number(patch.goodHits ?? player.goodHits) || 0,
    junkHits: Number(patch.junkHits ?? player.junkHits) || 0,
    attacksSent: Number(patch.attacksSent ?? player.attacksSent) || 0,
    attacksBlocked: Number(patch.attacksBlocked ?? player.attacksBlocked) || 0,
    attacksReceived: Number(patch.attacksReceived ?? player.attacksReceived) || 0,
    online: true,
    lastSeenAt: nowMs(),
    updatedAt: nowMs()
  };

  const players = {
    [pid]: nextPlayer
  };

  return await adapter.patchRoom(roomId, {
    ...room,
    players,
    updatedAt: nowMs()
  });
}

export async function addBattleShield(ctx = {}, options = {}) {
  const adapter = options.adapter || makeRoomAdapter();
  const roomId = clean(ctx.room, '');
  const pid = clean(ctx.pid, 'anon');

  if (!roomId) return null;

  const room = await adapter.loadRoom(roomId);
  if (!room || !room.players || !room.players[pid]) return null;

  const player = createBattlePlayer(pid, room.players[pid]);
  player.shield = 1;
  player.online = true;
  player.updatedAt = nowMs();
  player.lastSeenAt = nowMs();

  const players = {
    [pid]: player
  };

  return await adapter.patchRoom(roomId, {
    ...room,
    players,
    updatedAt: nowMs()
  });
}

export async function sendBattleAttack(ctx = {}, attackType = 'junkStorm', options = {}) {
  const adapter = options.adapter || makeRoomAdapter();
  const roomId = clean(ctx.room, '');
  const fromPid = clean(ctx.pid, 'anon');

  if (!roomId) {
    return {
      ok: false,
      code: 'ROOM_MISSING',
      message: 'ไม่พบ Room Code'
    };
  }

  const room = await adapter.loadRoom(roomId);
  const session = classifyBattleRoom({ ...ctx, mode: 'battle' }, room);

  if (!session.ok) {
    return {
      ok: false,
      code: session.code,
      message: session.message,
      room
    };
  }

  const fromPlayer = getPlayerByPid(room, fromPid);
  const opponent = getBattleOpponent(room, fromPid);

  if (!fromPlayer || !opponent) {
    return {
      ok: false,
      code: 'OPPONENT_MISSING',
      message: 'ยังไม่พบคู่แข่ง'
    };
  }

  const type = normalizeAttackType(attackType);
  const meta = BATTLE_ATTACK_TYPES[type];
  const cost = Number(options.cost ?? meta.cost ?? 3) || 3;

  const from = createBattlePlayer(fromPid, fromPlayer);
  if (from.attackMeter < cost) {
    return {
      ok: false,
      code: 'METER_NOT_READY',
      message: `พลังโจมตียังไม่พอ ต้องมี ${cost}/3`,
      room
    };
  }

  const to = createBattlePlayer(opponent.pid, opponent);

  const attack = {
    id: makeId('atk'),
    fromPid,
    toPid: opponent.pid,
    type,
    power: Number(options.power ?? meta.power ?? 1) || 1,
    durationMs: Number(options.durationMs ?? meta.durationMs ?? 4500) || 4500,
    createdAt: nowMs(),
    appliedAt: 0,
    blockedAt: 0,
    consumedAt: 0,
    status: 'pending'
  };

  from.attackMeter = clamp(from.attackMeter - cost, 0, 3);
  from.attacksSent += 1;
  from.online = true;
  from.updatedAt = nowMs();
  from.lastSeenAt = nowMs();

  const attacks = normalizeAttacks(room);
  attacks.push(attack);

  const players = {
    [fromPid]: from,
    [opponent.pid]: to
  };

  const saved = await adapter.patchRoom(roomId, {
    ...room,
    players,
    attacks,
    lastAttackAt: nowMs(),
    updatedAt: nowMs()
  });

  return {
    ok: true,
    code: 'ATTACK_SENT',
    attack,
    type,
    meta,
    fromPid,
    toPid: opponent.pid,
    room: saved
  };
}

export async function consumeBattleAttacksForPlayer(ctx = {}, options = {}) {
  const adapter = options.adapter || makeRoomAdapter();
  const roomId = clean(ctx.room, '');
  const pid = clean(ctx.pid, 'anon');

  if (!roomId) {
    return {
      ok: false,
      code: 'ROOM_MISSING',
      attacks: [],
      blocked: [],
      effects: [],
      room: null
    };
  }

  const room = await adapter.loadRoom(roomId);

  if (!room || !room.players || !room.players[pid]) {
    return {
      ok: false,
      code: 'PLAYER_NOT_FOUND',
      attacks: [],
      blocked: [],
      effects: [],
      room
    };
  }

  const player = createBattlePlayer(pid, room.players[pid]);
  const now = nowMs();

  const attacks = normalizeAttacks(room);
  const effects = normalizeEffects(room);
  const applied = [];
  const blocked = [];

  const nextAttacks = attacks.map((attack) => {
    if (
      attack.toPid !== pid ||
      attack.status !== 'pending' ||
      attack.consumedAt ||
      attack.blockedAt
    ) {
      return attack;
    }

    if (player.shield > 0) {
      player.shield = 0;
      player.attacksBlocked += 1;

      blocked.push({
        ...attack,
        status: 'blocked',
        blockedAt: now,
        consumedAt: now
      });

      return {
        ...attack,
        status: 'blocked',
        blockedAt: now,
        consumedAt: now
      };
    }

    const fx = {
      id: makeId('fx'),
      pid,
      type: attack.type,
      fromPid: attack.fromPid,
      power: attack.power,
      startedAt: now,
      expiresAt: now + Number(attack.durationMs || 4500),
      sourceAttackId: attack.id
    };

    effects.push(fx);
    applied.push({
      ...attack,
      status: 'applied',
      appliedAt: now,
      consumedAt: now
    });

    player.attacksReceived += 1;
    player.online = true;
    player.updatedAt = now;
    player.lastSeenAt = now;

    return {
      ...attack,
      status: 'applied',
      appliedAt: now,
      consumedAt: now
    };
  });

  const players = {
    [pid]: player
  };

  const saved = await adapter.patchRoom(roomId, {
    ...room,
    players,
    attacks: nextAttacks.slice(-30),
    effects: effects.filter((e) => e.expiresAt > now).slice(-20),
    updatedAt: now
  });

  return {
    ok: true,
    code: 'ATTACKS_CONSUMED',
    attacks: applied,
    blocked,
    effects: effects.filter((e) => e.pid === pid && e.expiresAt > now),
    room: saved
  };
}

export async function clearExpiredBattleEffects(ctx = {}, options = {}) {
  const adapter = options.adapter || makeRoomAdapter();
  const roomId = clean(ctx.room, '');

  if (!roomId) return null;

  const room = await adapter.loadRoom(roomId);
  if (!room) return null;

  const now = nowMs();
  const effects = normalizeEffects(room).filter((e) => e.expiresAt > now);

  return await adapter.patchRoom(roomId, {
    ...room,
    effects,
    updatedAt: now
  });
}