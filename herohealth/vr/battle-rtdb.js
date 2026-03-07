// === /herohealth/vr/battle-rtdb.js ===
// Firebase RTDB Battle — v7 classroom-ready
// FULL v20260307-BATTLE-RTDB-V7-CLASSROOM
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}
function emitBattleNotice(type, message, extra={}){
  emit('hha:battle-notice', {
    type: String(type || 'info'),
    message: String(message || ''),
    ...extra
  });
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
  s = s.replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,max);
  return s || '';
}
function randRoom(len=6){
  const abc='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s='';
  for(let i=0;i<len;i++) s += abc[(Math.random()*abc.length)|0];
  return s;
}
function lsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,String(v)); }catch(_){ } }

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
    pid:'',
    serverNow: ()=> Date.now(),
    setReady: async()=>{},
    syncScore: async()=>{},
    requestRematch: async()=>{},
    acceptRematch: async()=>{},
    declineRematch: async()=>{},
    getRematchState: ()=> ({ roundId:'', requestedBy:'', requestedAtMs:0, votes:{} }),
    saveRoundReport: async()=> null,
    leave: async()=>{},
    destroy: async()=>{},
    getRole: ()=> 'disabled',
    isSpectator: ()=> false,
    getJoinPolicy: ()=> ({
      role:'disabled',
      roomFull:false,
      lateJoin:false,
      invalidRoom:false
    }),
  };
}

function normalizePlayer(v, key){
  v = v || {};
  return {
    key,
    pid: String(v.pid || ''),
    nick: String(v.nick || v.pid || key || ''),
    ready: !!v.ready,
    connected: v.connected !== false,
    forfeit: !!v.forfeit,
    joinedAtMs: Number(v.joinedAtMs || 0) || 0,
    lastSeenMs: Number(v.lastSeenMs || 0) || 0,
    score: Number(v.score || 0) || 0,
    acc: Number(v.acc || 0) || 0,
    miss: Number(v.miss || 0) || 0,
    medianRT: Number(v.medianRT || 0) || 0,
    finishMs: Number(v.finishMs || 0) || 0,
  };
}

function sanitizeScorePayload(d){
  d = d || {};
  return {
    score: Math.max(0, Number(d.score || 0) || 0),
    acc: clamp(Number(d.accPct || d.acc || 0) || 0, 0, 100),
    miss: Math.max(0, Number(d.missTotal || d.miss || 0) || 0),
    medianRT: Math.max(0, Number(d.medianRtGoodMs || d.medianRT || 0) || 0),
    finishMs: Math.max(0, Number(d.finishMs || 0) || 0),
  };
}

function pickWinner(a, b){
  if(!a && !b) return { winnerKey:'', reason:'tie' };
  if(a && !b) return { winnerKey:a.key, reason:'forfeit' };
  if(!a && b) return { winnerKey:b.key, reason:'forfeit' };

  if((a.score||0) > (b.score||0)) return { winnerKey:a.key, reason:'score' };
  if((a.score||0) < (b.score||0)) return { winnerKey:b.key, reason:'score' };

  if((a.acc||0) > (b.acc||0)) return { winnerKey:a.key, reason:'acc' };
  if((a.acc||0) < (b.acc||0)) return { winnerKey:b.key, reason:'acc' };

  if((a.miss||0) < (b.miss||0)) return { winnerKey:a.key, reason:'miss' };
  if((a.miss||0) > (b.miss||0)) return { winnerKey:b.key, reason:'miss' };

  const art = Number(a.medianRT || 0) || 0;
  const brt = Number(b.medianRT || 0) || 0;
  if(art > 0 && brt > 0){
    if(art < brt) return { winnerKey:a.key, reason:'medianRT' };
    if(art > brt) return { winnerKey:b.key, reason:'medianRT' };
  }else if(art > 0 && brt === 0){
    return { winnerKey:a.key, reason:'medianRT' };
  }else if(brt > 0 && art === 0){
    return { winnerKey:b.key, reason:'medianRT' };
  }

  return { winnerKey:'', reason:'tie' };
}

