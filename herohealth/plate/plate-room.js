// === /herohealth/plate/plate-room.js ===
// FULL PATCH v20260326-PLATE-MP-ROOM-FULL
// Shared room + action engine for duet / race / battle / coop (Firebase RTDB)

const ROOT = 'hha-plate/rooms';
const ACTION_ROOT = 'hha-plate/actions';

function now() {
  return Date.now();
}

function clean(v) {
  return String(v ?? '').trim();
}

export function normalizePid(rawPid) {
  const v = clean(rawPid).replace(/[.#$[\]/]/g, '_');
  return v || makePid();
}

export function makePid() {
  try {
    const KEY = 'PLATE_DEVICE_PID';
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = `p-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, v);
    }
    return normalizePid(v);
  } catch {
    return `p-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function makeRoomId(prefix = 'PLT') {
  const s = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${s}`;
}

function getFirebaseConfig() {
  return (
    window.HHA_FIREBASE_CONFIG ||
    window.__HHA_FIREBASE_CONFIG__ ||
    window.firebaseConfig ||
    null
  );
}

function ensureFirebaseDb() {
  if (!window.firebase) {
    throw new Error('firebase-sdk-not-loaded');
  }

  const apps = window.firebase.apps || [];
  if (!apps.length) {
    const cfg = getFirebaseConfig();
    if (!cfg) throw new Error('firebase-config-not-found');
    window.firebase.initializeApp(cfg);
  }

  if (typeof window.firebase.database !== 'function') {
    throw new Error('firebase-database-not-loaded');
  }

  return window.firebase.database();
}

function roomRef(roomId) {
  return ensureFirebaseDb().ref(`${ROOT}/${roomId}`);
}

function playerRef(roomId, pid) {
  return ensureFirebaseDb().ref(`${ROOT}/${roomId}/players/${pid}`);
}

function actionRoomRef(roomId) {
  return ensureFirebaseDb().ref(`${ACTION_ROOT}/${roomId}`);
}

function playersObj(room) {
  return room?.players || {};
}

function playersArray(room) {
  return Object.values(playersObj(room)).filter(Boolean);
}

function pickOpenRole(room, mode) {
  if (mode !== 'duet' && mode !== 'battle') return '';
  const roles = new Set(
    playersArray(room)
      .filter(p => p.online !== false)
      .map(p => String(p.role || '').toUpperCase())
      .filter(Boolean)
  );
  if (!roles.has('A')) return 'A';
  if (!roles.has('B')) return 'B';
  return '';
}

export function readCtx(overrides = {}) {
  const sp = new URLSearchParams(location.search);

  const ctx = {
    mode: clean(overrides.mode || sp.get('mode') || 'duet').toLowerCase(),
    pid: normalizePid(overrides.pid || sp.get('pid') || makePid()),
    roomId: clean(overrides.roomId || sp.get('roomId') || '').toUpperCase(),
    role: clean(overrides.role || sp.get('role') || '').toUpperCase(),
    name: clean(overrides.name || sp.get('name') || ''),
    view: clean(overrides.view || sp.get('view') || 'mobile'),
    run: clean(overrides.run || sp.get('run') || 'play'),
    diff: clean(overrides.diff || sp.get('diff') || 'normal'),
    time: Number(overrides.time || sp.get('time') || 90),
    seed: clean(overrides.seed || sp.get('seed') || String(Date.now())),
    game: clean(overrides.game || sp.get('game') || 'platev1'),
    theme: clean(overrides.theme || sp.get('theme') || 'platev1'),
    zone: clean(overrides.zone || sp.get('zone') || 'nutrition'),
    hub: clean(
      overrides.hub ||
      sp.get('hub') ||
      'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html'
    ),
    cooldown: clean(overrides.cooldown || sp.get('cooldown') || '1')
  };

  if (!ctx.roomId) ctx.roomId = makeRoomId('PLT');
  if (!ctx.pid) ctx.pid = makePid();
  if (!ctx.seed) ctx.seed = String(Date.now());
  if (!Number.isFinite(ctx.time) || ctx.time <= 0) ctx.time = 90;

  return ctx;
}

function makeRoomMeta(ctx) {
  return {
    roomId: ctx.roomId,
    mode: ctx.mode,
    game: ctx.game,
    theme: ctx.theme,
    zone: ctx.zone,
    diff: ctx.diff,
    time: Number(ctx.time) || 90,
    seed: String(ctx.seed || ''),
    run: ctx.run || 'play',
    state: 'lobby',
    hostPid: ctx.pid,
    createdAt: now(),
    updatedAt: now()
  };
}

async function readRoom(roomId) {
  const snap = await roomRef(roomId).once('value');
  return snap.val() || null;
}

export async function createOrJoinRoom(input = {}) {
  const ctx = readCtx(input);
  let room = await readRoom(ctx.roomId);

  if (!room) {
    await roomRef(ctx.roomId).set({
      meta: makeRoomMeta(ctx),
      players: {}
    });
    room = await readRoom(ctx.roomId);
  }

  let role = ctx.role || pickOpenRole(room, ctx.mode);

  const existed = room?.players?.[ctx.pid] || null;

  await playerRef(ctx.roomId, ctx.pid).update({
    pid: ctx.pid,
    name: ctx.name || ctx.pid,
    role,
    ready: false,
    online: true,
    joinedAt: existed?.joinedAt || now(),
    updatedAt: now(),
    score: existed?.score || 0,
    finished: false,
    finishedAt: existed?.finishedAt || 0,
    contribution: existed?.contribution || 0,
    hp: Number.isFinite(existed?.hp) ? existed.hp : 100,
    finalScore: Number.isFinite(existed?.finalScore) ? existed.finalScore : 0,
    result: existed?.result || '',
    view: ctx.view || 'mobile'
  });

  await roomRef(ctx.roomId).child('meta').update({
    updatedAt: now()
  });

  try {
    playerRef(ctx.roomId, ctx.pid).child('online').onDisconnect().set(false);
  } catch {}

  ctx.role = role;

  return { ctx, roomId: ctx.roomId };
}

export function subscribeRoom(roomId, onChange) {
  const ref = roomRef(roomId);
  const handler = snap => onChange(snap.val() || null);
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

export function canStart(room) {
  const mode = String(room?.meta?.mode || '').toLowerCase();
  const ps = playersArray(room).filter(p => p.online !== false);

  if (mode === 'duet' || mode === 'battle') {
    const A = ps.find(p => String(p.role || '').toUpperCase() === 'A');
    const B = ps.find(p => String(p.role || '').toUpperCase() === 'B');
    return !!(A && B && A.ready && B.ready);
  }

  if (mode === 'race' || mode === 'coop') {
    return ps.length >= 2 && ps.every(p => !!p.ready);
  }

  return false;
}

export async function setReady(roomId, pid, ready) {
  await playerRef(roomId, pid).update({
    ready: !!ready,
    updatedAt: now()
  });
  await roomRef(roomId).child('meta').update({ updatedAt: now() });
}

export async function startRoom(roomId, pid) {
  const snap = await roomRef(roomId).once('value');
  const room = snap.val() || {};
  if (room?.meta?.hostPid && room.meta.hostPid !== pid) {
    throw new Error('only-host-can-start');
  }
  if (!canStart(room)) {
    throw new Error('room-not-ready');
  }

  await roomRef(roomId).child('meta').update({
    state: 'playing',
    startedAt: now(),
    updatedAt: now()
  });
}

export async function finishRoom(roomId, patch = {}) {
  await roomRef(roomId).child('meta').update({
    state: 'finished',
    finishedAt: now(),
    updatedAt: now(),
    ...patch
  });
}

export async function leaveRoom(roomId, pid) {
  await playerRef(roomId, pid).update({
    online: false,
    ready: false,
    updatedAt: now()
  });
}

export async function updatePlayer(roomId, pid, patch = {}) {
  await playerRef(roomId, pid).update({
    ...patch,
    updatedAt: now()
  });
}

export function roomPlayers(room) {
  return playersArray(room);
}

export function roomSlots(room) {
  const ps = playersArray(room).filter(Boolean);
  return {
    A: ps.find(p => String(p.role || '').toUpperCase() === 'A') || null,
    B: ps.find(p => String(p.role || '').toUpperCase() === 'B') || null
  };
}

export function isHost(room, pid) {
  return room?.meta?.hostPid === pid;
}

export function runPathByMode(mode) {
  const m = String(mode || '').toLowerCase();
  return {
    duet: './plate-duet.html',
    race: './plate-race-run.html',
    battle: './plate-battle-run.html',
    coop: './plate-coop-run.html'
  }[m] || './plate-duet.html';
}

export function buildRunUrl(ctx, extra = {}) {
  const url = new URL(runPathByMode(extra.mode || ctx.mode), location.href);

  const merged = {
    view: ctx.view,
    run: ctx.run,
    diff: ctx.diff,
    time: ctx.time,
    seed: ctx.seed,
    hub: ctx.hub,
    pid: ctx.pid,
    zone: ctx.zone,
    mode: ctx.mode,
    game: ctx.game,
    theme: ctx.theme,
    cooldown: ctx.cooldown,
    roomId: ctx.roomId,
    role: ctx.role,
    name: ctx.name,
    ...extra
  };

  Object.entries(merged).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    url.searchParams.set(k, String(v));
  });

  return url.toString();
}

export async function pushRoomAction(roomId, payload = {}) {
  const ref = actionRoomRef(roomId).push();
  const action = {
    ...payload,
    ts: Number(payload.ts || Date.now())
  };
  await ref.set(action);
  return ref.key;
}

export function subscribeRoomActions(roomId, onAction, opts = {}) {
  const limit = Math.max(1, Number(opts.limit || 80));
  const ref = actionRoomRef(roomId).limitToLast(limit);

  const handler = snap => {
    const val = snap.val();
    if (!val) return;
    onAction({
      id: snap.key,
      ...val
    });
  };

  ref.on('child_added', handler);
  return () => ref.off('child_added', handler);
}