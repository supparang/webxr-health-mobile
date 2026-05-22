/* =========================================================
 * GoodJunk Battle v2 Core
 * File: /herohealth/vr-goodjunk/goodjunk-battle-v2-core.js
 * Version: v2.4.33-core-sync-opponent-rematch-final
 *
 * ใช้ร่วมกับ:
 * - goodjunk-battle-v2-run-pc.html
 * - goodjunk-battle-v2-run-mobile.html
 * - goodjunk-battle-v2-run-cardboard.html
 * - goodjunk-battle-v2-run.html router
 *
 * หน้าที่:
 * - sync player score/state ไป Firebase
 * - อ่าน room/player/opponent แบบ realtime
 * - สร้าง window.GJ_BATTLE_OPPONENT ให้ runtime ทุกหน้าใช้
 * - จัดการ result / summary / rematch แบบกลาง
 * ======================================================= */

(function GoodJunkBattleV2Core(){
  'use strict';

  const CORE_VERSION = 'v2.4.33-core-sync-opponent-rematch-final';

  if (window.GJ_BATTLE_CORE && window.GJ_BATTLE_CORE.version === CORE_VERSION){
    return;
  }

  const url = new URL(location.href);
  const params = url.searchParams;

  const ROOM_PATH =
    window.GJ_BATTLE_ROOM_PATH ||
    'herohealth/goodjunk/battleV2Rooms';

  const PLAYER_ID = normalizeId(
    params.get('pid') ||
    params.get('playerId') ||
    window.GJ_PLAYER_ID ||
    window.MY_PLAYER_ID ||
    localStorage.getItem('GJ_BATTLE_PID') ||
    localStorage.getItem('HHA_GJ_PID') ||
    'anon'
  );

  const PLAYER_NAME =
    params.get('name') ||
    params.get('playerName') ||
    window.GJ_PLAYER_NAME ||
    window.MY_PLAYER_NAME ||
    localStorage.getItem('GJ_BATTLE_NAME') ||
    localStorage.getItem('HHA_GJ_NAME') ||
    'Hero';

  const ROOM_CODE = normalizeRoomCode(
    params.get('room') ||
    params.get('roomCode') ||
    params.get('code') ||
    params.get('lastRoom') ||
    window.GJ_ROOM_CODE ||
    window.ROOM_CODE ||
    localStorage.getItem('GJ_BATTLE_LAST_ROOM') ||
    ''
  );

  const MATCH_ID =
    params.get('matchId') ||
    params.get('roundId') ||
    params.get('runId') ||
    window.GJ_MATCH_ID ||
    '';

  const VIEW =
    normalizeView(
      params.get('view') ||
      params.get('device') ||
      window.HHA_VIEW && window.HHA_VIEW.mode ||
      'pc'
    );

  const MODE = 'battle';
  const MAX_POWER = 5;
  const SYNC_MIN_INTERVAL_MS = 260;
  const HEARTBEAT_MS = 1600;
  const ROOM_LISTEN_RETRY_MS = 800;

  const state = {
    ready:false,
    authReady:false,
    dbReady:false,

    roomCode:ROOM_CODE,
    matchId:MATCH_ID,
    playerId:PLAYER_ID,
    playerName:PLAYER_NAME,
    view:VIEW,

    roomRef:null,
    playersRef:null,
    meRef:null,

    room:null,
    me:null,
    opponent:null,

    roomListenerAttached:false,
    heartbeatTimer:null,
    syncTimer:null,
    retryTimer:null,

    lastSyncAt:0,
    lastPayloadHash:'',
    ended:false,
    rematchRequested:false,
    currentRoundId:MATCH_ID || '',
    lastError:null
  };

  window.GJ_PLAYER_ID = PLAYER_ID;
  window.MY_PLAYER_ID = PLAYER_ID;
  window.GJ_PLAYER_NAME = PLAYER_NAME;
  window.MY_PLAYER_NAME = PLAYER_NAME;
  window.GJ_ROOM_CODE = ROOM_CODE;
  window.ROOM_CODE = ROOM_CODE;
  window.GJ_MATCH_ID = MATCH_ID;
  window.GJ_BATTLE_PHASE = window.GJ_BATTLE_PHASE || 'play';

  localStorage.setItem('GJ_BATTLE_PID', PLAYER_ID);
  localStorage.setItem('GJ_BATTLE_NAME', PLAYER_NAME);

  if (ROOM_CODE){
    localStorage.setItem('GJ_BATTLE_LAST_ROOM', ROOM_CODE);
  }

  function now(){
    return Date.now();
  }

  function safeObj(v){
    return v && typeof v === 'object' ? v : {};
  }

  function normalizeId(raw){
    return String(raw || 'anon')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[.#$\[\]\/]/g, '_')
      .slice(0, 80) || 'anon';
  }

  function normalizeRoomCode(raw){
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
  }

  function normalizeView(raw){
    const v = String(raw || '').toLowerCase();

    if (v === 'mobile' || v === 'phone' || v === 'tablet'){
      return 'mobile';
    }

    if (v === 'cardboard' || v === 'cvr' || v === 'vr' || v === 'webxr'){
      return 'cardboard';
    }

    return 'pc';
  }

  function emit(name, detail){
    window.dispatchEvent(new CustomEvent(name, {
      detail: Object.assign({
        coreVersion:CORE_VERSION,
        roomCode:state.roomCode,
        playerId:state.playerId,
        matchId:state.matchId
      }, detail || {})
    }));
  }

  function getBridge(){
    return window.GJ_BATTLE_FIREBASE_BRIDGE || null;
  }

  function getDb(){
    const bridge = getBridge();

    if (bridge && typeof bridge.getDb === 'function'){
      try{
        return bridge.getDb();
      }catch(_){}
    }

    return (
      window.GJ_DB ||
      window.db ||
      window.database ||
      window.firebaseDb ||
      (
        window.firebase &&
        typeof firebase.database === 'function'
          ? firebase.database()
          : null
      )
    );
  }

  function isBridgeReady(){
    const bridge = getBridge();

    if (bridge && typeof bridge.isReady === 'function'){
      try{
        return !!bridge.isReady();
      }catch(_){}
    }

    return !!(
      window.GJ_BATTLE_DB_READY &&
      window.GJ_BATTLE_AUTH_READY &&
      getDb() &&
      typeof getDb().ref === 'function'
    );
  }

  async function waitForReady(timeoutMs){
    timeoutMs = Number(timeoutMs || 6000);
    const start = now();

    return await new Promise(resolve => {
      const tick = async () => {
        const bridge = getBridge();

        if (bridge){
          try{
            if (typeof bridge.ensureAuth === 'function'){
              await bridge.ensureAuth();
            }

            if (typeof bridge.refresh === 'function'){
              await bridge.refresh();
            }
          }catch(err){
            state.lastError = err;
          }
        }

        if (isBridgeReady()){
          state.authReady = true;
          state.dbReady = true;
          state.ready = true;
          resolve(true);
          return;
        }

        if (now() - start >= timeoutMs){
          resolve(false);
          return;
        }

        setTimeout(tick, 160);
      };

      tick();
    });
  }

  function getRoomRef(roomCode){
    const code = normalizeRoomCode(roomCode || state.roomCode);

    if (!code) return null;

    const bridge = getBridge();

    if (bridge && typeof bridge.getRoomRef === 'function'){
      try{
        return bridge.getRoomRef(code);
      }catch(err){
        state.lastError = err;
      }
    }

    const db = getDb();

    if (!db || typeof db.ref !== 'function') return null;

    return db.ref(ROOM_PATH + '/' + code);
  }

  function getMyKey(){
    /*
     * ใน rules เดิมหลายส่วนใช้ $pid แต่ auth rules ใหม่บางส่วนใช้ uid
     * สำหรับ battleV2Rooms เปิด .write auth != null ทั้ง players/$pid
     * ดังนั้นใช้ PLAYER_ID เป็น key เพื่อให้ชื่อ/คะแนนอ่านง่าย
     */
    return state.playerId;
  }

  function sanitizeNumber(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function buildBasePlayerPatch(extra){
    const current = safeObj(window.GJ_BATTLE_STATE);

    return Object.assign({
      pid:state.playerId,
      id:state.playerId,
      name:state.playerName,
      playerName:state.playerName,
      displayName:state.playerName,

      view:state.view,
      device:state.view,
      mode:MODE,
      role:'player',

      status:state.ended ? 'finished' : 'in-game',
      phase:window.GJ_BATTLE_PHASE || (state.ended ? 'summary' : 'play'),

      score:sanitizeNumber(current.score ?? current.myScore ?? current.points, 0),
      points:sanitizeNumber(current.points ?? current.score ?? current.myScore, 0),
      good:sanitizeNumber(current.good ?? current.goodCount, 0),
      junk:sanitizeNumber(current.junk ?? current.junkCount, 0),
      miss:sanitizeNumber(current.miss ?? current.missCount, 0),

      hearts:sanitizeNumber(current.hearts ?? current.hp ?? current.lives, 3),
      hp:sanitizeNumber(current.hp ?? current.hearts ?? current.lives, 3),
      lives:sanitizeNumber(current.lives ?? current.hearts ?? current.hp, 3),

      power:sanitizeNumber(current.power ?? current.attackPower, 0),
      attackPower:sanitizeNumber(current.attackPower ?? current.power, 0),
      bestStreak:sanitizeNumber(current.bestStreak ?? current.streakMax, 0),
      streak:sanitizeNumber(current.streak ?? current.combo, 0),

      finished:!!current.finished || !!current.done || state.ended,
      done:!!current.done || !!current.finished || state.ended,
      result:current.result || '',
      resultCode:current.resultCode || '',

      matchId:state.matchId || '',
      roundId:state.matchId || '',
      activeMatchId:state.matchId || '',

      lastSeen:now(),
      heartbeatAt:now(),
      updatedAt:now(),
      coreVersion:CORE_VERSION
    }, extra || {});
  }

  function stableHash(obj){
    try{
      return JSON.stringify(obj, Object.keys(obj).sort());
    }catch(_){
      return String(Math.random());
    }
  }

  async function updateMyPlayer(patch, options){
    options = options || {};

    if (!state.meRef){
      state.roomRef = state.roomRef || getRoomRef(state.roomCode);
      if (!state.roomRef) return false;
      state.meRef = state.roomRef.child('players').child(getMyKey());
    }

    const payload = buildBasePlayerPatch(patch || {});
    const hash = stableHash(payload);

    if (!options.force){
      if (hash === state.lastPayloadHash && now() - state.lastSyncAt < 1200){
        return true;
      }

      if (now() - state.lastSyncAt < SYNC_MIN_INTERVAL_MS){
        return true;
      }
    }

    state.lastPayloadHash = hash;
    state.lastSyncAt = now();

    try{
      await state.meRef.update(payload);
      state.me = payload;
      emit('gj:battle-my-player-synced', { player:payload });
      return true;
    }catch(err){
      state.lastError = err;
      console.warn('[GJ Battle Core] updateMyPlayer failed', err);
      emit('gj:battle-sync-error', { error:String(err && err.message || err) });
      return false;
    }
  }

  async function updateRoom(patch){
    state.roomRef = state.roomRef || getRoomRef(state.roomCode);
    if (!state.roomRef) return false;

    try{
      await state.roomRef.update(Object.assign({
        code:state.roomCode,
        room:state.roomCode,
        roomCode:state.roomCode,
        mode:MODE,
        game:'goodjunk',
        gameId:'goodjunk',
        updatedAt:now(),
        coreVersion:CORE_VERSION
      }, patch || {}));

      return true;
    }catch(err){
      state.lastError = err;
      console.warn('[GJ Battle Core] updateRoom failed', err);
      return false;
    }
  }

  function normalizePlayerEntry(id, raw){
    raw = safeObj(raw);

    const score = sanitizeNumber(raw.score ?? raw.points ?? raw.myScore, 0);

    const status = String(raw.status || '').toLowerCase();
    const left = !!(
      raw.left === true ||
      raw.quit === true ||
      raw.disconnected === true ||
      status === 'left' ||
      status === 'offline'
    );

    return {
      key:id,
      id:raw.id || raw.pid || id,
      pid:raw.pid || raw.id || id,
      uid:raw.uid || raw.authUid || '',
      name:raw.name || raw.playerName || raw.displayName || raw.pid || id || 'Hero',
      playerName:raw.playerName || raw.name || raw.displayName || raw.pid || id || 'Hero',
      displayName:raw.displayName || raw.name || raw.playerName || raw.pid || id || 'Hero',
      view:raw.view || raw.device || 'pc',
      role:raw.role || '',
      host:!!raw.host || raw.role === 'host',
      status:raw.status || 'online',
      left,
      score,
      points:sanitizeNumber(raw.points ?? raw.score, score),
      good:sanitizeNumber(raw.good ?? raw.goodCount, 0),
      junk:sanitizeNumber(raw.junk ?? raw.junkCount, 0),
      miss:sanitizeNumber(raw.miss ?? raw.missCount, 0),
      hearts:sanitizeNumber(raw.hearts ?? raw.hp ?? raw.lives, 3),
      hp:sanitizeNumber(raw.hp ?? raw.hearts ?? raw.lives, 3),
      lives:sanitizeNumber(raw.lives ?? raw.hearts ?? raw.hp, 3),
      power:sanitizeNumber(raw.power ?? raw.attackPower, 0),
      attackPower:sanitizeNumber(raw.attackPower ?? raw.power, 0),
      bestStreak:sanitizeNumber(raw.bestStreak ?? raw.streakMax, 0),
      streak:sanitizeNumber(raw.streak ?? raw.combo, 0),
      finished:!!raw.finished || !!raw.done,
      done:!!raw.done || !!raw.finished,
      result:raw.result || '',
      resultCode:raw.resultCode || '',
      matchId:raw.matchId || raw.roundId || '',
      updatedAt:sanitizeNumber(raw.updatedAt, 0),
      lastSeen:sanitizeNumber(raw.lastSeen ?? raw.heartbeatAt ?? raw.updatedAt, 0),
      raw
    };
  }

  function isMePlayer(p){
    if (!p) return false;

    const me = String(state.playerId);
    return (
      String(p.key) === me ||
      String(p.id) === me ||
      String(p.pid) === me ||
      String(p.raw && p.raw.pid) === me ||
      String(p.raw && p.raw.id) === me
    );
  }

  function isOnlinePlayer(p){
    if (!p || p.left) return false;

    const status = String(p.status || '').toLowerCase();

    if (status === 'left' || status === 'offline'){
      return false;
    }

    if (p.lastSeen && now() - p.lastSeen > 20000){
      return false;
    }

    return true;
  }

  function normalizeRoom(room){
    room = safeObj(room);

    const playersMap = safeObj(room.players);
    const players = Object.entries(playersMap)
      .map(([id, raw]) => normalizePlayerEntry(id, raw))
      .sort((a,b) => {
        if (a.host && !b.host) return -1;
        if (!a.host && b.host) return 1;
        return String(a.name).localeCompare(String(b.name));
      });

    const me =
      players.find(isMePlayer) ||
      normalizePlayerEntry(state.playerId, buildBasePlayerPatch());

    const onlinePlayers = players.filter(isOnlinePlayer);

    /*
     * สำคัญ: ถ้า opponent ไม่มีชื่อแต่มี score ให้เลือกจาก player ที่ไม่ใช่เรา
     * ไม่เอาแค่ key เพราะบางที key เป็น auth uid / pid คนละแบบ
     */
    const opponent =
      players.find(p => !isMePlayer(p) && isOnlinePlayer(p)) ||
      players.find(p => !isMePlayer(p)) ||
      null;

    const matchId =
      room.matchId ||
      room.roundId ||
      room.runId ||
      room.activeMatchId ||
      state.matchId ||
      '';

    return {
      raw:room,
      code:normalizeRoomCode(room.code || room.room || room.roomCode || state.roomCode),
      phase:String(room.phase || room.status || room.state || 'play').toLowerCase(),
      status:String(room.status || room.phase || room.state || 'play').toLowerCase(),
      state:String(room.state || room.phase || room.status || 'play').toLowerCase(),
      matchId:String(matchId || ''),
      activeMatchId:String(room.activeMatchId || matchId || ''),
      hostPid:String(room.hostPid || ''),
      hostName:room.hostName || '',
      players,
      onlinePlayers,
      me,
      opponent,
      summary:safeObj(room.summary),
      finalSummary:safeObj(room.finalSummary),
      rematch:safeObj(room.rematch),
      updatedAt:sanitizeNumber(room.updatedAt, 0),
      startedAt:sanitizeNumber(room.startedAt, 0),
      endedAt:sanitizeNumber(room.endedAt, 0)
    };
  }

  function publishRoom(room){
    const nr = normalizeRoom(room);

    state.room = nr;
    state.me = nr.me;
    state.opponent = nr.opponent;

    if (nr.matchId){
      state.matchId = nr.matchId;
      window.GJ_MATCH_ID = nr.matchId;
    }

    window.GJ_CURRENT_ROOM = nr.raw;
    window.GJ_BATTLE_ROOM = nr;
    window.GJ_BATTLE_ME = nr.me || null;
    window.GJ_BATTLE_OPPONENT = nr.opponent || null;

    emit('gj:battle-room-updated', {
      room:nr,
      raw:nr.raw,
      me:nr.me,
      opponent:nr.opponent
    });

    if (nr.opponent){
      emit('gj:battle-opponent-updated', {
        opponent:nr.opponent
      });
    }

    updateOpponentDom(nr.opponent);
    updateScoreDom(nr.me, nr.opponent);

    if (nr.phase === 'summary' || nr.status === 'summary' || nr.state === 'summary'){
      emit('gj:battle-summary-updated', {
        room:nr,
        summary:nr.summary,
        finalSummary:nr.finalSummary
      });
    }

    const rematch = nr.rematch || {};
    if (rematch.status === 'starting' || rematch.status === 'play'){
      handleRematchStart(rematch, nr);
    }
  }

  function updateOpponentDom(opponent){
    if (!opponent) return;

    const nameTargets = [
      document.getElementById('opponentName'),
      document.querySelector('[data-opponent-name]')
    ].filter(Boolean);

    nameTargets.forEach(el => {
      const score = sanitizeNumber(opponent.score ?? opponent.points, 0);
      el.textContent = 'คู่แข่ง: ' + (opponent.name || opponent.displayName || 'Hero') + ' • ' + score;
    });

    const scoreTargets = [
      document.getElementById('opponentScore'),
      document.querySelector('[data-opponent-score]')
    ].filter(Boolean);

    scoreTargets.forEach(el => {
      el.textContent = String(sanitizeNumber(opponent.score ?? opponent.points, 0));
    });
  }

  function updateScoreDom(me, opponent){
    if (me){
      const scoreEl =
        document.getElementById('score') ||
        document.querySelector('[data-score]');

      if (scoreEl && Number(scoreEl.textContent || 0) < sanitizeNumber(me.score, 0)){
        scoreEl.textContent = String(sanitizeNumber(me.score, 0));
      }
    }

    if (opponent){
      const opScoreEl =
        document.getElementById('opponentScore') ||
        document.querySelector('[data-opponent-score]');

      if (opScoreEl){
        opScoreEl.textContent = String(sanitizeNumber(opponent.score, 0));
      }
    }
  }

  function attachRoomListener(){
    if (!state.roomCode){
      console.warn('[GJ Battle Core] no roomCode, realtime sync disabled');
      return false;
    }

    state.roomRef = state.roomRef || getRoomRef(state.roomCode);

    if (!state.roomRef || typeof state.roomRef.on !== 'function'){
      scheduleRetry();
      return false;
    }

    if (state.roomListenerAttached) return true;

    state.playersRef = state.roomRef.child('players');
    state.meRef = state.playersRef.child(getMyKey());

    state.roomRef.on('value', snap => {
      try{
        const room = snap && typeof snap.val === 'function' ? snap.val() || {} : {};
        publishRoom(room);
      }catch(err){
        state.lastError = err;
        console.warn('[GJ Battle Core] room listener failed', err);
      }
    });

    state.roomListenerAttached = true;

    emit('gj:battle-core-listening', {
      path:ROOM_PATH + '/' + state.roomCode
    });

    return true;
  }

  function scheduleRetry(){
    if (state.retryTimer) return;

    state.retryTimer = setTimeout(async () => {
      state.retryTimer = null;
      await waitForReady(2000);
      attachRoomListener();
    }, ROOM_LISTEN_RETRY_MS);
  }

  async function ensureRoomPresence(){
    if (!state.roomCode) return false;

    state.roomRef = state.roomRef || getRoomRef(state.roomCode);
    if (!state.roomRef) return false;

    const baseRoomPatch = {
      code:state.roomCode,
      room:state.roomCode,
      roomCode:state.roomCode,
      game:'goodjunk',
      gameId:'goodjunk',
      mode:MODE,
      phase:window.GJ_BATTLE_PHASE || 'play',
      status:window.GJ_BATTLE_PHASE || 'play',
      state:window.GJ_BATTLE_PHASE || 'play',
      activeMatchId:state.matchId || '',
      updatedAt:now(),
      coreVersion:CORE_VERSION
    };

    try{
      await state.roomRef.update(baseRoomPatch);
      await updateMyPlayer({
        status:'in-game',
        phase:window.GJ_BATTLE_PHASE || 'play',
        matchId:state.matchId || '',
        roundId:state.matchId || ''
      }, {force:true});

      return true;
    }catch(err){
      state.lastError = err;
      console.warn('[GJ Battle Core] ensureRoomPresence failed', err);
      return false;
    }
  }

  function startHeartbeat(){
    if (state.heartbeatTimer) return;

    state.heartbeatTimer = setInterval(() => {
      updateMyPlayer({
        status:state.ended ? 'finished' : 'in-game',
        phase:window.GJ_BATTLE_PHASE || (state.ended ? 'summary' : 'play'),
        lastSeen:now(),
        heartbeatAt:now(),
        updatedAt:now()
      });
    }, HEARTBEAT_MS);
  }

  function startLocalSyncLoop(){
    if (state.syncTimer) return;

    state.syncTimer = setInterval(() => {
      const phase = String(window.GJ_BATTLE_PHASE || '').toLowerCase();

      if (phase === 'summary' || state.ended){
        updateMyPlayer({
          finished:true,
          done:true,
          status:'finished',
          phase:'summary'
        });
      }else{
        updateMyPlayer({
          status:'in-game',
          phase:'play'
        });
      }
    }, 900);
  }

  async function forceRealtimeSync(reason){
    return await updateMyPlayer({
      syncReason:reason || 'force',
      updatedAt:now()
    }, {force:true});
  }

  async function markFinished(extra){
    state.ended = true;
    window.GJ_BATTLE_PHASE = 'summary';

    const patch = Object.assign({
      finished:true,
      done:true,
      status:'finished',
      phase:'summary',
      endedAt:now()
    }, extra || {});

    await updateMyPlayer(patch, {force:true});

    await updateRoom({
      phase:'summary',
      status:'summary',
      state:'summary',
      endedAt:now()
    });

    await writeSummary();

    emit('gj:battle-core-finished', {
      player:state.me,
      opponent:state.opponent
    });
  }

  async function writeSummary(){
    if (!state.roomRef) return false;

    const room = state.room || normalizeRoom(window.GJ_CURRENT_ROOM || {});
    const me = room.me || state.me || normalizePlayerEntry(state.playerId, buildBasePlayerPatch());
    const opponent = room.opponent || state.opponent || null;

    const meScore = sanitizeNumber(me.score ?? me.points, 0);
    const opScore = sanitizeNumber(opponent && (opponent.score ?? opponent.points), 0);

    let resultCode = 'draw';
    if (meScore > opScore) resultCode = 'win';
    if (meScore < opScore) resultCode = 'lose';

    const summary = {
      roomCode:state.roomCode,
      matchId:state.matchId || '',
      updatedAt:now(),
      players:{
        [state.playerId]:{
          pid:state.playerId,
          name:state.playerName,
          score:meScore,
          good:sanitizeNumber(me.good, 0),
          junk:sanitizeNumber(me.junk, 0),
          miss:sanitizeNumber(me.miss, 0),
          resultCode
        }
      }
    };

    if (opponent){
      summary.players[opponent.pid || opponent.id || opponent.key] = {
        pid:opponent.pid || opponent.id || opponent.key,
        name:opponent.name || opponent.displayName || 'Hero',
        score:opScore,
        good:sanitizeNumber(opponent.good, 0),
        junk:sanitizeNumber(opponent.junk, 0),
        miss:sanitizeNumber(opponent.miss, 0),
        resultCode:resultCode === 'win' ? 'lose' : resultCode === 'lose' ? 'win' : 'draw'
      };
    }

    try{
      await state.roomRef.child('summary').update(summary);
      return true;
    }catch(err){
      console.warn('[GJ Battle Core] writeSummary failed', err);
      return false;
    }
  }

  async function requestRematch(){
    if (!state.roomRef) return false;

    state.rematchRequested = true;

    try{
      await state.roomRef.child('rematch').child('players').child(state.playerId).update({
        pid:state.playerId,
        name:state.playerName,
        ready:true,
        view:state.view,
        updatedAt:now()
      });

      await state.roomRef.child('players').child(state.playerId).update({
        rematchReady:true,
        readyRematch:true,
        nextReady:true,
        updatedAt:now()
      });

      await tryStartRematch();

      emit('gj:battle-rematch-requested', {
        playerId:state.playerId
      });

      return true;
    }catch(err){
      state.lastError = err;
      console.warn('[GJ Battle Core] requestRematch failed', err);
      return false;
    }
  }

  async function tryStartRematch(){
    if (!state.roomRef) return false;

    const room = state.room || normalizeRoom(window.GJ_CURRENT_ROOM || {});
    const players = room.players || [];
    const rematchPlayers = safeObj(room.rematch && room.rematch.players);

    const activePlayers = players.filter(p => !p.left);
    const readyIds = Object.keys(rematchPlayers).filter(k => rematchPlayers[k] && rematchPlayers[k].ready);

    const enough =
      activePlayers.length >= 2 &&
      readyIds.length >= Math.min(2, activePlayers.length);

    if (!enough) return false;

    const newMatchId = 'rm_' + now() + '_' + Math.random().toString(16).slice(2, 8);

    try{
      await state.roomRef.update({
        phase:'play',
        status:'play',
        state:'play',
        matchId:newMatchId,
        roundId:newMatchId,
        runId:newMatchId,
        activeMatchId:newMatchId,
        startedAt:now(),
        updatedAt:now(),
        winner:null,
        reason:null
      });

      await state.roomRef.child('rematch').update({
        status:'starting',
        matchId:newMatchId,
        updatedAt:now()
      });

      return true;
    }catch(err){
      console.warn('[GJ Battle Core] tryStartRematch failed', err);
      return false;
    }
  }

  function handleRematchStart(rematch, room){
    const newMatchId =
      rematch.matchId ||
      room.matchId ||
      room.activeMatchId ||
      '';

    if (!newMatchId) return;
    if (state.currentRoundId === newMatchId && !state.ended) return;

    state.currentRoundId = newMatchId;
    state.matchId = newMatchId;
    state.ended = false;
    state.rematchRequested = false;

    window.GJ_MATCH_ID = newMatchId;
    window.GJ_BATTLE_PHASE = 'play';

    emit('gj:battle-rematch-start', {
      matchId:newMatchId,
      roomCode:state.roomCode
    });
  }

  function bindDomButtons(){
    const rematchButtons = Array.from(document.querySelectorAll('[data-rematch-btn], .btn-rematch, #btnRematch'));
    rematchButtons.forEach(btn => {
      if (btn.dataset.gjCoreRematchBound === '1') return;
      btn.dataset.gjCoreRematchBound = '1';
      btn.addEventListener('click', async ev => {
        ev.preventDefault();
        await requestRematch();

        const statusEl =
          document.querySelector('[data-rematch-status]') ||
          document.getElementById('rematchStatus');

        if (statusEl){
          statusEl.textContent = 'รอคู่แข่งกด Battle อีกครั้ง...';
        }
      });
    });

    const lobbyButtons = Array.from(document.querySelectorAll('[data-back-lobby], #btnBackLobby, #btnResultLobby'));
    lobbyButtons.forEach(btn => {
      if (btn.dataset.gjCoreLobbyBound === '1') return;
      btn.dataset.gjCoreLobbyBound = '1';
      btn.addEventListener('click', ev => {
        ev.preventDefault();
        location.href = buildLobbyUrl();
      });
    });

    const allModeButtons = Array.from(document.querySelectorAll('[data-all-modes], #btnAllModes'));
    allModeButtons.forEach(btn => {
      if (btn.dataset.gjCoreModesBound === '1') return;
      btn.dataset.gjCoreModesBound = '1';
      btn.addEventListener('click', ev => {
        ev.preventDefault();
        location.href = buildModesUrl();
      });
    });

    const hubButtons = Array.from(document.querySelectorAll('[data-back-hub], #btnHub, #btnResultHub'));
    hubButtons.forEach(btn => {
      if (btn.dataset.gjCoreHubBound === '1') return;
      btn.dataset.gjCoreHubBound = '1';
      btn.addEventListener('click', ev => {
        ev.preventDefault();
        location.href = buildHubUrl();
      });
    });
  }

  function buildLobbyUrl(){
    const out = new URL('./goodjunk-battle-v2-lobby.html', location.href);

    copyCommonParams(out);
    out.searchParams.set('room', state.roomCode || ROOM_CODE);
    out.searchParams.set('roomCode', state.roomCode || ROOM_CODE);
    out.searchParams.set('view', state.view);

    return out.toString();
  }

  function buildModesUrl(){
    const out = new URL('../goodjunk-launcher.html', location.href);
    copyCommonParams(out);
    return out.toString();
  }

  function buildHubUrl(){
    const hub = params.get('hub');

    if (hub){
      try{
        return new URL(hub, location.href).toString();
      }catch(_){}
    }

    const out = new URL('../nutrition-zone.html', location.href);
    copyCommonParams(out);
    return out.toString();
  }

  function copyCommonParams(out){
    [
      'pid',
      'name',
      'diff',
      'time',
      'view',
      'device',
      'room',
      'roomCode',
      'code',
      'hub',
      'zone',
      'cat',
      'studyId',
      'conditionGroup',
      'api',
      'log'
    ].forEach(k => {
      const v = params.get(k);
      if (v !== null && v !== ''){
        out.searchParams.set(k, v);
      }
    });

    if (!out.searchParams.get('pid')) out.searchParams.set('pid', state.playerId);
    if (!out.searchParams.get('name')) out.searchParams.set('name', state.playerName);
    if (!out.searchParams.get('view')) out.searchParams.set('view', state.view);
    if (!out.searchParams.get('zone')) out.searchParams.set('zone', 'nutrition');
    if (!out.searchParams.get('cat')) out.searchParams.set('cat', 'nutrition');
  }

  function bindRuntimeEvents(){
    window.addEventListener('gj:battle-state-updated', ev => {
      const d = safeObj(ev.detail);
      window.GJ_BATTLE_STATE = Object.assign({}, window.GJ_BATTLE_STATE || {}, d);
      updateMyPlayer({}, {force:false});
    });

    window.addEventListener('hha:score', ev => {
      const d = safeObj(ev.detail);
      const s = safeObj(window.GJ_BATTLE_STATE);

      const add = sanitizeNumber(d.points ?? d.score, 0);
      s.score = sanitizeNumber(s.score ?? s.myScore ?? s.points, 0) + add;
      s.points = sanitizeNumber(s.points ?? s.score, 0);
      s.myScore = s.score;
      s.good = sanitizeNumber(s.good, 0) + (d.type === 'good' ? 1 : 0);

      window.GJ_BATTLE_STATE = s;
      updateMyPlayer({}, {force:true});
    });

    window.addEventListener('hha:miss', ev => {
      const d = safeObj(ev.detail);
      const s = safeObj(window.GJ_BATTLE_STATE);

      s.miss = sanitizeNumber(s.miss, 0) + 1;

      if (d.type === 'junk'){
        s.junk = sanitizeNumber(s.junk, 0) + 1;
      }

      window.GJ_BATTLE_STATE = s;
      updateMyPlayer({}, {force:true});
    });

    window.addEventListener('gj:battle-ended', ev => {
      const d = safeObj(ev.detail);
      markFinished({
        result:d.title || d.result || '',
        resultCode:d.result || d.resultCode || '',
        reason:d.reason || ''
      });
    });

    window.addEventListener('beforeunload', markLeaving);
    window.addEventListener('pagehide', markLeaving);
  }

  function markLeaving(){
    try{
      if (!state.meRef) return;

      state.meRef.update({
        status:state.ended ? 'finished' : 'left',
        left:!state.ended,
        lastSeen:now(),
        updatedAt:now()
      });
    }catch(_){}
  }

  async function boot(){
    bindDomButtons();
    bindRuntimeEvents();

    if (!state.roomCode){
      console.warn('[GJ Battle Core] no room code found; core loaded in local mode only');
      window.GJ_BATTLE_CORE_READY = false;
      emit('gj:battle-core-local-only', {});
      return;
    }

    const ok = await waitForReady(6500);

    if (!ok){
      console.warn('[GJ Battle Core] Firebase not ready');
      window.GJ_BATTLE_CORE_READY = false;
      emit('gj:battle-core-not-ready', {
        error:String(state.lastError && state.lastError.message || state.lastError || 'not-ready')
      });
      scheduleRetry();
      return;
    }

    state.roomRef = getRoomRef(state.roomCode);
    state.playersRef = state.roomRef && state.roomRef.child('players');
    state.meRef = state.playersRef && state.playersRef.child(getMyKey());

    attachRoomListener();
    await ensureRoomPresence();

    startHeartbeat();
    startLocalSyncLoop();

    window.GJ_BATTLE_CORE_READY = true;

    emit('gj:battle-core-ready', {
      path:ROOM_PATH + '/' + state.roomCode,
      playerId:state.playerId,
      playerName:state.playerName,
      view:state.view
    });

    console.info('[GoodJunk Battle Core]', CORE_VERSION, 'ready', {
      room:state.roomCode,
      player:state.playerId,
      view:state.view
    });
  }

  window.GJ_BATTLE_CORE = {
    version:CORE_VERSION,
    state,

    waitForReady,
    getDb,
    getRoomRef,
    attachRoomListener,

    updateMyPlayer,
    updateRoom,
    forceRealtimeSync,
    markFinished,
    writeSummary,

    requestRematch,
    tryStartRematch,

    normalizeRoom,
    normalizePlayerEntry,
    getOpponent:function(){ return state.opponent || window.GJ_BATTLE_OPPONENT || null; },
    getMe:function(){ return state.me || window.GJ_BATTLE_ME || null; },
    buildLobbyUrl,
    buildModesUrl,
    buildHubUrl,

    boot
  };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();