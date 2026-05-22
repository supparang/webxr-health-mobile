/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-battle-v2-core.js
   GoodJunk Battle v2 Core Sync
   Version: v2.4.31-clean-final
   Purpose:
   - ใช้ร่วมกับ run-pc / run-mobile / run-cardboard
   - sync คะแนนตัวเองขึ้น Firebase
   - ฟังคะแนนคู่แข่งแบบ realtime
   - แก้ชื่อคู่แข่งไม่ขึ้น เช่น KK ไม่ขึ้น แต่คะแนนมา
   - แก้ผลสรุป PC/Mobile ไม่ตรงกัน
   - รองรับ rematch / กลับ lobby / กลับ launcher / hub
========================================================= */

(function GoodJunkBattleV2Core(){
  'use strict';

  const VERSION = 'v2.4.31-clean-final-core-sync';

  const url = new URL(location.href);
  const params = url.searchParams;

  const ROOM_CODE = normalizeRoomCode(
    params.get('room') ||
    params.get('roomCode') ||
    params.get('code') ||
    params.get('lastRoom') ||
    window.GJ_ROOM_CODE ||
    window.ROOM_CODE ||
    ''
  );

  const PLAYER_ID = String(
    params.get('pid') ||
    window.GJ_PLAYER_ID ||
    window.MY_PLAYER_ID ||
    localStorage.getItem('GJ_BATTLE_PID') ||
    localStorage.getItem('HHA_GJ_PID') ||
    'anon'
  ).trim() || 'anon';

  const PLAYER_NAME = String(
    params.get('name') ||
    params.get('nick') ||
    window.GJ_PLAYER_NAME ||
    window.MY_PLAYER_NAME ||
    localStorage.getItem('GJ_BATTLE_NAME') ||
    localStorage.getItem('HHA_GJ_NAME') ||
    'Hero'
  ).trim() || 'Hero';

  const VIEW = normalizeView(
    params.get('view') ||
    params.get('device') ||
    window.GJ_VIEW ||
    detectView()
  );

  const MATCH_ID = String(
    params.get('matchId') ||
    params.get('roundId') ||
    params.get('runId') ||
    window.GJ_MATCH_ID ||
    ''
  ).trim();

  const MODE = 'battle';
  const GAME = 'goodjunk';

  const HEARTBEAT_MS = 2500;
  const SYNC_MS = 900;
  const OPPONENT_TIMEOUT_MS = 15000;

  const state = {
    version: VERSION,
    roomCode: ROOM_CODE,
    playerId: PLAYER_ID,
    playerName: PLAYER_NAME,
    view: VIEW,
    matchId: MATCH_ID,

    bridgeReady: false,
    roomRef: null,
    room: null,
    players: {},
    me: null,
    opponent: null,

    heartbeatTimer: null,
    syncTimer: null,
    offRoom: null,

    latestLocal: {},
    ended: false,
    rematchReady: false,
    lastSyncAt: 0,
    lastOpponentAt: 0
  };

  window.GJ_BATTLE_CORE_VERSION = VERSION;
  window.GJ_PLAYER_ID = PLAYER_ID;
  window.MY_PLAYER_ID = PLAYER_ID;
  window.GJ_PLAYER_NAME = PLAYER_NAME;
  window.MY_PLAYER_NAME = PLAYER_NAME;
  window.GJ_ROOM_CODE = ROOM_CODE;
  window.ROOM_CODE = ROOM_CODE;
  window.GJ_MATCH_ID = MATCH_ID;
  window.GJ_BATTLE_MODE = MODE;

  function now(){
    return Date.now();
  }

  function log(){
    try{
      console.info.apply(console, ['[GJ Battle Core]'].concat([].slice.call(arguments)));
    }catch(_){}
  }

  function warn(){
    try{
      console.warn.apply(console, ['[GJ Battle Core]'].concat([].slice.call(arguments)));
    }catch(_){}
  }

  function emit(name, detail){
    window.dispatchEvent(new CustomEvent(name, {
      detail: detail || {}
    }));
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
    const s = String(v || '').toLowerCase().trim();

    if (s === 'pc' || s === 'desktop') return 'pc';
    if (s === 'cardboard' || s === 'cvr' || s === 'vr') return 'cardboard';
    if (s === 'mobile' || s === 'phone') return 'mobile';

    return detectView();
  }

  function detectView(){
    const isMobile =
      (window.matchMedia && window.matchMedia('(max-width:760px)').matches) ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

    return isMobile ? 'mobile' : 'pc';
  }

  function safeObj(v){
    return v && typeof v === 'object' ? v : {};
  }

  function num(v, d){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(d || 0);
  }

  function bool(v){
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  function getBridge(){
    return window.GJ_BATTLE_FIREBASE_BRIDGE || null;
  }

  async function waitForBridge(timeoutMs){
    timeoutMs = Number(timeoutMs || 5000);

    const started = now();

    return new Promise(resolve => {
      const tick = async () => {
        const bridge = getBridge();

        if (bridge){
          try{
            if (typeof bridge.init === 'function'){
              await bridge.init();
            }else if (typeof bridge.refresh === 'function'){
              await bridge.refresh();
            }
          }catch(_){}

          if (typeof bridge.isReady === 'function' && bridge.isReady()){
            resolve(true);
            return;
          }
        }

        if (now() - started >= timeoutMs){
          resolve(false);
          return;
        }

        setTimeout(tick, 160);
      };

      tick();
    });
  }

  function getRoomRef(){
    const bridge = getBridge();

    if (!ROOM_CODE || !bridge || typeof bridge.getRoomRef !== 'function'){
      return null;
    }

    return bridge.getRoomRef(ROOM_CODE);
  }

  function currentRuntimeState(){
    const runtime = window.GJ_BATTLE_RUNTIME && window.GJ_BATTLE_RUNTIME.state
      ? window.GJ_BATTLE_RUNTIME.state
      : {};

    const battleState = window.GJ_BATTLE_STATE || {};

    return Object.assign({}, battleState, runtime);
  }

  function makePlayerPatch(extra){
    const rs = currentRuntimeState();

    return Object.assign({
      pid: PLAYER_ID,
      name: PLAYER_NAME,
      playerName: PLAYER_NAME,
      displayName: PLAYER_NAME,

      view: VIEW,
      device: VIEW,
      mode: MODE,
      game: GAME,

      status: state.ended ? 'finished' : 'in-game',
      phase: state.ended ? 'summary' : 'play',
      currentPage: 'run',

      score: num(rs.score ?? rs.myScore ?? rs.points, 0),
      points: num(rs.points ?? rs.score ?? rs.myScore, 0),
      good: num(rs.good ?? rs.goodCount, 0),
      junk: num(rs.junk ?? rs.junkCount, 0),
      miss: num(rs.miss ?? rs.missCount, 0),
      bestStreak: num(rs.bestStreak ?? rs.streakMax ?? rs.comboMax, 0),

      hearts: num(rs.hearts ?? rs.hp, 3),
      hp: num(rs.hp ?? rs.hearts, 3),
      lives: num(rs.lives ?? rs.hearts ?? rs.hp, 3),

      power: num(rs.power ?? rs.attackPower, 0),
      attackPower: num(rs.attackPower ?? rs.power, 0),

      finished: !!state.ended || bool(rs.finished),
      done: !!state.ended || bool(rs.done),

      left: false,
      quit: false,
      disconnected: false,

      roomCode: ROOM_CODE,
      room: ROOM_CODE,
      matchId: state.matchId || MATCH_ID || '',
      roundId: state.matchId || MATCH_ID || '',

      lastSeen: now(),
      heartbeatAt: now(),
      updatedAt: now(),
      coreVersion: VERSION
    }, extra || {});
  }

  function normalizePlayer(id, raw){
    raw = safeObj(raw);

    return {
      id,
      raw,

      pid: String(raw.pid || id || ''),
      name: String(
        raw.name ||
        raw.playerName ||
        raw.displayName ||
        raw.nick ||
        raw.pid ||
        id ||
        'Hero'
      ),

      view: raw.view || raw.device || 'pc',
      status: String(raw.status || 'online').toLowerCase(),
      phase: String(raw.phase || '').toLowerCase(),

      score: num(raw.score ?? raw.points, 0),
      points: num(raw.points ?? raw.score, 0),
      good: num(raw.good ?? raw.goodCount, 0),
      junk: num(raw.junk ?? raw.junkCount, 0),
      miss: num(raw.miss ?? raw.missCount, 0),
      bestStreak: num(raw.bestStreak ?? raw.streakMax, 0),

      hearts: num(raw.hearts ?? raw.hp, 0),
      hp: num(raw.hp ?? raw.hearts, 0),

      finished: bool(raw.finished) || bool(raw.done),
      done: bool(raw.done) || bool(raw.finished),

      host: bool(raw.host),
      role: raw.role || '',
      left: bool(raw.left) || bool(raw.quit) || bool(raw.disconnected),
      lastSeen: num(raw.lastSeen ?? raw.heartbeatAt ?? raw.updatedAt, 0),
      updatedAt: num(raw.updatedAt, 0),
      matchId: raw.matchId || raw.roundId || ''
    };
  }

  function isOnline(p){
    if (!p) return false;
    if (p.left) return false;
    if (p.status === 'left' || p.status === 'offline') return false;

    if (p.lastSeen && now() - p.lastSeen > OPPONENT_TIMEOUT_MS){
      return false;
    }

    return true;
  }

  function normalizeRoom(room){
    room = safeObj(room);

    const playersMap = safeObj(room.players);
    const players = Object.entries(playersMap).map(([id, raw]) => normalizePlayer(id, raw));

    const me = players.find(p =>
      String(p.id) === String(PLAYER_ID) ||
      String(p.pid) === String(PLAYER_ID)
    ) || null;

    const onlineOpponents = players
      .filter(p => !(
        String(p.id) === String(PLAYER_ID) ||
        String(p.pid) === String(PLAYER_ID)
      ))
      .filter(isOnline)
      .sort((a, b) => (b.updatedAt || b.lastSeen || 0) - (a.updatedAt || a.lastSeen || 0));

    const anyOpponent = players.find(p => !(
      String(p.id) === String(PLAYER_ID) ||
      String(p.pid) === String(PLAYER_ID)
    )) || null;

    const opponent = onlineOpponents[0] || anyOpponent || null;

    return {
      raw: room,
      code: normalizeRoomCode(room.code || room.roomCode || room.room || ROOM_CODE),
      phase: String(room.phase || room.status || room.state || 'play').toLowerCase(),
      status: String(room.status || room.phase || room.state || 'play').toLowerCase(),
      matchId: String(room.matchId || room.roundId || room.runId || room.activeMatchId || state.matchId || MATCH_ID || ''),
      startedAt: num(room.startedAt, 0),
      endedAt: num(room.endedAt, 0),
      updatedAt: num(room.updatedAt, 0),
      playersMap,
      players,
      me,
      opponent
    };
  }

  async function updateRoom(patch){
    if (!state.roomRef) return false;

    try{
      await state.roomRef.update(Object.assign({}, patch || {}, {
        updatedAt: now()
      }));

      return true;
    }catch(err){
      warn('updateRoom failed', err);
      return false;
    }
  }

  async function updateMyPlayer(extra){
    if (!state.roomRef) return false;

    try{
      await state.roomRef.child('players').child(PLAYER_ID).update(makePlayerPatch(extra));
      state.lastSyncAt = now();
      return true;
    }catch(err){
      warn('updateMyPlayer failed', err);
      return false;
    }
  }

  async function forceRealtimeSync(source){
    await updateMyPlayer({
      syncSource: source || 'force',
      forceSyncAt: now()
    });
  }

  function applyOpponentToWindow(opponent){
    if (!opponent) return;

    const op = {
      id: opponent.id,
      pid: opponent.pid,
      name: opponent.name || 'Hero',
      score: opponent.score,
      points: opponent.points,
      good: opponent.good,
      junk: opponent.junk,
      miss: opponent.miss,
      bestStreak: opponent.bestStreak,
      hearts: opponent.hearts,
      hp: opponent.hp,
      status: opponent.status,
      phase: opponent.phase,
      finished: opponent.finished,
      done: opponent.done,
      updatedAt: opponent.updatedAt,
      lastSeen: opponent.lastSeen
    };

    window.GJ_BATTLE_OPPONENT = op;
    window.GJ_OPPONENT = op;

    state.opponent = op;
    state.lastOpponentAt = now();

    emit('gj:battle-opponent-updated', op);

    if (op.status === 'left' || op.status === 'offline'){
      emit('gj:battle-opponent-left', op);
    }
  }

  function applyRoomToWindow(room){
    const nr = normalizeRoom(room);

    state.room = nr.raw;
    state.players = nr.playersMap;
    state.me = nr.me;

    if (nr.matchId && !state.matchId){
      state.matchId = nr.matchId;
      window.GJ_MATCH_ID = nr.matchId;
    }

    window.GJ_CURRENT_ROOM = nr.raw;
    window.GJ_BATTLE_ROOM = nr.raw;
    window.GJ_BATTLE_ROOM_NORMALIZED = nr;

    if (nr.opponent){
      applyOpponentToWindow(nr.opponent);
    }

    emit('gj:battle-room-updated', nr);

    maybeEndFromRoom(nr);
    return nr;
  }

  function maybeEndFromRoom(nr){
    if (!nr || state.ended) return;

    const me = nr.me;
    const op = nr.opponent;

    const roomEnded =
      nr.phase === 'summary' ||
      nr.phase === 'ended' ||
      nr.status === 'summary' ||
      nr.status === 'ended';

    if (!roomEnded) return;

    if (window.GJ_BATTLE_RUNTIME && typeof window.GJ_BATTLE_RUNTIME.endGame === 'function'){
      if (!state.ended){
        state.ended = true;

        const myScore = me ? me.score : num(currentRuntimeState().score, 0);
        const opScore = op ? op.score : 0;

        let result = 'timeup';
        if (myScore > opScore) result = 'win';
        else if (myScore < opScore) result = 'lose';
        else result = 'draw';

        window.GJ_BATTLE_RUNTIME.endGame(result, 'room-summary');
      }
    }
  }

  function attachRoomListener(){
    if (!state.roomRef || typeof state.roomRef.on !== 'function') return false;

    if (state.offRoom){
      try{ state.offRoom(); }catch(_){}
      state.offRoom = null;
    }

    const handler = function(snapshot){
      const room = snapshot && typeof snapshot.val === 'function'
        ? snapshot.val() || {}
        : {};

      applyRoomToWindow(room);
    };

    state.roomRef.on('value', handler);

    state.offRoom = function(){
      try{
        state.roomRef.off('value', handler);
      }catch(_){}
    };

    return true;
  }

  function startHeartbeat(){
    if (state.heartbeatTimer) return;

    state.heartbeatTimer = setInterval(function(){
      updateMyPlayer({
        status: state.ended ? 'finished' : 'in-game',
        phase: state.ended ? 'summary' : 'play'
      });
    }, HEARTBEAT_MS);

    window.addEventListener('beforeunload', markLeftSync);
    window.addEventListener('pagehide', markLeftSync);
  }

  function startPeriodicSync(){
    if (state.syncTimer) return;

    state.syncTimer = setInterval(function(){
      if (state.ended) return;

      updateMyPlayer({
        status: 'in-game',
        phase: 'play'
      });
    }, SYNC_MS);
  }

  function stopTimers(){
    clearInterval(state.heartbeatTimer);
    clearInterval(state.syncTimer);

    state.heartbeatTimer = null;
    state.syncTimer = null;
  }

  function markLeftSync(){
    try{
      if (!state.roomRef) return;

      state.roomRef.child('players').child(PLAYER_ID).update({
        status: state.ended ? 'finished' : 'left',
        left: !state.ended,
        quit: !state.ended,
        disconnected: !state.ended,
        updatedAt: now(),
        lastSeen: now()
      });
    }catch(_){}
  }

  async function markFinished(extra){
    state.ended = true;

    await updateMyPlayer(Object.assign({
      status: 'finished',
      phase: 'summary',
      finished: true,
      done: true,
      endedAt: now()
    }, extra || {}));

    await updateRoom({
      phase: 'summary',
      status: 'summary',
      state: 'summary',
      endedAt: now()
    });

    stopTimers();
  }

  async function rematch(){
    if (!state.roomRef) return false;

    state.rematchReady = true;

    const patch = {
      rematchReady: true,
      readyRematch: true,
      nextReady: true,
      status: 'rematch-ready',
      phase: 'summary',
      updatedAt: now()
    };

    try{
      await state.roomRef.child('players').child(PLAYER_ID).update(patch);

      const snap = await state.roomRef.once('value');
      const room = snap && typeof snap.val === 'function' ? snap.val() || {} : {};
      const nr = normalizeRoom(room);

      const online = nr.players.filter(isOnline);
      const ready = online.filter(p =>
        p.raw &&
        (
          p.raw.rematchReady === true ||
          p.raw.readyRematch === true ||
          p.raw.nextReady === true
        )
      );

      emit('gj:battle-rematch-ready', {
        ready: ready.length,
        total: online.length
      });

      if (online.length >= 2 && ready.length >= 2){
        const matchId = makeMatchId();

        await state.roomRef.update({
          phase: 'play',
          status: 'play',
          state: 'play',
          matchId,
          roundId: matchId,
          runId: matchId,
          activeMatchId: matchId,
          startedAt: now(),
          updatedAt: now(),
          endedAt: null,
          winner: null,
          reason: null
        });

        for (const p of online){
          await state.roomRef.child('players').child(p.id).update({
            score: 0,
            points: 0,
            good: 0,
            junk: 0,
            miss: 0,
            bestStreak: 0,
            hearts: 3,
            hp: 3,
            lives: 3,
            power: 0,
            attackPower: 0,
            finished: false,
            done: false,
            rematchReady: false,
            readyRematch: false,
            nextReady: false,
            status: 'in-game',
            phase: 'play',
            matchId,
            roundId: matchId,
            updatedAt: now(),
            lastSeen: now()
          });
        }

        emit('gj:battle-rematch-start', {
          matchId,
          room: ROOM_CODE
        });

        setTimeout(function(){
          const target = buildSelfRunUrl({
            matchId,
            roundId: matchId,
            seed: String(now()),
            rematch: '1'
          });

          location.href = target;
        }, 280);

        return true;
      }

      updateRematchStatus(ready.length, online.length);
      return true;
    }catch(err){
      warn('rematch failed', err);
      return false;
    }
  }

  function updateRematchStatus(ready, total){
    const el =
      document.querySelector('[data-rematch-status]') ||
      document.getElementById('rematchStatus');

    if (!el) return;

    el.textContent = 'พร้อมเล่นอีกครั้ง ' + ready + '/' + total + ' คน';
  }

  function makeMatchId(){
    const bridge = getBridge();

    if (bridge && typeof bridge.makeMatchId === 'function'){
      return bridge.makeMatchId('m');
    }

    return 'm_' + now() + '_' + Math.random().toString(16).slice(2, 8);
  }

  function buildSelfRunUrl(extra){
    const view = normalizeView(extra && extra.view ? extra.view : VIEW);
    const file =
      view === 'mobile'
        ? './goodjunk-battle-v2-run-mobile.html'
        : view === 'cardboard'
          ? './goodjunk-battle-v2-run-cardboard.html'
          : './goodjunk-battle-v2-run-pc.html';

    const out = new URL(file, location.href);

    params.forEach(function(v, k){
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('pid', PLAYER_ID);
    out.searchParams.set('name', PLAYER_NAME);
    out.searchParams.set('view', view);
    out.searchParams.set('device', view);
    out.searchParams.set('room', ROOM_CODE);
    out.searchParams.set('roomCode', ROOM_CODE);
    out.searchParams.set('mode', MODE);
    out.searchParams.set('game', GAME);
    out.searchParams.set('gameId', GAME);
    out.searchParams.set('zone', params.get('zone') || 'nutrition');
    out.searchParams.set('cat', params.get('cat') || 'nutrition');
    out.searchParams.set('entry', 'battle');
    out.searchParams.set('variant', 'battle-v2');
    out.searchParams.set('run', 'play');
    out.searchParams.set('phase', 'play');

    Object.entries(extra || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== ''){
        out.searchParams.set(k, String(v));
      }
    });

    return out.toString();
  }

  function buildLobbyUrl(){
    const out = new URL('./goodjunk-battle-v2-lobby.html', location.href);

    ['pid','name','diff','time','view','hub','zone','cat','studyId','conditionGroup','api','log'].forEach(function(k){
      const v =
        k === 'pid' ? PLAYER_ID :
        k === 'name' ? PLAYER_NAME :
        k === 'view' ? VIEW :
        params.get(k);

      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    if (ROOM_CODE){
      out.searchParams.set('room', ROOM_CODE);
      out.searchParams.set('roomCode', ROOM_CODE);
      out.searchParams.set('lastRoom', ROOM_CODE);
    }

    return out.toString();
  }

  function buildModesUrl(){
    const out = new URL('../goodjunk-launcher.html', location.href);

    ['pid','name','diff','time','view','hub','zone','cat','studyId','conditionGroup','api','log'].forEach(function(k){
      const v =
        k === 'pid' ? PLAYER_ID :
        k === 'name' ? PLAYER_NAME :
        k === 'view' ? VIEW :
        params.get(k);

      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    return out.toString();
  }

  function buildHubUrl(){
    const hub = params.get('hub');

    if (hub){
      try{
        return new URL(hub, location.href).toString();
      }catch(_){}
    }

    return new URL('../nutrition-zone.html', location.href).toString();
  }

  function bindButtons(){
    document.querySelectorAll('[data-back-lobby], #btnBackLobby, #btnResultLobby').forEach(btn => {
      if (btn.dataset.gjCoreBound === '1') return;
      btn.dataset.gjCoreBound = '1';

      btn.addEventListener('click', function(){
        location.href = buildLobbyUrl();
      });
    });

    document.querySelectorAll('[data-all-modes], #btnAllModes').forEach(btn => {
      if (btn.dataset.gjCoreBound === '1') return;
      btn.dataset.gjCoreBound = '1';

      btn.addEventListener('click', function(){
        location.href = buildModesUrl();
      });
    });

    document.querySelectorAll('[data-back-hub], #btnHub, #btnResultHub').forEach(btn => {
      if (btn.dataset.gjCoreBound === '1') return;
      btn.dataset.gjCoreBound = '1';

      btn.addEventListener('click', function(){
        location.href = buildHubUrl();
      });
    });

    document.querySelectorAll('[data-rematch-btn], #btnRematch').forEach(btn => {
      if (btn.dataset.gjCoreBound === '1') return;
      btn.dataset.gjCoreBound = '1';

      btn.addEventListener('click', function(){
        rematch();
      });
    });
  }

  function bindRuntimeEvents(){
    window.addEventListener('gj:battle-state-updated', function(ev){
      state.latestLocal = Object.assign({}, state.latestLocal, ev.detail || {});
      updateMyPlayer({
        status: state.ended ? 'finished' : 'in-game',
        phase: state.ended ? 'summary' : 'play'
      });
    });

    window.addEventListener('hha:score', function(ev){
      state.latestLocal = Object.assign({}, state.latestLocal, ev.detail || {});
      updateMyPlayer({
        lastEvent: 'score'
      });
    });

    window.addEventListener('hha:miss', function(ev){
      state.latestLocal = Object.assign({}, state.latestLocal, ev.detail || {});
      updateMyPlayer({
        lastEvent: 'miss'
      });
    });

    window.addEventListener('gj:good-collected', function(ev){
      state.latestLocal = Object.assign({}, state.latestLocal, ev.detail || {});
      updateMyPlayer({
        lastEvent: 'good'
      });
    });

    window.addEventListener('gj:junk-hit', function(ev){
      state.latestLocal = Object.assign({}, state.latestLocal, ev.detail || {});
      updateMyPlayer({
        lastEvent: 'junk'
      });
    });

    window.addEventListener('gj:battle-ended', function(ev){
      markFinished({
        endReason: ev.detail && ev.detail.reason || 'ended',
        result: ev.detail && ev.detail.result || ''
      });
    });
  }

  async function boot(){
    bindButtons();
    bindRuntimeEvents();

    if (!ROOM_CODE){
      warn('No ROOM_CODE in URL. Core will run local only.');
      return false;
    }

    const ok = await waitForBridge(6000);
    state.bridgeReady = ok;

    if (!ok){
      warn('Firebase bridge is not ready. Core will run local only.');
      return false;
    }

    state.roomRef = getRoomRef();

    if (!state.roomRef){
      warn('Room ref not ready.');
      return false;
    }

    attachRoomListener();

    await updateMyPlayer({
      status: 'in-game',
      phase: 'play',
      currentPage: 'run',
      currentUrl: location.href
    });

    startHeartbeat();
    startPeriodicSync();

    emit('gj:battle-core-ready', {
      version: VERSION,
      room: ROOM_CODE,
      playerId: PLAYER_ID,
      playerName: PLAYER_NAME,
      view: VIEW
    });

    log('ready', {
      room: ROOM_CODE,
      playerId: PLAYER_ID,
      playerName: PLAYER_NAME,
      view: VIEW
    });

    return true;
  }

  window.GJ_BATTLE_CORE = {
    version: VERSION,
    state,

    boot,
    updateRoom,
    updateMyPlayer,
    forceRealtimeSync,
    markFinished,
    rematch,

    buildSelfRunUrl,
    buildLobbyUrl,
    buildModesUrl,
    buildHubUrl,

    normalizeRoom,
    normalizePlayer,
    getOpponent: function(){
      return state.opponent || window.GJ_BATTLE_OPPONENT || null;
    },
    getRoom: function(){
      return state.room || null;
    }
  };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

  console.info('[GoodJunk Battle Core]', VERSION, 'loaded');
})();
