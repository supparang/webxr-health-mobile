/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-battle-v2-core.js
   GoodJunk Battle v2 Core Sync
   PATCH: v2.4.33-core-opponent-score-rematch-stable
   Requires:
   - goodjunk-battle-v2-firebase-bridge.js
   ========================================================= */

(function GoodJunkBattleV2Core(){
  'use strict';

  const VERSION = 'v2.4.33-core-opponent-score-rematch-stable';
  const ROOM_PATH = 'herohealth/goodjunk/battleV2Rooms';
  const STALE_MS = 14000;
  const SYNC_MS = 1800;

  const url = new URL(location.href);
  const params = url.searchParams;

  const PLAYER_ID =
    params.get('pid') ||
    params.get('playerId') ||
    window.GJ_PLAYER_ID ||
    window.MY_PLAYER_ID ||
    'anon';

  const PLAYER_NAME =
    params.get('name') ||
    params.get('nick') ||
    params.get('playerName') ||
    window.GJ_PLAYER_NAME ||
    window.MY_PLAYER_NAME ||
    'Hero';

  const ROOM_CODE = normalizeRoomCode(
    params.get('room') ||
    params.get('roomCode') ||
    params.get('code') ||
    params.get('lastRoom') ||
    window.GJ_ROOM_CODE ||
    window.ROOM_CODE ||
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
      window.GJ_VIEW ||
      'pc'
    );

  const MODE =
    params.get('mode') ||
    'battle';

  const state = {
    version: VERSION,
    playerId: PLAYER_ID,
    playerName: PLAYER_NAME,
    roomCode: ROOM_CODE,
    matchId: MATCH_ID,
    view: VIEW,
    mode: MODE,
    room: null,
    players: {},
    me: null,
    opponent: null,
    roomRef: null,
    listenerAttached: false,
    syncTimer: null,
    heartbeatTimer: null,
    lastLocalState: {},
    lastRoomAt: 0,
    startedAt: Date.now(),
    rematchReady: false,
    destroyed: false,
    dbReady: false
  };

  window.GJ_PLAYER_ID = PLAYER_ID;
  window.MY_PLAYER_ID = PLAYER_ID;
  window.GJ_PLAYER_NAME = PLAYER_NAME;
  window.MY_PLAYER_NAME = PLAYER_NAME;
  window.GJ_ROOM_CODE = ROOM_CODE;
  window.ROOM_CODE = ROOM_CODE;
  window.GJ_MATCH_ID = MATCH_ID;
  window.GJ_BATTLE_CORE_VERSION = VERSION;

  function now(){
    return Date.now();
  }

  function log(){
    try{
      console.info.apply(console, ['[GJ Battle Core]'].concat(Array.from(arguments)));
    }catch(_){}
  }

  function warn(){
    try{
      console.warn.apply(console, ['[GJ Battle Core]'].concat(Array.from(arguments)));
    }catch(_){}
  }

  function normalizeRoomCode(raw){
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
  }

  function normalizeView(v){
    v = String(v || '').toLowerCase().trim();
    if (v === 'cvr' || v === 'vr') return 'cardboard';
    if (v === 'mobile') return 'mobile';
    if (v === 'cardboard') return 'cardboard';
    return 'pc';
  }

  function safeObj(v){
    return v && typeof v === 'object' ? v : {};
  }

  function safeNum(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function safeString(v, fallback){
    v = String(v == null ? '' : v).trim();
    return v || fallback || '';
  }

  function getBridge(){
    return window.GJ_BATTLE_FIREBASE_BRIDGE || null;
  }

  async function waitForBridgeReady(timeoutMs){
    timeoutMs = Number(timeoutMs || 6500);
    const start = now();

    while (now() - start < timeoutMs){
      const bridge = getBridge();

      if (bridge){
        try{
          if (typeof bridge.waitForReady === 'function'){
            const ok = await bridge.waitForReady(900);
            if (ok) return true;
          }else if (typeof bridge.refresh === 'function'){
            const ok = await bridge.refresh();
            if (ok) return true;
          }else if (typeof bridge.isReady === 'function' && bridge.isReady()){
            return true;
          }
        }catch(_){}
      }

      await new Promise(resolve => setTimeout(resolve, 180));
    }

    const bridge = getBridge();
    return !!(bridge && typeof bridge.isReady === 'function' && bridge.isReady());
  }

  function isDbReady(){
    const bridge = getBridge();

    if (bridge && typeof bridge.isReady === 'function'){
      return !!bridge.isReady();
    }

    return !!(
      window.GJ_BATTLE_DB_READY &&
      window.GJ_BATTLE_AUTH_READY &&
      window.GJ_DB &&
      typeof window.GJ_DB.ref === 'function'
    );
  }

  function getRoomRef(){
    if (!ROOM_CODE) return null;

    const bridge = getBridge();

    if (bridge && typeof bridge.getRoomRef === 'function'){
      return bridge.getRoomRef(ROOM_CODE);
    }

    if (window.GJ_DB && typeof window.GJ_DB.ref === 'function'){
      return window.GJ_DB.ref(ROOM_PATH + '/' + ROOM_CODE);
    }

    return null;
  }

  function normalizePlayer(id, raw){
    raw = safeObj(raw);

    const pid = safeString(raw.pid || raw.playerId || id, id || '');
    const name = safeString(raw.name || raw.playerName || raw.displayName || pid, 'Hero');

    const status = String(raw.status || 'online').toLowerCase();

    const left = !!(
      raw.left === true ||
      raw.quit === true ||
      raw.disconnected === true ||
      status === 'left' ||
      status === 'offline'
    );

    const lastSeen = safeNum(raw.lastSeen || raw.heartbeatAt || raw.updatedAt || 0, 0);

    return {
      id: id || pid,
      pid,
      raw,
      name,
      playerName: name,
      displayName: name,
      view: normalizeView(raw.view || raw.device || 'pc'),
      device: normalizeView(raw.device || raw.view || 'pc'),
      role: raw.role || '',
      host: !!raw.host,
      status,
      left,
      lastSeen,
      online: !left && (!lastSeen || now() - lastSeen <= STALE_MS),

      score: safeNum(raw.score || raw.points || raw.myScore || 0, 0),
      points: safeNum(raw.points || raw.score || raw.myScore || 0, 0),
      good: safeNum(raw.good || raw.goodCount || 0, 0),
      junk: safeNum(raw.junk || raw.junkCount || 0, 0),
      miss: safeNum(raw.miss || raw.missCount || 0, 0),

      hearts: safeNum(raw.hearts || raw.hp || raw.lives || 0, 0),
      hp: safeNum(raw.hp || raw.hearts || raw.lives || 0, 0),
      lives: safeNum(raw.lives || raw.hearts || raw.hp || 0, 0),

      power: safeNum(raw.power || raw.attackPower || 0, 0),
      attackPower: safeNum(raw.attackPower || raw.power || 0, 0),

      finished: !!(raw.finished || raw.done),
      done: !!(raw.done || raw.finished),
      result: raw.result || '',

      rematchReady: !!(raw.rematchReady || raw.readyRematch || raw.nextReady),
      readyRematch: !!(raw.readyRematch || raw.rematchReady || raw.nextReady),
      nextReady: !!(raw.nextReady || raw.rematchReady || raw.readyRematch),

      phase: raw.phase || '',
      currentPage: raw.currentPage || '',
      matchId: raw.matchId || raw.roundId || ''
    };
  }

  function normalizeRoom(room){
    room = safeObj(room);

    const playersMap = safeObj(room.players);
    const players = {};

    Object.entries(playersMap).forEach(function(pair){
      const id = pair[0];
      players[id] = normalizePlayer(id, pair[1]);
    });

    const code = normalizeRoomCode(
      room.code ||
      room.room ||
      room.roomCode ||
      ROOM_CODE
    );

    return {
      raw: room,
      code,
      room: code,
      roomCode: code,
      phase: String(room.phase || room.status || room.state || 'lobby').toLowerCase(),
      status: String(room.status || room.phase || room.state || 'lobby').toLowerCase(),
      state: String(room.state || room.phase || room.status || 'lobby').toLowerCase(),
      matchId: String(room.matchId || room.roundId || room.runId || MATCH_ID || ''),
      roundId: String(room.roundId || room.matchId || room.runId || MATCH_ID || ''),
      runId: String(room.runId || room.matchId || room.roundId || MATCH_ID || ''),
      hostPid: String(room.hostPid || ''),
      startedAt: safeNum(room.startedAt || 0, 0),
      endedAt: safeNum(room.endedAt || 0, 0),
      updatedAt: safeNum(room.updatedAt || 0, 0),
      winner: room.winner || '',
      reason: room.reason || '',
      effects: safeObj(room.effects),
      players
    };
  }

  function findMe(players){
    players = players || state.players || {};

    let me =
      players[PLAYER_ID] ||
      Object.values(players).find(function(p){
        return String(p.pid || '') === String(PLAYER_ID);
      });

    if (!me){
      me = normalizePlayer(PLAYER_ID, makeLocalPatch());
    }

    return me;
  }

  function findOpponent(players){
    players = players || state.players || {};

    const list = Object.values(players);

    const onlineOpponents = list.filter(function(p){
      return (
        String(p.id) !== String(PLAYER_ID) &&
        String(p.pid) !== String(PLAYER_ID) &&
        !p.left &&
        p.online
      );
    });

    if (onlineOpponents.length){
      onlineOpponents.sort(function(a, b){
        return safeNum(b.score, 0) - safeNum(a.score, 0);
      });
      return onlineOpponents[0];
    }

    const anyOpponent = list.find(function(p){
      return (
        String(p.id) !== String(PLAYER_ID) &&
        String(p.pid) !== String(PLAYER_ID)
      );
    });

    if (anyOpponent) return anyOpponent;

    return {
      id: '',
      pid: '',
      name: 'รอคู่แข่ง...',
      playerName: 'รอคู่แข่ง...',
      displayName: 'รอคู่แข่ง...',
      score: 0,
      points: 0,
      good: 0,
      junk: 0,
      miss: 0,
      hearts: 0,
      hp: 0,
      status: 'waiting',
      online: false,
      left: false,
      rematchReady: false,
      finished: false
    };
  }

  function updateGlobals(){
    window.GJ_CURRENT_ROOM = state.room ? state.room.raw || state.room : null;
    window.GJ_BATTLE_ROOM = state.room;
    window.GJ_BATTLE_PLAYERS = state.players || {};
    window.GJ_BATTLE_ME = state.me || null;
    window.GJ_BATTLE_OPPONENT = state.opponent || null;

    if (state.opponent){
      window.GJ_OPPONENT_NAME = state.opponent.name;
      window.GJ_OPPONENT_SCORE = safeNum(state.opponent.score, 0);
    }

    window.GJ_BATTLE_DB_READY = isDbReady();
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, {
        detail: Object.assign({
          version: VERSION,
          room: ROOM_CODE,
          playerId: PLAYER_ID,
          matchId: MATCH_ID
        }, detail || {})
      }));
    }catch(_){}
  }

  function applyRoomSnapshot(rawRoom, source){
    const room = normalizeRoom(rawRoom || {});
    state.room = room;
    state.players = room.players;
    state.me = findMe(room.players);
    state.opponent = findOpponent(room.players);
    state.lastRoomAt = now();

    updateGlobals();

    emit('gj:battle-room-updated', {
      source: source || 'room-listener',
      room: room,
      me: state.me,
      opponent: state.opponent
    });

    emit('gj:battle-opponent-updated', state.opponent);

    syncUIFromCore();

    return room;
  }

  function readRuntimeState(){
    const runtime = window.GJ_BATTLE_RUNTIME;
    const runtimeState = runtime && runtime.state ? runtime.state : {};

    const battleState = window.GJ_BATTLE_STATE || {};

    const score =
      firstNumber(runtimeState.score, battleState.score, battleState.myScore, battleState.points, 0);

    const good =
      firstNumber(runtimeState.good, battleState.good, battleState.goodCount, 0);

    const junk =
      firstNumber(runtimeState.junk, battleState.junk, battleState.junkCount, 0);

    const miss =
      firstNumber(runtimeState.miss, battleState.miss, battleState.missCount, 0);

    const hearts =
      firstNumber(runtimeState.hearts, runtimeState.hp, battleState.hearts, battleState.hp, battleState.lives, 3);

    const power =
      firstNumber(runtimeState.power, runtimeState.attackPower, battleState.power, battleState.attackPower, 0);

    const timeLeft =
      firstNumber(runtimeState.timeLeft, battleState.timeLeft, battleState.remaining, 0);

    const ended =
      !!(runtimeState.ended || battleState.ended || window.GJ_BATTLE_PHASE === 'summary');

    return {
      score,
      points: score,
      good,
      junk,
      miss,
      hearts,
      hp: hearts,
      lives: hearts,
      power,
      attackPower: power,
      timeLeft,
      remaining: timeLeft,
      ended,
      finished: ended,
      done: ended
    };
  }

  function firstNumber(){
    for (let i = 0; i < arguments.length; i++){
      const n = Number(arguments[i]);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  function makeLocalPatch(extra){
    const local = readRuntimeState();

    return Object.assign({
      pid: PLAYER_ID,
      name: PLAYER_NAME,
      playerName: PLAYER_NAME,
      displayName: PLAYER_NAME,
      view: VIEW,
      device: VIEW,
      mode: MODE,
      matchId: MATCH_ID,
      roundId: MATCH_ID,
      status: local.ended ? 'finished' : 'in-game',
      phase: local.ended ? 'summary' : 'play',
      currentPage: local.ended ? 'summary' : 'run',
      left: false,
      quit: false,
      disconnected: false,
      rematchReady: state.rematchReady,
      readyRematch: state.rematchReady,
      nextReady: state.rematchReady,
      updatedAt: now(),
      lastSeen: now(),
      heartbeatAt: now()
    }, local, extra || {});
  }

  async function updateMyPlayer(extra){
    const patch = makeLocalPatch(extra);

    state.lastLocalState = Object.assign({}, state.lastLocalState, patch);

    const bridge = getBridge();

    if (bridge && typeof bridge.updatePlayer === 'function'){
      return await bridge.updatePlayer(ROOM_CODE, PLAYER_ID, patch);
    }

    const ref = state.roomRef || getRoomRef();

    if (!ref || typeof ref.child !== 'function'){
      return false;
    }

    try{
      await ref.child('players').child(PLAYER_ID).update(patch);
      return true;
    }catch(err){
      warn('updateMyPlayer failed', err);
      return false;
    }
  }

  async function updateRoom(patch){
    patch = Object.assign({}, patch || {}, {
      updatedAt: now()
    });

    const bridge = getBridge();

    if (bridge && typeof bridge.updateRoom === 'function'){
      return await bridge.updateRoom(ROOM_CODE, patch);
    }

    const ref = state.roomRef || getRoomRef();

    if (!ref || typeof ref.update !== 'function'){
      return false;
    }

    try{
      await ref.update(patch);
      return true;
    }catch(err){
      warn('updateRoom failed', err);
      return false;
    }
  }

  async function getRoomOnce(){
    const bridge = getBridge();

    if (bridge && typeof bridge.getRoom === 'function'){
      const room = await bridge.getRoom(ROOM_CODE);
      if (room) applyRoomSnapshot(room, 'getRoomOnce-bridge');
      return room;
    }

    const ref = state.roomRef || getRoomRef();

    if (!ref || typeof ref.once !== 'function'){
      return null;
    }

    try{
      const snap = await ref.once('value');
      const room = snap && typeof snap.val === 'function' ? snap.val() || null : null;
      if (room) applyRoomSnapshot(room, 'getRoomOnce-ref');
      return room;
    }catch(err){
      warn('getRoomOnce failed', err);
      return null;
    }
  }

  function attachRoomListener(){
    if (!ROOM_CODE) return false;

    const ref = getRoomRef();

    if (!ref || typeof ref.on !== 'function'){
      return false;
    }

    if (state.listenerAttached) return true;

    state.roomRef = ref;
    state.listenerAttached = true;

    try{
      ref.on('value', function(snapshot){
        const room = snapshot && typeof snapshot.val === 'function'
          ? snapshot.val() || {}
          : {};

        applyRoomSnapshot(room, 'firebase-value');
      });

      return true;
    }catch(err){
      warn('attachRoomListener failed', err);
      state.listenerAttached = false;
      return false;
    }
  }

  function startSyncLoop(){
    if (state.syncTimer) return;

    state.syncTimer = setInterval(function(){
      if (state.destroyed) return;
      forceRealtimeSync('interval');
    }, SYNC_MS);

    state.heartbeatTimer = setInterval(function(){
      if (state.destroyed) return;
      updateMyPlayer({
        status: window.GJ_BATTLE_PHASE === 'summary' ? 'finished' : 'in-game',
        phase: window.GJ_BATTLE_PHASE === 'summary' ? 'summary' : 'play'
      });
    }, 4200);
  }

  async function forceRealtimeSync(source){
    if (!ROOM_CODE) return false;

    if (!isDbReady()){
      state.dbReady = false;
      updateGlobals();
      return false;
    }

    state.dbReady = true;

    const ok = await updateMyPlayer({
      syncSource: source || 'forceRealtimeSync'
    });

    updateGlobals();

    return ok;
  }

  function syncUIFromCore(){
    const op = state.opponent || findOpponent(state.players);
    const me = state.me || findMe(state.players);

    const rivalScoreEl =
      document.getElementById('rivalScore') ||
      document.querySelector('[data-rival-score]') ||
      document.querySelector('#opponentScore');

    if (rivalScoreEl){
      rivalScoreEl.textContent = String(safeNum(op.score, 0));
    }

    const opponentNameEl =
      document.getElementById('opponentName') ||
      document.querySelector('[data-opponent-name]');

    if (opponentNameEl){
      opponentNameEl.textContent = 'คู่แข่ง: ' + (op.name || 'รอคู่แข่ง...');
    }

    const opponentStatusEl =
      document.getElementById('opponentStatus') ||
      document.querySelector('[data-opponent-status]');

    if (opponentStatusEl){
      if (op.left || !op.online){
        opponentStatusEl.textContent = op.name && op.name !== 'รอคู่แข่ง...' ? 'LEFT' : 'WAIT';
        opponentStatusEl.classList.add('off');
      }else{
        opponentStatusEl.textContent = op.finished ? 'DONE' : 'PLAY';
        opponentStatusEl.classList.remove('off');
      }
    }

    const battlePower =
      document.getElementById('battlePower') ||
      document.querySelector('[data-battle-power]');

    if (battlePower){
      const power = firstNumber(me.power, me.attackPower, 0);
      battlePower.textContent =
        'พลัง ' + power + '/5 • คู่แข่ง: ' +
        (op.name || 'รอคู่แข่ง...') + ' • ' +
        safeNum(op.score, 0);
    }

    updateResultOverlayFromCore();
  }

  function updateResultOverlayFromCore(){
    const overlay = document.getElementById('resultOverlay');

    if (!overlay || !overlay.classList.contains('show')){
      return;
    }

    const op = state.opponent || findOpponent(state.players);
    const me = state.me || findMe(state.players);

    const resultOpName = document.getElementById('resultOpName');
    const resultOpScore = document.getElementById('resultOpScore');
    const resultOpMeta = document.getElementById('resultOpMeta');

    if (resultOpName){
      resultOpName.textContent = 'คู่แข่ง: ' + (op.name || 'รอคู่แข่ง...');
    }

    if (resultOpScore){
      resultOpScore.textContent = String(safeNum(op.score, 0));
    }

    if (resultOpMeta){
      resultOpMeta.textContent =
        'Good: ' + safeNum(op.good, 0) +
        ' • Junk: ' + safeNum(op.junk, 0) +
        ' • Miss: ' + safeNum(op.miss, 0);
    }

    const resultMeName = document.getElementById('resultMeName');
    const resultMyScore = document.getElementById('resultMyScore');
    const resultMyMeta = document.getElementById('resultMyMeta');

    if (resultMeName){
      resultMeName.textContent = 'คุณ: ' + PLAYER_NAME;
    }

    if (resultMyScore){
      const local = readRuntimeState();
      resultMyScore.textContent = String(local.score || safeNum(me.score, 0));
    }

    if (resultMyMeta){
      const local = readRuntimeState();
      resultMyMeta.textContent =
        'Good: ' + safeNum(local.good || me.good, 0) +
        ' • Junk: ' + safeNum(local.junk || me.junk, 0) +
        ' • Miss: ' + safeNum(local.miss || me.miss, 0);
    }

    const rematchStatus = document.getElementById('rematchStatus');

    if (rematchStatus){
      const readyCount = Object.values(state.players || {}).filter(function(p){
        return p.rematchReady;
      }).length;

      if (state.rematchReady){
        rematchStatus.textContent =
          'พร้อมเล่นต่อแล้ว • รอผู้เล่นอีกคน (' + readyCount + '/2)';
      }else{
        rematchStatus.textContent =
          'กด Battle อีกครั้ง เมื่อต้องการเล่นต่อ';
      }
    }
  }

  async function requestRematch(){
    state.rematchReady = true;

    await updateMyPlayer({
      rematchReady: true,
      readyRematch: true,
      nextReady: true,
      status: 'rematch-ready',
      phase: 'summary'
    });

    const room = await getRoomOnce();
    const nr = normalizeRoom(room || state.room || {});
    const readyPlayers = Object.values(nr.players || {}).filter(function(p){
      return p.rematchReady || p.readyRematch || p.nextReady;
    });

    if (readyPlayers.length >= 2){
      const newMatchId = 'm_' + now() + '_' + Math.random().toString(16).slice(2, 8);

      await updateRoom({
        phase: 'play',
        status: 'play',
        state: 'play',
        matchId: newMatchId,
        roundId: newMatchId,
        runId: newMatchId,
        activeMatchId: newMatchId,
        startedAt: now(),
        endedAt: null,
        reason: null,
        winner: null
      });

      await resetMyForRematch(newMatchId);

      emit('gj:battle-rematch-start', {
        matchId: newMatchId
      });

      const out = new URL(location.href);
      out.searchParams.set('matchId', newMatchId);
      out.searchParams.set('roundId', newMatchId);
      out.searchParams.set('seed', String(now()));
      out.searchParams.set('run', 'play');
      out.searchParams.set('phase', 'play');

      setTimeout(function(){
        location.href = out.toString();
      }, 280);
    }else{
      syncUIFromCore();
    }
  }

  async function resetMyForRematch(newMatchId){
    state.rematchReady = false;

    return updateMyPlayer({
      score: 0,
      points: 0,
      good: 0,
      junk: 0,
      miss: 0,
      hearts: 3,
      hp: 3,
      lives: 3,
      power: 0,
      attackPower: 0,
      finished: false,
      done: false,
      result: null,
      status: 'in-game',
      phase: 'play',
      currentPage: 'run',
      matchId: newMatchId,
      roundId: newMatchId,
      rematchReady: false,
      readyRematch: false,
      nextReady: false
    });
  }

  async function markLeft(){
    const bridge = getBridge();

    if (bridge && typeof bridge.markPlayerLeft === 'function'){
      return bridge.markPlayerLeft(ROOM_CODE, PLAYER_ID);
    }

    return updateMyPlayer({
      status: 'left',
      left: true,
      quit: true,
      disconnected: true,
      phase: 'left',
      currentPage: 'left'
    });
  }

  function hookButtons(){
    document.querySelectorAll('[data-rematch-btn], .btn-rematch, #btnRematch').forEach(function(btn){
      if (btn.dataset.gjCoreRematchBound === '1') return;
      btn.dataset.gjCoreRematchBound = '1';

      btn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        requestRematch();
      }, true);
    });

    document.querySelectorAll('[data-back-lobby], #btnBackLobby, #btnResultLobby').forEach(function(btn){
      if (btn.dataset.gjCoreLobbyBound === '1') return;
      btn.dataset.gjCoreLobbyBound = '1';

      btn.addEventListener('click', function(){
        markLeft();
      }, true);
    });

    document.querySelectorAll('[data-back-hub], #btnHub, #btnResultHub').forEach(function(btn){
      if (btn.dataset.gjCoreHubBound === '1') return;
      btn.dataset.gjCoreHubBound = '1';

      btn.addEventListener('click', function(){
        markLeft();
      }, true);
    });
  }

  function hookRuntimeEvents(){
    window.addEventListener('gj:good-collected', function(){
      setTimeout(function(){
        forceRealtimeSync('good-collected');
      }, 40);
    });

    window.addEventListener('gj:junk-hit', function(){
      setTimeout(function(){
        forceRealtimeSync('junk-hit');
      }, 40);
    });

    window.addEventListener('hha:score', function(){
      setTimeout(function(){
        forceRealtimeSync('hha-score');
      }, 40);
    });

    window.addEventListener('hha:miss', function(){
      setTimeout(function(){
        forceRealtimeSync('hha-miss');
      }, 40);
    });

    window.addEventListener('gj:battle-ended', async function(ev){
      const detail = ev && ev.detail ? ev.detail : {};

      await updateMyPlayer({
        finished: true,
        done: true,
        status: 'finished',
        phase: 'summary',
        currentPage: 'summary',
        result: detail.result || '',
        reason: detail.reason || ''
      });

      await updateRoom({
        phase: 'summary',
        status: 'summary',
        state: 'summary',
        endedAt: now(),
        reason: detail.reason || ''
      });

      setTimeout(function(){
        getRoomOnce();
      }, 300);
    });

    window.addEventListener('beforeunload', function(){
      markLeft();
    });

    window.addEventListener('pagehide', function(){
      markLeft();
    });
  }

  async function boot(){
    hookButtons();
    hookRuntimeEvents();

    if (!ROOM_CODE){
      warn('No room code. Core runs in local mode.');
      updateGlobals();
      return false;
    }

    const ready = await waitForBridgeReady(6500);
    state.dbReady = ready;

    if (!ready){
      warn('DB/Auth not ready. Core fallback local.', {
        room: ROOM_CODE,
        playerId: PLAYER_ID
      });
      updateGlobals();
      return false;
    }

    state.roomRef = getRoomRef();

    attachRoomListener();

    await updateMyPlayer({
      status: 'in-game',
      phase: 'play',
      currentPage: 'run',
      joinedRunAt: now()
    });

    await getRoomOnce();

    startSyncLoop();

    emit('gj:battle-core-ready', {
      ready: true,
      roomCode: ROOM_CODE,
      playerId: PLAYER_ID,
      view: VIEW
    });

    log(VERSION, 'ready', {
      room: ROOM_CODE,
      playerId: PLAYER_ID,
      view: VIEW
    });

    return true;
  }

  function destroy(){
    state.destroyed = true;
    clearInterval(state.syncTimer);
    clearInterval(state.heartbeatTimer);
    markLeft();
  }

  const api = {
    version: VERSION,
    state,
    boot,
    destroy,
    getRoomOnce,
    updateMyPlayer,
    updateRoom,
    forceRealtimeSync,
    requestRematch,
    resetMyForRematch,
    markLeft,
    normalizeRoom,
    normalizePlayer,
    findOpponent,
    findMe,
    readRuntimeState,
    syncUIFromCore
  };

  window.GJ_BATTLE_CORE = api;

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      setTimeout(boot, 80);
    }, { once:true });
  }else{
    setTimeout(boot, 80);
  }

  setInterval(hookButtons, 1200);

  console.info('[GJ Battle Core]', VERSION, 'loaded');
})();
