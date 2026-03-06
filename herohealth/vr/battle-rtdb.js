// === /herohealth/vr/battle-rtdb.js ===
// Firebase RTDB Battle — v6 (room policy + spectator + notices + cloud reports + debugStart + reset stale debug room)
// FULL v20260307-BATTLE-RTDB-V6-DEBUGSTART-RESETROOM
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
  const cfg = WIN.HHA_FIREBASE_CONFIG || WIN.__HHA_FIREBASE_CONFIG__ || WIN.firebaseConfig || null;
  return cfg || null;
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
  const debugStart = String(qs('debugStart','0')) === '1';

  const fbCfg = getFirebaseConfig();
  if(!fbCfg){
    console.warn('[battle-rtdb] missing Firebase config');
    emitBattleNotice('error', 'ยังไม่ได้ตั้งค่า Firebase สำหรับ Battle', {
      code:'missing_firebase_config'
    });
    return disabledBattle();
  }

  let fb = null;
  try{
    fb = await loadFirebase();
  }catch(err){
    console.warn('[battle-rtdb] firebase load failed', err);
    emitBattleNotice('error', 'เชื่อมต่อระบบ Battle ไม่สำเร็จ', {
      code:'firebase_load_failed'
    });
    return disabledBattle();
  }

  const {
    initializeApp, getApps, getApp,
    getDatabase, ref, get, set, update, push,
    onValue, off, runTransaction, serverTimestamp, onDisconnect
  } = fb;

  const app = getApps().length ? getApp() : initializeApp(fbCfg);
  const db  = getDatabase(app);

  const base = `hha-battle/${gameKey}/rooms/${room}`;
  const metaRef = ref(db, `${base}/meta`);
  const playersRef = ref(db, `${base}/players`);
  const stateRef = ref(db, `${base}/state`);
  const rematchRef = ref(db, `${base}/rematch`);
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
      ...(st||{})
    });
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

  async function resetDebugRoomIfStale(){
    if(!debugStart) return;

    const stateSnap = await get(stateRef).catch(()=>null);
    const st = stateSnap?.val() || {};
    const phase = String(st.phase || 'lobby').toLowerCase();

    const playersSnap = await get(playersRef).catch(()=>null);
    const rawPlayers = playersSnap?.val() || {};
    const allPlayers = Object.keys(rawPlayers)
      .map(k => normalizePlayer(rawPlayers[k], k))
      .sort((a,b)=>(a.joinedAtMs||0)-(b.joinedAtMs||0));

    const connectedPlayers = allPlayers.filter(p => p.connected !== false);
    const onlyMeOrEmpty =
      connectedPlayers.length === 0 ||
      (connectedPlayers.length === 1 && (connectedPlayers[0].key === meKey || connectedPlayers[0].pid === pid));

    const stalePhase = phase === 'ended' || phase === 'running' || phase === 'countdown';

    if(!stalePhase || !onlyMeOrEmpty) return;

    const newRoundId = `r_${Date.now()}`;
    await update(stateRef, {
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

    const playerUpdates = {};
    Object.keys(rawPlayers).forEach(k=>{
      playerUpdates[`${k}/ready`] = false;
      playerUpdates[`${k}/forfeit`] = false;
      playerUpdates[`${k}/score`] = 0;
      playerUpdates[`${k}/acc`] = 0;
      playerUpdates[`${k}/miss`] = 0;
      playerUpdates[`${k}/medianRT`] = 0;
      playerUpdates[`${k}/finishMs`] = 0;
    });

    if(Object.keys(playerUpdates).length){
      await update(playersRef, playerUpdates).catch(()=>{});
    }

    emitBattleNotice('info', 'รีเซ็ตห้อง debug ที่ค้างไว้แล้ว', {
      code:'debug_room_reset',
      room,
      roundId:newRoundId
    });
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
      });

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
      emitRoom({ meKey:'', role:'spectator',