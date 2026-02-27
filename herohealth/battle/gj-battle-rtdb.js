// === /herohealth/battle/gj-battle-rtdb.js ===
// GoodJunk Battle RTDB — Room (AutoStart 3s) + Forfeit 5s
// Usage:
//   const battle = await createOrJoin({...});
//   battle.onState(cb)
//   battle.reportStats({score, combo, miss, acc})
//   battle.getOpponent()
//   battle.dispose()

'use strict';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase, ref, get, set, update, onValue, off, runTransaction,
  onDisconnect, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

function nowMs(){ return Date.now(); }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function makeRoomCode(){
  // GJ + 4 digits (simple). You can upgrade to checksum later.
  const n = Math.floor(1000 + Math.random()*9000);
  return "GJ" + n;
}

async function getServerOffsetMs(db){
  // Firebase special path
  const r = ref(db, ".info/serverTimeOffset");
  const snap = await get(r);
  return Number(snap.val() || 0);
}

function serverNowMs(localNow, offset){ return Number(localNow||nowMs()) + Number(offset||0); }

export function initFirebase(firebaseConfig){
  const app = initializeApp(firebaseConfig);
  const db  = getDatabase(app);
  return { app, db };
}

export async function createRoom({ db, pid="anon", name="Player", mode="score_race_mirror", countdownMs=3000, forfeitGraceMs=5000 }){
  const offset = await getServerOffsetMs(db);

  // generate unique-ish room code; retry if exists
  let roomId = makeRoomCode();
  for(let i=0;i<5;i++){
    const roomRef = ref(db, `gjRooms/${roomId}`);
    const s = await get(roomRef);
    if(!s.exists()) break;
    roomId = makeRoomCode();
  }

  const seed = nowMs(); // or deterministic hash(pid+day) if you want
  const createdAt = serverNowMs(nowMs(), offset);

  const roomRef = ref(db, `gjRooms/${roomId}`);
  const pKey = "P1";

  const room = {
    ver: 1,
    createdAt,
    status: "waiting",
    maxPlayers: 2,
    seed,
    mode,
    countdownMs,
    forfeitGraceMs,
    startAt: 0,
    endAt: 0,
    players: {
      [pKey]: {
        pid: String(pid||"anon"),
        name: String(name||"Player 1"),
        joinedAt: createdAt,
        connected: true,
        lastSeen: createdAt,
        score: 0,
        combo: 0,
        miss: 0,
        acc: 0
      }
    },
    forfeit: { active:false, victim:"", deadline:0 },
    winner: "",
    endedReason: ""
  };

  await set(roomRef, room);
  return { roomId, playerKey: pKey, seed, offset };
}

export async function joinRoom({ db, roomId, pid="anon", name="Player" }){
  const offset = await getServerOffsetMs(db);
  const roomRef = ref(db, `gjRooms/${roomId}`);

  const result = await runTransaction(roomRef, (room)=>{
    if(!room) return room; // abort, will be handled after
    if(room.status === "ended") return room;
    room.players = room.players || {};
    const keys = Object.keys(room.players);

    // already in room?
    for(const k of keys){
      if(room.players[k] && room.players[k].pid === pid){
        return room; // rejoin same pid
      }
    }
    if(keys.length >= 2) return room; // full

    const newKey = keys.includes("P1") ? "P2" : "P1";
    const t = serverNowMs(nowMs(), offset);
    room.players[newKey] = {
      pid: String(pid||"anon"),
      name: String(name||"Player 2"),
      joinedAt: t,
      connected: true,
      lastSeen: t,
      score: 0,
      combo: 0,
      miss: 0,
      acc: 0
    };

    // If now full -> countdown
    const keys2 = Object.keys(room.players);
    if(keys2.length >= 2 && (room.status === "waiting" || room.status === "countdown")){
      room.status = "countdown";
      room.startAt = serverNowMs(nowMs(), offset) + Number(room.countdownMs || 3000);
      // clear forfeit
      room.forfeit = { active:false, victim:"", deadline:0 };
    }
    return room;
  }, { applyLocally:false });

  const snap = await get(roomRef);
  if(!snap.exists()) throw new Error("ROOM_NOT_FOUND");
  const room = snap.val();
  if(room.status === "ended") throw new Error("ROOM_ENDED");
  if(!room.players) throw new Error("ROOM_BAD");

  // Determine my playerKey (P1/P2) by matching pid
  let myKey = "";
  for(const k of Object.keys(room.players)){
    if(String(room.players[k]?.pid||"") === String(pid||"")) { myKey = k; break; }
  }
  if(!myKey){
    // not matched — likely room full
    const n = Object.keys(room.players).length;
    if(n >= 2) throw new Error("ROOM_FULL");
    throw new Error("JOIN_FAILED");
  }

  return { roomId, playerKey: myKey, seed: room.seed, offset };
}

export function attachPresence({ db, roomId, playerKey }){
  const pRef = ref(db, `gjPresence/${roomId}/${playerKey}`);
  const t = serverTimestamp();
  set(pRef, { connected:true, lastSeen:t }).catch(()=>{});
  onDisconnect(pRef).set({ connected:false, lastSeen: serverTimestamp() }).catch(()=>{});

  // Also mirror into room player.connected/lastSeen (best-effort)
  const rp = ref(db, `gjRooms/${roomId}/players/${playerKey}`);
  update(rp, { connected:true, lastSeen: serverTimestamp() }).catch(()=>{});
  onDisconnect(rp).update({ connected:false, lastSeen: serverTimestamp() }).catch(()=>{});

  return ()=> {
    // best-effort cleanup
    update(pRef, { connected:false, lastSeen: serverTimestamp() }).catch(()=>{});
    update(rp, { connected:false, lastSeen: serverTimestamp() }).catch(()=>{});
  };
}

