// === /herohealth/battle/gj-battle-rtdb.js ===
'use strict';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase, ref, get, set, update, onValue, off, runTransaction,
  onDisconnect, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

function nowMs(){ return Date.now(); }
function serverNowMs(offset){ return nowMs() + (Number(offset)||0); }
function makeRoomCode(){
  const n = Math.floor(1000 + Math.random()*9000);
  return "GJ" + n;
}
async function getServerOffsetMs(db){
  const r = ref(db, ".info/serverTimeOffset");
  const snap = await get(r);
  return Number(snap.val() || 0);
}

export function initFirebase(firebaseConfig){
  const app = initializeApp(firebaseConfig);
  const db  = getDatabase(app);
  return { app, db };
}

export async function createRoom({ db, pid="anon", name="Player", mode="score_race_mirror", countdownMs=3000, forfeitGraceMs=5000 }){
  const offset = await getServerOffsetMs(db);

  let roomId = makeRoomCode();
  for(let i=0;i<6;i++){
    const s = await get(ref(db, `gjRooms/${roomId}`));
    if(!s.exists()) break;
    roomId = makeRoomCode();
  }

  const createdAt = serverNowMs(offset);
  const seed = nowMs(); // can be replaced with deterministic day-hash later

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
      P1: {
        pid: String(pid||"anon"),
        name: String(name||"Player A"),
        joinedAt: createdAt,
        connected: true,
        lastSeen: createdAt,
        score: 0, combo: 0, miss: 0, acc: 0
      }
    },
    forfeit: { active:false, victim:"", deadline:0 },
    winner: "",
    endedReason: ""
  };

  await set(ref(db, `gjRooms/${roomId}`), room);
  return { roomId, playerKey: "P1", seed, offset };
}

export async function joinRoom({ db, roomId, pid="anon", name="Player" }){
  const offset = await getServerOffsetMs(db);
  const roomRef = ref(db, `gjRooms/${roomId}`);

  await runTransaction(roomRef, (room)=>{
    if(!room) return room;
    if(room.status === "ended") return room;
    room.players = room.players || {};
    const keys = Object.keys(room.players);

    // already joined?
    for(const k of keys){
      if(String(room.players[k]?.pid||"") === String(pid||"")) return room;
    }
    if(keys.length >= 2) return room;

    const newKey = keys.includes("P1") ? "P2" : "P1";
    const t = serverNowMs(offset);

    room.players[newKey] = {
      pid: String(pid||"anon"),
      name: String(name||"Player B"),
      joinedAt: t,
      connected: true,
      lastSeen: t,
      score: 0, combo: 0, miss: 0, acc: 0
    };

    const keys2 = Object.keys(room.players);
    if(keys2.length >= 2 && (room.status === "waiting" || room.status === "countdown")){
      room.status = "countdown";
      room.startAt = serverNowMs(offset) + Number(room.countdownMs || 3000);
      room.forfeit = { active:false, victim:"", deadline:0 };
    }
    return room;
  }, { applyLocally:false });

  const snap = await get(roomRef);
  if(!snap.exists()) throw new Error("ROOM_NOT_FOUND");
  const room = snap.val();
  if(room.status === "ended") throw new Error("ROOM_ENDED");

  let myKey = "";
  for(const k of Object.keys(room.players||{})){
    if(String(room.players[k]?.pid||"") === String(pid||"")) { myKey = k; break; }
  }
  if(!myKey){
    const n = Object.keys(room.players||{}).length;
    if(n>=2) throw new Error("ROOM_FULL");
    throw new Error("JOIN_FAILED");
  }
  return { roomId, playerKey: myKey, seed: room.seed, offset };
}

export function attachPresence({ db, roomId, playerKey }){
  const pRef  = ref(db, `gjPresence/${roomId}/${playerKey}`);
  const plyRef = ref(db, `gjRooms/${roomId}/players/${playerKey}`);

  set(pRef, { connected:true, lastSeen: serverTimestamp() }).catch(()=>{});
  update(plyRef, { connected:true, lastSeen: serverTimestamp() }).catch(()=>{});

  onDisconnect(pRef).set({ connected:false, lastSeen: serverTimestamp() }).catch(()=>{});
  onDisconnect(plyRef).update({ connected:false, lastSeen: serverTimestamp() }).catch(()=>{});

  return ()=> {
    update(pRef, { connected:false, lastSeen: serverTimestamp() }).catch(()=>{});
    update(plyRef, { connected:false, lastSeen: serverTimestamp() }).catch(()=>{});
  };
}

