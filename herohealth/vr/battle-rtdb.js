// === /herohealth/vr/battle-rtdb.js ===
// Firebase RTDB Battle — v4
// ✅ Reconnect/Resume (reuse player key)
// ✅ Soft anti-cheat (clamp + winner guard by time/tune cap)
// ✅ Rematch (same room, new round)
// ✅ Spectator (read-only)
// Emits: hha:battle-players, hha:battle-state, hha:battle-ended
// FULL v20260304-BATTLE-RTDB-V4
'use strict';

import { pickWinner, normalizeResult } from './score-rank.js';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function qs(k, d=''){ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } }
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
function emit(name, detail){ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){} }
function safeKey(s, max=24){
  s = String(s||'').trim();
  s = s.replace(/[.#$\[\]]/g,'');
  s = s.replace(/[^a-zA-Z0-9_-]/g,'');
  s = s.slice(0, max);
  return s;
}
function mkPlayerKey(){ return `p_${Math.random().toString(36).slice(2,9)}_${Date.now().toString(36)}`; }

function getCfg(){
  return WIN.HHA_BATTLE_CFG || WIN.HHA_FIREBASE_CONFIG || null;
}

async function loadFirebase(){
  const v = String(WIN.HHA_FIREBASE_VERSION || '10.12.5');
  const base = `https://www.gstatic.com/firebasejs/${v}`;
  const appMod  = await import(`${base}/firebase-app.js`);
  const dbMod   = await import(`${base}/firebase-database.js`);
  const authMod = await import(`${base}/firebase-auth.js`);
  return { appMod, dbMod, authMod };
}
async function ensureApp(cfg){
  const { appMod } = await loadFirebase();
  const { initializeApp, getApps } = appMod;
  const apps = getApps();
  if(apps && apps.length) return apps[0];
  return initializeApp(cfg);
}
async function ensureAuth(app){
  const { authMod } = await loadFirebase();
  const { getAuth, signInAnonymously } = authMod;
  const auth = getAuth(app);
  try{ if(!auth.currentUser) await signInAnonymously(auth); }catch(e){}
  return auth;
}

function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k, String(v||'')); }catch(e){} }

function battleKeyStore(gameKey, room, pid){
  return `HHA_BATTLE_MEKEY:${String(gameKey)}:${String(room)}:${String(pid)}`;
}

// ---- soft anti-cheat cap (approx by tune + elapsed)
function scoreCapApprox({ elapsedSec, plannedSec, tune, diff }){
  elapsedSec = clamp(elapsedSec, 0, 9999);
  plannedSec = clamp(plannedSec, 10, 600);

  const spawnBase = clamp(tune?.spawnBase ?? 0.78, 0.2, 2.0);
  const stormMult = clamp(tune?.stormMult ?? 1.0, 0.5, 2.0);

  const stormSec = Math.max(0, Math.min(elapsedSec, Math.min(40, plannedSec*0.45)));
  const normSec  = Math.max(0, elapsedSec - stormSec);

  const estSpawns = normSec * spawnBase + stormSec * (spawnBase*stormMult);

  // upper bound: assume many hits are good+combo-ish
  const maxPerHit = (diff==='hard') ? 30 : (diff==='easy') ? 26 : 28;
  const cap = Math.round(estSpawns * maxPerHit + 260); // + boss/bonus cushion
  return clamp(cap, 0, 999999);
}

