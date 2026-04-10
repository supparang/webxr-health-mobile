// === /herohealth/vr-goodjunk/goodjunk-battle-room.js ===
// FULL PATCH v20260410b-GJ-BATTLE-ROOM-GUARD-1V1

const STORAGE = {
  localRoomPrefix: 'GJ_ROOM_LOCAL:',
  recentRoomPrefix: 'GJ_RECENT_ROOM:'
};

const BATTLE_REQUIRED_PLAYERS = 2;
const BATTLE_MAX_PLAYERS = 2;

function clean(v, d=''){
  const s = String(v ?? '').trim();
  return s || d;
}

function storageGet(key, fallback=''){
  try{
    const v = localStorage.getItem(key);
    return v == null ? fallback : v;
  }catch(_){
    return fallback;
  }
}

function storageSet(key, value){
  try{
    localStorage.setItem(key, String(value));
  }catch(_){}
}

function safeJsonParse(text, fallback=null){
  try { return JSON.parse(text); }
  catch (_) { return fallback; }
}

function localRoomKey(roomId){
  return `${STORAGE.localRoomPrefix}${roomId}`;
}

function makeLocalRoomAdapter(){
  function loadRoom(roomId){
    const raw = storageGet(localRoomKey(roomId), '');
    return safeJsonParse(raw, null);
  }

  function saveRoom(roomId, payload){
    storageSet(localRoomKey(roomId), JSON.stringify(payload));
    return payload;
  }

  function patchRoom(roomId, patch){
    const prev = loadRoom(roomId) || {};
    const next = { ...prev, ...patch };
    storageSet(localRoomKey(roomId), JSON.stringify(next));
    return next;
  }

  function subscribeRoom(roomId, callback){
    const onStorage = () => callback(loadRoom(roomId));
    window.addEventListener('storage', onStorage);

    const timer = setInterval(() => {
      callback(loadRoom(roomId));
    }, 800);

    callback(loadRoom(roomId));

    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(timer);
    };
  }

  return {
    loadRoom,
    saveRoom,
    patchRoom,
    subscribeRoom
  };
}

export function makeRoomAdapter(){
  const g = window;

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

export function getPlayers(room){
  const players = room?.players || {};
  return Object.values(players).filter(Boolean);
}

export function getPlayerCount(room){
  return getPlayers(room).length;
}

export function getPlayerByPid(room, pid=''){
  const players = room?.players || {};
  return players?.[pid] || null;
}

export function saveRecentRoom(mode='battle', roomId=''){
  if (!mode || !roomId) return;
  storageSet(`${STORAGE.recentRoomPrefix}${mode}`, roomId);
}

export function loadRecentRoom(mode='battle'){
  return storageGet(`${STORAGE.recentRoomPrefix}${mode}`, '');
}

export function getBattleMaxPlayers(){
  return BATTLE_MAX_PLAYERS;
}

export function classifyBattleRoom(ctx = {}, room = null){
  const pid = clean(ctx.pid, 'anon');
  const mode = clean(ctx.mode, 'solo');
  const roomId = clean(ctx.room, '');

  if (mode !== 'battle') {
    return {
      ok: false,
      code: 'MODE_NOT_BATTLE',
      title: 'โหมดไม่ถูกต้อง',
      message: 'หน้านี้ใช้สำหรับ battle เท่านั้น'
    };
  }

  if (!roomId) {
    return {
      ok: false,
      code: 'ROOM_MISSING',
      title: 'ไม่พบ Room Code',
      message: 'ต้องมี room ก่อนเข้าเล่นโหมด battle'
    };
  }

  if (!room) {
    return {
      ok: false,
      code: 'ROOM_NOT_FOUND',
      title: 'ยังไม่พบห้อง',
      message: 'ไม่พบข้อมูลห้องนี้ หรือ backend ยังซิงก์ไม่เสร็จ'
    };
  }

  if (clean(room.mode, '') !== 'battle') {
    return {
      ok: false,
      code: 'ROOM_MODE_MISMATCH',
      title: 'ห้องนี้ไม่ใช่ battle',
      message: 'room นี้ถูกสร้างด้วยโหมดอื่น'
    };
  }

  const me = getPlayerByPid(room, pid);
  if (!me) {
    return {
      ok: false,
      code: 'PLAYER_NOT_IN_ROOM',
      title: 'ผู้เล่นนี้ไม่ได้อยู่ในห้อง',
      message: 'กรุณากลับไป lobby แล้วเข้าห้องด้วย PID เดิม'
    };
  }

  const count = getPlayerCount(room);

  if (count < BATTLE_REQUIRED_PLAYERS) {
    return {
      ok: false,
      code: 'WAITING_PLAYER',
      title: 'รอผู้เล่นอีก 1 คน',
      message: `ตอนนี้มี ${count}/2 คน`
    };
  }

  if (count > BATTLE_MAX_PLAYERS) {
    return {
      ok: false,
      code: 'ROOM_OVERFLOW',
      title: 'จำนวนผู้เล่นเกิน',
      message: `ห้อง battle ต้องมีแค่ 2 คน แต่ตอนนี้มี ${count} คน`
    };
  }

  if (clean(room.status, 'waiting') !== 'started') {
    return {
      ok: false,
      code: 'WAITING_START',
      title: 'รอ Host กดเริ่มเกม',
      message: `ครบ 2/2 แล้ว แต่ห้องยังไม่ถูกสั่งเริ่ม`
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
    maxPlayers: 2
  };
}

export async function ensureBattleSession(ctx = {}, options = {}){
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

export function watchBattleSession(ctx = {}, callback, options = {}){
  const adapter = options.adapter || makeRoomAdapter();
  const roomId = clean(ctx.room, '');

  if (!roomId || typeof callback !== 'function') {
    return () => {};
  }

  return adapter.subscribeRoom(roomId, (room) => {
    callback(classifyBattleRoom(ctx, room));
  });
}

export function buildBattleEngineQuery(ctx = {}, extra = {}){
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
    time: clean(ctx.time, '90'),
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