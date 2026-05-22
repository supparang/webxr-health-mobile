(function GoodJunkBattleV2Core(){
  'use strict';

  const CORE_VERSION = 'v2.4.33-core-opponent-score-rematch-skill-sync';
  const ROOM_PATH = window.GJ_BATTLE_ROOM_PATH || 'herohealth/goodjunk/battleV2Rooms';

  const url = new URL(location.href);
  const params = url.searchParams;

  const PLAYER_ID =
    params.get('pid') ||
    window.GJ_PLAYER_ID ||
    window.MY_PLAYER_ID ||
    localStorage.getItem('GJ_BATTLE_PID') ||
    'anon';

  const PLAYER_NAME =
    params.get('name') ||
    window.GJ_PLAYER_NAME ||
    window.MY_PLAYER_NAME ||
    localStorage.getItem('GJ_BATTLE_NAME') ||
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
      window.GJ_VIEW ||
      'pc'
    );

  const state = {
    version: CORE_VERSION,
    roomPath: ROOM_PATH,
    playerId: String(PLAYER_ID || 'anon'),
    playerName: String(PLAYER_NAME || 'Hero'),
    roomCode: ROOM_CODE,
    matchId: MATCH_ID,
    view: VIEW,
    roomRef: null,
    playerRef: null,
    room: null,
    opponent: null,
    attached: false,
    heartbeatTimer: null,
    syncTimer: null,
    lastSyncAt: 0,
    lastRoomUpdatedAt: 0,
    ready: false,
    ended: false,
    rematchReady: false,
    lastError: ''
  };

  window.GJ_BATTLE_CORE_VERSION = CORE_VERSION;
  window.GJ_BATTLE_CORE_STATE = state;

  function now(){
    return Date.now();
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, {
        detail: Object.assign({
          version: CORE_VERSION,
          room: state.roomCode,
          playerId: state.playerId,
          at: now()
        }, detail || {})
      }));
    }catch(_){}
  }

  function setError(err, source){
    const msg = err && err.message ? err.message : String(err || 'unknown-error');
    state.lastError = msg;

    console.warn('[GJ Battle Core]', source || 'error', err);

    emit('gj:battle-core-error', {
      source: source || 'core',
      error: msg
    });
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
    v = String(v || '').trim().toLowerCase();

    if (v === 'cvr' || v === 'vr' || v === 'cardboard-vr'){
      return 'cardboard';
    }

    if (v === 'cardboard'){
      return 'cardboard';
    }

    if (v === 'mobile' || v === 'phone' || v === 'touch'){
      return 'mobile';
    }

    return 'pc';
  }

  function safeObj(v){
    return v && typeof v === 'object' ? v : {};
  }

  function safeNum(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function getBridge(){
    return window.GJ_BATTLE_FIREBASE_BRIDGE || null;
  }

  async function waitForBridgeReady(timeoutMs){
    timeoutMs = Number(timeoutMs || 5000);
    const start = now();

    return await new Promise(resolve => {
      const tick = async () => {
        const bridge = getBridge();

        if (bridge){
          try{
            if (typeof bridge.refresh === 'function'){
              await bridge.refresh();
            }else if (typeof bridge.init === 'function'){
              await bridge.init();
            }
          }catch(_){}

          if (typeof bridge.isReady === 'function' && bridge.isReady()){
            resolve(true);
            return;
          }
        }

        if (
          window.GJ_BATTLE_DB_READY &&
          window.GJ_BATTLE_AUTH_READY &&
          window.GJ_DB &&
          typeof window.GJ_DB.ref === 'function'
        ){
          resolve(true);
          return;
        }

        if (now() - start >= timeoutMs){
          resolve(false);
          return;
        }

        setTimeout(tick, 180);
      };

      tick();
    });
  }

  function getRoomRef(){
    if (!state.roomCode){
      setError('Missing room code', 'get-room-ref-no-room');
      return null;
    }

    const bridge = getBridge();

    if (bridge && typeof bridge.getRoomRef === 'function'){
      const ref = bridge.getRoomRef(state.roomCode);
      if (ref){
        state.roomRef = ref;
        return ref;
      }
    }

    const db = window.GJ_DB || window.GJ_BATTLE_DB || null;

    if (!db || typeof db.ref !== 'function'){
      return null;
    }

    state.roomRef = db.ref(ROOM_PATH + '/' + state.roomCode);
    return state.roomRef;
  }

  function getPlayerRef(){
    const roomRef = state.roomRef || getRoomRef();

    if (!roomRef || typeof roomRef.child !== 'function'){
      return null;
    }

    state.playerRef = roomRef.child('players').child(state.playerId);
    return state.playerRef;
  }

  function readRuntimeState(){
    const rs =
      window.GJ_BATTLE_RUNTIME && window.GJ_BATTLE_RUNTIME.state
        ? window.GJ_BATTLE_RUNTIME.state
        : {};

    const bs = window.GJ_BATTLE_STATE || {};

    return {
      score: safeNum(rs.score ?? bs.score ?? bs.myScore ?? bs.points, 0),
      points: safeNum(rs.score ?? bs.score ?? bs.myScore ?? bs.points, 0),
      good: safeNum(rs.good ?? bs.good ?? bs.goodCount, 0),
      junk: safeNum(rs.junk ?? bs.junk ?? bs.junkCount, 0),
      miss: safeNum(rs.miss ?? bs.miss ?? bs.missCount, 0),
      hearts: safeNum(rs.hearts ?? bs.hearts ?? bs.hp ?? bs.lives, 3),
      hp: safeNum(rs.hearts ?? bs.hearts ?? bs.hp ?? bs.lives, 3),
      lives: safeNum(rs.hearts ?? bs.hearts ?? bs.hp ?? bs.lives, 3),
      power: safeNum(rs.power ?? bs.power ?? bs.attackPower, 0),
      attackPower: safeNum(rs.power ?? bs.power ?? bs.attackPower, 0),
      shieldActive: !!(rs.shieldActive ?? bs.shieldActive),
      freezeActive: !!(rs.freezeActive ?? bs.freezeActive),
      timeLeft: safeNum(rs.timeLeft ?? bs.timeLeft ?? bs.remaining, 0),
      remaining: safeNum(rs.timeLeft ?? bs.timeLeft ?? bs.remaining, 0),
      ended: !!(rs.ended ?? bs.ended),
      running: rs.running !== false
    };
  }

  function playerPatch(extra){
    const runtime = readRuntimeState();

    return Object.assign({
      pid: state.playerId,
      name: state.playerName,
      playerName: state.playerName,
      displayName: state.playerName,
      view: state.view,
      device: state.view,
      room: state.roomCode,
      roomCode: state.roomCode,
      matchId: state.matchId,
      roundId: state.matchId,
      status: runtime.ended ? 'finished' : 'in-game',
      phase: runtime.ended ? 'summary' : 'play',
      currentPage: runtime.ended ? 'summary' : 'run',
      currentUrl: location.href,
      left: false,
      quit: false,
      disconnected: false,
      lastSeen: now(),
      heartbeatAt: now(),
      updatedAt: now(),
      coreVersion: CORE_VERSION
    }, runtime, extra || {});
  }

  async function updateMyPlayer(patch){
    const ref = getPlayerRef();

    if (!ref || typeof ref.update !== 'function'){
      return false;
    }

    try{
      await ref.update(playerPatch(patch));
      state.lastSyncAt = now();

      return true;
    }catch(err){
      setError(err, 'update-my-player-failed');
      return false;
    }
  }

  async function updateRoom(patch){
    const ref = state.roomRef || getRoomRef();

    if (!ref || typeof ref.update !== 'function'){
      return false;
    }

    try{
      await ref.update(Object.assign({
        code: state.roomCode,
        room: state.roomCode,
        roomCode: state.roomCode,
        updatedAt: now(),
        coreVersion: CORE_VERSION
      }, patch || {}));

      return true;
    }catch(err){
      setError(err, 'update-room-failed');
      return false;
    }
  }

  async function forceRealtimeSync(reason){
    if (!state.roomCode || state.ended) return false;

    const runtime = readRuntimeState();

    if (runtime.ended){
      state.ended = true;
    }

    const ok = await updateMyPlayer({
      syncReason: reason || 'manual-sync'
    });

    emit('gj:battle-core-sync', {
      reason: reason || 'manual-sync',
      ok,
      runtime
    });

    return ok;
  }

  function normalizePlayer(id, raw){
    raw = safeObj(raw);

    const status = String(raw.status || '').toLowerCase();
    const left = !!(
      raw.left === true ||
      raw.quit === true ||
      raw.disconnected === true ||
      status === 'left' ||
      status === 'offline'
    );

    const lastSeen = safeNum(raw.lastSeen || raw.heartbeatAt || raw.updatedAt, 0);
    const online = !left && (!lastSeen || now() - lastSeen <= 16000);

    return {
      id: String(id || raw.pid || ''),
      pid: String(raw.pid || id || ''),
      name: raw.name || raw.playerName || raw.displayName || id || 'Hero',
      playerName: raw.playerName || raw.name || raw.displayName || id || 'Hero',
      displayName: raw.displayName || raw.name || raw.playerName || id || 'Hero',
      view: raw.view || raw.device || 'pc',
      score: safeNum(raw.score || raw.points, 0),
      points: safeNum(raw.points || raw.score, 0),
      good: safeNum(raw.good || raw.goodCount, 0),
      junk: safeNum(raw.junk || raw.junkCount, 0),
      miss: safeNum(raw.miss || raw.missCount, 0),
      hearts: safeNum(raw.hearts || raw.hp || raw.lives, 3),
      hp: safeNum(raw.hp || raw.hearts || raw.lives, 3),
      lives: safeNum(raw.lives || raw.hearts || raw.hp, 3),
      power: safeNum(raw.power || raw.attackPower, 0),
      attackPower: safeNum(raw.attackPower || raw.power, 0),
      status: raw.status || (online ? 'online' : 'offline'),
      phase: raw.phase || '',
      matchId: raw.matchId || raw.roundId || '',
      finished: !!(raw.finished || raw.done || raw.phase === 'summary' || raw.status === 'finished'),
      done: !!(raw.done || raw.finished),
      rematchReady: !!(raw.rematchReady || raw.readyRematch || raw.nextReady),
      readyRematch: !!(raw.readyRematch || raw.rematchReady || raw.nextReady),
      nextReady: !!(raw.nextReady || raw.rematchReady || raw.readyRematch),
      online,
      left,
      raw
    };
  }

  function normalizeRoom(room){
    room = safeObj(room);
    const playersMap = safeObj(room.players);

    const players = Object.entries(playersMap).map(([id, raw]) => normalizePlayer(id, raw));

    const me = players.find(p =>
      String(p.id) === String(state.playerId) ||
      String(p.pid) === String(state.playerId)
    ) || null;

    const opponent = players.find(p =>
      String(p.id) !== String(state.playerId) &&
      String(p.pid) !== String(state.playerId)
    ) || null;

    return {
      raw: room,
      code: normalizeRoomCode(room.code || room.room || room.roomCode || state.roomCode),
      phase: String(room.phase || room.status || room.state || 'play').toLowerCase(),
      status: String(room.status || room.phase || room.state || 'play').toLowerCase(),
      state: String(room.state || room.phase || room.status || 'play').toLowerCase(),
      matchId: String(room.matchId || room.roundId || room.runId || state.matchId || ''),
      activeMatchId: String(room.activeMatchId || room.matchId || room.roundId || ''),
      startedAt: safeNum(room.startedAt, 0),
      endedAt: safeNum(room.endedAt, 0),
      updatedAt: safeNum(room.updatedAt, 0),
      effects: safeObj(room.effects),
      players,
      playersMap,
      me,
      opponent
    };
  }

  function applyOpponent(opponent){
    if (!opponent){
      window.GJ_BATTLE_OPPONENT = null;
      state.opponent = null;

      emit('gj:battle-opponent-updated', {
        opponent: null
      });

      return;
    }

    state.opponent = opponent;

    window.GJ_BATTLE_OPPONENT = {
      id: opponent.id,
      pid: opponent.pid,
      name: opponent.name,
      playerName: opponent.playerName,
      displayName: opponent.displayName,
      view: opponent.view,
      score: opponent.score,
      points: opponent.points,
      good: opponent.good,
      junk: opponent.junk,
      miss: opponent.miss,
      hearts: opponent.hearts,
      hp: opponent.hp,
      lives: opponent.lives,
      power: opponent.power,
      attackPower: opponent.attackPower,
      status: opponent.status,
      phase: opponent.phase,
      finished: opponent.finished,
      done: opponent.done,
      online: opponent.online,
      left: opponent.left,
      rematchReady: opponent.rematchReady,
      readyRematch: opponent.readyRematch,
      nextReady: opponent.nextReady,
      raw: opponent.raw
    };

    emit('gj:battle-opponent-updated', {
      opponent: window.GJ_BATTLE_OPPONENT
    });
  }

  function applyRoom(room){
    const nr = normalizeRoom(room);

    state.room = nr;
    state.matchId = state.matchId || nr.matchId || nr.activeMatchId || '';
    state.lastRoomUpdatedAt = nr.updatedAt || now();

    window.GJ_CURRENT_ROOM = room || {};
    window.GJ_BATTLE_ROOM = nr;
    window.GJ_BATTLE_ROOM_NORMALIZED = nr;

    applyOpponent(nr.opponent);

    emit('gj:battle-room-updated', {
      room: nr,
      opponent: nr.opponent
    });

    handleRoomEffects(nr);
    handleRoomSummary(nr);
    handleRematchState(nr);
  }

  function handleRoomEffects(nr){
    const effect = nr.effects || {};
    const type = String(effect.type || '').toLowerCase();
    const from = String(effect.from || '');

    if (!type || !from || from === String(state.playerId)) return;

    const effectKey = [
      'GJ_EFFECT',
      state.roomCode,
      nr.matchId || state.matchId || 'match',
      type,
      from,
      effect.at || effect.createdAt || ''
    ].join('_');

    try{
      if (sessionStorage.getItem(effectKey) === '1') return;
      sessionStorage.setItem(effectKey, '1');
    }catch(_){}

    if (type === 'junk-storm'){
      emit('gj:battle-skill-received', {
        skill: 'junk-storm',
        from
      });

      if (typeof window.spawnJunkStorm === 'function'){
        window.spawnJunkStorm(6);
      }else if (typeof window.spawnBadItems === 'function'){
        window.spawnBadItems(6);
      }else if (window.GJ_BATTLE_RUNTIME && typeof window.GJ_BATTLE_RUNTIME.spawnTarget === 'function'){
        for (let i = 0; i < 6; i++){
          setTimeout(() => window.GJ_BATTLE_RUNTIME.spawnTarget('junk'), i * 220);
        }
      }
    }

    if (type === 'freeze'){
      emit('gj:battle-skill-received', {
        skill: 'freeze',
        from
      });

      try{
        document.documentElement.classList.add('gj-freeze-received');
        setTimeout(() => document.documentElement.classList.remove('gj-freeze-received'), 3500);
      }catch(_){}
    }
  }

  function handleRoomSummary(nr){
    const phase = String(nr.phase || nr.status || '').toLowerCase();

    if (phase !== 'summary' && phase !== 'ended' && phase !== 'finished'){
      return;
    }

    emit('gj:battle-room-summary', {
      room: nr
    });
  }

  function handleRematchState(nr){
    const players = nr.players || [];
    if (!players.length) return;

    const onlinePlayers = players.filter(p => !p.left);
    const readyPlayers = onlinePlayers.filter(p => p.rematchReady || p.readyRematch || p.nextReady);

    emit('gj:battle-rematch-status', {
      total: onlinePlayers.length,
      ready: readyPlayers.length,
      readyPlayers
    });

    const meReady = !!(nr.me && (nr.me.rematchReady || nr.me.readyRematch || nr.me.nextReady));
    const opponentReady = !!(nr.opponent && (nr.opponent.rematchReady || nr.opponent.readyRematch || nr.opponent.nextReady));

    if (meReady && opponentReady && onlinePlayers.length >= 2){
      startRematchFromRoom(nr);
    }
  }

  async function startRematchFromRoom(nr){
    const key = 'GJ_REMATCH_START_' + state.roomCode + '_' + (nr.matchId || state.matchId || 'match');

    try{
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
    }catch(_){}

    emit('gj:battle-rematch-start', {
      room: nr,
      reason: 'both-ready'
    });
  }

  async function setRematchReady(){
    state.rematchReady = true;

    await updateMyPlayer({
      rematchReady: true,
      readyRematch: true,
      nextReady: true,
      status: 'ready-rematch',
      phase: 'summary',
      updatedAt: now()
    });

    const nr = state.room;

    if (nr && nr.opponent && (nr.opponent.rematchReady || nr.opponent.readyRematch || nr.opponent.nextReady)){
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
        effects: null,
        winner: null,
        reason: null
      });

      await resetPlayerForRematch(newMatchId);

      emit('gj:battle-rematch-start', {
        matchId: newMatchId,
        reason: 'local-start'
      });
    }else{
      emit('gj:battle-rematch-ready', {
        playerId: state.playerId
      });
    }
  }

  async function resetPlayerForRematch(matchId){
    state.ended = false;
    state.rematchReady = false;
    state.matchId = matchId || state.matchId;

    await updateMyPlayer({
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
      result: null,
      finished: false,
      done: false,
      rematchReady: false,
      readyRematch: false,
      nextReady: false,
      status: 'in-game',
      phase: 'play',
      matchId: state.matchId,
      roundId: state.matchId,
      currentPage: 'run',
      currentUrl: location.href
    });
  }

  async function markLeft(){
    const ref = getPlayerRef();

    if (!ref || typeof ref.update !== 'function'){
      return false;
    }

    try{
      await ref.update({
        status: 'left',
        left: true,
        quit: true,
        disconnected: true,
        lastSeen: now(),
        heartbeatAt: now(),
        updatedAt: now(),
        coreVersion: CORE_VERSION
      });

      return true;
    }catch(_){
      return false;
    }
  }

  function attachRoomListener(){
    if (state.attached) return true;

    const ref = state.roomRef || getRoomRef();

    if (!ref || typeof ref.on !== 'function'){
      return false;
    }

    state.attached = true;

    ref.on('value', function(snapshot){
      const room = snapshot && typeof snapshot.val === 'function'
        ? snapshot.val() || {}
        : {};

      applyRoom(room);
    }, function(err){
      setError(err, 'room-listener-error');
    });

    return true;
  }

  function startHeartbeat(){
    if (state.heartbeatTimer) return;

    state.heartbeatTimer = setInterval(function(){
      forceRealtimeSync('heartbeat');
    }, 2500);

    state.syncTimer = setInterval(function(){
      const runtime = readRuntimeState();

      if (runtime.ended && !state.ended){
        state.ended = true;
        forceRealtimeSync('runtime-ended-detected');
        return;
      }

      if (!runtime.ended){
        forceRealtimeSync('periodic');
      }
    }, 900);

    window.addEventListener('beforeunload', markLeft);
    window.addEventListener('pagehide', markLeft);
  }

  function bindRuntimeEvents(){
    window.addEventListener('gj:good-collected', function(){
      forceRealtimeSync('good-collected');
    });

    window.addEventListener('gj:junk-hit', function(){
      forceRealtimeSync('junk-hit');
    });

    window.addEventListener('gj:junk-blocked', function(){
      forceRealtimeSync('junk-blocked');
    });

    window.addEventListener('hha:score', function(){
      forceRealtimeSync('hha-score');
    });

    window.addEventListener('hha:miss', function(){
      forceRealtimeSync('hha-miss');
    });

    window.addEventListener('gj:battle-ended', function(ev){
      const d = ev && ev.detail ? ev.detail : {};
      state.ended = true;

      updateMyPlayer({
        finished: true,
        done: true,
        status: 'finished',
        phase: 'summary',
        result: d.result || '',
        endReason: d.reason || '',
        endedAt: now()
      });

      updateRoom({
        phase: 'summary',
        status: 'summary',
        state: 'summary',
        endedAt: now(),
        reason: d.reason || 'battle-ended'
      });
    });

    window.addEventListener('gj:battle-skill', function(ev){
      const d = ev && ev.detail ? ev.detail : {};
      const skill = String(d.skill || d.type || '').toLowerCase();

      if (!skill) return;

      if (skill === 'junk-storm' || skill === 'freeze'){
        updateRoom({
          effects: {
            type: skill,
            from: state.playerId,
            name: state.playerName,
            at: now()
          }
        });
      }

      forceRealtimeSync('skill-' + skill);
    });
  }

  function bindRematchButtons(){
    const buttons = Array.from(document.querySelectorAll('[data-rematch-btn], .btn-rematch, #btnRematch'));

    buttons.forEach(function(btn){
      if (btn.dataset.gjRematchBound === '1') return;

      btn.dataset.gjRematchBound = '1';

      btn.addEventListener('click', async function(ev){
        ev.preventDefault();
        ev.stopPropagation();

        btn.disabled = true;
        const old = btn.textContent;
        btn.textContent = '⏳ รอคู่แข่ง...';

        try{
          await setRematchReady();
        }catch(err){
          setError(err, 'rematch-click-failed');
          btn.disabled = false;
          btn.textContent = old || '🔁 Battle อีกครั้ง';
        }
      });
    });
  }

  function updateRematchStatusText(detail){
    const el = document.querySelector('[data-rematch-status], #rematchStatus');
    if (!el) return;

    const total = safeNum(detail && detail.total, 0);
    const ready = safeNum(detail && detail.ready, 0);

    if (total >= 2){
      el.textContent = 'พร้อมเล่นต่อ ' + ready + '/' + total + ' คน';
    }else{
      el.textContent = 'กด Battle อีกครั้ง เมื่อต้องการเล่นต่อ';
    }
  }

  async function init(){
    if (!state.roomCode){
      setError('No room code. Core will run local only.', 'init-no-room');
      return false;
    }

    const ok = await waitForBridgeReady(5500);

    if (!ok){
      setError('Firebase bridge/db/auth not ready. Core will retry.', 'bridge-not-ready');
    }

    const ref = getRoomRef();

    if (!ref){
      setError('Cannot get room ref', 'init-no-room-ref');
      return false;
    }

    getPlayerRef();

    await updateMyPlayer({
      joinedRunAt: now(),
      status: 'in-game',
      phase: 'play',
      currentPage: 'run',
      currentUrl: location.href,
      matchId: state.matchId,
      roundId: state.matchId
    });

    await updateRoom({
      code: state.roomCode,
      room: state.roomCode,
      roomCode: state.roomCode,
      phase: 'play',
      status: 'play',
      state: 'play',
      matchId: state.matchId || undefined,
      roundId: state.matchId || undefined
    });

    attachRoomListener();
    startHeartbeat();
    bindRuntimeEvents();
    bindRematchButtons();

    window.addEventListener('gj:battle-rematch-status', function(ev){
      updateRematchStatusText(ev && ev.detail ? ev.detail : {});
    });

    state.ready = true;

    emit('gj:battle-core-ready', {
      roomCode: state.roomCode,
      matchId: state.matchId,
      view: state.view
    });

    console.info('[GoodJunk Battle Core]', CORE_VERSION, 'ready', {
      roomCode: state.roomCode,
      playerId: state.playerId,
      view: state.view
    });

    return true;
  }

  window.GJ_BATTLE_CORE = {
    version: CORE_VERSION,
    state,
    init,
    readRuntimeState,
    forceRealtimeSync,
    updateMyPlayer,
    updateRoom,
    applyRoom,
    getOpponentSnapshot: function(){
      return state.opponent || window.GJ_BATTLE_OPPONENT || null;
    },
    setRematchReady,
    resetPlayerForRematch,
    markLeft,
    normalizeRoom,
    normalizePlayer,
    getRoomRef,
    getPlayerRef
  };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      init();
    }, { once:true });
  }else{
    init();
  }

  window.addEventListener('gj:battle-firebase-ready', function(){
    if (!state.ready){
      init();
    }
  });

  console.info('[GoodJunk Battle Core]', CORE_VERSION, 'loaded');
})();
