// === /herohealth/vr/battle-rtdb.js ===
// Firebase RTDB Battle — v7 (admin tools + rematch votes + policy + announcement)
// FULL PATCH v20260308-BATTLE-RTDB-V7-ADMIN-REMATCH-POLICY
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

function normalizePolicy(v){
  v = v || {};
  return {
    roomLocked: !!v.roomLocked,
    allowSpectatorOnly: !!v.allowSpectatorOnly,
    spectatorUrl: String(v.spectatorUrl || ''),
    message: String(v.message || ''),
    updatedAtMs: Number(v.updatedAtMs || 0) || 0,
  };
}

function normalizeAnnouncement(v){
  v = v || {};
  return {
    message: String(v.message || ''),
    tone: String(v.tone || 'info'),
    ttlSec: Number(v.ttlSec || 0) || 0,
    createdAtMs: Number(v.createdAtMs || 0) || 0,
    updatedAtMs: Number(v.updatedAtMs || 0) || 0,
  };
}

function normalizeRematch(v){
  v = v || {};
  return {
    roundId: String(v.roundId || ''),
    requestedBy: String(v.requestedBy || ''),
    requestedAtMs: Number(v.requestedAtMs || 0) || 0,
    votes: (v.votes && typeof v.votes === 'object') ? v.votes : {}
  };
}

function buildBasePaths(gameKey, room){
  const base = `hha-battle/${gameKey}/rooms/${room}`;
  return {
    base,
    meta: `${base}/meta`,
    players: `${base}/players`,
    state: `${base}/state`,
    rematch: `${base}/rematch`,
    attendance: `${base}/attendance`,
    roster: `${base}/roster`,
    policy: `${base}/policy`,
    announcement: `${base}/announcement`,
    reports: `${base}/reports`
  };
}

async function getFirebaseBundle(){
  const fbCfg = getFirebaseConfig();
  if(!fbCfg){
    throw new Error('missing_firebase_config');
  }
  const fb = await loadFirebase();
  const {
    initializeApp, getApps, getApp,
    getDatabase, ref, get, set, update, push,
    onValue, off, runTransaction, serverTimestamp, onDisconnect
  } = fb;

  const app = getApps().length ? getApp() : initializeApp(fbCfg);
  const db  = getDatabase(app);

  return {
    fbCfg, fb, db,
    initializeApp, getApps, getApp,
    getDatabase, ref, get, set, update, push,
    onValue, off, runTransaction, serverTimestamp, onDisconnect
  };
}

