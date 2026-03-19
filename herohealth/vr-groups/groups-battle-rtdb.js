// === /herohealth/vr-groups/groups-battle-rtdb.js ===
// FULL PATCH v20260320-GROUPS-BATTLE-RTDB-V1

const ROOT = 'hha-battle/groups/battleRooms';

function getDb(){
  const db = window.HHA_FIREBASE_DB;
  if(!db) throw new Error('Firebase not initialized');
  return db;
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

function scoresRef(roomCode){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/scores`);
}

function scoreRef(roomCode, playerId){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/scores/${playerId}`);
}

function matchRef(roomCode){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/match`);
}

function rematchRef(roomCode){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/rematch`);
}

function effectsRef(roomCode){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/effects`);
}

function effectRef(roomCode, playerId){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/effects/${playerId}`);
}

function connectedRef(){
  const db = getDb();
  return db.ref('.info/connected');
}

export function makeBattlePlayerId(){
  return `bp-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeBattleRoomCode(raw){
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

function makeBattleRoomCode(){
  return normalizeBattleRoomCode(Math.random().toString(36).slice(2, 8));
}

function getPlayerIds(data){
  return Object.keys(data?.players || {});
}

function getReadyCount(data){
  return getPlayerIds(data).filter(id => data?.players?.[id]?.ready).length;
}

export async function createBattleRoom({ hostName, playerId, diff='normal', timeSec=60, view='mobile' }){
  const roomCode = makeBattleRoomCode();
  const now = Date.now();

  await roomRef(roomCode).set({
    meta: {
      mode: 'groups-battle',
      hostName: String(hostName || 'Host'),
      hostPlayerId: playerId,
      diff: String(diff || 'normal'),
      timeSec: Number(timeSec || 60),
      view: String(view || 'mobile'),
      createdAt: now,
      updatedAt: now
    },
    players: {
      [playerId]: {
        playerId,
        name: String(hostName || 'Host'),
        role: 'host',
        ready: false,
        online: true,
        joinedAt: now,
        lastSeenAt: now
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
        pressureSent: 0,
        pressureReceived: 0,
        updatedAt: now
      }
    },
    effects: {
      [playerId]: {
        pressureUntil: 0,
        updatedAt: now
      }
    },
    rematch: {
      requestedBy: {},
      readyCount: 0,
      updatedAt: now
    }
  });

  return roomCode;
}

export async function joinBattleRoom({ roomCode, playerId, playerName }){
  const snap = await roomRef(roomCode).once('value');
  const data = snap.val();

  if(!data) throw new Error('ไม่พบห้องนี้');

  if(isBattleRoomStale(data)){
    await roomRef(roomCode).remove();
    throw new Error('ห้องนี้หมดอายุแล้ว');
  }

  const players = data.players || {};
  const count = Object.keys(players).length;

  if(data.match?.started && !data.match?.endedAt){
    throw new Error('เกมนี้เริ่มไปแล้ว');
  }

  if(count >= 2){
    throw new Error('ห้องเต็มแล้ว');
  }

  const now = Date.now();

  await playersRef(roomCode).child(playerId).set({
    playerId,
    name: String(playerName || 'Guest'),
    role: 'guest',
    ready: false,
    online: true,
    joinedAt: now,
    lastSeenAt: now
  });

  await scoresRef(roomCode).child(playerId).set({
    score: 0,
    combo: 0,
    acc: 0,
    pressureSent: 0,
    pressureReceived: 0,
    updatedAt: now
  });

  await effectsRef(roomCode).child(playerId).set({
    pressureUntil: 0,
    updatedAt: now
  });

  await roomRef(roomCode).child('meta/updatedAt').set(now);
}

export function watchBattleRoom(roomCode, onValue){
  const ref = roomRef(roomCode);
  const fn = snap => onValue?.(snap.val() || null);
  ref.on('value', fn);
  return () => ref.off('value', fn);
}

export function watchBattleScores(roomCode, onValue){
  const ref = scoresRef(roomCode);
  const fn = snap => onValue?.(snap.val() || {});
  ref.on('value', fn);
  return () => ref.off('value', fn);
}

export function watchBattleEffects(roomCode, onValue){
  const ref = effectsRef(roomCode);
  const fn = snap => onValue?.(snap.val() || {});
  ref.on('value', fn);
  return () => ref.off('value', fn);
}

export async function readBattleRoom(roomCode){
  const snap = await roomRef(roomCode).once('value');
  return snap.val() || null;
}

export async function markBattleReady(roomCode, playerId, ready=true){
  await playerRef(roomCode, playerId).child('ready').set(!!ready);
  await playerRef(roomCode, playerId).child('lastSeenAt').set(Date.now());
  await roomRef(roomCode).child('meta/updatedAt').set(Date.now());
}

export async function startBattleMatch(roomCode){
  const room = await readBattleRoom(roomCode);
  if(!room) throw new Error('ไม่พบห้อง');

  const ids = getPlayerIds(room);
  if(ids.length < 2) throw new Error('ผู้เล่นยังไม่ครบ');

  const readyCount = getReadyCount(room);
  if(readyCount < 2) throw new Error('ผู้เล่นยังไม่พร้อมครบ');

  const now = Date.now();

  const resetScores = {};
  const resetEffects = {};

  ids.forEach(id => {
    resetScores[id] = {
      score: 0,
      combo: 0,
      acc: 0,
      pressureSent: 0,
      pressureReceived: 0,
      updatedAt: now
    };
    resetEffects[id] = {
      pressureUntil: 0,
      updatedAt: now
    };
  });

  await scoresRef(roomCode).set(resetScores);
  await effectsRef(roomCode).set(resetEffects);

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

export async function pushBattleScore(roomCode, playerId, patch = {}){
  await scoreRef(roomCode, playerId).update({
    ...patch,
    updatedAt: Date.now()
  });
}

export async function sendBattlePressure(roomCode, targetPlayerId, durationMs = 4500){
  const now = Date.now();
  const until = now + Math.max(1000, Number(durationMs || 4500));

  const currentSnap = await effectRef(roomCode, targetPlayerId).once('value');
  const current = currentSnap.val() || {};
  const currentUntil = Number(current.pressureUntil || 0);

  await effectRef(roomCode, targetPlayerId).update({
    pressureUntil: Math.max(currentUntil, until),
    updatedAt: now
  });
}

export async function finishBattleMatch(roomCode, payload = {}){
  await matchRef(roomCode).update({
    endedAt: Date.now(),
    endSummary: payload || {}
  });
  await roomRef(roomCode).child('meta/updatedAt').set(Date.now());
}

export async function requestBattleRematch(roomCode, playerId){
  const room = await readBattleRoom(roomCode);
  if(!room) throw new Error('ไม่พบห้อง');

  const ids = getPlayerIds(room);
  await rematchRef(roomCode).child('requestedBy').child(playerId).set(true);

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

export async function resetBattleForRematch(roomCode){
  const room = await readBattleRoom(roomCode);
  if(!room) throw new Error('ไม่พบห้อง');

  const ids = getPlayerIds(room);
  const readyCount = getReadyCount(room);

  if(ids.length < 2) throw new Error('ผู้เล่นไม่ครบ');
  if(readyCount < 2) throw new Error('ยังมีผู้เล่นไม่พร้อม');

  const now = Date.now();

  const resetScores = {};
  const resetEffects = {};

  ids.forEach(id => {
    resetScores[id] = {
      score: 0,
      combo: 0,
      acc: 0,
      pressureSent: 0,
      pressureReceived: 0,
      updatedAt: now
    };
    resetEffects[id] = {
      pressureUntil: 0,
      updatedAt: now
    };
  });

  await scoresRef(roomCode).set(resetScores);
  await effectsRef(roomCode).set(resetEffects);

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

export async function leaveBattleRoom(roomCode, playerId){
  const room = await readBattleRoom(roomCode);
  if(!room) return;

  const leaving = room.players?.[playerId];
  if(!leaving) return;

  await playerRef(roomCode, playerId).remove();
  await scoreRef(roomCode, playerId).remove();
  await effectRef(roomCode, playerId).remove();

  const remainingSnap = await roomRef(roomCode).once('value');
  const remaining = remainingSnap.val();
  const remainingPlayers = remaining?.players || {};
  const count = Object.keys(remainingPlayers).length;
  const onlineCount = Object.values(remainingPlayers).filter(p => p && p.online !== false).length;

  if(count === 0 || onlineCount === 0){
    await roomRef(roomCode).remove();
    return;
  }

  const hostId = remaining?.meta?.hostPlayerId;
  if(hostId === playerId){
    const nextHostId = Object.keys(remainingPlayers)[0] || '';
    if(nextHostId){
      await roomRef(roomCode).child('meta/hostPlayerId').set(nextHostId);
      await roomRef(roomCode).child('meta/hostName').set(remainingPlayers[nextHostId]?.name || 'Host');
      await playerRef(roomCode, nextHostId).child('role').set('host');
    }
  }

  await roomRef(roomCode).child('meta/updatedAt').set(Date.now());
}

export function bindBattlePresence(roomCode, playerId){
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

export function isBattleRoomStale(room){
  const updatedAt = Number(room?.meta?.updatedAt || room?.meta?.createdAt || 0);
  const ageMs = Date.now() - updatedAt;
  const players = room?.players || {};
  const onlineCount = Object.values(players).filter(p => p && p.online !== false).length;

  return ageMs > (2 * 60 * 60 * 1000) && onlineCount === 0;
}

export async function cleanupBattleRoomIfStale(roomCode){
  const room = await readBattleRoom(roomCode);
  if(!room) return { removed:false, reason:'not-found' };

  if(isBattleRoomStale(room)){
    await roomRef(roomCode).remove();
    return { removed:true, reason:'stale' };
  }

  return { removed:false, reason:'active' };
}