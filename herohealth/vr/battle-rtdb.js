// === /herohealth/vr/battle-rtdb.js ===
// Firebase RTDB battle room: join/create, live score sync, autostart, end sync, forfeit
// + ✅ FIX: use "/.info/serverTimeOffset" (leading slash) to avoid Invalid token in path
// + ✅ Use serverNow() everywhere (joinedAt/lastSeen/startAt/deadline/endAt)
// Emits:
//  - hha:battle-players {room, me, opponent, players}
//  - hha:battle-state {room, status:'waiting'|'started'|'ended', startAt?, endAt?}
//  - hha:battle-ended {room, a, b, winner, rule}
// FULL v20260228p1-BATTLE-RTDB-SERVEROFFSET
'use strict';

import { pickWinner, normalizeResult } from './score-rank.js';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function qs(k, d=''){ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } }
function now(){ return Date.now(); }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
}

function getCfg(){
  // prefer explicit cfg, else global
  // expected: { apiKey, authDomain, databaseURL, projectId, ... }
  return WIN.HHA_BATTLE_CFG || null;
}

let _fbCache = null;
async function loadFirebase(){
  // Uses Firebase modular CDN (v10+)
  if(_fbCache) return _fbCache;

  const v = (WIN.HHA_FIREBASE_VERSION || '10.12.2');
  const base = `https://www.gstatic.com/firebasejs/${v}`;
  const appMod = await import(`${base}/firebase-app.js`);
  const dbMod  = await import(`${base}/firebase-database.js`);
  const authMod= await import(`${base}/firebase-auth.js`);

  _fbCache = { appMod, dbMod, authMod };
  return _fbCache;
}

async function ensureApp(){
  const cfg = getCfg();
  if(!cfg || !cfg.databaseURL){
    throw new Error('Missing HHA_BATTLE_CFG.databaseURL');
  }
  const { appMod } = await loadFirebase();
  const { initializeApp, getApps } = appMod;

  const apps = getApps();
  if(apps && apps.length) return apps[0];
  return initializeApp(cfg);
}

async function ensureDb(app){
  const { dbMod } = await loadFirebase();
  const { getDatabase } = dbMod;
  return getDatabase(app);
}

async function ensureAuth(app){
  const { authMod } = await loadFirebase();
  const { getAuth, signInAnonymously } = authMod;
  const auth = getAuth(app);
  try{
    if(!auth.currentUser){
      await signInAnonymously(auth);
    }
  }catch(e){
    // auth may be optional depending on rules; proceed anyway
  }
  return auth;
}

function makeKey(){
  return `p_${Math.random().toString(36).slice(2,9)}_${now().toString(36)}`;
}

function safeRoom(room){
  room = String(room||'').trim();
  room = room.replace(/[^a-zA-Z0-9_-]/g,'').slice(0, 24);
  return room || `R${Math.random().toString(36).slice(2,8).toUpperCase()}`;
}

