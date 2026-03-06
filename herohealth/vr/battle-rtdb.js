// === /herohealth/vr/battle-rtdb.js ===
// Firebase RTDB Battle — v6 (Battle Ready Pack / Classroom Trial)
// ✅ Room create/join via ?room=CODE
// ✅ Ready-check + countdown + startAtMs (server-time aligned)
// ✅ Reconnect / resume by room+pid
// ✅ Soft anti-cheat score clamp + time guard
// ✅ Forfeit on disconnect / timeout
// ✅ Rematch (same room, new roundId)
// ✅ Emits rich state for launcher / HUD / result overlay
//
// Emits:
//  - hha:battle-room       {room, roundId, meKey, pid}
//  - hha:battle-players    {room, roundId, meKey, players[]}
//  - hha:battle-state      {phase, room, roundId, startAtMs, endAtMs, winner?, reason?}
//  - hha:battle-countdown  {room, roundId, startAtMs, leftMs}
//  - hha:battle-start      {room, roundId, startAtMs}
//  - hha:battle-score      {room, roundId, me, opp, leader}
//  - hha:battle-ended      {room, roundId, winner, reason, results}
// FULL v20260306-BATTLE-RTDB-V6
'use strict';

import { pickWinner as pickWinnerAB } from './score-rank.js';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}
function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(_){ return d; }
}
function clamp(v,a,b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}
function safeKey(s, max=32){
  s = String(s || '').trim();
  s = s.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, max);
  return s || '';
}
function randRoom(len=6){
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for(let i=0;i<len;i++) s += abc[(Math.random()*abc.length)|0];
  return s;
}
function nowMs(){ return Date.now(); }
function lsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k, String(v)); }catch(_){ } }
function lsDel(k){ try{ localStorage.removeItem(k); }catch(_){ } }

async function loadFirebase(){
  const v = '9.22.2';
  const appMod = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`);
  const dbMod  = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-database.js`);
  return { ...appMod, ...dbMod };
}

function getFirebaseConfig(){
  return WIN.HHA_FIREBASE_CONFIG || WIN.__HHA_FIREBASE_CONFIG__ || WIN.firebaseConfig || null;
}

function disabledBattle(){
  return {
    enabled:false,
    room:'',
    roundId:'',
    meKey:'',
    serverNow:()=>Date.now(),
    setReady:()=>{},
    syncScore:()=>{},
    requestRematch:()=>{},
    leave:()=>{},
    destroy:()=>{},
  };
}

function normalizePlayer(raw, key){
  raw = raw || {};
  return {
    key,
    pid: String(raw.pid || ''),
    nick: String(raw.nick || raw.pid || ''),
    ready: !!raw.ready,
    connected: raw.connected !== false,
    joinedAtMs: Number(raw.joinedAtMs || 0) || 0,
    lastSeenMs: Number(raw.lastSeenMs || 0) || 0,
    score: Number(raw.score || 0) || 0,
    acc: Number(raw.acc || 0) || 0,
    miss: Number(raw.miss || 0) || 0,
    medianRT: Number(raw.medianRT || 0) || 0,
    finishMs: Number(raw.finishMs || 0) || 0,
    forfeit: !!raw.forfeit,
  };
}

function normalizeBattleResult(input){
  input = input || {};
  return {
    score: Number(input.score || input.scoreFinal || 0) || 0,
    acc: Number(input.acc || input.accPct || 0) || 0,
    miss: Number(input.miss || input.missTotal || 0) || 0,
    medianRT: Number(input.medianRT || input.medianRtGoodMs || 0) || 0,
    finishMs: Number(input.finishMs || 0) || 0,
  };
}