export async function initBattle(opts){
  opts = opts || {};
  const enabled = !!opts.enabled;
  if(!enabled) return disabledBattle();

  const pid = safeKey(opts.pid || qs('pid','anon'), 24) || 'anon';
  const nick = String(opts.nick || qs('nick', pid)).trim() || pid;
  const gameKey = safeKey(opts.gameKey || 'game', 24) || 'game';
  const roomIn = safeKey(opts.room || qs('room',''), 10);
  const room = roomIn || randRoom(6);

  const autostartMs = clamp(opts.autostartMs ?? qs('autostart','3000'), 500, 10000);
  const forfeitMs   = clamp(opts.forfeitMs   ?? qs('forfeit','5000'), 1500, 20000);

  const fbCfg = getFirebaseConfig();
  if(!fbCfg){
    console.warn('[battle-rtdb] missing Firebase config');
    emitBattleNotice('error', 'ยังไม่ได้ตั้งค่า Firebase สำหรับ Battle', { code:'missing_firebase_config' });
    return disabledBattle();
  }

  let fb = null;
  try{
    fb = await loadFirebase();
  }catch(err){
    console.warn('[battle-rtdb] firebase load failed', err);
    emitBattleNotice('error', 'เชื่อมต่อระบบ Battle ไม่สำเร็จ', { code:'firebase_load_failed' });
    return disabledBattle();
  }

  const {
    initializeApp, getApps, getApp,
    getDatabase, ref, get, set, update, push,
    onValue, runTransaction, serverTimestamp, onDisconnect
  } = fb;

  const app = getApps().length ? getApp() : initializeApp(fbCfg);
  const db  = getDatabase(app);

  const base = `hha-battle/${gameKey}/rooms/${room}`;
  const metaRef = ref(db, `${base}/meta`);
  const playersRef = ref(db, `${base}/players`);
  const stateRef = ref(db, `${base}/state`);
  const rematchRef = ref(db, `${base}/rematch`);
  const rematchVotesRef = ref(db, `${base}/rematchVotes`);
  const reportsRef = ref(db, `${base}/reports`);
  const offsetRef = ref(db, `.info/serverTimeOffset`);

  let localDestroyed = false;
  let meKey = safeKey(lsGet(`HHA_BATTLE_MEKEY:${gameKey}:${room}:${pid}`) || '', 32);
  if(!meKey) meKey = `p_${pid}_${Math.random().toString(36).slice(2,8)}`;
  const meLsKey = `HHA_BATTLE_MEKEY:${gameKey}:${room}:${pid}`;
  lsSet(meLsKey, meKey);

  let currentRoundId = '';
  let currentRole = 'player';
  let roomFullFlag = false;
  let lateJoinFlag = false;
  let invalidRoomFlag = false;

  let rematchState = {
    roundId:'',
    requestedBy:'',
    requestedAtMs:0,
    votes:{}
  };

  let serverTimeOffset = 0;
  let unsubscribers = [];
  let countdownTimer = 0;

  function clearCountdownTimer(){
    if(countdownTimer){
      clearInterval(countdownTimer);
      countdownTimer = 0;
    }
  }
  function serverNow(){
    return Date.now() + serverTimeOffset;
  }
  function emitRoom(detail={}){
    emit('hha:battle-room', {
      room,
      roundId: currentRoundId,
      meKey: currentRole === 'player' ? meKey : '',
      pid,
      ...detail
    });
  }
  function emitPlayers(players){
    emit('hha:battle-players', { players });
  }
  function emitState(st){
    emit('hha:battle-state', {
      room,
      roundId: currentRoundId,
      ...(st || {})
    });
  }
  function emitRematchState(extra={}){
    emit('hha:battle-rematch-state', {
      room,
      roundId: rematchState.roundId || currentRoundId,
      requestedBy: rematchState.requestedBy || '',
      requestedAtMs: rematchState.requestedAtMs || 0,
      votes: rematchState.votes || {},
      ...extra
    });
  }
  function normalizeVoteMap(v){
    const out = {};
    Object.keys(v || {}).forEach(k=>{
      const row = v[k] || {};
      out[k] = {
        accepted: !!row.accepted,
        declined: !!row.declined,
        ts: Number(row.ts || 0) || 0
      };
    });
    return out;
  }
  function attachCountdown(startAtMs){
    clearCountdownTimer();
    if(!startAtMs || startAtMs <= 0) return;
    countdownTimer = setInterval(()=>{
      if(localDestroyed){
        clearCountdownTimer();
        return;
      }
      const leftMs = Math.max(0, Number(startAtMs || 0) - serverNow());
      emit('hha:battle-countdown', { room, roundId: currentRoundId, startAtMs, leftMs });
      if(leftMs <= 0) clearCountdownTimer();
    }, 200);
  }

  async function ensureMeta(){
    await runTransaction(metaRef, (v)=>{
      v = v || {};
      if(!v.createdAt) v.createdAt = serverTimestamp();
      if(!v.createdAtMs) v.createdAtMs = Date.now();
      v.room = room;
      v.gameKey = gameKey;
      return v;
    }).catch(()=>{});
  }

  async function ensureRoundIfMissing(){
    const stateSnap = await get(stateRef).catch(()=>null);
    const st = stateSnap?.val() || {};
    if(st.roundId){
      currentRoundId = String(st.roundId);
      return currentRoundId;
    }
    const newRoundId = `r_${Date.now()}`;
    await set(stateRef, {
      phase:'lobby',
      room,
      roundId:newRoundId,
      startAtMs:0,
      winner:'',
      reason:'',
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});
    currentRoundId = newRoundId;
    return currentRoundId;
  }

  async function joinPlayer(){
    const stateSnap = await get(stateRef).catch(()=>null);
    const st = stateSnap?.val() || {};
    const phase = String(st.phase || 'lobby').toLowerCase();

    const playersSnap = await get(playersRef).catch(()=>null);
    const rawPlayers = playersSnap?.val() || {};
    const existingPlayers = Object.keys(rawPlayers)
      .map(k => normalizePlayer(rawPlayers[k], k))
      .sort((a,b)=>(a.joinedAtMs||0)-(b.joinedAtMs||0));

    const existingMine = existingPlayers.find(p => p.key === meKey || p.pid === pid) || null;

    if(existingMine){
      currentRole = 'player';
      const pRef = ref(db, `${base}/players/${existingMine.key}`);
      meKey = existingMine.key;
      lsSet(meLsKey, meKey);

      await update(pRef, {
        pid,
        nick,
        connected:true,
        lastSeenMs: serverNow(),
        lastSeen: serverTimestamp(),
      }).catch(()=>{});

      try{
        await onDisconnect(pRef).update({
          connected:false,
          lastSeenMs: serverNow(),
          lastSeen: serverTimestamp(),
        });
      }catch(_){}

      emitRoom({ role:'player', resume:true });
      emitBattleNotice('info', 'กลับเข้าสู่ห้องเดิมแล้ว', {
        code:'resume_player',
        room,
        role:'player'
      });
      return;
    }

    if(existingPlayers.length >= 2){
      roomFullFlag = true;

      if(phase === 'countdown' || phase === 'running' || phase === 'ended'){
        currentRole = 'spectator';
        lateJoinFlag = (phase === 'countdown' || phase === 'running');
        emitRoom({ meKey:'', role:'spectator', lateJoin: lateJoinFlag, roomFull:true });
        emitBattleNotice('warn', 'ห้องนี้เริ่มแข่งแล้ว • เข้าในโหมด spectator', {
          code:'late_join_spectator',
          room,
          role:'spectator'
        });
        return;
      }

      currentRole = 'spectator';
      emitRoom({ meKey:'', role:'spectator', lateJoin:false, roomFull:true });
      emitBattleNotice('warn', 'ห้องนี้มีผู้เล่นครบแล้ว • เข้าในโหมด spectator', {
        code:'room_full',
        room,
        role:'spectator'
      });
      return;
    }

    currentRole = 'player';
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
    }).catch(()=>{});

    try{
      await onDisconnect(pRef).update({
        connected:false,
        lastSeenMs: serverNow(),
        lastSeen: serverTimestamp(),
      });
    }catch(_){}

    emitRoom({ role:'player', resume:false });
    emitBattleNotice('info', 'เข้าห้อง Battle สำเร็จ', {
      code:'join_player_ok',
      room,
      role:'player'
    });
  }

  async function maybeStartCountdown(players, st){
    if(localDestroyed) return;
    if(String(st.phase || 'lobby').toLowerCase() !== 'lobby') return;

    const realPlayers = (players || []).filter(p => p.connected !== false).slice(0,2);
    if(realPlayers.length < 2) return;
    if(!realPlayers.every(p => !!p.ready)) return;

    const startAtMs = serverNow() + autostartMs;
    await update(stateRef, {
      phase:'countdown',
      startAtMs,
      winner:'',
      reason:'',
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});
  }

  async function maybeStartRunning(st){
    if(localDestroyed) return;
    if(String(st.phase || '').toLowerCase() !== 'countdown') return;
    const startAtMs = Number(st.startAtMs || 0) || 0;
    if(!startAtMs) return;
    if(serverNow() < startAtMs) return;

    await update(stateRef, {
      phase:'running',
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});
  }

  async function markForfeitIfNeeded(players, st){
    if(localDestroyed) return;
    if(String(st.phase || '').toLowerCase() !== 'running') return;

    const realPlayers = (players || []).slice(0,2);
    if(realPlayers.length < 2) return;

    const disconnected = realPlayers.find(p => p.connected === false && (serverNow() - (p.lastSeenMs || 0) >= forfeitMs));
    const stillHere = realPlayers.find(p => p.key !== disconnected?.key);

    if(!disconnected || !stillHere) return;

    await update(stateRef, {
      phase:'ended',
      winner: stillHere.key,
      reason:'forfeit',
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});

    emitBattleNotice('warn', 'อีกฝ่ายหลุด/ออกจากห้อง ระบบตัดสินผลแล้ว', {
      code:'forfeit_end',
      room
    });
    emit('hha:battle-ended', {
      room,
      roundId: currentRoundId,
      winner: stillHere.key,
      reason:'forfeit',
      results: realPlayers
    });
  }

  async function finalizeIfRoundFinished(players, st){
    if(localDestroyed) return;
    if(String(st.phase || '').toLowerCase() !== 'running') return;

    const realPlayers = (players || []).filter(Boolean).slice(0,2);
    if(realPlayers.length < 2) return;

    const finishedPlayers = realPlayers.filter(p => Number(p.finishMs || 0) > 0);
    if(finishedPlayers.length < 2) return;

    const picked = pickWinner(realPlayers[0], realPlayers[1]);
    await update(stateRef, {
      phase:'ended',
      winner: picked.winnerKey || '',
      reason: picked.reason || 'tie',
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});

    emitBattleNotice('info', 'จบรอบ Battle แล้ว', {
      code:'battle_round_ended',
      room,
      rule: picked.reason
    });
    emit('hha:battle-ended', {
      room,
      roundId: currentRoundId,
      winner: picked.winnerKey || '',
      reason: picked.reason || 'tie',
      results: realPlayers
    });
  }

  async function maybeCommitAcceptedRematch(){
    const votes = rematchState.votes || {};
    const playersSnap = await get(playersRef).catch(()=>null);
    const raw = playersSnap?.val() || {};
    const players = Object.keys(raw)
      .map(k => normalizePlayer(raw[k], k))
      .filter(p => p.connected !== false)
      .slice(0,2);

    if(!players.length) return;

    const allAccepted = players.every(p => votes[p.key]?.accepted === true);
    if(!allAccepted) return;

    const nextRoundId = rematchState.roundId || `r_${Date.now()}`;
    currentRoundId = nextRoundId;

    const updates = {};
    Object.keys(raw).forEach(k=>{
      updates[`${k}/ready`] = false;
      updates[`${k}/forfeit`] = false;
      updates[`${k}/score`] = 0;
      updates[`${k}/acc`] = 0;
      updates[`${k}/miss`] = 0;
      updates[`${k}/medianRT`] = 0;
      updates[`${k}/finishMs`] = 0;
      updates[`${k}/connected`] = raw[k]?.connected !== false;
      updates[`${k}/lastSeenMs`] = serverNow();
      updates[`${k}/lastSeen`] = serverTimestamp();
    });

    await update(playersRef, updates).catch(()=>{});
    await update(stateRef, {
      phase:'lobby',
      room,
      roundId: nextRoundId,
      startAtMs:0,
      winner:'',
      reason:'',
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});

    await set(rematchRef, {
      requestedBy: rematchState.requestedBy || '',
      requestedAt: serverTimestamp(),
      requestedAtMs: Date.now(),
      roundId: nextRoundId,
      committed:true
    }).catch(()=>{});

    emit('hha:battle-rematch-ready', {
      room,
      roundId: nextRoundId
    });

    emitBattleNotice('info', 'ทั้งสองฝ่ายยอมรับ Rematch แล้ว', {
      code:'rematch_both_accepted',
      room,
      roundId: nextRoundId
    });
  }

  async function setReady(on){
    if(localDestroyed || currentRole !== 'player') return;
    await update(ref(db, `${base}/players/${meKey}`), {
      ready: !!on,
      connected:true,
      lastSeenMs: serverNow(),
      lastSeen: serverTimestamp(),
    }).catch(()=>{});
  }

  async function syncScore(payload){
    if(localDestroyed || currentRole !== 'player') return;
    const safe = sanitizeScorePayload(payload);
    await update(ref(db, `${base}/players/${meKey}`), {
      score: safe.score,
      acc: safe.acc,
      miss: safe.miss,
      medianRT: safe.medianRT,
      finishMs: safe.finishMs,
      connected:true,
      lastSeenMs: serverNow(),
      lastSeen: serverTimestamp(),
    }).catch(()=>{});
  }

  async function requestRematch(){
    if(localDestroyed || currentRole !== 'player') return;

    const nextRoundId = `r_${Date.now()}`;
    currentRoundId = nextRoundId;

    await set(rematchRef, {
      requestedBy: meKey,
      requestedAt: serverTimestamp(),
      requestedAtMs: Date.now(),
      roundId: nextRoundId,
      committed:false
    }).catch(()=>{});

    await update(rematchVotesRef, {
      [`${meKey}/accepted`]: true,
      [`${meKey}/declined`]: false,
      [`${meKey}/ts`]: Date.now()
    }).catch(()=>{});

    rematchState = {
      roundId: nextRoundId,
      requestedBy: meKey,
      requestedAtMs: Date.now(),
      votes: {
        ...(rematchState.votes || {}),
        [meKey]: { accepted:true, declined:false, ts:Date.now() }
      }
    };

    emit('hha:battle-rematch', {
      room,
      roundId: nextRoundId,
      requestedBy: meKey,
      requestedAtMs: Date.now(),
      byMe: true
    });

    emitRematchState({ byMe:true });
    await maybeCommitAcceptedRematch();
  }

  async function acceptRematch(){
    if(localDestroyed || currentRole !== 'player') return;
    const roundId = rematchState.roundId || `r_${Date.now()}`;

    await update(rematchVotesRef, {
      [`${meKey}/accepted`]: true,
      [`${meKey}/declined`]: false,
      [`${meKey}/ts`]: Date.now()
    }).catch(()=>{});

    rematchState.votes = {
      ...(rematchState.votes || {}),
      [meKey]: { accepted:true, declined:false, ts:Date.now() }
    };
    rematchState.roundId = roundId;

    emitRematchState({ acceptedByMe:true });
    await maybeCommitAcceptedRematch();
  }

  async function declineRematch(){
    if(localDestroyed || currentRole !== 'player') return;

    await update(rematchVotesRef, {
      [`${meKey}/accepted`]: false,
      [`${meKey}/declined`]: true,
      [`${meKey}/ts`]: Date.now()
    }).catch(()=>{});

    rematchState.votes = {
      ...(rematchState.votes || {}),
      [meKey]: { accepted:false, declined:true, ts:Date.now() }
    };

    emitRematchState({ declinedByMe:true });
    emitBattleNotice('warn', 'ปฏิเสธ Rematch แล้ว', {
      code:'rematch_declined',
      room
    });
  }

  async function saveRoundReport(report){
    if(localDestroyed || !report || typeof report !== 'object') return null;

    const row = {
      ...report,
      room,
      gameKey,
      roundId: currentRoundId || String(report.roundId || ''),
      savedAtMs: serverNow(),
      savedAt: serverTimestamp(),
    };

    try{
      const rowRef = push(reportsRef);
      await set(rowRef, row);
      emitBattleNotice('info', 'บันทึกรายงานรอบนี้ขึ้น cloud แล้ว', {
        code:'cloud_report_saved',
        room,
        roundId: row.roundId || ''
      });
      return rowRef.key;
    }catch(err){
      console.warn('[battle-rtdb] saveRoundReport failed', err);
      emitBattleNotice('error', 'บันทึกรายงานขึ้น cloud ไม่สำเร็จ', {
        code:'cloud_report_save_failed',
        room
      });
      return null;
    }
  }

  async function leave(){
    clearCountdownTimer();
    if(currentRole !== 'player') return;
    await update(ref(db, `${base}/players/${meKey}`), {
      connected:false,
      lastSeenMs: serverNow(),
      lastSeen: serverTimestamp(),
      ready:false,
    }).catch(()=>{});
  }

  async function destroy(){
    localDestroyed = true;
    clearCountdownTimer();
    unsubscribers.forEach(fn=>{ try{ fn(); }catch(_){ } });
    unsubscribers = [];
  }

  unsubscribers.push(onValue(offsetRef, (snap)=>{
    serverTimeOffset = Number(snap.val() || 0) || 0;
  }));

  unsubscribers.push(onValue(stateRef, async (snap)=>{
    if(localDestroyed) return;
    const st = snap.val() || {};
    currentRoundId = String(st.roundId || currentRoundId || '');

    emitState(st);

    const phase = String(st.phase || 'lobby').toLowerCase();
    if(phase === 'countdown'){
      attachCountdown(Number(st.startAtMs || 0) || 0);
    }else{
      clearCountdownTimer();
    }
    if(phase === 'running'){
      emit('hha:battle-start', {
        room,
        roundId: currentRoundId,
        startAtMs: Number(st.startAtMs || 0) || 0
      });
    }

    await maybeStartRunning(st);
  }));

  unsubscribers.push(onValue(playersRef, async (snap)=>{
    if(localDestroyed) return;
    const raw = snap.val() || {};
    const allPlayers = Object.keys(raw)
      .map(k => normalizePlayer(raw[k], k))
      .sort((a,b)=>(a.joinedAtMs||0)-(b.joinedAtMs||0));

    roomFullFlag = allPlayers.length > 2;

    const players = allPlayers.slice(0,2);
    emitPlayers(players);

    const me = players.find(p => p.key === meKey) || null;
    const opp = players.find(p => p.key !== meKey) || null;
    emit('hha:battle-score', {
      me,
      opp,
      leader: (!me || !opp) ? 'tie' : ((me.score > opp.score) ? 'you' : (me.score < opp.score ? 'opp' : 'tie'))
    });

    const stSnap = await get(stateRef).catch(()=>null);
    const st = stSnap?.val() || {};

    await maybeStartCountdown(players, st);
    await markForfeitIfNeeded(players, st);
    await finalizeIfRoundFinished(players, st);
  }));

  unsubscribers.push(onValue(rematchRef, async (snap)=>{
    if(localDestroyed) return;
    const v = snap.val() || null;
    if(!v) return;

    rematchState.roundId = String(v.roundId || '');
    rematchState.requestedBy = String(v.requestedBy || '');
    rematchState.requestedAtMs = Number(v.requestedAtMs || 0) || 0;

    emit('hha:battle-rematch', {
      room,
      roundId: rematchState.roundId,
      requestedBy: rematchState.requestedBy,
      requestedAtMs: rematchState.requestedAtMs,
      byMe: rematchState.requestedBy === meKey
    });

    emitRematchState({
      byMe: rematchState.requestedBy === meKey,
      committed: !!v.committed
    });

    if(rematchState.requestedBy && rematchState.requestedBy !== meKey){
      emitBattleNotice('info', 'อีกฝ่ายขอ Rematch', {
        code:'opponent_requested_rematch',
        room,
        roundId: rematchState.roundId
      });
    }

    if(rematchState.roundId && currentRoundId !== rematchState.roundId){
      currentRoundId = rematchState.roundId;
    }

    const stSnap = await get(stateRef).catch(()=>null);
    const st = stSnap?.val() || {};
    const phase = String(st.phase || 'lobby').toLowerCase();

    if(phase === 'lobby' && rematchState.roundId){
      emit('hha:battle-rematch-ready', {
        room,
        roundId: rematchState.roundId
      });
    }
  }));

  unsubscribers.push(onValue(rematchVotesRef, (snap)=>{
    if(localDestroyed) return;
    rematchState.votes = normalizeVoteMap(snap.val() || {});
    emitRematchState();
  }));

  await ensureMeta();
  await ensureRoundIfMissing();
  await joinPlayer();

  return {
    enabled:true,
    room,
    roundId: currentRoundId,
    meKey,
    pid,
    serverNow,
    setReady,
    syncScore,
    requestRematch,
    acceptRematch,
    declineRematch,
    getRematchState: ()=> ({ ...rematchState }),
    saveRoundReport,
    leave,
    destroy,
    getRole: ()=> currentRole,
    isSpectator: ()=> currentRole === 'spectator',
    getJoinPolicy: ()=> ({
      role: currentRole,
      roomFull: roomFullFlag,
      lateJoin: lateJoinFlag,
      invalidRoom: invalidRoomFlag
    }),
  };
}

