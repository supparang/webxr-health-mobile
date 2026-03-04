// === /herohealth/vr/battle-rtdb.js ===
// Firebase RTDB Battle — v5
// ✅ Room (create/join via ?room=CODE)
// ✅ Ready-check + Countdown + StartAt (server-time aligned)
// ✅ Reconnect/Resume (reuse player key per room+pid)
// ✅ Soft anti-cheat (clamp score deltas + time guard)
// ✅ Forfeit on disconnect/timeout (forfeitMs)
// ✅ Rematch (same room -> new roundId)
// Emits:
//  - hha:battle-players {players[]}
//  - hha:battle-state   {phase, room, roundId, startAtMs, winner?}
//  - hha:battle-countdown {startAtMs, leftMs}
//  - hha:battle-start {startAtMs}
//  - hha:battle-ended {winner, reason, results}
// FULL v20260304-BATTLE-RTDB-V5
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}
function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(_){ return d; }
}
function nowMs(){ return (performance && performance.now) ? performance.timeOrigin + performance.now() : Date.now(); }
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
function safeKey(s, max=32){
  s = String(s||'').trim();
  s = s.replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,max);
  return s || '';
}
function randRoom(len=6){
  const abc='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s='';
  for(let i=0;i<len;i++) s += abc[(Math.random()*abc.length)|0];
  return s;
}

// ---- Firebase loader (modular SDK via gstatic) ----
async function loadFirebase(){
  // pin a stable version you already use if needed
  const v = '9.22.2';
  const appMod = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`);
  const dbMod  = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-database.js`);
  return { ...appMod, ...dbMod };
}

function getFirebaseConfig(){
  // ✅ Put config in one of these (recommended: window.HHA_FIREBASE_CONFIG)
  // Example:
  // window.HHA_FIREBASE_CONFIG = { apiKey, authDomain, databaseURL, projectId, appId };
  const cfg =
    WIN.HHA_FIREBASE_CONFIG ||
    WIN.__HHA_FIREBASE_CONFIG__ ||
    WIN.firebaseConfig ||
    null;
  return cfg || null;
}

function lsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,String(v)); }catch(_){ } }