export function createBattleClient({ db, roomId, playerKey, offset }){
  const roomRef = ref(db, `gjRooms/${roomId}`);
  const myRef   = ref(db, `gjRooms/${roomId}/players/${playerKey}`);

  let unsubRoom = null;
  let lastRoom = null;
  let lastReportAt = 0;
  let disposed = false;

  function onState(cb){
    const fn = (snap)=>{
      lastRoom = snap.val() || null;
      cb(lastRoom);
    };
    unsubRoom = fn;
    onValue(roomRef, fn);
    return ()=>{ try{ off(roomRef, "value", fn); }catch(e){} };
  }

  async function ensurePlayingTransition(){
    // Optional: host can set playing when startAt passed. We'll do best-effort by anyone.
    if(!lastRoom) return;
    if(lastRoom.status !== "countdown") return;
    const startAt = Number(lastRoom.startAt||0);
    if(!startAt) return;
    const sNow = serverNowMs(nowMs(), offset);
    if(sNow >= startAt){
      // try move to playing
      try{
        await runTransaction(roomRef, (room)=>{
          if(!room) return room;
          if(room.status === "countdown"){
            room.status = "playing";
          }
          return room;
        }, { applyLocally:false });
      }catch(e){}
    }
  }

  async function reportStats({ score, combo, miss, acc }){
    if(disposed) return;
    const t = nowMs();
    // throttle ~6-10 times/sec
    if(t - lastReportAt < 120) return;
    lastReportAt = t;
    const payload = {
      score: Number(score||0),
      combo: Number(combo||0),
      miss:  Number(miss||0),
      acc:   Number(acc||0),
      lastSeen: serverTimestamp(),
      connected: true
    };
    try{ await update(myRef, payload); }catch(e){}
  }

  function getOpponent(){
    if(!lastRoom || !lastRoom.players) return null;
    const oppKey = (playerKey === "P1") ? "P2" : "P1";
    return lastRoom.players[oppKey] || null;
  }

  async function startForfeitIfNeeded(){
    if(!lastRoom || lastRoom.status !== "playing") return;
    const oppKey = (playerKey === "P1") ? "P2" : "P1";
    const opp = lastRoom.players?.[oppKey];
    if(!opp) return;

    const sNow = serverNowMs(nowMs(), offset);
    const grace = Number(lastRoom.forfeitGraceMs || 5000);

    // consider disconnected if connected=false OR lastSeen stale > ~2500ms
    const lastSeen = Number(opp.lastSeen || 0);
    const connected = !!opp.connected;

    const stale = (lastSeen && (sNow - lastSeen > 2500));
    const disconnected = (!connected) || stale;

    if(!disconnected) return;

    // if already active forfeit, don't restart
    if(lastRoom.forfeit?.active){
      return;
    }

    const deadline = sNow + grace;

    // set forfeit active
    try{
      await runTransaction(roomRef, (room)=>{
        if(!room) return room;
        if(room.status !== "playing") return room;
        if(room.forfeit?.active) return room;
        room.forfeit = { active:true, victim: oppKey, deadline };
        return room;
      }, { applyLocally:false });
    }catch(e){}
  }

  async function resolveForfeitIfDeadlinePassed(){
    if(!lastRoom || lastRoom.status !== "playing") return;
    const f = lastRoom.forfeit || {};
    if(!f.active) return;
    const sNow = serverNowMs(nowMs(), offset);
    const deadline = Number(f.deadline||0);
    if(!deadline || sNow < deadline) return;

    const victim = String(f.victim||"");
    if(victim !== "P1" && victim !== "P2") return;

    // check if victim actually came back
    const opp = lastRoom.players?.[victim];
    const back = opp && opp.connected && (Number(opp.lastSeen||0) > (deadline - 2500));
    if(back){
      // cancel forfeit
      try{
        await update(roomRef, { forfeit:{active:false, victim:"", deadline:0} });
      }catch(e){}
      return;
    }

    // end with winner = other side
    const winner = (victim === "P1") ? "P2" : "P1";
    try{
      await runTransaction(roomRef, (room)=>{
        if(!room) return room;
        if(room.status === "ended") return room;
        room.status = "ended";
        room.winner = winner;
        room.endedReason = "forfeit";
        room.endAt = serverNowMs(nowMs(), offset);
        return room;
      }, { applyLocally:false });
    }catch(e){}
  }

  function tick(){
    if(disposed) return;
    ensurePlayingTransition().catch(()=>{});
    startForfeitIfNeeded().catch(()=>{});
    resolveForfeitIfDeadlinePassed().catch(()=>{});
  }

  const tickTimer = setInterval(tick, 250);

  function dispose(){
    disposed = true;
    clearInterval(tickTimer);
    try{ if(unsubRoom) off(roomRef, "value", unsubRoom); }catch(e){}
  }

  return {
    onState,
    reportStats,
    getOpponent,
    dispose
  };
}