export function createBattleClient({ db, roomId, playerKey, offset }){
  const roomRef = ref(db, `gjRooms/${roomId}`);
  const myRef   = ref(db, `gjRooms/${roomId}/players/${playerKey}`);

  let lastRoom = null;
  let roomCb = null;
  let lastReportAt = 0;
  let disposed = false;

  function onState(cb){
    roomCb = (snap)=>{ lastRoom = snap.val() || null; cb(lastRoom); };
    onValue(roomRef, roomCb);
    return ()=>{ try{ off(roomRef, "value", roomCb); }catch(e){} };
  }

  function getOpponent(){
    if(!lastRoom || !lastRoom.players) return null;
    const oppKey = (playerKey === "P1") ? "P2" : "P1";
    return lastRoom.players[oppKey] || null;
  }

  async function reportStats({ score, combo, miss, acc }){
    if(disposed) return;
    const t = nowMs();
    if(t - lastReportAt < 120) return;
    lastReportAt = t;
    try{
      await update(myRef, {
        score: Number(score||0),
        combo: Number(combo||0),
        miss:  Number(miss||0),
        acc:   Number(acc||0),
        connected: true,
        lastSeen: serverTimestamp()
      });
    }catch(e){}
  }

  async function ensurePlaying(){
    if(!lastRoom) return;
    if(lastRoom.status !== "countdown") return;
    const startAt = Number(lastRoom.startAt||0);
    if(!startAt) return;
    if(serverNowMs(offset) >= startAt){
      try{
        await runTransaction(roomRef, (room)=>{
          if(!room) return room;
          if(room.status === "countdown") room.status = "playing";
          return room;
        }, { applyLocally:false });
      }catch(e){}
    }
  }

  async function forfeitTick(){
    if(!lastRoom || lastRoom.status !== "playing") return;

    const oppKey = (playerKey === "P1") ? "P2" : "P1";
    const opp = lastRoom.players?.[oppKey];
    if(!opp) return;

    const sNow = serverNowMs(offset);
    const grace = Number(lastRoom.forfeitGraceMs || 5000);
    const lastSeen = Number(opp.lastSeen || 0);
    const connected = !!opp.connected;
    const stale = (lastSeen && (sNow - lastSeen > 2500));
    const disconnected = (!connected) || stale;

    if(!disconnected){
      // cancel if opponent is back
      if(lastRoom.forfeit?.active && lastRoom.forfeit?.victim === oppKey){
        try{ await update(roomRef, { forfeit:{active:false, victim:"", deadline:0} }); }catch(e){}
      }
      return;
    }

    // start forfeit window if not active
    if(!lastRoom.forfeit?.active){
      const deadline = sNow + grace;
      try{
        await runTransaction(roomRef, (room)=>{
          if(!room) return room;
          if(room.status !== "playing") return room;
          if(room.forfeit?.active) return room;
          room.forfeit = { active:true, victim: oppKey, deadline };
          return room;
        }, { applyLocally:false });
      }catch(e){}
      return;
    }

    // resolve forfeit
    const f = lastRoom.forfeit || {};
    if(f.active && f.victim === oppKey && Number(f.deadline||0) && sNow >= Number(f.deadline||0)){
      const winner = playerKey;
      try{
        await runTransaction(roomRef, (room)=>{
          if(!room) return room;
          if(room.status === "ended") return room;
          room.status = "ended";
          room.winner = winner;
          room.endedReason = "forfeit";
          room.endAt = serverNowMs(offset);
          return room;
        }, { applyLocally:false });
      }catch(e){}
    }
  }

  const timer = setInterval(()=>{
    if(disposed) return;
    ensurePlaying().catch(()=>{});
    forfeitTick().catch(()=>{});
  }, 250);

  function dispose(){
    disposed = true;
    clearInterval(timer);
    try{ if(roomCb) off(roomRef, "value", roomCb); }catch(e){}
  }

  return { onState, getOpponent, reportStats, dispose, get lastRoom(){ return lastRoom; }, offset };
}
