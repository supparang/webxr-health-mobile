// === /herohealth/vr-groups/groups-race-rtdb.js ===
// FULL PATCH v20260319-GROUPS-RACE-RTDB-V2-REMATCH-DISCONNECT

const ROOT = 'hha-battle/groups/raceRooms';

function getDb(){
  const db = window.HHA_FIREBASE_DB;
  if(!db) throw new Error('Firebase not initialized');
  return db;
}

export function makeRacePlayerId(){
  return `p-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeRoomCode(raw){
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

function makeRoomCode(){
  return normalizeRoomCode(Math.random().toString(36).slice(2, 8));
}

function roomRef(roomCode){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}`);
}

function playersRef(roomCode){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/players`);
}

function playerRef(roomCode, playerId){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/players/${playerId}`);
}

function matchRef(roomCode){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/match`);
}

function scoresRef(roomCode){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/scores`);
}

function scoreRef(roomCode, playerId){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/scores/${playerId}`);
}

function rematchRef(roomCode){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/rematch`);
}

function connectedRef(){
  const db = getDb();
  return db.ref('.info/connected');
}

function getPlayerIds(data){
  return Object.keys(data?.players || {});
}

function getReadyCount(data){
  return getPlayerIds(data).filter(id => data?.players?.[id]?.ready).length;
}