export async function adminOpenRoomTools(opts={}){
  const gameKey = safeKey(opts.gameKey || 'game', 24) || 'game';
  const room = safeKey(opts.room || qs('room',''), 10) || randRoom(6);

  const {
    db, ref, get, set, update, onValue, off,
    serverTimestamp
  } = await getFirebaseBundle();

  const P = buildBasePaths(gameKey, room);

  function roomNow(){ return Date.now(); }

  async function setAnnouncement(message, options={}){
    const row = {
      message: String(message || ''),
      tone: String(options.tone || 'info'),
      ttlSec: clamp(options.ttlSec ?? 12, 0, 600),
      createdAt: serverTimestamp(),
      createdAtMs: roomNow(),
      updatedAt: serverTimestamp(),
      updatedAtMs: roomNow()
    };
    await set(ref(db, P.announcement), row);
    emitBattleNotice('info', 'ส่ง announcement แล้ว', {
      code:'announcement_set',
      room,
      gameKey
    });
    return row;
  }

  async function clearAnnouncement(){
    await set(ref(db, P.announcement), {
      message:'',
      tone:'info',
      ttlSec:0,
      updatedAt: serverTimestamp(),
      updatedAtMs: roomNow()
    });
    emitBattleNotice('info', 'ล้าง announcement แล้ว', {
      code:'announcement_cleared',
      room,
      gameKey
    });
  }

  async function getAnnouncement(){
    const snap = await get(ref(db, P.announcement)).catch(()=>null);
    return normalizeAnnouncement(snap?.val() || {});
  }

  async function setRoomLocked(on, options={}){
    const row = {
      roomLocked: !!on,
      allowSpectatorOnly: !!options.allowSpectatorOnly,
      spectatorUrl: String(options.spectatorUrl || ''),
      message: String(options.message || ''),
      updatedAt: serverTimestamp(),
      updatedAtMs: roomNow()
    };
    await update(ref(db, P.policy), row);
    emitBattleNotice('info', on ? 'ล็อกห้องแล้ว' : 'ปลดล็อกห้องแล้ว', {
      code:on ? 'room_locked' : 'room_unlocked',
      room,
      gameKey
    });
    return row;
  }

  async function setSpectatorOnly(on, options={}){
    const row = {
      roomLocked: !!on,
      allowSpectatorOnly: !!on,
      spectatorUrl: String(options.spectatorUrl || ''),
      message: String(options.message || ''),
      updatedAt: serverTimestamp(),
      updatedAtMs: roomNow()
    };
    await update(ref(db, P.policy), row);
    emitBattleNotice('info', on ? 'ตั้ง spectator only แล้ว' : 'ปิด spectator only แล้ว', {
      code:on ? 'spectator_only_on' : 'spectator_only_off',
      room,
      gameKey
    });
    return row;
  }

  async function getRoomPolicy(){
    const snap = await get(ref(db, P.policy)).catch(()=>null);
    return normalizePolicy(snap?.val() || {});
  }

  async function ensureState(){
    const stSnap = await get(ref(db, P.state)).catch(()=>null);
    const st = stSnap?.val() || {};
    if(st.roundId) return st;
    const newRoundId = `r_${Date.now()}`;
    const row = {
      phase:'lobby',
      room,
      roundId:newRoundId,
      startAtMs:0,
      winner:'',
      reason:'',
      updatedAt: serverTimestamp(),
      updatedAtMs: roomNow()
    };
    await set(ref(db, P.state), row);
    return row;
  }

  async function clearRematch(){
    await set(ref(db, P.rematch), {
      roundId:'',
      requestedBy:'',
      requestedAtMs:0,
      votes:{},
      updatedAt: serverTimestamp(),
      updatedAtMs: roomNow()
    });
    emit('hha:battle-rematch-state', normalizeRematch({
      roundId:'',
      requestedBy:'',
      requestedAtMs:0,
      votes:{}
    }));
  }

  async function resetScoresOnly(){
    const pSnap = await get(ref(db, P.players)).catch(()=>null);
    const raw = pSnap?.val() || {};
    const updates = {};
    Object.keys(raw).forEach(k=>{
      updates[`${k}/score`] = 0;
      updates[`${k}/acc`] = 0;
      updates[`${k}/miss`] = 0;
      updates[`${k}/medianRT`] = 0;
      updates[`${k}/finishMs`] = 0;
      updates[`${k}/ready`] = false;
      updates[`${k}/forfeit`] = false;
      updates[`${k}/lastSeenMs`] = roomNow();
      updates[`${k}/lastSeen`] = serverTimestamp();
    });
    await update(ref(db, P.players), updates).catch(()=>{});
    emitBattleNotice('info', 'รีเซ็ตคะแนนแล้ว', {
      code:'scores_reset',
      room,
      gameKey
    });
  }

  async function resetRoom(){
    const st = await ensureState();
    const nextRoundId = `r_${Date.now()}`;
    await resetScoresOnly();
    await update(ref(db, P.state), {
      phase:'lobby',
      room,
      roundId: nextRoundId,
      startAtMs:0,
      winner:'',
      reason:'',
      updatedAt: serverTimestamp(),
      updatedAtMs: roomNow()
    });
    await clearRematch();
    emitBattleNotice('info', 'รีเซ็ตห้องแล้ว', {
      code:'room_reset',
      room,
      gameKey,
      previousRoundId: st.roundId || ''
    });
  }

  async function forceCountdown(seconds=3){
    const st = await ensureState();
    const sec = clamp(seconds, 1, 30);
    const startAtMs = roomNow() + (sec * 1000);
    await update(ref(db, P.state), {
      phase:'countdown',
      room,
      roundId: String(st.roundId || `r_${Date.now()}`),
      startAtMs,
      winner:'',
      reason:'',
      updatedAt: serverTimestamp(),
      updatedAtMs: roomNow()
    });
    emitBattleNotice('info', `บังคับ countdown ${sec} วินาที`, {
      code:'force_countdown',
      room,
      gameKey,
      seconds: sec
    });
    return { startAtMs };
  }

  async function forceStart(){
    const st = await ensureState();
    await update(ref(db, P.state), {
      phase:'running',
      room,
      roundId: String(st.roundId || `r_${Date.now()}`),
      startAtMs: roomNow(),
      winner:'',
      reason:'',
      updatedAt: serverTimestamp(),
      updatedAtMs: roomNow()
    });
    emitBattleNotice('info', 'บังคับเริ่มรอบแล้ว', {
      code:'force_start',
      room,
      gameKey
    });
  }

  async function endRoundNow(reason='teacher-end'){
    const pSnap = await get(ref(db, P.players)).catch(()=>null);
    const raw = pSnap?.val() || {};
    const players = Object.keys(raw)
      .map(k => normalizePlayer(raw[k], k))
      .sort((a,b)=>(a.joinedAtMs||0)-(b.joinedAtMs||0))
      .slice(0,2);

    const picked = players.length >= 2 ? pickWinner(players[0], players[1]) : { winnerKey:'', reason:'tie' };

    await update(ref(db, P.state), {
      phase:'ended',
      winner: picked.winnerKey || '',
      reason: String(reason || picked.reason || 'teacher-end'),
      updatedAt: serverTimestamp(),
      updatedAtMs: roomNow()
    });

    emit('hha:battle-ended', {
      room,
      roundId:'',
      winner: picked.winnerKey || '',
      reason: String(reason || picked.reason || 'teacher-end'),
      results: players
    });

    emitBattleNotice('warn', 'ครูสั่งจบรอบแล้ว', {
      code:'round_ended_by_teacher',
      room,
      gameKey
    });
  }

  async function forceWinner(which='p1'){
    const pSnap = await get(ref(db, P.players)).catch(()=>null);
    const raw = pSnap?.val() || {};
    const players = Object.keys(raw)
      .map(k => normalizePlayer(raw[k], k))
      .sort((a,b)=>(a.joinedAtMs||0)-(b.joinedAtMs||0))
      .slice(0,2);

    const winner = which === 'p2' ? players[1] : players[0];
    await update(ref(db, P.state), {
      phase:'ended',
      winner: String(winner?.key || ''),
      reason:'teacher-force-winner',
      updatedAt: serverTimestamp(),
      updatedAtMs: roomNow()
    });

    emit('hha:battle-ended', {
      room,
      roundId:'',
      winner: String(winner?.key || ''),
      reason:'teacher-force-winner',
      results: players
    });

    emitBattleNotice('warn', 'ครูบังคับผู้ชนะแล้ว', {
      code:'winner_forced',
      room,
      gameKey,
      which
    });
  }

  function watchState(cb){
    const r = ref(db, P.state);
    const handler = snap => cb(snap.val() || {});
    r.onValueRef = handler;
    onValue(r, handler);
    return ()=>{ try{ off(r, 'value', handler); }catch(_){} };
  }

  function watchPlayers(cb){
    const r = ref(db, P.players);
    const handler = snap => cb(snap.val() || {});
    onValue(r, handler);
    return ()=>{ try{ off(r, 'value', handler); }catch(_){} };
  }

  function watchRematch(cb){
    const r = ref(db, P.rematch);
    const handler = snap => cb(normalizeRematch(snap.val() || {}));
    onValue(r, handler);
    return ()=>{ try{ off(r, 'value', handler); }catch(_){} };
  }

  function watchPolicy(cb){
    const r = ref(db, P.policy);
    const handler = snap => cb(normalizePolicy(snap.val() || {}));
    onValue(r, handler);
    return ()=>{ try{ off(r, 'value', handler); }catch(_){} };
  }

  function watchAnnouncement(cb){
    const r = ref(db, P.announcement);
    const handler = snap => cb(normalizeAnnouncement(snap.val() || {}));
    onValue(r, handler);
    return ()=>{ try{ off(r, 'value', handler); }catch(_){} };
  }

  return {
    enabled:true,
    room,
    gameKey,
    setAnnouncement,
    clearAnnouncement,
    getAnnouncement,
    setRoomLocked,
    setSpectatorOnly,
    getRoomPolicy,
    clearRematch,
    resetScoresOnly,
    resetRoom,
    forceCountdown,
    forceStart,
    endRoundNow,
    forceWinner,
    watchState,
    watchPlayers,
    watchRematch,
    watchPolicy,
    watchAnnouncement
  };
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

  let bundle = null;
  try{
    bundle = await getFirebaseBundle();
  }catch(err){
    console.warn('[battle-rtdb] firebase init failed', err);
    emitBattleNotice('error', err?.message === 'missing_firebase_config'
      ? 'ยังไม่ได้ตั้งค่า Firebase สำหรับ Battle'
      : 'เชื่อมต่อระบบ Battle ไม่สำเร็จ', {
      code: err?.message === 'missing_firebase_config'
        ? 'missing_firebase_config'
        : 'firebase_load_failed'
    });
    return disabledBattle();
  }

  const {
    db, ref, get, set, update, push,
    onValue, off, runTransaction, serverTimestamp, onDisconnect
  } = bundle;

  const P = buildBasePaths(gameKey, room);

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
  let rematchState = { roundId:'', requestedBy:'', requestedAtMs:0, votes:{} };
  let policyState = { roomLocked:false, allowSpectatorOnly:false, spectatorUrl:'', message:'' };

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
    await runTransaction(ref(db, P.meta), (v)=>{
      v = v || {};
      if(!v.createdAt) v.createdAt = serverTimestamp();
      if(!v.createdAtMs) v.createdAtMs = Date.now();
      v.room = room;
      v.gameKey = gameKey;
      return v;
    }).catch(()=>{});
  }

  async function ensureRoundIfMissing(){
    const stateSnap = await get(ref(db, P.state)).catch(()=>null);
    const st = stateSnap?.val() || {};
    if(st.roundId){
      currentRoundId = String(st.roundId);
      return currentRoundId;
    }
    const newRoundId = `r_${Date.now()}`;
    await set(ref(db, P.state), {
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
    const stateSnap = await get(ref(db, P.state)).catch(()=>null);
    const st = stateSnap?.val() || {};
    const phase = String(st.phase || 'lobby').toLowerCase();

    const policySnap = await get(ref(db, P.policy)).catch(()=>null);
    policyState = normalizePolicy(policySnap?.val() || {});
    if(policyState.roomLocked && policyState.allowSpectatorOnly){
      currentRole = 'spectator';
      lateJoinFlag = (phase === 'countdown' || phase === 'running');
      emitRoom({
        meKey:'',
        role:'spectator',
        lateJoin: lateJoinFlag,
        roomFull:false,
        policy: policyState
      });
      emitBattleNotice('warn', policyState.message || 'ห้องนี้เปิดให้เข้าชมแทน', {
        code:'policy_spectator_only',
        room,
        role:'spectator',
        spectatorUrl: policyState.spectatorUrl || ''
      });
      return;
    }

    if(policyState.roomLocked && !policyState.allowSpectatorOnly){
      invalidRoomFlag = true;
      emitBattleNotice('warn', policyState.message || 'ห้องนี้ถูกล็อก', {
        code:'policy_room_locked',
        room
      });
      return;
    }

    const playersSnap = await get(ref(db, P.players)).catch(()=>null);
    const rawPlayers = playersSnap?.val() || {};
    const existingPlayers = Object.keys(rawPlayers)
      .map(k => normalizePlayer(rawPlayers[k], k))
      .sort((a,b)=>(a.joinedAtMs||0)-(b.joinedAtMs||0));

    const existingMine = existingPlayers.find(p => p.key === meKey || p.pid === pid) || null;

    if(existingMine){
      currentRole = 'player';
      const pRef = ref(db, `${P.players}/${existingMine.key}`);
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
      emitRoom({ meKey:'', role:'spectator', lateJoin:false, roomFull:true });
      emitBattleNotice('warn', 'ห้องนี้มีผู้เล่นครบแล้ว • เข้าในโหมด spectator', {
        code:'room_full',
        room,
        role:'spectator'
      });
      return;
    }

    currentRole = 'player';
    const pRef = ref(db, `${P.players}/${meKey}`);
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
    await update(ref(db, P.state), {
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

    await update(ref(db, P.state), {
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

    await update(ref(db, P.state), {
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
    await update(ref(db, P.state), {
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

  async function maybeResolveRematch(){
    if(localDestroyed) return;
    const stSnap = await get(ref(db, P.state)).catch(()=>null);
    const st = stSnap?.val() || {};
    if(String(st.phase || '').toLowerCase() !== 'ended') return;

    const pSnap = await get(ref(db, P.players)).catch(()=>null);
    const raw = pSnap?.val() || {};
    const players = Object.keys(raw)
      .map(k => normalizePlayer(raw[k], k))
      .sort((a,b)=>(a.joinedAtMs||0)-(b.joinedAtMs||0))
      .slice(0,2);

    if(players.length < 2) return;
    if(!rematchState.requestedBy) return;

    const votes = rematchState.votes || {};
    const statuses = players.map(p => votes[p.key] || {});
    const anyDeclined = statuses.some(v => !!v.declined);
    const allAccepted = statuses.every(v => !!v.accepted);

    if(anyDeclined){
      emitBattleNotice('warn', 'Rematch ถูกปฏิเสธ', {
        code:'rematch_declined',
        room
      });
      return;
    }

    if(!allAccepted) return;

    const nextRoundId = `r_${Date.now()}`;
    const updates = {};
    players.forEach(p=>{
      updates[`${p.key}/ready`] = false;
      updates[`${p.key}/forfeit`] = false;
      updates[`${p.key}/score`] = 0;
      updates[`${p.key}/acc`] = 0;
      updates[`${p.key}/miss`] = 0;
      updates[`${p.key}/medianRT`] = 0;
      updates[`${p.key}/finishMs`] = 0;
      updates[`${p.key}/connected`] = p.connected !== false;
      updates[`${p.key}/lastSeenMs`] = serverNow();
      updates[`${p.key}/lastSeen`] = serverTimestamp();
    });

    await update(ref(db, P.players), updates).catch(()=>{});
    await update(ref(db, P.state), {
      phase:'lobby',
      room,
      roundId: nextRoundId,
      startAtMs:0,
      winner:'',
      reason:'',
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});

    await set(ref(db, P.rematch), {
      requestedBy:'',
      requestedAt:'',
      requestedAtMs:0,
      roundId: nextRoundId,
      votes:{},
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});

    emit('hha:battle-rematch-state', normalizeRematch({
      requestedBy:'',
      requestedAtMs:0,
      roundId: nextRoundId,
      votes:{}
    }));

    emitBattleNotice('info', 'Rematch เริ่มรอบใหม่แล้ว', {
      code:'rematch_started',
      room,
      roundId: nextRoundId
    });
  }

  async function setReady(on){
    if(localDestroyed || currentRole !== 'player') return;
    await update(ref(db, `${P.players}/${meKey}`), {
      ready: !!on,
      connected:true,
      lastSeenMs: serverNow(),
      lastSeen: serverTimestamp(),
    }).catch(()=>{});
  }

  async function syncScore(payload){
    if(localDestroyed || currentRole !== 'player') return;
    const safe = sanitizeScorePayload(payload);
    await update(ref(db, `${P.players}/${meKey}`), {
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

    const stSnap = await get(ref(db, P.state)).catch(()=>null);
    const st = stSnap?.val() || {};
    const roundId = String(st.roundId || currentRoundId || '');
    const currentVotes = rematchState.votes || {};

    await set(ref(db, P.rematch), {
      requestedBy: meKey,
      requestedAt: serverTimestamp(),
      requestedAtMs: Date.now(),
      roundId,
      votes: {
        ...currentVotes,
        [meKey]: {
          accepted:true,
          declined:false,
          atMs: Date.now()
        }
      },
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});

    emitBattleNotice('info', 'ส่งคำขอ Rematch แล้ว', {
      code:'rematch_requested',
      room,
      roundId
    });
  }

  async function acceptRematch(){
    if(localDestroyed || currentRole !== 'player') return;
    const roundId = String(rematchState.roundId || currentRoundId || '');
    const votes = { ...(rematchState.votes || {}) };
    votes[meKey] = {
      accepted:true,
      declined:false,
      atMs: Date.now()
    };

    await update(ref(db, P.rematch), {
      roundId,
      votes,
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});

    emitBattleNotice('info', 'ตอบรับ Rematch แล้ว', {
      code:'rematch_accepted',
      room,
      roundId
    });
  }

  async function declineRematch(){
    if(localDestroyed || currentRole !== 'player') return;
    const roundId = String(rematchState.roundId || currentRoundId || '');
    const votes = { ...(rematchState.votes || {}) };
    votes[meKey] = {
      accepted:false,
      declined:true,
      atMs: Date.now()
    };

    await update(ref(db, P.rematch), {
      roundId,
      votes,
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(()=>{});

    emitBattleNotice('warn', 'ปฏิเสธ Rematch แล้ว', {
      code:'rematch_declined',
      room,
      roundId
    });
  }

  function getRematchState(){
    return normalizeRematch(rematchState);
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
      const rowRef = push(ref(db, P.reports));
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
    await update(ref(db, `${P.players}/${meKey}`), {
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

  const offsetRef = ref(db, `.info/serverTimeOffset`);
  const offOffsetCb = (snap)=>{
    serverTimeOffset = Number(snap.val() || 0) || 0;
  };
  onValue(offsetRef, offOffsetCb);
  unsubscribers.push(()=> off(offsetRef, 'value', offOffsetCb));

  const stateRef = ref(db, P.state);
  const offStateCb = async (snap)=>{
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
  };
  onValue(stateRef, offStateCb);
  unsubscribers.push(()=> off(stateRef, 'value', offStateCb));

  const playersRef = ref(db, P.players);
  const offPlayersCb = async (snap)=>{
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

    const stSnap = await get(ref(db, P.state)).catch(()=>null);
    const st = stSnap?.val() || {};

    await maybeStartCountdown(players, st);
    await markForfeitIfNeeded(players, st);
    await finalizeIfRoundFinished(players, st);
  };
  onValue(playersRef, offPlayersCb);
  unsubscribers.push(()=> off(playersRef, 'value', offPlayersCb));

  const rematchRef = ref(db, P.rematch);
  const offRematchCb = async (snap)=>{
    if(localDestroyed) return;
    rematchState = normalizeRematch(snap.val() || {});
    emit('hha:battle-rematch-state', rematchState);
    await maybeResolveRematch();
  };
  onValue(rematchRef, offRematchCb);
  unsubscribers.push(()=> off(rematchRef, 'value', offRematchCb));

  const policyRef = ref(db, P.policy);
  const offPolicyCb = (snap)=>{
    policyState = normalizePolicy(snap.val() || {});
    emit('hha:battle-policy', policyState);
  };
  onValue(policyRef, offPolicyCb);
  unsubscribers.push(()=> off(policyRef, 'value', offPolicyCb));

  const announcementRef = ref(db, P.announcement);
  const offAnnouncementCb = (snap)=>{
    const a = normalizeAnnouncement(snap.val() || {});
    emit('hha:battle-announcement', a);
  };
  onValue(announcementRef, offAnnouncementCb);
  unsubscribers.push(()=> off(announcementRef, 'value', offAnnouncementCb));

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
    getRematchState,
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