export async function adminOpenRoomTools(opts){
  opts = opts || {};

  const gameKey = safeKey(opts.gameKey || 'game', 24) || 'game';
  const room = safeKey(opts.room || '', 10);
  if(!room) throw new Error('missing room');

  const fbCfg = getFirebaseConfig();
  if(!fbCfg) throw new Error('missing Firebase config');

  const fb = await loadFirebase();
  const {
    initializeApp, getApps, getApp,
    getDatabase, ref, get, set, update, remove, serverTimestamp
  } = fb;

  const app = getApps().length ? getApp() : initializeApp(fbCfg);
  const db  = getDatabase(app);

  const base = `hha-battle/${gameKey}/rooms/${room}`;
  const stateRef = ref(db, `${base}/state`);
  const playersRef = ref(db, `${base}/players`);
  const rematchRef = ref(db, `${base}/rematch`);
  const rematchVotesRef = ref(db, `${base}/rematchVotes`);
  const rosterRef = ref(db, `${base}/roster`);
  const policyRef = ref(db, `${base}/policy`);
  const announcementRef = ref(db, `${base}/announcement`);

  async function forceStart(){
    const stSnap = await get(stateRef).catch(()=>null);
    const st = stSnap?.val() || {};
    const roundId = String(st.roundId || `r_${Date.now()}`);

    await update(stateRef, {
      phase:'running',
      room,
      roundId,
      startAtMs: Date.now(),
      winner:'',
      reason:'',
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});
  }

  async function forceCountdown(sec=3){
    sec = Math.max(1, Math.min(10, Number(sec || 3) || 3));

    const stSnap = await get(stateRef).catch(()=>null);
    const st = stSnap?.val() || {};
    const roundId = String(st.roundId || `r_${Date.now()}`);

    await update(stateRef, {
      phase:'countdown',
      room,
      roundId,
      startAtMs: Date.now() + (sec * 1000),
      winner:'',
      reason:'',
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});
  }

  async function resetRoom(){
    const playersSnap = await get(playersRef).catch(()=>null);
    const raw = playersSnap?.val() || {};
    const nextRoundId = `r_${Date.now()}`;

    const updates = {};
    Object.keys(raw).forEach(k=>{
      updates[`${k}/ready`] = false;
      updates[`${k}/forfeit`] = false;
      updates[`${k}/score`] = 0;
      updates[`${k}/acc`] = 0;
      updates[`${k}/miss`] = 0;
      updates[`${k}/medianRT`] = 0;
      updates[`${k}/finishMs`] = 0;
    });

    if(Object.keys(updates).length){
      await update(playersRef, updates).catch(()=>{});
    }

    await update(stateRef, {
      phase:'lobby',
      room,
      roundId: nextRoundId,
      startAtMs:0,
      winner:'',
      reason:'',
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});
  }

  async function clearRematch(){
    await remove(rematchRef).catch(()=>{});
    await remove(rematchVotesRef).catch(()=>{});
  }

  async function setAllReady(on=true){
    const playersSnap = await get(playersRef).catch(()=>null);
    const raw = playersSnap?.val() || {};
    const updates = {};
    Object.keys(raw).forEach(k=>{
      updates[`${k}/ready`] = !!on;
    });
    if(Object.keys(updates).length){
      await update(playersRef, updates).catch(()=>{});
    }
  }

  async function resetScoresOnly(){
    const playersSnap = await get(playersRef).catch(()=>null);
    const raw = playersSnap?.val() || {};
    const updates = {};

    Object.keys(raw).forEach(k=>{
      updates[`${k}/score`] = 0;
      updates[`${k}/acc`] = 0;
      updates[`${k}/miss`] = 0;
      updates[`${k}/medianRT`] = 0;
      updates[`${k}/finishMs`] = 0;
      updates[`${k}/forfeit`] = false;
    });

    if(Object.keys(updates).length){
      await update(playersRef, updates).catch(()=>{});
    }
  }

  async function kickDisconnectedPlayers(){
    const playersSnap = await get(playersRef).catch(()=>null);
    const raw = playersSnap?.val() || {};
    const keys = Object.keys(raw);

    for(const k of keys){
      const p = raw[k] || {};
      if(p.connected === false){
        await remove(ref(db, `${base}/players/${k}`)).catch(()=>{});
      }
    }
  }

  async function clearSpectatorOverflow(){
    const playersSnap = await get(playersRef).catch(()=>null);
    const raw = playersSnap?.val() || {};
    const rows = Object.keys(raw)
      .map(k => ({ key:k, ...(raw[k] || {}) }))
      .sort((a,b)=>(Number(a.joinedAtMs||0)-Number(b.joinedAtMs||0)));

    const keep = rows.slice(0,2).map(r=>r.key);
    const removeKeys = rows.slice(2).map(r=>r.key);

    for(const k of removeKeys){
      if(!keep.includes(k)){
        await remove(ref(db, `${base}/players/${k}`)).catch(()=>{});
      }
    }
  }

  async function getTopTwoPlayers(){
    const playersSnap = await get(playersRef).catch(()=>null);
    const raw = playersSnap?.val() || {};
    const rows = Object.keys(raw)
      .map(k => ({ key:k, ...normalizePlayer(raw[k], k) }))
      .sort((a,b)=>
        (Number(b.score||0)-Number(a.score||0)) ||
        (Number(b.acc||0)-Number(a.acc||0)) ||
        (Number(a.miss||0)-Number(b.miss||0)) ||
        (Number(a.medianRT||0)-Number(b.medianRT||0))
      );

    return rows.slice(0,2);
  }

  async function endRoundNow(){
    const top2 = await getTopTwoPlayers();
    const a = top2[0] || null;
    const b = top2[1] || null;
    const picked = pickWinner(a, b);

    await update(stateRef, {
      phase:'ended',
      winner: picked.winnerKey || '',
      reason: picked.reason || 'teacherEnd',
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});

    return {
      winnerKey: picked.winnerKey || '',
      reason: picked.reason || 'teacherEnd',
      players: top2
    };
  }

  async function forceWinner(playerKey){
    playerKey = safeKey(playerKey || '', 64);
    if(!playerKey) throw new Error('missing playerKey');

    await update(stateRef, {
      phase:'ended',
      winner: playerKey,
      reason:'teacherForceWinner',
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});

    return {
      winnerKey: playerKey,
      reason: 'teacherForceWinner'
    };
  }

  async function exportRoundSnapshot(){
    const stateSnap = await get(stateRef).catch(()=>null);
    const playersSnap = await get(playersRef).catch(()=>null);
    const rematchSnap = await get(rematchRef).catch(()=>null);
    const rematchVotesSnap = await get(rematchVotesRef).catch(()=>null);

    const state = stateSnap?.val() || {};
    const playersRaw = playersSnap?.val() || {};
    const rematch = rematchSnap?.val() || {};
    const rematchVotes = rematchVotesSnap?.val() || {};

    const players = Object.keys(playersRaw)
      .map(k => ({ key:k, ...normalizePlayer(playersRaw[k], k) }))
      .sort((a,b)=>(a.joinedAtMs||0)-(b.joinedAtMs||0));

    return {
      exportedAtIso: new Date().toISOString(),
      room,
      gameKey,
      state,
      players,
      rematch,
      rematchVotes
    };
  }

  async function getAttendanceSnapshot(){
    const attendanceRef = ref(db, `${base}/attendance`);
    const snap = await get(attendanceRef).catch(()=>null);
    return snap?.val() || {};
  }

  async function clearAttendance(){
    const attendanceRef = ref(db, `${base}/attendance`);
    await remove(attendanceRef).catch(()=>{});
  }

  async function getRosterSnapshot(){
    const snap = await get(rosterRef).catch(()=>null);
    return snap?.val() || {};
  }

  async function clearRoster(){
    await remove(rosterRef).catch(()=>{});
  }

  async function saveRosterSnapshot(rows){
    rows = Array.isArray(rows) ? rows : [];
    const payload = {};

    rows.forEach((r, i)=>{
      const pid = String(r?.pid || '').trim();
      const nick = String(r?.nick || '').trim();
      const key = safeKey(pid || nick || `row_${i}`, 64);
      if(!key) return;

      payload[key] = {
        nick: nick || '-',
        pid: pid || '-',
        room,
        lastSeen: String(r?.lastSeen || ''),
        savedAtMs: Date.now()
      };
    });

    await set(rosterRef, payload).catch(()=>{});
    return payload;
  }

  async function getRoomPolicy(){
    const snap = await get(policyRef).catch(()=>null);
    return snap?.val() || {};
  }

  async function setRoomLocked(on, extra={}){
    await update(policyRef, {
      roomLocked: !!on,
      allowSpectatorOnly: !!extra?.allowSpectatorOnly,
      spectatorUrl: String(extra?.spectatorUrl || ''),
      message: String(extra?.message || ''),
      updatedAtMs: Date.now()
    }).catch(()=>{});
  }

  async function setSpectatorOnly(on, extra={}){
    await update(policyRef, {
      roomLocked: !!on,
      allowSpectatorOnly: !!on,
      spectatorUrl: String(extra?.spectatorUrl || ''),
      message: String(extra?.message || ''),
      updatedAtMs: Date.now()
    }).catch(()=>{});
  }

  async function clearRoomPolicy(){
    await remove(policyRef).catch(()=>{});
  }

  async function getAnnouncement(){
    const snap = await get(announcementRef).catch(()=>null);
    return snap?.val() || {};
  }

  async function setAnnouncement(message, extra={}){
    const msg = String(message || '').trim();

    if(!msg){
      await remove(announcementRef).catch(()=>{});
      return {};
    }

    const payload = {
      message: msg,
      tone: String(extra?.tone || 'info'),
      ttlSec: Math.max(0, Number(extra?.ttlSec || 0) || 0),
      createdAtMs: Date.now(),
      updatedAtMs: Date.now()
    };

    await set(announcementRef, payload).catch(()=>{});
    return payload;
  }

  async function clearAnnouncement(){
    await remove(announcementRef).catch(()=>{});
  }

  return {
    forceStart,
    forceCountdown,
    resetRoom,
    resetScoresOnly,
    clearRematch,
    setAllReady,
    kickDisconnectedPlayers,
    clearSpectatorOverflow,
    endRoundNow,
    forceWinner,
    exportRoundSnapshot,
    getAttendanceSnapshot,
    clearAttendance,
    getRosterSnapshot,
    saveRosterSnapshot,
    clearRoster,
    getRoomPolicy,
    setRoomLocked,
    setSpectatorOnly,
    clearRoomPolicy,
    getAnnouncement,
    setAnnouncement,
    clearAnnouncement
  };
}