export async function createRaceRoom({ hostName, playerId, diff='normal', timeSec=60, view='mobile' }){
  const roomCode = makeRoomCode();
  const ref = roomRef(roomCode);

  await ref.set({
    meta: {
      mode: 'groups-race',
      hostName: String(hostName || 'Host'),
      hostPlayerId: playerId,
      diff: String(diff || 'normal'),
      timeSec: Number(timeSec || 60),
      view: String(view || 'mobile'),
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    players: {
      [playerId]: {
        playerId,
        name: String(hostName || 'Host'),
        role: 'host',
        ready: false,
        online: true,
        joinedAt: Date.now(),
        lastSeenAt: Date.now()
      }
    },
    match: {
      started: false,
      countdownStartAt: 0,
      startedAt: 0,
      endedAt: 0,
      roundNo: 1,
      locked: false,
      endSummary: null
    },
    scores: {
      [playerId]: {
        score: 0,
        combo: 0,
        acc: 0,
        updatedAt: Date.now()
      }
    },
    rematch: {
      requestedBy: {},
      readyCount: 0,
      updatedAt: Date.now()
    }
  });

  return roomCode;
}

export async function joinRaceRoom({ roomCode, playerId, playerName }){
  const ref = roomRef(roomCode);
  const snap = await ref.once('value');
  const data = snap.val();

  if(!data) throw new Error('ไม่พบห้องนี้');

  if(isRaceRoomStale(data)){
    await roomRef(roomCode).remove();
    throw new Error('ห้องนี้หมดอายุแล้ว');
  }

  const players = data.players || {};
  const count = Object.keys(players).length;

  if(data.match?.started && !data.match?.endedAt){
    throw new Error('เกมนี้เริ่มไปแล้ว');
  }

  if(count >= 2) throw new Error('ห้องเต็มแล้ว');

  await playersRef(roomCode).child(playerId).set({
    playerId,
    name: String(playerName || 'Guest'),
    role: 'guest',
    ready: false,
    online: true,
    joinedAt: Date.now(),
    lastSeenAt: Date.now()
  });

  await scoresRef(roomCode).child(playerId).set({
    score: 0,
    combo: 0,
    acc: 0,
    updatedAt: Date.now()
  });

  await roomRef(roomCode).child('meta/updatedAt').set(Date.now());
  return true;
}

export function watchRaceRoom(roomCode, onValue){
  const ref = roomRef(roomCode);
  const fn = snap => onValue?.(snap.val() || null);
  ref.on('value', fn);
  return () => ref.off('value', fn);
}

export function watchRaceScores(roomCode, onValue){
  const ref = scoresRef(roomCode);
  const fn = snap => onValue?.(snap.val() || {});
  ref.on('value', fn);
  return () => ref.off('value', fn);
}

export async function readRaceRoom(roomCode){
  const snap = await roomRef(roomCode).once('value');
  return snap.val() || null;
}

export async function markReady(roomCode, playerId, ready=true){
  await playerRef(roomCode, playerId).child('ready').set(!!ready);
  await playerRef(roomCode, playerId).child('lastSeenAt').set(Date.now());
  await roomRef(roomCode).child('meta/updatedAt').set(Date.now());
}

export async function startRaceMatch(roomCode){
  const ref = roomRef(roomCode);
  const snap = await ref.once('value');
  const data = snap.val();
  if(!data) throw new Error('ไม่พบห้อง');

  const players = data.players || {};
  const ids = Object.keys(players);

  if(ids.length < 2) throw new Error('ผู้เล่นยังไม่ครบ');

  const readyCount = ids.filter(id => players[id]?.ready).length;
  if(readyCount < 2) throw new Error('ผู้เล่นยังไม่พร้อมครบ');

  const now = Date.now();

  const resetScores = {};
  ids.forEach(id => {
    resetScores[id] = { score: 0, combo: 0, acc: 0, updatedAt: now };
  });

  await scoresRef(roomCode).set(resetScores);

  await matchRef(roomCode).update({
    started: true,
    countdownStartAt: now,
    startedAt: now + 3000,
    endedAt: 0,
    locked: true,
    endSummary: null
  });

  await rematchRef(roomCode).set({
    requestedBy: {},
    readyCount: 0,
    updatedAt: now
  });

  await roomRef(roomCode).child('meta/updatedAt').set(now);
}

export async function pushRaceScore(roomCode, playerId, patch = {}){
  await scoreRef(roomCode, playerId).update({
    ...patch,
    updatedAt: Date.now()
  });
}

export async function finishRaceMatch(roomCode, payload = {}){
  await matchRef(roomCode).update({
    endedAt: Date.now(),
    endSummary: payload || {}
  });
  await roomRef(roomCode).child('meta/updatedAt').set(Date.now());
}

export async function requestRaceRematch(roomCode, playerId){
  const db = getDb();
  const room = await readRaceRoom(roomCode);
  if(!room) throw new Error('ไม่พบห้อง');

  const players = room.players || {};
  const ids = Object.keys(players);

  await db.ref(`${ROOT}/${roomCode}/rematch/requestedBy/${playerId}`).set(true);

  const snap = await rematchRef(roomCode).once('value');
  const rematch = snap.val() || {};
  const requestedBy = rematch.requestedBy || {};
  const readyCount = ids.filter(id => requestedBy[id] === true).length;

  await rematchRef(roomCode).update({
    readyCount,
    updatedAt: Date.now()
  });

  return {
    readyCount,
    totalPlayers: ids.length
  };
}

export async function resetRaceForRematch(roomCode){
  const room = await readRaceRoom(roomCode);
  if(!room) throw new Error('ไม่พบห้อง');

  const ids = getPlayerIds(room);
  const readyCount = getReadyCount(room);
  if(ids.length < 2) throw new Error('ผู้เล่นไม่ครบ');
  if(readyCount < 2) throw new Error('ยังมีผู้เล่นไม่พร้อม');

  const now = Date.now();

  const resetScores = {};
  ids.forEach(id => {
    resetScores[id] = { score: 0, combo: 0, acc: 0, updatedAt: now };
  });

  await scoresRef(roomCode).set(resetScores);

  await playersRef(roomCode).transaction((players)=>{
    const next = players || {};
    Object.keys(next).forEach(id=>{
      next[id] = {
        ...next[id],
        ready: true,
        online: next[id]?.online !== false,
        lastSeenAt: now
      };
    });
    return next;
  });

  const currentRound = Number(room.match?.roundNo || 1);

  await matchRef(roomCode).update({
    started: true,
    countdownStartAt: now,
    startedAt: now + 3000,
    endedAt: 0,
    locked: true,
    roundNo: currentRound + 1,
    endSummary: null
  });

  await rematchRef(roomCode).set({
    requestedBy: {},
    readyCount: 0,
    updatedAt: now
  });

  await roomRef(roomCode).child('meta/updatedAt').set(now);
}

export async function leaveRaceRoom(roomCode, playerId){
  const room = await readRaceRoom(roomCode);
  if(!room) return;

  const players = room.players || {};
  const leaving = players[playerId];
  if(!leaving) return;

  await playerRef(roomCode, playerId).remove();
  await scoreRef(roomCode, playerId).remove();

  const remainingSnap = await roomRef(roomCode).once('value');
  const remaining = remainingSnap.val();
  const count = Object.keys(remaining?.players || {}).length;
  const remainingPlayers = remaining?.players || {};
  const onlineCount = Object.values(remainingPlayers).filter(p => p && p.online !== false).length;

  if(count === 0 || onlineCount === 0){
    await roomRef(roomCode).remove();
    return;
  }

  const hostId = remaining?.meta?.hostPlayerId;
  if(hostId === playerId){
    const nextHostId = Object.keys(remaining.players || {})[0] || '';
    if(nextHostId){
      await roomRef(roomCode).child('meta/hostPlayerId').set(nextHostId);
      await roomRef(roomCode).child('meta/hostName').set(remaining.players[nextHostId]?.name || 'Host');
      await playerRef(roomCode, nextHostId).child('role').set('host');
    }
  }

  await roomRef(roomCode).child('meta/updatedAt').set(Date.now());
}

export function bindRacePresence(roomCode, playerId){
  const pRef = playerRef(roomCode, playerId);
  const cRef = connectedRef();

  const handle = snap => {
    if(snap.val() !== true) return;

    pRef.child('online').onDisconnect().set(false);
    pRef.child('lastSeenAt').onDisconnect().set(Date.now());

    pRef.update({
      online: true,
      lastSeenAt: Date.now()
    }).catch(()=>{});
  };

  cRef.on('value', handle);

  return () => {
    cRef.off('value', handle);
  };
}

export function isRaceRoomStale(room){
  const updatedAt = Number(room?.meta?.updatedAt || room?.meta?.createdAt || 0);
  const ageMs = Date.now() - updatedAt;
  const players = room?.players || {};
  const onlineCount = Object.values(players).filter(p => p && p.online !== false).length;

  return ageMs > (2 * 60 * 60 * 1000) && onlineCount === 0;
}

export async function cleanupRaceRoomIfStale(roomCode){
  const room = await readRaceRoom(roomCode);
  if(!room) return { removed:false, reason:'not-found' };

  if(isRaceRoomStale(room)){
    await roomRef(roomCode).remove();
    return { removed:true, reason:'stale' };
  }

  return { removed:false, reason:'active' };
}