export async function initBattle(opts){
  opts = opts || {};
  if(!opts.enabled) return null;

  const cfg = getCfg();
  if(!cfg || !cfg.databaseURL || !cfg.apiKey || !cfg.appId){
    console.warn('[battle] Missing config: set window.HHA_BATTLE_CFG = firebaseConfig');
    return null;
  }

  const gameKey = safeKey(opts.gameKey || 'goodjunk', 24) || 'goodjunk';
  const pid = String(opts.pid || qs('pid','anon')).trim() || 'anon';
  const spectator = String(opts.spectator ?? qs('spectator','0')) === '1';

  const room = safeKey(opts.room || qs('room',''), 24);
  if(!room){
    // v4: allow UI-only usage (host/join handled elsewhere) but if you call from game, must have room
    return null;
  }

  const autostartMs = clamp(opts.autostartMs ?? Number(qs('autostart','3000'))||3000, 500, 15000);
  const forfeitMs   = clamp(opts.forfeitMs   ?? Number(qs('forfeit','5000'))||5000, 1000, 30000);

  const plannedSec  = clamp(opts.plannedSec ?? Number(qs('time','80'))||80, 20, 300);
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const tune = opts.tune || null;

  // reuse meKey for reconnect
  const storeKey = battleKeyStore(gameKey, room, pid);
  const reused = (!spectator) ? safeKey(lsGet(storeKey) || '', 60) : '';
  const meKey = spectator ? 'spectator' : (reused || mkPlayerKey());
  if(!spectator) lsSet(storeKey, meKey);

  // Firebase
  const { dbMod } = await loadFirebase();
  const { getDatabase, ref, child, get, set, update, onValue, onDisconnect, serverTimestamp, runTransaction, remove } = dbMod;

  const app = await ensureApp(cfg);
  await ensureAuth(app);
  const db = getDatabase(app);

  async function getServerOffsetMs(){
    const snap = await get(ref(db, '.info/serverTimeOffset'));
    return Number(snap.val() || 0);
  }
  const offsetMs = await getServerOffsetMs();
  const serverNow = ()=> Date.now() + offsetMs;

  const root = ref(db, `hha_battle/${gameKey}/rooms/${room}`);
  const playersRef = child(root, 'players');
  const stateRef   = child(root, 'state');
  const myRef      = child(playersRef, meKey);

  // init state
  await runTransaction(stateRef, (cur)=>{
    if(cur) return cur;
    const t0 = serverNow();
    return {
      status:'waiting',
      createdAt: t0,
      startAt: null,
      endAt: null,
      round: 1,
      roomSeed: `seed_${Math.floor(t0)}`,
      rule: 'score→acc→miss→medianRT',
      autostartMs,
      forfeitMs,
      // keep tune snapshot for guard (optional)
      tune: tune || null,
      plannedSec,
      diff,
      winner:'',
      reason:'',
      forfeit:null,
      rematch:{ want:{} }
    };
  }, { applyLocally:false });

  // join player (or resume)
  if(!spectator){
    const t = serverNow();
    await set(myRef, {
      pid,
      name: String(opts.name || qs('name', pid) || pid).slice(0,24),
      joinedAt: t,
      lastSeen: t,
      connected: true,
      score: 0,
      miss: 0,
      accPct: 0,
      medianRtGoodMs: 0,
      ended: false,
      endSummary: null
    });

    try{ await onDisconnect(myRef).update({ connected:false, lastSeen: serverTimestamp() }); }catch(e){}
    try{ await onDisconnect(myRef).remove(); }catch(e){}
  }

  const battle = {
    enabled:true,
    spectator,
    room,
    gameKey,
    pid,
    meKey,
    opponentKey:null,
    players:{},
    state:{ status:'waiting' },
    offsetMs,
    serverNow,
    pushScore,
    finalizeEnd,
    requestRematch,
    destroy,
    getOpponent
  };

  function computeOpponent(){
    const keys = Object.keys(battle.players||{});
    battle.opponentKey = keys.find(k => k !== meKey) || null;
    return battle.opponentKey;
  }
  function getOpponent(){
    const k = computeOpponent();
    return k ? (battle.players?.[k] || null) : null;
  }

  // ----- listeners -----
  let unsubPlayers = null;
  let unsubState = null;

  unsubPlayers = onValue(playersRef, (snap)=>{
    battle.players = snap.val() || {};
    computeOpponent();
    emit('hha:battle-players', { room, meKey, opponentKey: battle.opponentKey, players: battle.players });

    // autostart when 2 players and waiting
    tryAutostart().catch(()=>{});
  });

  unsubState = onValue(stateRef, (snap)=>{
    battle.state = snap.val() || { status:'waiting' };
    emit('hha:battle-state', { room, ...battle.state });

    if(String(battle.state.status) === 'ended'){
      maybeEmitEndedOnce().catch(()=>{});
      maybeStartRematchIfBothWant().catch(()=>{});
    }
  });

  // heartbeat / forfeit check
  const pingInt = setInterval(async ()=>{
    try{
      if(!spectator){
        await update(myRef, { lastSeen: serverTimestamp(), connected:true });
      }
      await ensurePlayingAtStart();
      if(!spectator) await maybeForfeitTick();
      if(!spectator) await maybeEndWhenBothEnded();
    }catch(e){}
  }, 650);

  async function tryAutostart(){
    if(String(battle.state?.status||'') !== 'waiting') return;
    const keys = Object.keys(battle.players||{});
    if(keys.length < 2) return;

    await runTransaction(stateRef, (cur)=>{
      cur = cur || {};
      if(cur.status !== 'waiting') return cur;
      const st = serverNow() + Number(cur.autostartMs||autostartMs);
      return { ...cur, status:'countdown', startAt: st, winner:'', reason:'' };
    }, { applyLocally:false });
  }

  async function ensurePlayingAtStart(){
    const cur = battle.state || {};
    if(cur.status !== 'countdown') return;
    const st = Number(cur.startAt||0);
    if(!st) return;
    if(serverNow() < st) return;
    await runTransaction(stateRef, (x)=>{
      x = x || {};
      if(x.status === 'countdown') x.status = 'playing';
      return x;
    }, { applyLocally:false });
  }

  // ---- pushScore (anti-spam + clamp + cap) ----
  let lastPushAt = 0;
  async function pushScore(payload){
    if(spectator) return;
    const t = Date.now();
    if(t - lastPushAt < 140) return; // ~7Hz
    lastPushAt = t;

    const d = payload || {};
    const miss = clamp(d.miss, 0, 9999)|0;
    const accPct = clamp(d.accPct, 0, 100);
    const medRt = clamp(d.medianRtGoodMs, 0, 20000)|0;

    // cap score by elapsed + tune
    const st = Number(battle.state?.startAt || 0);
    const elapsedSec = st ? Math.max(0, (battle.serverNow() - st)/1000) : 0;
    const cap = scoreCapApprox({
      elapsedSec,
      plannedSec: Number(battle.state?.plannedSec || plannedSec),
      tune: battle.state?.tune || tune,
      diff: String(battle.state?.diff || diff)
    });

    const score = clamp(d.score, 0, cap)|0;

    try{
      await update(myRef, { score, miss, accPct, medianRtGoodMs: medRt, lastSeen: serverTimestamp(), connected:true });
    }catch(e){}
  }

  async function finalizeEnd(endSummary){
    if(spectator) return;
    const endedAt = serverNow();
    try{
      await update(myRef, { ended:true, endSummary: { ...(endSummary||{}), ts: endedAt }, lastSeen: serverTimestamp(), connected:true });
    }catch(e){}

    // if both ended -> mark room ended
    await maybeEndWhenBothEnded();
  }

  async function maybeEndWhenBothEnded(){
    const p = battle.players || {};
    const keys = Object.keys(p);
    if(keys.length < 2) return;
    const endedCount = keys.filter(k => !!p[k]?.ended).length;
    if(endedCount < 2) return;

    await runTransaction(stateRef, (cur)=>{
      cur = cur || {};
      if(cur.status === 'ended') return cur;
      return { ...cur, status:'ended', endAt: serverNow(), reason:'both-ended' };
    }, { applyLocally:false });
  }

  // ---- forfeit ----
  async function maybeForfeitTick(){
    const cur = battle.state || {};
    if(cur.status !== 'playing') return;

    const oppKey = battle.opponentKey;
    const opp = oppKey ? battle.players?.[oppKey] : null;
    if(!opp) return;

    const lastSeen = Number(opp.lastSeen||0);
    const stale = (serverNow() - lastSeen) > 3500;
    const disconnected = (!opp.connected) || stale;

    if(!disconnected){
      // clear forfeit if active
      if(cur.forfeit?.active){
        await update(stateRef, { forfeit: null }).catch(()=>{});
      }
      return;
    }

    // start forfeit if none
    if(!cur.forfeit?.active){
      const deadline = serverNow() + Number(cur.forfeitMs||forfeitMs);
      await runTransaction(stateRef, (x)=>{
        x = x || {};
        if(x.status !== 'playing') return x;
        if(x.forfeit?.active) return x;
        x.forfeit = { active:true, victim: oppKey, deadline };
        return x;
      }, { applyLocally:false });
      return;
    }

    // if deadline passed -> end room
    const dl = Number(cur.forfeit.deadline||0);
    if(dl && serverNow() >= dl){
      await runTransaction(stateRef, (x)=>{
        x = x || {};
        if(x.status === 'ended') return x;
        return { ...x, status:'ended', endAt: serverNow(), winner: meKey, reason:'forfeit' };
      }, { applyLocally:false });
    }
  }

  // ---- rematch ----
  async function requestRematch(){
    if(spectator) return false;
    try{
      await runTransaction(stateRef, (cur)=>{
        cur = cur || {};
        cur.rematch = cur.rematch || { want:{} };
        cur.rematch.want = cur.rematch.want || {};
        cur.rematch.want[meKey] = 1;
        return cur;
      }, { applyLocally:false });
      return true;
    }catch(e){
      return false;
    }
  }

  async function maybeStartRematchIfBothWant(){
    const cur = battle.state || {};
    if(String(cur.status) !== 'ended') return;

    const p = battle.players || {};
    const keys = Object.keys(p);
    if(keys.length < 2) return;

    const want = cur.rematch?.want || {};
    const allWant = keys.every(k => !!want[k]);
    if(!allWant) return;

    const t0 = serverNow();
    const nextRound = clamp(Number(cur.round||1)+1, 1, 999);
    const newSeed = `seed_${Math.floor(t0)}_r${nextRound}`;

    await runTransaction(stateRef, (x)=>{
      x = x || {};
      if(x.status !== 'ended') return x;
      return {
        ...x,
        status:'waiting',
        startAt:null,
        endAt:null,
        winner:'',
        reason:'rematch',
        round: nextRound,
        roomSeed: newSeed,
        rematch:{ want:{} },
        forfeit:null
      };
    }, { applyLocally:false });

    // reset players (best effort)
    try{
      for(const k of keys){
        await update(child(playersRef, k), {
          score:0, miss:0, accPct:0, medianRtGoodMs:0,
          ended:false, endSummary:null,
          connected:true, lastSeen: serverTimestamp()
        });
      }
    }catch(e){}
  }

  // ---- ended event (winner guard) ----
  let endedEmitted = false;
  async function maybeEmitEndedOnce(){
    if(endedEmitted) return;
    endedEmitted = true;

    const p = battle.players || {};
    const keys = Object.keys(p);
    if(keys.length < 2) return;

    const Akey = keys[0], Bkey = keys[1];
    const Araw = p[Akey]?.endSummary || p[Akey] || {};
    const Braw = p[Bkey]?.endSummary || p[Bkey] || {};

    const a = normalizeResult({ ...Araw, pid: p[Akey]?.pid, room, gameKey });
    const b = normalizeResult({ ...Braw, pid: p[Bkey]?.pid, room, gameKey });

    // apply cap again for fairness (guard opponent spoof)
    const st = Number(battle.state?.startAt || 0);
    const elapsedSec = st ? Math.max(0, (battle.serverNow() - st)/1000) : 0;
    const cap = scoreCapApprox({ elapsedSec, plannedSec: Number(battle.state?.plannedSec||plannedSec), tune: battle.state?.tune||tune, diff: String(battle.state?.diff||diff) });

    a.score = clamp(a.score, 0, cap)|0;
    b.score = clamp(b.score, 0, cap)|0;

    const w = pickWinner(a, b);
    const winnerKey = (w.winner === 'A') ? Akey : (w.winner === 'B') ? Bkey : '';

    emit('hha:battle-ended', {
      room,
      a, b,
      winnerKey,
      winner: winnerKey ? (winnerKey===meKey ? 'ME' : 'OPP') : 'TIE',
      rule: 'score→acc→miss→medianRT',
      tieReason: w.reason
    });

    // also write winner once (optional)
    try{
      await runTransaction(stateRef, (cur)=>{
        cur = cur || {};
        if(cur.winner) return cur;
        cur.winner = winnerKey || '';
        return cur;
      }, { applyLocally:false });
    }catch(e){}
  }

  async function destroy(){
    clearInterval(pingInt);
    try{ unsubPlayers && unsubPlayers(); }catch(e){}
    try{ unsubState && unsubState(); }catch(e){}
    if(!spectator){
      try{ await remove(myRef); }catch(e){}
    }
  }

  // expose
  WIN.__HHA_BATTLE__ = battle;
  return battle;
}