export async function initBattle(opts){
  opts = opts || {};
  const enabled = !!opts.enabled;
  if(!enabled) return disabledBattle();

  const pid = safeKey(opts.pid || qs('pid','anon'), 24) || 'anon';
  const nick = safeKey(opts.nick || qs('nick', pid), 24) || pid;
  const gameKey = safeKey(opts.gameKey || 'game', 24) || 'game';
  const roomIn = safeKey(opts.room || qs('room',''), 10);
  const room = roomIn || randRoom(6);

  const autostartMs = clamp(opts.autostartMs ?? qs('autostart','3000'), 500, 10000);
  const forfeitMs   = clamp(opts.forfeitMs   ?? qs('forfeit','5000'), 1500, 20000);
  const roundMs     = clamp(opts.roundMs     ?? qs('time','80') * 1000, 20000, 300000);

  const fbCfg = getFirebaseConfig();
  if(!fbCfg){
    console.warn('[battle-rtdb] missing Firebase config');
    return disabledBattle();
  }

  const fb = await loadFirebase();
  const {
    initializeApp, getApps, getApp,
    getDatabase, ref, child, get, set, update, remove, push,
    onValue, off, onDisconnect, serverTimestamp, runTransaction
  } = fb;

  const app = getApps().length ? getApp() : initializeApp(fbCfg);
  const db = getDatabase(app);

  // ---- server time offset ----
  const offsetRef = ref(db, '.info/serverTimeOffset');
  let serverOffsetMs = 0;
  const offOffset = onValue(offsetRef, (snap)=>{
    serverOffsetMs = Number(snap.val() || 0) || 0;
  });
  const serverNow = ()=> nowMs() + serverOffsetMs;

  // ---- paths ----
  const base = `hha-battle/${gameKey}/rooms/${room}`;
  const roomRef = ref(db, base);
  const metaRef = ref(db, `${base}/meta`);
  const playersRef = ref(db, `${base}/players`);
  const roundsRef = ref(db, `${base}/rounds`);
  const stateRef = ref(db, `${base}/state`);
  const rematchRef = ref(db, `${base}/rematch`);

  // ---- stable meKey by room+pid ----
  const meLsKey = `HHA_BATTLE_PLAYERKEY:${gameKey}:${room}:${pid}`;
  let meKey = safeKey(lsGet(meLsKey), 32);
  if(!meKey){
    meKey = `p_${pid}_${Math.random().toString(36).slice(2,8)}`;
    lsSet(meLsKey, meKey);
  }

  let currentRoundId = '';
  let currentPhase = 'lobby';
  let countdownTimer = null;
  let destroyFns = [];
  let lastPlayers = [];
  let lastState = null;
  let localReady = false;
  let localDestroyed = false;
  let localScoreShadow = {
    score:0, acc:0, miss:0, medianRT:0, finishMs:0,
    sentAtMs:0,
  };

  // anti-cheat baseline
  let runningStartAtMs = 0;
  let runningEndAtMs = 0;
  let lastAcceptedScore = 0;

  function clearCountdownTimer(){
    if(countdownTimer){
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function emitPlayers(players){
    emit('hha:battle-players', {
      room,
      roundId: currentRoundId,
      meKey,
      players
    });
  }

  function emitState(detail){
    emit('hha:battle-state', {
      room,
      roundId: currentRoundId,
      ...detail
    });
  }

  function emitScore(){
    const me = lastPlayers.find(p => p.key === meKey) || null;
    const opp = lastPlayers.find(p => p.key !== meKey) || null;
    let leader = 'tie';
    if(me && opp){
      if(me.score > opp.score) leader = 'me';
      else if(me.score < opp.score) leader = 'opp';
    }
    emit('hha:battle-score', {
      room,
      roundId: currentRoundId,
      me, opp, leader
    });
  }

  async function ensureRoomMeta(){
    const metaSnap = await get(metaRef);
    if(!metaSnap.exists()){
      await set(metaRef, {
        gameKey,
        room,
        createdAtMs: serverNow(),
        createdAt: serverTimestamp(),
      });
    }
  }

  async function ensureRound(){
    const stateSnap = await get(stateRef);
    const st = stateSnap.val() || {};
    if(st.roundId){
      currentRoundId = String(st.roundId);
      currentPhase = String(st.phase || 'lobby');
      return;
    }

    const roundId = `r_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const startState = {
      room,
      gameKey,
      roundId,
      phase:'lobby',
      startAtMs:0,
      endAtMs:0,
      winner:'',
      reason:'',
      updatedAtMs: serverNow(),
      updatedAt: serverTimestamp(),
    };

    await set(stateRef, startState);
    currentRoundId = roundId;
    currentPhase = 'lobby';

    await set(ref(db, `${base}/rounds/${roundId}`), {
      createdAtMs: serverNow(),
      createdAt: serverTimestamp(),
      autostartMs,
      forfeitMs,
      roundMs,
    });
  }

  async function joinPlayer(){
    const pRef = ref(db, `${base}/players/${meKey}`);
    await update(pRef, {
      pid,
      nick,
      ready:false,
      connected:true,
      forfeit:false,
      joinedAtMs: serverNow(),
      joinedAt: serverTimestamp(),
      lastSeenMs: serverNow(),
      lastSeen: serverTimestamp(),
      score:0,
      acc:0,
      miss:0,
      medianRT:0,
      finishMs:0,
    });

    try{
      await onDisconnect(pRef).update({
        connected:false,
        lastSeenMs: serverNow(),
        lastSeen: serverTimestamp(),
      });
    }catch(_){}

    emit('hha:battle-room', {
      room,
      roundId: currentRoundId,
      meKey,
      pid
    });
  }

  async function resetPlayerForRound(){
    const pRef = ref(db, `${base}/players/${meKey}`);
    localScoreShadow = { score:0, acc:0, miss:0, medianRT:0, finishMs:0, sentAtMs:0 };
    lastAcceptedScore = 0;

    await update(pRef, {
      ready: false,
      connected: true,
      forfeit: false,
      score: 0,
      acc: 0,
      miss: 0,
      medianRT: 0,
      finishMs: 0,
      lastSeenMs: serverNow(),
      lastSeen: serverTimestamp(),
    });
    localReady = false;
  }

  async function maybeStartCountdown(players){
    if(localDestroyed) return;
    if(currentPhase !== 'lobby') return;

    const active = players.filter(p => p.connected !== false);
    if(active.length < 2) return;

    const allReady = active.every(p => p.ready);
    if(!allReady) return;

    // transaction prevents double countdown
    const result = await runTransaction(stateRef, (cur)=>{
      cur = cur || {};
      const phase = String(cur.phase || 'lobby');
      if(phase !== 'lobby') return cur;
      const startAtMs = serverNow() + autostartMs;
      return {
        ...cur,
        phase:'countdown',
        startAtMs,
        endAtMs: startAtMs + roundMs,
        winner:'',
        reason:'',
        updatedAtMs: serverNow(),
      };
    }, { applyLocally:false }).catch(()=>null);

    if(result && result.committed){
      // state listener will emit countdown/start
    }
  }

  function attachCountdown(startAtMs){
    clearCountdownTimer();
    countdownTimer = setInterval(()=>{
      const leftMs = Math.max(0, startAtMs - serverNow());
      emit('hha:battle-countdown', {
        room,
        roundId: currentRoundId,
        startAtMs,
        leftMs
      });
      if(leftMs <= 0){
        clearCountdownTimer();
      }
    }, 100);
  }

  async function markForfeitIfNeeded(players, state){
    if(!state) return;
    const phase = String(state.phase || 'lobby');
    if(phase !== 'countdown' && phase !== 'running') return;

    const me = players.find(p => p.key === meKey) || null;
    const opp = players.find(p => p.key !== meKey) || null;
    if(!opp) return;

    const oppGone = (!opp.connected) && ((serverNow() - Number(opp.lastSeenMs || 0)) >= forfeitMs);
    if(!oppGone) return;

    const winner = meKey;
    const results = {
      [meKey]: normalizeBattleResult(me || {}),
      [opp.key]: { ...normalizeBattleResult(opp || {}), forfeit:true }
    };

    await update(stateRef, {
      phase:'ended',
      winner,
      reason:'forfeit',
      updatedAtMs: serverNow(),
      updatedAt: serverTimestamp(),
    }).catch(()=>{});

    emit('hha:battle-ended', {
      room,
      roundId: currentRoundId,
      winner,
      reason:'forfeit',
      results
    });
  }

  async function finalizeIfRoundFinished(players, state){
    if(!state) return;
    if(String(state.phase || '') !== 'running') return;

    const now = serverNow();
    const endAtMs = Number(state.endAtMs || 0) || 0;
    if(now < endAtMs) return;

    const a = players[0];
    const b = players[1];
    if(!a || !b) return;

    const ar = normalizeBattleResult(a);
    const br = normalizeBattleResult(b);

    const picked = pickWinnerAB(ar, br) || {};
    const winner = picked.winnerKey === 'a'
      ? a.key
      : picked.winnerKey === 'b'
      ? b.key
      : '';

    const reason = picked.rule || 'score';

    const result = await runTransaction(stateRef, (cur)=>{
      cur = cur || {};
      if(String(cur.phase || '') === 'ended') return cur;
      if(String(cur.phase || '') !== 'running') return cur;
      return {
        ...cur,
        phase:'ended',
        winner,
        reason,
        updatedAtMs: serverNow(),
        updatedAt: serverTimestamp(),
      };
    }, { applyLocally:false }).catch(()=>null);

    if(result && result.committed){
      emit('hha:battle-ended', {
        room,
        roundId: currentRoundId,
        winner,
        reason,
        results: {
          [a.key]: ar,
          [b.key]: br,
        }
      });
    }
  }

  function sanitizeScorePayload(payload){
    payload = payload || {};
    const score = Math.max(0, Number(payload.score || 0) || 0);
    const acc = clamp(payload.acc ?? payload.accPct ?? 0, 0, 100);
    const miss = Math.max(0, Number(payload.miss ?? payload.missTotal ?? 0) || 0);
    const medianRT = Math.max(0, Number(payload.medianRT ?? payload.medianRtGoodMs ?? 0) || 0);
    const finishMs = Math.max(0, Number(payload.finishMs || 0) || 0);
    return { score, acc, miss, medianRT, finishMs };
  }

  async function syncScore(payload){
    if(localDestroyed) return;
    if(currentPhase !== 'running') return;

    const now = serverNow();
    if(runningStartAtMs && now < runningStartAtMs - 500) return;
    if(runningEndAtMs && now > runningEndAtMs + 3000) return;

    const clean = sanitizeScorePayload(payload);

    // soft anti-cheat:
    // allow only limited jump by elapsed time
    const elapsedMs = Math.max(0, now - runningStartAtMs);
    const elapsedS = elapsedMs / 1000;
    const hardCap = Math.floor(elapsedS * 60) + 200; // generous
    const maxAllowed = Math.max(lastAcceptedScore + 120, hardCap);

    if(clean.score > maxAllowed){
      clean.score = maxAllowed;
    }

    if(clean.score < lastAcceptedScore){
      // never regress score server-side
      clean.score = lastAcceptedScore;
    }

    lastAcceptedScore = clean.score;
    localScoreShadow = {
      ...clean,
      sentAtMs: now
    };

    await update(ref(db, `${base}/players/${meKey}`), {
      score: clean.score,
      acc: clean.acc,
      miss: clean.miss,
      medianRT: clean.medianRT,
      finishMs: clean.finishMs,
      lastSeenMs: now,
      lastSeen: serverTimestamp(),
      connected:true,
    }).catch(()=>{});
  }

  async function setReady(on){
    if(localDestroyed) return;
    localReady = !!on;
    await update(ref(db, `${base}/players/${meKey}`), {
      ready: !!on,
      connected:true,
      lastSeenMs: serverNow(),
      lastSeen: serverTimestamp(),
    }).catch(()=>{});
  }

  async function requestRematch(){
    if(localDestroyed) return;

    const now = serverNow();
    await update(ref(db, `${base}/rematch/${meKey}`), {
      want: true,
      atMs: now,
      at: serverTimestamp(),
      pid,
      nick,
    }).catch(()=>{});

    const snap = await get(rematchRef).catch(()=>null);
    const raw = snap?.val() || {};
    const keys = Object.keys(raw);
    const activePlayers = lastPlayers.filter(p => p.connected !== false);
    const allWant = activePlayers.length >= 2 && activePlayers.every(p => raw[p.key]?.want === true);

    if(!allWant) return;

    const newRoundId = `r_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

    await set(stateRef, {
      room,
      gameKey,
      roundId:newRoundId,
      phase:'lobby',
      startAtMs:0,
      endAtMs:0,
      winner:'',
      reason:'',
      updatedAtMs: now,
      updatedAt: serverTimestamp(),
    }).catch(()=>{});

    await set(ref(db, `${base}/rounds/${newRoundId}`), {
      createdAtMs: now,
      createdAt: serverTimestamp(),
      autostartMs,
      forfeitMs,
      roundMs,
      rematchOf: currentRoundId || '',
    }).catch(()=>{});

    // clear rematch flags
    await remove(rematchRef).catch(()=>{});

    // reset players
    const updates = {};
    lastPlayers.forEach(p=>{
      updates[`${p.key}/ready`] = false;
      updates[`${p.key}/forfeit`] = false;
      updates[`${p.key}/score`] = 0;
      updates[`${p.key}/acc`] = 0;
      updates[`${p.key}/miss`] = 0;
      updates[`${p.key}/medianRT`] = 0;
      updates[`${p.key}/finishMs`] = 0;
      updates[`${p.key}/connected`] = true;
      updates[`${p.key}/lastSeenMs`] = now;
      updates[`${p.key}/lastSeen`] = serverTimestamp();
    });
    await update(playersRef, updates).catch(()=>{});

    currentRoundId = newRoundId;
    currentPhase = 'lobby';
    localReady = false;
    await resetPlayerForRound().catch(()=>{});
  }

  async function leave(){
    clearCountdownTimer();
    await update(ref(db, `${base}/players/${meKey}`), {
      connected:false,
      lastSeenMs: serverNow(),
      lastSeen: serverTimestamp(),
      ready:false,
    }).catch(()=>{});
  }

  function destroy(){
    if(localDestroyed) return;
    localDestroyed = true;
    clearCountdownTimer();
    destroyFns.forEach(fn => { try{ fn(); }catch(_){ } });
    destroyFns = [];
    try{ off(offsetRef, 'value', offOffset); }catch(_){}
  }

  // ---- bootstrap ----
  await ensureRoomMeta();
  await ensureRound();
  await joinPlayer();

  // ---- state listener ----
  const stopState = onValue(stateRef, (snap)=>{
    const st = snap.val() || {};
    const prevPhase = currentPhase;
    currentRoundId = String(st.roundId || currentRoundId || '');
    currentPhase = String(st.phase || 'lobby');
    lastState = st;

    const startAtMs = Number(st.startAtMs || 0) || 0;
    const endAtMs = Number(st.endAtMs || 0) || 0;

    runningStartAtMs = startAtMs;
    runningEndAtMs = endAtMs;

    emitState({
      phase: currentPhase,
      startAtMs,
      endAtMs,
      winner: st.winner || '',
      reason: st.reason || '',
    });

    if(currentPhase === 'countdown'){
      attachCountdown(startAtMs);
    }else{
      clearCountdownTimer();
    }

    if(prevPhase !== 'running' && currentPhase === 'running'){
      emit('hha:battle-start', {
        room,
        roundId: currentRoundId,
        startAtMs
      });
    }

    if(currentPhase === 'ended'){
      clearCountdownTimer();
    }
  });
  destroyFns.push(()=> off(stateRef, 'value', stopState));

  // ---- players listener ----
  const stopPlayers = onValue(playersRef, async (snap)=>{
    const raw = snap.val() || {};
    const players = Object.keys(raw)
      .map(k => normalizePlayer(raw[k], k))
      .sort((a,b)=>(a.joinedAtMs||0)-(b.joinedAtMs||0))
      .slice(0,2);

    lastPlayers = players;
    emitPlayers(players);
    emitScore();

    await maybeStartCountdown(players).catch(()=>{});
    await markForfeitIfNeeded(players, lastState).catch(()=>{});
    await finalizeIfRoundFinished(players, lastState).catch(()=>{});
  });
  destroyFns.push(()=> off(playersRef, 'value', stopPlayers));

  // ---- heartbeat ----
  const hb = setInterval(()=>{
    if(localDestroyed) return;
    update(ref(db, `${base}/players/${meKey}`), {
      connected:true,
      lastSeenMs: serverNow(),
      lastSeen: serverTimestamp(),
    }).catch(()=>{});
  }, 1500);
  destroyFns.push(()=> clearInterval(hb));

  // ---- expose api ----
  return {
    enabled:true,
    room,
    roundId: currentRoundId,
    meKey,
    serverNow,
    setReady,
    syncScore,
    requestRematch,
    leave,
    destroy,
  };
}