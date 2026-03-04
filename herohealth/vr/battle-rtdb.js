// === /herohealth/vr/battle-rtdb.js ===
// Firebase RTDB Battle — v5 (Seamless Rejoin + Classroom-ready)
// ✅ Rejoin/resume mid-playing (reuse player key, keep node on disconnect)
// ✅ Countdown→Playing gate by server time offset
// ✅ Soft anti-cheat (clamp score by cap approx)
// ✅ Rematch (same room, new round seed)
// ✅ Spectator mode
// Emits: hha:battle-players, hha:battle-state, hha:battle-ended
// FULL v20260304-BATTLE-RTDB-V5
'use strict';

import { pickWinner, normalizeResult } from './score-rank.js';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function qs(k, d=''){ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } }
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
function emit(name, detail){ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){} }

function safeKey(s, max=28){
  s = String(s||'').trim();
  s = s.replace(/[.#$\[\]]/g,'');
  s = s.replace(/[^a-zA-Z0-9_-]/g,'');
  s = s.slice(0, max);
  return s;
}

function mkPlayerKey(){ return `p_${Math.random().toString(36).slice(2,9)}_${Date.now().toString(36)}`; }
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k, String(v||'')); }catch(e){} }

function getCfg(){
  // accept either battle cfg or firebase config
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

// ---- soft score cap (approx) ----
function scoreCapApprox({ elapsedSec, plannedSec, tune, diff }){
  elapsedSec = clamp(elapsedSec, 0, 9999);
  plannedSec = clamp(plannedSec, 10, 600);

  const spawnBase = clamp(tune?.spawnBase ?? 0.78, 0.2, 2.0);
  const stormMult = clamp(tune?.stormMult ?? 1.0, 0.5, 2.0);

  const stormSec = Math.max(0, Math.min(elapsedSec, Math.min(40, plannedSec*0.45)));
  const normSec  = Math.max(0, elapsedSec - stormSec);

  const estSpawns = normSec * spawnBase + stormSec * (spawnBase*stormMult);

  const maxPerHit = (diff==='hard') ? 32 : (diff==='easy') ? 26 : 29;
  const cap = Math.round(estSpawns * maxPerHit + 320);
  return clamp(cap, 0, 999999);
}

function storeKey(gameKey, room, pid){
  return `HHA_BATTLE_MEKEY:${String(gameKey)}:${String(room)}:${String(pid)}`;
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
  if(!room) return null;

  const autostartMs = clamp(opts.autostartMs ?? Number(qs('autostart','3000'))||3000, 500, 15000);
  const forfeitMs   = clamp(opts.forfeitMs   ?? Number(qs('forfeit','5000'))||5000, 1000, 60000);

  const plannedSec  = clamp(opts.plannedSec ?? Number(qs('time','80'))||80, 20, 300);
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const tune = opts.tune || null;

  // reuse key (rejoin/resume)
  const sk = storeKey(gameKey, room, pid);
  const reuse = (!spectator) ? safeKey(lsGet(sk) || '', 60) : '';
  const meKey = spectator ? `spectator_${Math.random().toString(36).slice(2,7)}` : (reuse || mkPlayerKey());
  if(!spectator) lsSet(sk, meKey);

  const { dbMod } = await loadFirebase();
  const {
    getDatabase, ref, child, get, set, update, onValue, onDisconnect,
    serverTimestamp, runTransaction, remove
  } = dbMod;

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

  // init state once
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
      plannedSec,
      diff,
      tune: tune || null,
      winner:'',
      reason:'',
      forfeit:null,
      rematch:{ want:{} }
    };
  }, { applyLocally:false });

  // join/resume player
  if(!spectator){
    const t = serverNow();

    // IMPORTANT: use update() first to keep any existing record (resume), then ensure fields exist
    await update(myRef, {
      pid,
      name: String(opts.name || qs('name', pid) || pid).slice(0,24),
      joinedAt: t,
      lastSeen: t,
      connected: true,
      ended: false
    });

    // On disconnect: mark offline BUT DO NOT REMOVE (so we can rejoin seamlessly)
    try{ await onDisconnect(myRef).update({ connected:false, lastSeen: serverTimestamp() }); }catch(e){}
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
    battle.opponentKey = keys.find(k => k !== battle.meKey) || null;
    return battle.opponentKey;
  }
  function getOpponent(){
    const k = computeOpponent();
    return k ? (battle.players?.[k] || null) : null;
  }

  // listeners
  let unsubPlayers = null;
  let unsubState = null;

  unsubPlayers = onValue(playersRef, (snap)=>{
    battle.players = snap.val() || {};
    computeOpponent();
    emit('hha:battle-players', { room, meKey, opponentKey: battle.opponentKey, players: battle.players });
    tryAutostart().catch(()=>{});
  });

  unsubState = onValue(stateRef, (snap)=>{
    battle.state = snap.val() || { status:'waiting' };
    emit('hha:battle-state', { room, ...battle.state });
    if(String(battle.state.status) === 'ended'){
      maybeEmitEndedOnce().catch(()=>{});
      maybeStartRematchIfBothWant().catch(()=>{});
      cleanupStalePlayers().catch(()=>{});
    }
  });

  // heartbeat + gates
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
    // count only real players (ignore spectators if any)
    const real = keys.filter(k => String(battle.players?.[k]?.pid||'') !== '' );
    if(real.length < 2) return;

    await runTransaction(stateRef, (cur)=>{
      cur = cur || {};
      if(cur.status !== 'waiting') return cur;
      const st = serverNow() + Number(cur.autostartMs||autostartMs);
      return { ...cur, status:'countdown', startAt: st, winner:'', reason:'', forfeit:null };
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

  // push score (7Hz, clamp + cap)
  let lastPushAt = 0;
  async function pushScore(payload){
    if(spectator) return;
    const t = Date.now();
    if(t - lastPushAt < 140) return;
    lastPushAt = t;

    const d = payload || {};
    const miss = clamp(d.miss, 0, 9999)|0;
    const accPct = clamp(d.accPct, 0, 100);
    const medRt = clamp(d.medianRtGoodMs, 0, 20000)|0;

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
      await update(myRef, {
        score,
        miss,
        accPct,
        medianRtGoodMs: medRt,
        lastSeen: serverTimestamp(),
        connected:true
      });
    }catch(e){}
  }

  async function finalizeEnd(endSummary){
    if(spectator) return;
    const endedAt = battle.serverNow();
    try{
      await update(myRef, { ended:true, endSummary: { ...(endSummary||{}), ts: endedAt }, lastSeen: serverTimestamp(), connected:true });
    }catch(e){}
    await maybeEndWhenBothEnded();
  }

  async function maybeEndWhenBothEnded(){
    const p = battle.players || {};
    const keys = Object.keys(p);
    const real = keys.filter(k => String(p[k]?.pid||'') !== '');
    if(real.length < 2) return;
    const endedCount = real.filter(k => !!p[k]?.ended).length;
    if(endedCount < 2) return;

    await runTransaction(stateRef, (cur)=>{
      cur = cur || {};
      if(cur.status === 'ended') return cur;
      return { ...cur, status:'ended', endAt: serverNow(), reason:'both-ended' };
    }, { applyLocally:false });
  }

  async function maybeForfeitTick(){
    const cur = battle.state || {};
    if(cur.status !== 'playing') return;

    const oppKey = battle.opponentKey;
    const opp = oppKey ? battle.players?.[oppKey] : null;
    if(!opp) return;

    const lastSeen = Number(opp.lastSeen||0);
    const stale = (serverNow() - lastSeen) > 3800;
    const disconnected = (!opp.connected) || stale;

    if(!disconnected){
      if(cur.forfeit?.active){
        await update(stateRef, { forfeit: null }).catch(()=>{});
      }
      return;
    }

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

    const dl = Number(cur.forfeit.deadline||0);
    if(dl && serverNow() >= dl){
      await runTransaction(stateRef, (x)=>{
        x = x || {};
        if(x.status === 'ended') return x;
        return { ...x, status:'ended', endAt: serverNow(), winner: meKey, reason:'forfeit' };
      }, { applyLocally:false });
    }
  }

  // rematch
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
    const real = keys.filter(k => String(p[k]?.pid||'') !== '');
    if(real.length < 2) return;

    const want = cur.rematch?.want || {};
    const allWant = real.every(k => !!want[k]);
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

    // reset players for next round
    try{
      for(const k of real){
        await update(child(playersRef, k), {
          score:0, miss:0, accPct:0, medianRtGoodMs:0,
          ended:false, endSummary:null,
          connected:true, lastSeen: serverTimestamp()
        });
      }
    }catch(e){}
  }

  // end event
  let endedEmitted = false;
  async function maybeEmitEndedOnce(){
    if(endedEmitted) return;
    endedEmitted = true;

    const p = battle.players || {};
    const keys = Object.keys(p);
    const real = keys.filter(k => String(p[k]?.pid||'') !== '');
    if(real.length < 2) return;

    const Akey = real[0], Bkey = real[1];
    const Araw = p[Akey]?.endSummary || p[Akey] || {};
    const Braw = p[Bkey]?.endSummary || p[Bkey] || {};

    const a = normalizeResult({ ...Araw, pid: p[Akey]?.pid, room, gameKey });
    const b = normalizeResult({ ...Braw, pid: p[Bkey]?.pid, room, gameKey });

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

    // persist winner if empty
    try{
      await runTransaction(stateRef, (cur)=>{
        cur = cur || {};
        if(cur.winner) return cur;
        cur.winner = winnerKey || '';
        return cur;
      }, { applyLocally:false });
    }catch(e){}
  }

  // cleanup stale (after ended only)
  async function cleanupStalePlayers(){
    const cur = battle.state || {};
    if(String(cur.status) !== 'ended') return;

    const p = battle.players || {};
    const keys = Object.keys(p);
    if(!keys.length) return;

    const tNow = serverNow();
    const cutoff = tNow - 1000*60*10; // 10 นาที
    for(const k of keys){
      const lastSeen = Number(p[k]?.lastSeen||0);
      const isReal = String(p[k]?.pid||'') !== '';
      if(isReal && lastSeen && lastSeen < cutoff){
        try{ await remove(child(playersRef, k)); }catch(e){}
      }
    }
  }

  async function destroy(opts2={}){
    clearInterval(pingInt);
    try{ unsubPlayers && unsubPlayers(); }catch(e){}
    try{ unsubState && unsubState(); }catch(e){}

    // default: DO NOT remove node (so reload can rejoin)
    // if caller really wants to leave room: destroy({ leave:true })
    if(!spectator && !!opts2.leave){
      try{ await remove(myRef); }catch(e){}
    }else{
      // best effort mark disconnected
      if(!spectator){
        try{ await update(myRef, { connected:false, lastSeen: serverTimestamp() }); }catch(e){}
      }
    }
  }

  WIN.__HHA_BATTLE__ = battle;
  return battle;
}