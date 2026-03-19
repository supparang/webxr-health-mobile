// === /herohealth/vr-groups/groups-race-rtdb.js ===
// FULL PATCH v20260319-GROUPS-RACE-RTDB-V1

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

function matchRef(roomCode){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/match`);
}

function scoresRef(roomCode){
  const db = getDb();
  return db.ref(`${ROOT}/${roomCode}/scores`);
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
      createdAt: Date.now()
    },
    players: {
      [playerId]: {
        playerId,
        name: String(hostName || 'Host'),
        role: 'host',
        ready: false,
        joinedAt: Date.now()
      }
    },
    match: {
      started: false,
      countdownStartAt: 0,
      startedAt: 0,
      endedAt: 0
    },
    scores: {
      [playerId]: {
        score: 0,
        combo: 0,
        acc: 0,
        updatedAt: Date.now()
      }
    }
  });

  return roomCode;
}

export async function joinRaceRoom({ roomCode, playerId, playerName }){
  const ref = roomRef(roomCode);
  const snap = await ref.once('value');
  const data = snap.val();

  if(!data) throw new Error('ไม่พบห้องนี้');
  const players = data.players || {};
  const count = Object.keys(players).length;

  if(count >= 2) throw new Error('ห้องเต็มแล้ว');

  await playersRef(roomCode).child(playerId).set({
    playerId,
    name: String(playerName || 'Guest'),
    role: 'guest',
    ready: false,
    joinedAt: Date.now()
  });

  await scoresRef(roomCode).child(playerId).set({
    score: 0,
    combo: 0,
    acc: 0,
    updatedAt: Date.now()
  });

  return true;
}

export function watchRaceRoom(roomCode, onValue){
  const ref = roomRef(roomCode);
  const fn = snap => onValue?.(snap.val() || null);
  ref.on('value', fn);
  return () => ref.off('value', fn);
}

export async function markReady(roomCode, playerId, ready=true){
  await playersRef(roomCode).child(playerId).child('ready').set(!!ready);
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
  await matchRef(roomCode).update({
    started: true,
    countdownStartAt: now,
    startedAt: now + 3000,
    endedAt: 0
  });
}

export async function readRaceRoom(roomCode){
  const snap = await roomRef(roomCode).once('value');
  return snap.val() || null;
}

export async function pushRaceScore(roomCode, playerId, patch = {}){
  await scoresRef(roomCode).child(playerId).update({
    ...patch,
    updatedAt: Date.now()
  });
}

export function watchRaceScores(roomCode, onValue){
  const ref = scoresRef(roomCode);
  const fn = snap => onValue?.(snap.val() || {});
  ref.on('value', fn);
  return () => ref.off('value', fn);
}

export async function finishRaceMatch(roomCode, payload = {}){
  await matchRef(roomCode).update({
    endedAt: Date.now(),
    endSummary: payload || {}
  });
}