export async function initBattle(opts){
  opts = opts || {};
  const enabled = !!opts.enabled;
  if(!enabled) return null;

  const room = safeRoom(opts.room || qs('room',''));
  const pid  = String(opts.pid || qs('pid','anon')).trim() || 'anon';
  const gameKey = String(opts.gameKey || 'unknown');

  const autostartMs = clamp(opts.autostartMs ?? Number(qs('autostart','3000'))||3000, 500, 15000);
  const forfeitMs   = clamp(opts.forfeitMs   ?? Number(qs('forfeit','5000'))||5000, 1000, 30000);

  const meKey = makeKey();

  const app = await ensureApp();
  const db  = await ensureDb(app);
  await ensureAuth(app);

  const { dbMod } = await loadFirebase();
  const {
    ref, child, get, set, update, onValue, onDisconnect, serverTimestamp,
    runTransaction, remove
  } = dbMod;

  // --- server time offset (✅ FIX: must start with "/") ---
  let serverOffsetMs = 0;
  async function getServerOffsetMs(){
    try{
      const snap = await get(ref(db, "/.info/serverTimeOffset"));
      return Number(snap.val() || 0);
    }catch(e){
      // if rules block .info, fallback to 0 (still works)
      return 0;
    }
  }
  serverOffsetMs = await getServerOffsetMs();
  const serverNow = ()=> Date.now() + (Number(serverOffsetMs)||0);

  const root = ref(db, `hha_battle/${gameKey}/${room}`);
  const playersRef = child(root, 'players');
  const stateRef   = child(root, 'state');

  // Join as player
  const myRef = child(playersRef, meKey);
  const joinedAt = serverNow();

  await set(myRef, {
    pid,
    gameKey,
    joinedAt,
    lastSeen: joinedAt,
    score: 0,
    miss: 0,
    accPct: 0,
    medianRtGoodMs: 0,
    ended: false,
    endSummary: null
  });

  // Cleanup when disconnect
  try{
    await onDisconnect(myRef).remove();
  }catch(e){}

  // Create/init state if absent
  await runTransaction(stateRef, (cur)=>{
    if(cur) return cur;
    return {
      status: 'waiting',
      createdAt: joinedAt,
      startAt: null,
      endAt: null,
      rule: 'score→acc→miss→medianRT',
      autostartMs,
      forfeitMs
    };
  });

  const battle = {
    enabled: true,
    room,
    pid,
    gameKey,
    meKey,
    opponentKey: null,
    players: {},
    state: { status:'waiting' },
    serverOffsetMs,
    serverNow,
    pushScore,
    finalizeEnd,
    destroy
  };

  let unsubPlayers = null;
  let unsubState = null;

  async function tryAutostart(){
    // Autostart only if 2 players and state waiting
    if(String(battle.state?.status||'') !== 'waiting') return;
    const p = battle.players || {};
    const keys = Object.keys(p);
    if(keys.length < 2) return;

    // use transaction to set startAt once
    await runTransaction(stateRef, (cur)=>{
      cur = cur || {};
      if(cur.status !== 'waiting') return cur;
      const t0 = serverNow() + autostartMs;
      return { ...cur, status:'started', startAt: t0 };
    });
  }

  // Players listener
  unsubPlayers = onValue(playersRef, (snap)=>{
    const val = snap.val() || {};
    battle.players = val;

    // determine opponent (first other key)
    const keys = Object.keys(val);
    const opp = keys.find(k=>k !== meKey) || null;
    battle.opponentKey = opp;

    emit('hha:battle-players', {
      room,
      me: meKey,
      opponent: opp,
      players: val
    });

    // autostart logic: when 2 players and still waiting
    tryAutostart().catch(()=>{});
  }, (err)=>{
    console.warn('[battle] players onValue err', err);
  });

  // State listener
  unsubState = onValue(stateRef, (snap)=>{
    const s = snap.val() || { status:'waiting' };
    battle.state = s;
    emit('hha:battle-state', { room, ...s });

    // If ended, emit battle-ended once with payload a/b
    if(String(s.status) === 'ended'){
      const p = battle.players || {};
      const keys = Object.keys(p);

      if(keys.length >= 2){
        const A = p[keys[0]]?.endSummary || p[keys[0]] || null;
        const B = p[keys[1]]?.endSummary || p[keys[1]] || null;

        const a = normalizeResult({ ...A, pid: p[keys[0]]?.pid, gameKey, room });
        const b = normalizeResult({ ...B, pid: p[keys[1]]?.pid, gameKey, room });

        const w = pickWinner(a, b);
        emit('hha:battle-ended', {
          room,
          a, b,
          winner: w.winner,
          rule: 'score→acc→miss→medianRT'
        });
      }
    }
  }, (err)=>{
    console.warn('[battle] state onValue err', err);
  });

  // ping lastSeen (light)
  const pingInt = setInterval(()=>{
    try{
      update(myRef, { lastSeen: serverNow() });
    }catch(e){}
  }, 2500);

  async function pushScore(payload){
    // payload is hha:score detail {score, miss, accPct, medianRtGoodMs...}
    if(!payload) return;
    const d = {
      score: Number(payload.score||0) || 0,
      miss: Number(payload.miss||0) || 0,
      accPct: Number(payload.accPct||0) || 0,
      medianRtGoodMs: Number(payload.medianRtGoodMs||0) || 0,
      lastSeen: serverNow()
    };
    try{ await update(myRef, d); }catch(e){}
  }

  async function finalizeEnd(endSummary){
    // mark ended + attach endSummary
    const s = endSummary || {};
    const endedAt = serverNow();
    try{
      await update(myRef, { ended:true, endSummary: { ...s, ts: endedAt } });
    }catch(e){}

    const deadline = endedAt + forfeitMs;

    const timer = setInterval(async ()=>{
      const p = battle.players || {};
      const keys = Object.keys(p);
      const endedCount = keys.filter(k=> !!p[k]?.ended).length;

      // if someone left room, treat as forfeit
      if(keys.length < 2){
        clearInterval(timer);
        await runTransaction(stateRef, (cur)=>{
          cur = cur || {};
          if(cur.status === 'ended') return cur;
          return { ...cur, status:'ended', endAt: serverNow(), forfeit: true };
        });
        return;
      }

      if(endedCount >= 2){
        clearInterval(timer);
        await runTransaction(stateRef, (cur)=>{
          cur = cur || {};
          if(cur.status === 'ended') return cur;
          return { ...cur, status:'ended', endAt: serverNow(), forfeit: false };
        });
        return;
      }

      if(serverNow() >= deadline){
        clearInterval(timer);
        await runTransaction(stateRef, (cur)=>{
          cur = cur || {};
          if(cur.status === 'ended') return cur;
          return { ...cur, status:'ended', endAt: serverNow(), forfeit: true };
        });
      }
    }, 600);
  }

  async function destroy(){
    clearInterval(pingInt);
    try{ unsubPlayers && unsubPlayers(); }catch(e){}
    try{ unsubState && unsubState(); }catch(e){}
    // leave player node
    try{ await remove(myRef); }catch(e){}
  }

  // expose for debug
  WIN.__HHA_BATTLE__ = battle;

  return battle;
}