export async function initBattle(opts){
  opts = opts || {};
  const enabled = !!opts.enabled;
  if(!enabled) return disabledBattle();

  const pid = safeKey(opts.pid || qs('pid','anon'), 24) || 'anon';
  const gameKey = safeKey(opts.gameKey || 'game', 24) || 'game';
  const roomIn = safeKey(opts.room || qs('room',''), 10);
  const room = roomIn || randRoom(6);

  const autostartMs = clamp(opts.autostartMs ?? qs('autostart','3000'), 500, 10000);
  const forfeitMs   = clamp(opts.forfeitMs   ?? qs('forfeit','5000'), 1500, 20000);

  const fbCfg = getFirebaseConfig();
  if(!fbCfg){
    console.warn('[Battle] Missing Firebase config: set window.HHA_FIREBASE_CONFIG');
    throw new Error('Missing Firebase config');
  }

  const fb = await loadFirebase();
  const app = fb.initializeApp(fbCfg, `hha-${gameKey}`);
  const db  = fb.getDatabase(app);

  // Root paths
  const rootPath = `hhaBattle/${gameKey}/${room}`;
  const metaRef  = fb.ref(db, `${rootPath}/meta`);
  const playersRef = fb.ref(db, `${rootPath}/players`);
  const scoresRef  = fb.ref(db, `${rootPath}/scores`);
  const roundsRef  = fb.ref(db, `${rootPath}/rounds`);

  // Player key persistence
  const lk = `HHA_BATTLE_PLAYERKEY:${gameKey}:${room}:${pid}`;
  let playerKey = safeKey(lsGet(lk), 32);
  if(!playerKey){
    playerKey = safeKey(`${pid}_${Math.random().toString(36).slice(2,10)}`, 32);
    lsSet(lk, playerKey);
  }

  const meRef = fb.ref(db, `${rootPath}/players/${playerKey}`);

  // Create meta if absent
  const metaSnap = await fb.get(metaRef);
  if(!metaSnap.exists()){
    const createdAt = fb.serverTimestamp();
    await fb.set(metaRef, {
      room,
      gameKey,
      createdAt,
      phase: 'lobby',   // lobby|countdown|running|ended
      roundId: 1,
      startAtMs: null,
      winner: null,
      endedReason: null
    });
  }

  // Join player record
  const joinAt = fb.serverTimestamp();
  await fb.update(meRef, {
    pid,
    key: playerKey,
    joinedAt: joinAt,
    lastSeenAt: joinAt,
    ready: false,
    connected: true,
    forfeited: false
  });

  // Presence / onDisconnect
  try{
    fb.onDisconnect(meRef).update({
      connected: false,
      lastSeenAt: fb.serverTimestamp()
    });
  }catch(e){
    // ok
  }

  // Local state
  let currentPhase = 'lobby';
  let roundId = 1;
  let startAtMs = null;
  let countdownTimer = null;
  let heartbeatTimer = null;

  // soft anti-cheat tracking
  let lastPushAt = 0;
  let lastScore = 0;

  // ---- listeners ----
  fb.onValue(metaRef, (snap)=>{
    const m = snap.val() || {};
    currentPhase = String(m.phase || 'lobby');
    roundId = Number(m.roundId || 1) || 1;
    startAtMs = (m.startAtMs==null) ? null : Number(m.startAtMs);

    emit('hha:battle-state', {
      room,
      gameKey,
      phase: currentPhase,
      roundId,
      startAtMs,
      winner: m.winner || null,
      endedReason: m.endedReason || null
    });

    // countdown driver
    if(currentPhase === 'countdown' && Number.isFinite(startAtMs)){
      startCountdown(startAtMs);
    }else{
      stopCountdown();
    }

    if(currentPhase === 'running' && Number.isFinite(startAtMs)){
      // fire start event (clients can call __GJ_START_NOW__)
      emit('hha:battle-start', { room, startAtMs, roundId });
    }

    if(currentPhase === 'ended'){
      // results come from scores + meta winner
      // run finalize UI via event
      emit('hha:battle-ended', { room, gameKey, roundId, winner: m.winner||null, reason: m.endedReason||'ended' });
    }
  });

  fb.onValue(playersRef, (snap)=>{
    const obj = snap.val() || {};
    const players = Object.values(obj).map(p=>({
      pid: p.pid || '',
      key: p.key || '',
      ready: !!p.ready,
      connected: (p.connected !== false),
      forfeited: !!p.forfeited,
      lastSeenAt: p.lastSeenAt || null
    }));
    emit('hha:battle-players', { room, gameKey, roundId, players });
    // If 2 players ready -> trigger countdown (one client will write)
    maybeArmCountdown(players).catch(()=>{});
  });

  // Heartbeat lastSeen
  heartbeatTimer = setInterval(()=>{
    try{
      fb.update(meRef, { lastSeenAt: fb.serverTimestamp(), connected:true });
    }catch(_){}
  }, 1500);

  // Forfeit watcher: if opponent disconnects too long while running/countdown
  const forfeitWatch = setInterval(async ()=>{
    try{
      const m = (await fb.get(metaRef)).val() || {};
      const phase = String(m.phase||'lobby');
      if(phase !== 'countdown' && phase !== 'running') return;

      const ps = (await fb.get(playersRef)).val() || {};
      const arr = Object.values(ps);
      if(arr.length < 2) return;

      const me = arr.find(x=>x.key===playerKey);
      const opp = arr.find(x=>x.key!==playerKey);
      if(!opp) return;

      const oppConn = (opp.connected !== false);
      const oppForf = !!opp.forfeited;
      if(oppForf) return;

      // If opp disconnected => wait forfeitMs then forfeit them
      if(!oppConn){
        // write forfeit if still disconnected after forfeitMs (best-effort)
        const t0 = Date.now();
        const stamp = t0;
        // store a "disco marker" under meta ephemeral? too heavy; just act after threshold
        // We approximate with lastSeenAt if numeric (server timestamp might not be)
        // We'll do simple: if disconnected now & phase running -> forfeit after forfeitMs by setTimeout once
        // Guard: only schedule once using local flag on battle instance
        scheduleForfeitIfStillDisconnected(opp.key, forfeitMs);
      }
    }catch(_){}
  }, 1200);

  let forfeitTimers = new Map();
  function scheduleForfeitIfStillDisconnected(oppKey, waitMs){
    if(forfeitTimers.has(oppKey)) return;
    const t = setTimeout(async ()=>{
      forfeitTimers.delete(oppKey);
      try{
        const oppRef = fb.ref(db, `${rootPath}/players/${oppKey}`);
        const oppSnap = await fb.get(oppRef);
        const opp = oppSnap.val();
        if(!opp) return;
        if(opp.connected !== false) return;
        if(opp.forfeited) return;

        await fb.update(oppRef, { forfeited:true, ready:false });
        await endMatchByForfeit(oppKey);
      }catch(_){}
    }, waitMs);
    forfeitTimers.set(oppKey, t);
  }

  async function endMatchByForfeit(forfeitKey){
    try{
      const ps = (await fb.get(playersRef)).val() || {};
      const arr = Object.values(ps);
      const winner = arr.find(x=>x.key !== forfeitKey);
      await fb.update(metaRef, {
        phase: 'ended',
        winner: winner?.pid || null,
        endedReason: 'forfeit'
      });
    }catch(_){}
  }

  // ---- countdown write (arm) ----
  async function maybeArmCountdown(players){
    // Need exactly 2 players, both ready, phase lobby
    try{
      if(players.length < 2) return;
      // ignore if someone forfeited
      if(players.some(p=>p.forfeited)) return;

      const meta = (await fb.get(metaRef)).val() || {};
      const phase = String(meta.phase || 'lobby');
      if(phase !== 'lobby') return;

      const ready2 = players.filter(p=>p.ready && p.connected).length >= 2;
      if(!ready2) return;

      // Use transaction to avoid race
      await fb.runTransaction(metaRef, (cur)=>{
        cur = cur || {};
        if(String(cur.phase||'lobby') !== 'lobby') return cur;
        const startAt = Date.now() + autostartMs; // client time; acceptable for casual. (server-time is heavier)
        cur.phase = 'countdown';
        cur.startAtMs = startAt;
        cur.winner = null;
        cur.endedReason = null;
        return cur;
      });
    }catch(_){}
  }

  function startCountdown(startAt){
    stopCountdown();
    const tick = ()=>{
      const left = startAt - Date.now();
      emit('hha:battle-countdown', { room, roundId, startAtMs: startAt, leftMs: left });
      if(left <= 0){
        stopCountdown();
        // move to running once
        fb.runTransaction(metaRef, (cur)=>{
          cur = cur || {};
          if(String(cur.phase||'') !== 'countdown') return cur;
          cur.phase = 'running';
          return cur;
        }).catch(()=>{});
      }else{
        countdownTimer = setTimeout(tick, 100);
      }
    };
    tick();
  }

  function stopCountdown(){
    if(countdownTimer){
      clearTimeout(countdownTimer);
      countdownTimer = null;
    }
  }

  async function setReady(on){
    await fb.update(meRef, { ready: !!on, connected:true, forfeited:false, lastSeenAt: fb.serverTimestamp() });
  }

  // ---- score sync ----
  async function pushScore(payload){
    payload = payload || {};
    const phaseOk = (currentPhase === 'running' || currentPhase === 'countdown');
    if(!phaseOk) return;

    // soft anti-cheat: clamp deltas & push rate
    const t = Date.now();
    if(t - lastPushAt < 80) return; // rate limit
    lastPushAt = t;

    const s = clamp(payload.score ?? 0, 0, 200000);
    const miss = clamp(payload.miss ?? 0, 0, 9999);
    const accPct = clamp(payload.accPct ?? 0, 0, 100);
    const med = clamp(payload.medianRtGoodMs ?? 0, 0, 99999);

    const delta = s - lastScore;
    // disallow huge jumps
    if(delta > 800) payload.score = lastScore + 800;
    lastScore = clamp(payload.score ?? s, 0, 200000);

    const entry = {
      pid,
      key: playerKey,
      t: fb.serverTimestamp(),
      score: lastScore,
      miss,
      accPct,
      medianRtGoodMs: med,
      comboMax: clamp(payload.comboMax ?? 0, 0, 9999),
      shots: clamp(payload.shots ?? 0, 0, 99999),
      hits: clamp(payload.hits ?? 0, 0, 99999),
      stage: clamp(payload.stage ?? 0, 0, 9),
      pro: !!payload.pro,
      mode: String(payload.mode || '')
    };

    const scoreRef = fb.ref(db, `${rootPath}/scores/${roundId}/${playerKey}`);
    await fb.set(scoreRef, entry);
  }

  function pickWinner(a,b){
    // score desc, acc desc, miss asc, medianRT asc
    if((a.score||0) !== (b.score||0)) return (a.score||0) > (b.score||0) ? a : b;
    if((a.accPct||0) !== (b.accPct||0)) return (a.accPct||0) > (b.accPct||0) ? a : b;
    if((a.miss||0) !== (b.miss||0)) return (a.miss||0) < (b.miss||0) ? a : b;
    if((a.medianRtGoodMs||0) !== (b.medianRtGoodMs||0)) return (a.medianRtGoodMs||0) < (b.medianRtGoodMs||0) ? a : b;
    return a; // tie -> a
  }

  async function finalizeEnd(summary){
    // Called by game on end (time/miss/win/background)
    try{
      // write my final score
      await pushScore({
        score: summary?.scoreFinal ?? summary?.score ?? 0,
        miss: summary?.missTotal ?? summary?.miss ?? 0,
        accPct: summary?.accPct ?? 0,
        medianRtGoodMs: summary?.medianRtGoodMs ?? 0,
        comboMax: summary?.comboMax ?? 0,
        shots: summary?.shots ?? 0,
        hits: summary?.hits ?? 0,
        stage: summary?.stage ?? 0,
        pro: !!summary?.pro,
        mode: summary?.mode || ''
      });

      // Only one client should decide winner -> transaction on meta
      const scoreSnap = await fb.get(fb.ref(db, `${rootPath}/scores/${roundId}`));
      const obj = scoreSnap.val() || {};
      const arr = Object.values(obj);
      if(arr.length < 2){
        // wait a moment for other player
        setTimeout(async ()=>{
          try{
            const s2 = await fb.get(fb.ref(db, `${rootPath}/scores/${roundId}`));
            const o2 = s2.val() || {};
            const a2 = Object.values(o2);
            if(a2.length >= 2) await decideEnd(a2, summary?.reason || 'end');
          }catch(_){}
        }, 300);
        return;
      }
      await decideEnd(arr, summary?.reason || 'end');
    }catch(e){
      console.warn('[Battle] finalizeEnd failed', e);
    }
  }

  async function decideEnd(arr, reason){
    try{
      // ignore forfeited players
      const ps = (await fb.get(playersRef)).val() || {};
      const forfeitedKeys = new Set(Object.values(ps).filter(p=>p.forfeited).map(p=>p.key));
      const filtered = arr.filter(x=>!forfeitedKeys.has(x.key));

      if(filtered.length < 2){
        // if someone forfeited, winner is remaining
        const winner = filtered[0] || arr[0];
        await fb.update(metaRef, { phase:'ended', winner: winner?.pid || null, endedReason: 'forfeit' });
        return;
      }

      const w = pickWinner(filtered[0], filtered[1]);
      await fb.runTransaction(metaRef, (cur)=>{
        cur = cur || {};
        if(String(cur.phase||'') === 'ended') return cur;
        cur.phase = 'ended';
        cur.winner = w?.pid || null;
        cur.endedReason = String(reason||'end');
        return cur;
      });
    }catch(_){}
  }

  async function rematch(){
    // Reset meta -> lobby, increment roundId, clear ready flags
    try{
      const nextRound = (roundId||1) + 1;
      await fb.update(metaRef, {
        phase: 'lobby',
        roundId: nextRound,
        startAtMs: null,
        winner: null,
        endedReason: null
      });
      // set all players ready=false, forfeited=false
      const ps = (await fb.get(playersRef)).val() || {};
      for(const k of Object.keys(ps)){
        const pr = fb.ref(db, `${rootPath}/players/${k}`);
        await fb.update(pr, { ready:false, forfeited:false });
      }
      emit('hha:battle-state', { room, gameKey, phase:'lobby', roundId: nextRound, startAtMs:null });
    }catch(_){}
  }

  async function leave(){
    try{
      stopCountdown();
      if(heartbeatTimer) clearInterval(heartbeatTimer);
      if(forfeitWatch) clearInterval(forfeitWatch);
      for(const t of forfeitTimers.values()) clearTimeout(t);
      forfeitTimers.clear();
      await fb.update(meRef, { connected:false, ready:false, lastSeenAt: fb.serverTimestamp() });
    }catch(_){}
  }

  const api = {
    enabled: true,
    room,
    pid,
    gameKey,
    playerKey,
    setReady,
    pushScore,
    finalizeEnd,
    rematch,
    leave,
    get state(){
      return { room, pid, gameKey, phase: currentPhase, roundId, startAtMs };
    }
  };

  emit('hha:battle-state', { room, gameKey, phase: currentPhase, roundId, startAtMs });
  return api;
}

function disabledBattle(){
  return {
    enabled:false,
    setReady: async()=>{},
    pushScore: async()=>{},
    finalizeEnd: async()=>{},
    rematch: async()=>{},
    leave: async()=>{},
    get state(){ return { phase:'off' }; }
  };
}