// === /herohealth/vr-groups/groups-race-rtdb.js ===
// FULL PATCH v20260323-GROUPS-RACE-RTDB-PRESENCE-HEARTBEAT-HARDENED

const ROOT = 'hha-battle/groups/raceRooms';

async function getDb(){
  if (window.HHA_FIREBASE_DB) return window.HHA_FIREBASE_DB;

  if (typeof window.HHA_WAIT_FIREBASE === 'function') {
    try {
      const db = await window.HHA_WAIT_FIREBASE(4000);
      if (db) return db;
    } catch (_) {}
  }

  if (window.HHA_FIREBASE_DB) return window.HHA_FIREBASE_DB;

  throw new Error('Firebase not initialized');
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

async function roomRef(roomCode){
  const db = await getDb();
  return db.ref(`${ROOT}/${roomCode}`);
}

async function playersRef(roomCode){
  const db = await getDb();
  return db.ref(`${ROOT}/${roomCode}/players`);
}

async function playerRef(roomCode, playerId){
  const db = await getDb();
  return db.ref(`${ROOT}/${roomCode}/players/${playerId}`);
}

async function matchRef(roomCode){
  const db = await getDb();
  return db.ref(`${ROOT}/${roomCode}/match`);
}

async function scoresRef(roomCode){
  const db = await getDb();
  return db.ref(`${ROOT}/${roomCode}/scores`);
}

async function scoreRef(roomCode, playerId){
  const db = await getDb();
  return db.ref(`${ROOT}/${roomCode}/scores/${playerId}`);
}

async function rematchRef(roomCode){
  const db = await getDb();
  return db.ref(`${ROOT}/${roomCode}/rematch`);
}

async function connectedRef(){
  const db = await getDb();
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
  const ref = await roomRef(roomCode);
  const now = Date.now();

  await ref.set({
    meta: {
      mode: 'groups-race',
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

export async function joinRaceRoom({ roomCode, playerId, playerName }){
  const ref = await roomRef(roomCode);
  const snap = await ref.once('value');
  const data = snap.val();

  if(!data) throw new Error('ไม่พบห้องนี้');

  if(isRaceRoomStale(data)){
    await ref.remove();
    throw new Error('ห้องนี้หมดอายุแล้ว');
  }

  const players = data.players || {};
  const count = Object.keys(players).length;

  if(data.match?.started && !data.match?.endedAt){
    throw new Error('เกมนี้เริ่มไปแล้ว');
  }

  if(count >= 2) throw new Error('ห้องเต็มแล้ว');

  const now = Date.now();

  const pRef = await playersRef(roomCode);
  await pRef.child(playerId).set({
    playerId,
    name: String(playerName || 'Guest'),
    role: 'guest',
    ready: false,
    online: true,
    joinedAt: now,
    lastSeenAt: now
  });

  const sRef = await scoresRef(roomCode);
  await sRef.child(playerId).set({
    score: 0,
    combo: 0,
    acc: 0,
    updatedAt: now
  });

  await ref.child('meta/updatedAt').set(now);
  return true;
}

export function watchRaceRoom(roomCode, onValue){
  let ref = null;
  let fn = null;
  let stopped = false;

  (async ()=>{
    try{
      ref = await roomRef(roomCode);
      if(stopped) return;
      fn = snap => onValue?.(snap.val() || null);
      ref.on('value', fn);
    }catch(err){
      console.error('[watchRaceRoom]', err);
      onValue?.(null);
    }
  })();

  return () => {
    stopped = true;
    try{
      if(ref && fn) ref.off('value', fn);
    }catch(_){}
  };
}

export function watchRaceScores(roomCode, onValue){
  let ref = null;
  let fn = null;
  let stopped = false;

  (async ()=>{
    try{
      ref = await scoresRef(roomCode);
      if(stopped) return;
      fn = snap => onValue?.(snap.val() || {});
      ref.on('value', fn);
    }catch(err){
      console.error('[watchRaceScores]', err);
      onValue?.({});
    }
  })();

  return () => {
    stopped = true;
    try{
      if(ref && fn) ref.off('value', fn);
    }catch(_){}
  };
}

export async function markReady(roomCode, playerId, ready=true){
  const pRef = await playerRef(roomCode, playerId);
  await pRef.child('ready').set(!!ready);
  await pRef.child('lastSeenAt').set(Date.now());

  const ref = await roomRef(roomCode);
  await ref.child('meta/updatedAt').set(Date.now());
}

export async function startRaceMatch(roomCode){
  const ref = await roomRef(roomCode);
  const snap = await ref.once('value');
  const data = snap.val();
  if(!data) throw new Error('ไม่พบห้อง');

  const players = data.players || {};
  const ids = Object.keys(players);

  if(ids.length < 2) throw new Error('ผู้เล่นยังไม่ครบ');

  const readyCount = ids.filter(id => players[id]?.ready).length;
  if(readyCount < 2) throw new Error('ผู้เล่นยังไม่พร้อมครบ');

  const onlineCount = ids.filter(id => players[id]?.online !== false).length;
  if(onlineCount < 2) throw new Error('ยังมีผู้เล่น offline อยู่');

  const now = Date.now();

  const resetScores = {};
  ids.forEach(id => {
    resetScores[id] = { score: 0, combo: 0, acc: 0, updatedAt: now };
  });

  const sRef = await scoresRef(roomCode);
  await sRef.set(resetScores);

  const mRef = await matchRef(roomCode);
  await mRef.update({
    started: true,
    countdownStartAt: now,
    startedAt: now + 3000,
    endedAt: 0,
    locked: true,
    endSummary: null
  });

  const rRef = await rematchRef(roomCode);
  await rRef.set({
    requestedBy: {},
    readyCount: 0,
    updatedAt: now
  });

  await ref.child('meta/updatedAt').set(now);
}

export async function readRaceRoom(roomCode){
  const ref = await roomRef(roomCode);
  const snap = await ref.once('value');
  return snap.val() || null;
}

export async function pushRaceScore(roomCode, playerId, patch = {}){
  const sRef = await scoreRef(roomCode, playerId);
  await sRef.update({
    ...patch,
    updatedAt: Date.now()
  });
}

export async function finishRaceMatch(roomCode, payload = {}){
  const mRef = await matchRef(roomCode);
  await mRef.update({
    endedAt: Date.now(),
    endSummary: payload || {}
  });

  const ref = await roomRef(roomCode);
  await ref.child('meta/updatedAt').set(Date.now());
}

export async function requestRaceRematch(roomCode, playerId){
  const room = await readRaceRoom(roomCode);
  if(!room) throw new Error('ไม่พบห้อง');

  const players = room.players || {};
  const ids = Object.keys(players);

  const rRef = await rematchRef(roomCode);
  await rRef.child('requestedBy').child(playerId).set(true);

  const snap = await rRef.once('value');
  const rematch = snap.val() || {};
  const requestedBy = rematch.requestedBy || {};
  const readyCount = ids.filter(id => requestedBy[id] === true).length;

  await rRef.update({
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

  const sRef = await scoresRef(roomCode);
  await sRef.set(resetScores);

  const pRef = await playersRef(roomCode);
  await pRef.transaction((players)=>{
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

  const mRef = await matchRef(roomCode);
  await mRef.update({
    started: true,
    countdownStartAt: now,
    startedAt: now + 3000,
    endedAt: 0,
    locked: true,
    roundNo: currentRound + 1,
    endSummary: null
  });

  const rRef = await rematchRef(roomCode);
  await rRef.set({
    requestedBy: {},
    readyCount: 0,
    updatedAt: now
  });

  const ref = await roomRef(roomCode);
  await ref.child('meta/updatedAt').set(now);
}

export async function leaveRaceRoom(roomCode, playerId){
  const room = await readRaceRoom(roomCode);
  if(!room) return;

  const players = room.players || {};
  const leaving = players[playerId];
  if(!leaving) return;

  const pRef = await playerRef(roomCode, playerId);
  await pRef.remove();

  const sRef = await scoreRef(roomCode, playerId);
  await sRef.remove();

  const ref = await roomRef(roomCode);
  const remainingSnap = await ref.once('value');
  const remaining = remainingSnap.val();
  const count = Object.keys(remaining?.players || {}).length;
  const remainingPlayers = remaining?.players || {};
  const onlineCount = Object.values(remainingPlayers).filter(p => p && p.online !== false).length;

  if(count === 0 || onlineCount === 0){
    await ref.remove();
    return;
  }

  const hostId = remaining?.meta?.hostPlayerId;
  if(hostId === playerId){
    const nextHostId = Object.keys(remaining.players || {})[0] || '';
    if(nextHostId){
      await ref.child('meta/hostPlayerId').set(nextHostId);
      await ref.child('meta/hostName').set(remaining.players[nextHostId]?.name || 'Host');
      const nextPRef = await playerRef(roomCode, nextHostId);
      await nextPRef.child('role').set('host');
    }
  }

  await ref.child('meta/updatedAt').set(Date.now());
}

export function bindRacePresence(roomCode, playerId){
  let stop = false;
  let cRef = null;
  let handle = null;
  let heartbeatTimer = null;
  let pRef = null;

  (async ()=>{
    try{
      pRef = await playerRef(roomCode, playerId);
      cRef = await connectedRef();

      async function pingOnline(){
        if(stop || !pRef) return;
        try{
          await pRef.update({
            online: true,
            lastSeenAt: Date.now()
          });
        }catch(err){
          console.error('[bindRacePresence ping]', err);
        }
      }

      handle = snap => {
        if(stop) return;
        if(snap.val() !== true) return;

        try{
          pRef.child('online').onDisconnect().set(false);
          pRef.child('lastSeenAt').onDisconnect().set(Date.now());
        }catch(err){
          console.error('[bindRacePresence onDisconnect]', err);
        }

        pingOnline();

        if(heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(pingOnline, 4000);
      };

      cRef.on('value', handle);

      const onVisible = ()=>{
        if(stop) return;
        if(document.visibilityState === 'visible'){
          pingOnline();
        }
      };

      const onFocus = ()=>{ if(!stop) pingOnline(); };
      const onPageShow = ()=>{ if(!stop) pingOnline(); };

      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onFocus, { passive:true });
      window.addEventListener('pageshow', onPageShow, { passive:true });

    }catch(err){
      console.error('[bindRacePresence]', err);
    }
  })();

  return () => {
    stop = true;
    try{
      if(cRef && handle) cRef.off('value', handle);
    }catch(_){}
    try{
      if(heartbeatTimer) clearInterval(heartbeatTimer);
    }catch(_){}
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
    const ref = await roomRef(roomCode);
    await ref.remove();
    return { removed:true, reason:'stale' };
  }

  return { removed:false, reason:'active' };
}