/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-battle-v2-core.js
   GoodJunk Battle v2 Core
   Version: v2.4.32-core-sync-result-rematch-final
   Purpose:
   - Shared Firebase sync core for PC / Mobile / Cardboard
   - Normalize player identity by pid/authUid/playerId
   - Fix opponent name/score mismatch
   - Fix result summary winner mismatch across devices
   - Support host-controlled rematch / next round
========================================================= */

(function GoodJunkBattleV2Core(){
  'use strict';

  const CORE_VERSION = 'v2.4.32-core-sync-result-rematch-final';

  const url = new URL(location.href);
  const params = url.searchParams;

  const ROOM_PATH =
    window.GJ_BATTLE_ROOM_PATH ||
    'herohealth/goodjunk/battleV2Rooms';

  const PLAYER_ID =
    params.get('pid') ||
    params.get('playerId') ||
    params.get('studentId') ||
    localStorage.getItem('GJ_BATTLE_PID') ||
    localStorage.getItem('HHA_GJ_PID') ||
    'anon';

  const PLAYER_NAME =
    params.get('name') ||
    params.get('nick') ||
    params.get('playerName') ||
    localStorage.getItem('GJ_BATTLE_NAME') ||
    localStorage.getItem('HHA_GJ_NAME') ||
    'Hero';

  const ROOM_CODE = normalizeRoomCode(
    params.get('room') ||
    params.get('roomCode') ||
    params.get('code') ||
    params.get('lastRoom') ||
    localStorage.getItem('GJ_BATTLE_LAST_ROOM') ||
    ''
  );

  const INITIAL_MATCH_ID =
    params.get('matchId') ||
    params.get('roundId') ||
    params.get('runId') ||
    '';

  const VIEW =
    normalizeView(
      params.get('view') ||
      params.get('device') ||
      detectView()
    );

  const DIFF = params.get('diff') || 'normal';
  const TIME_SEC = Number(params.get('time') || params.get('timeSec') || 90);

  const state = {
    version: CORE_VERSION,

    roomCode: ROOM_CODE,
    roomRef: null,
    room: null,

    playerId: PLAYER_ID,
    playerName: PLAYER_NAME,
    authUid: '',

    matchId: INITIAL_MATCH_ID,
    view: VIEW,

    isHost: false,
    isReady: false,
    listenerAttached: false,

    local: {
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
      bestStreak: 0,
      streak: 0,
      finished: false,
      done: false,
      result: '',
      resultCode: '',
      updatedAt: Date.now()
    },

    opponent: null,

    finalSummary: null,

    heartbeatTimer: null,
    publishTimer: null,
    lastPublishAt: 0,
    lastLocalHash: '',

    rematchWanted: false,
    rematchRound: 0
  };

  function now(){
    return Date.now();
  }

  function safeObj(v){
    return v && typeof v === 'object' ? v : {};
  }

  function safeText(v, fallback){
    v = String(v || '').trim();
    return v || fallback || '';
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

    if (s === 'mobile' || s === 'phone' || s === 'touch') return 'mobile';
    if (s === 'cardboard' || s === 'cvr' || s === 'vr') return 'cardboard';
    if (s === 'pc' || s === 'desktop' || s === 'computer') return 'pc';

    return 'pc';
  }

  function detectView(){
    const isMobile =
      (window.matchMedia && window.matchMedia('(max-width:760px)').matches) ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

    return isMobile ? 'mobile' : 'pc';
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, {
        detail: detail || {}
      }));
    }catch(_){}
  }

  function num(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function bool(v){
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  function clamp(n, min, max){
    return Math.max(min, Math.min(max, n));
  }

  function makeHash(obj){
    try{
      return JSON.stringify(obj);
    }catch(_){
      return String(Date.now());
    }
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
      return !!bridge.isReady();
    }

    return !!(
      window.GJ_BATTLE_DB_READY &&
      window.GJ_BATTLE_AUTH_READY &&
      getDb() &&
      typeof getDb().ref === 'function'
    );
  }

  async function waitForReady(timeoutMs){
    timeoutMs = Number(timeoutMs || 5200);
    const start = Date.now();

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
          }catch(_){}
        }

        const authUid =
          window.GJ_BATTLE_AUTH_UID ||
          (
            window.firebase &&
            firebase.auth &&
            firebase.auth().currentUser
              ? firebase.auth().currentUser.uid
              : ''
          );

        if (authUid){
          state.authUid = authUid;
        }

        if (isBridgeReady()){
          state.isReady = true;
          resolve(true);
          return;
        }

        if (Date.now() - start >= timeoutMs){
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
      }catch(_){}
    }

    const db = getDb();

    if (!db || typeof db.ref !== 'function'){
      return null;
    }

    return db.ref(ROOM_PATH + '/' + code);
  }

  function playerKeyCandidates(raw){
    raw = safeObj(raw);

    const keys = [
      raw.id,
      raw.uid,
      raw.pid,
      raw.playerId,
      raw.authUid,
      raw.key,
      raw.name,
      raw.displayName
    ]
      .map(v => String(v || '').trim())
      .filter(Boolean);

    return Array.from(new Set(keys));
  }

  function isMePlayer(id, raw){
    raw = safeObj(raw);

    const me = [
      state.playerId,
      state.authUid,
      PLAYER_ID,
      window.GJ_BATTLE_AUTH_UID,
      window.GJ_PLAYER_ID,
      window.MY_PLAYER_ID,
      params.get('pid'),
      params.get('playerId')
    ]
      .map(v => String(v || '').trim())
      .filter(Boolean);

    const cand = [
      id,
      raw.id,
      raw.uid,
      raw.pid,
      raw.playerId,
      raw.authUid,
      raw.key
    ]
      .map(v => String(v || '').trim())
      .filter(Boolean);

    return cand.some(c => me.includes(c));
  }

  function normalizePlayer(id, raw){
    raw = safeObj(raw);

    const name =
      raw.name ||
      raw.playerName ||
      raw.displayName ||
      raw.nick ||
      raw.nickname ||
      raw.pid ||
      raw.playerId ||
      id ||
      'Hero';

    const pid =
      raw.pid ||
      raw.playerId ||
      raw.id ||
      id ||
      name ||
      'anon';

    const score = num(
      raw.score ??
      raw.points ??
      raw.myScore ??
      raw.totalScore ??
      raw.finalScore,
      0
    );

    const good = num(
      raw.good ??
      raw.goodCount ??
      raw.goodHit ??
      raw.goodHits,
      0
    );

    const junk = num(
      raw.junk ??
      raw.junkCount ??
      raw.junkHit ??
      raw.junkHits,
      0
    );

    const miss = num(
      raw.miss ??
      raw.missCount ??
      raw.misses ??
      raw.bad ??
      raw.error,
      0
    );

    const hearts = num(
      raw.hearts ??
      raw.hp ??
      raw.lives,
      3
    );

    const finished = !!(
      raw.finished === true ||
      raw.done === true ||
      raw.status === 'finished' ||
      raw.phase === 'summary' ||
      raw.result
    );

    const status = String(raw.status || 'online').toLowerCase();

    const left = !!(
      raw.left === true ||
      raw.quit === true ||
      raw.disconnected === true ||
      status === 'left' ||
      status === 'offline'
    );

    return {
      key: id,
      id,
      uid: raw.uid || raw.authUid || '',
      authUid: raw.authUid || raw.uid || '',
      pid,
      name: String(name),
      displayName: String(name),
      view: normalizeView(raw.view || raw.device || 'pc'),
      role: raw.role || '',
      host: !!raw.host,
      status,
      left,
      score,
      points: score,
      good,
      junk,
      miss,
      hearts,
      hp: hearts,
      lives: hearts,
      power: num(raw.power ?? raw.attackPower, 0),
      attackPower: num(raw.attackPower ?? raw.power, 0),
      bestStreak: num(raw.bestStreak ?? raw.streakMax, 0),
      streak: num(raw.streak, 0),
      finished,
      done: finished,
      result: raw.result || '',
      resultCode: raw.resultCode || '',
      matchId: raw.matchId || raw.roundId || '',
      lastSeen: num(raw.lastSeen ?? raw.heartbeatAt ?? raw.updatedAt, 0),
      updatedAt: num(raw.updatedAt, 0),
      rematchReady: !!(raw.rematchReady || raw.readyRematch || raw.nextReady),
      raw
    };
  }

  function normalizeRoom(room){
    room = safeObj(room);

    const playersMap = safeObj(room.players);

    const players = Object.entries(playersMap).map(([id, raw]) => {
      return normalizePlayer(id, raw);
    });

    const code = normalizeRoomCode(
      room.code ||
      room.room ||
      room.roomCode ||
      state.roomCode ||
      ROOM_CODE
    );

    const phase = String(
      room.phase ||
      room.status ||
      room.state ||
      'lobby'
    ).toLowerCase();

    const matchId =
      room.matchId ||
      room.roundId ||
      room.runId ||
      room.activeMatchId ||
      state.matchId ||
      INITIAL_MATCH_ID ||
      '';

    const hostPid = String(room.hostPid || room.hostId || room.hostUid || '');

    const me = players.find(p => isMePlayer(p.key, p.raw)) || null;
    const opponent = players.find(p => !isMePlayer(p.key, p.raw) && !p.left) || null;

    return {
      raw: room,
      code,
      phase,
      status: phase,
      state: phase,
      matchId,
      activeMatchId: room.activeMatchId || matchId,
      roundId: room.roundId || matchId,
      runId: room.runId || matchId,
      hostPid,
      hostName: room.hostName || '',
      startedAt: num(room.startedAt, 0),
      endedAt: num(room.endedAt, 0),
      updatedAt: num(room.updatedAt, 0),
      createdAt: num(room.createdAt, 0),
      players,
      playersMap,
      me,
      opponent,
      summary: safeObj(room.summary),
      finalSummary: safeObj(room.finalSummary),
      rematch: safeObj(room.rematch)
    };
  }

  function isHost(room){
    const nr = normalizeRoom(room || state.room || {});
    const me = nr.me;

    if (me && (me.host || me.role === 'host')){
      return true;
    }

    const ids = [
      state.playerId,
      state.authUid,
      PLAYER_ID,
      window.GJ_BATTLE_AUTH_UID
    ]
      .map(v => String(v || '').trim())
      .filter(Boolean);

    if (nr.hostPid && ids.includes(String(nr.hostPid))){
      return true;
    }

    return false;
  }

  function getMyPlayer(room){
    const nr = normalizeRoom(room || state.room || {});
    return nr.me || normalizePlayer(state.playerId, makePlayerPatch({}));
  }

  function getOpponent(room){
    const nr = normalizeRoom(room || state.room || {});
    return nr.opponent || null;
  }

  function makePlayerPatch(extra){
    const local = state.local || {};

    return Object.assign({
      pid: state.playerId,
      playerId: state.playerId,
      name: state.playerName,
      playerName: state.playerName,
      displayName: state.playerName,
      view: state.view,
      device: state.view,
      authUid: state.authUid || window.GJ_BATTLE_AUTH_UID || '',
      matchId: state.matchId || INITIAL_MATCH_ID || '',
      roundId: state.matchId || INITIAL_MATCH_ID || '',
      score: num(local.score ?? local.points, 0),
      points: num(local.points ?? local.score, 0),
      good: num(local.good, 0),
      junk: num(local.junk, 0),
      miss: num(local.miss, 0),
      hearts: num(local.hearts ?? local.hp ?? local.lives, 3),
      hp: num(local.hp ?? local.hearts ?? local.lives, 3),
      lives: num(local.lives ?? local.hearts ?? local.hp, 3),
      power: num(local.power ?? local.attackPower, 0),
      attackPower: num(local.attackPower ?? local.power, 0),
      bestStreak: num(local.bestStreak, 0),
      streak: num(local.streak, 0),
      finished: !!local.finished,
      done: !!local.done,
      result: local.result || '',
      resultCode: local.resultCode || '',
      status: local.finished ? 'finished' : 'in-game',
      phase: local.finished ? 'summary' : 'play',
      currentPage: local.finished ? 'summary' : 'run',
      left: false,
      quit: false,
      disconnected: false,
      updatedAt: now(),
      lastSeen: now(),
      heartbeatAt: now(),
      coreVersion: CORE_VERSION
    }, extra || {});
  }

  async function updateMyPlayer(patch, options){
    options = options || {};

    const merged = Object.assign({}, state.local, patch || {});
    state.local = merged;

    syncWindowState();

    if (!state.roomRef){
      state.roomRef = getRoomRef(state.roomCode);
    }

    if (!state.roomRef){
      return false;
    }

    const fullPatch = makePlayerPatch(patch || {});
    const hash = makeHash(fullPatch);

    if (!options.force && hash === state.lastLocalHash && now() - state.lastPublishAt < 550){
      return true;
    }

    state.lastLocalHash = hash;
    state.lastPublishAt = now();

    try{
      await state.roomRef.child('players').child(state.playerId).update(fullPatch);
      return true;
    }catch(err){
      console.warn('[GJ Battle Core] updateMyPlayer failed', err);
      return false;
    }
  }

  async function updateRoom(patch){
    if (!state.roomRef){
      state.roomRef = getRoomRef(state.roomCode);
    }

    if (!state.roomRef){
      return false;
    }

    try{
      await state.roomRef.update(Object.assign({}, patch || {}, {
        updatedAt: now()
      }));
      return true;
    }catch(err){
      console.warn('[GJ Battle Core] updateRoom failed', err);
      return false;
    }
  }

  async function heartbeat(){
    if (!state.roomRef){
      state.roomRef = getRoomRef(state.roomCode);
    }

    if (!state.roomRef) return false;

    try{
      await state.roomRef.child('players').child(state.playerId).update({
        pid: state.playerId,
        playerId: state.playerId,
        name: state.playerName,
        playerName: state.playerName,
        displayName: state.playerName,
        view: state.view,
        device: state.view,
        authUid: state.authUid || window.GJ_BATTLE_AUTH_UID || '',
        left: false,
        quit: false,
        disconnected: false,
        status: state.local.finished ? 'finished' : 'in-game',
        phase: state.local.finished ? 'summary' : 'play',
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

  function markLeft(){
    try{
      if (!state.roomRef || !state.playerId) return;

      state.roomRef.child('players').child(state.playerId).update({
        left: true,
        quit: true,
        disconnected: true,
        status: 'left',
        updatedAt: now(),
        lastSeen: now()
      });
    }catch(_){}
  }

  function syncWindowState(){
    window.GJ_BATTLE_STATE = Object.assign({}, window.GJ_BATTLE_STATE || {}, {
      coreVersion: CORE_VERSION,
      roomCode: state.roomCode,
      matchId: state.matchId,
      playerId: state.playerId,
      playerName: state.playerName,
      name: state.playerName,
      view: state.view,

      score: num(state.local.score ?? state.local.points, 0),
      myScore: num(state.local.score ?? state.local.points, 0),
      points: num(state.local.points ?? state.local.score, 0),
      good: num(state.local.good, 0),
      junk: num(state.local.junk, 0),
      miss: num(state.local.miss, 0),
      hearts: num(state.local.hearts ?? state.local.hp ?? state.local.lives, 3),
      hp: num(state.local.hp ?? state.local.hearts ?? state.local.lives, 3),
      lives: num(state.local.lives ?? state.local.hearts ?? state.local.hp, 3),
      power: num(state.local.power ?? state.local.attackPower, 0),
      attackPower: num(state.local.attackPower ?? state.local.power, 0),
      bestStreak: num(state.local.bestStreak, 0),
      streak: num(state.local.streak, 0),
      finished: !!state.local.finished,
      done: !!state.local.done,
      result: state.local.result || '',
      resultCode: state.local.resultCode || ''
    });

    window.GJ_BATTLE_OPPONENT = state.opponent || null;
    window.GJ_CURRENT_ROOM = state.room || null;
    window.GJ_BATTLE_FINAL_SUMMARY = state.finalSummary || null;

    emit('gj:battle-state-updated', window.GJ_BATTLE_STATE);
  }

  function applyExternalLocalState(source){
    source = safeObj(source || window.GJ_BATTLE_STATE || {});

    const patch = {};

    if (source.score != null || source.myScore != null || source.points != null){
      patch.score = num(source.score ?? source.myScore ?? source.points, state.local.score);
      patch.points = patch.score;
    }

    if (source.good != null) patch.good = num(source.good, state.local.good);
    if (source.junk != null) patch.junk = num(source.junk, state.local.junk);
    if (source.miss != null) patch.miss = num(source.miss, state.local.miss);

    if (source.hearts != null || source.hp != null || source.lives != null){
      const h = num(source.hearts ?? source.hp ?? source.lives, state.local.hearts);
      patch.hearts = h;
      patch.hp = h;
      patch.lives = h;
    }

    if (source.power != null || source.attackPower != null){
      const p = num(source.power ?? source.attackPower, state.local.power);
      patch.power = p;
      patch.attackPower = p;
    }

    if (source.bestStreak != null) patch.bestStreak = num(source.bestStreak, state.local.bestStreak);
    if (source.streak != null) patch.streak = num(source.streak, state.local.streak);

    if (source.finished != null || source.done != null){
      patch.finished = bool(source.finished ?? source.done);
      patch.done = patch.finished;
    }

    if (source.result) patch.result = source.result;
    if (source.resultCode) patch.resultCode = source.resultCode;

    if (Object.keys(patch).length){
      state.local = Object.assign({}, state.local, patch, {
        updatedAt: now()
      });

      syncWindowState();
    }

    return patch;
  }

  function publishCurrentLocal(reason){
    const patch = applyExternalLocalState(window.GJ_BATTLE_STATE || {});
    return updateMyPlayer(Object.assign({}, patch, {
      syncReason: reason || 'publish-current-local'
    }), {
      force: reason === 'runtime-end' || reason === 'force'
    });
  }

  function determineWinner(room){
    const nr = normalizeRoom(room || state.room || {});
    const players = nr.players.filter(p => !p.left);

    if (!players.length){
      return {
        winner: '',
        winnerName: '',
        resultCode: 'no-player',
        reason: 'no-player',
        players: []
      };
    }

    const sorted = players.slice().sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.good !== a.good) return b.good - a.good;
      if (a.miss !== b.miss) return a.miss - b.miss;
      return String(a.name).localeCompare(String(b.name));
    });

    const top = sorted[0];
    const second = sorted[1] || null;

    let resultCode = 'winner-score';
    let reason = 'คะแนนสูงกว่า';

    if (second && top.score === second.score){
      if (top.good !== second.good){
        resultCode = 'winner-good';
        reason = 'คะแนนเท่ากัน แต่เก็บ Good มากกว่า';
      }else if (top.miss !== second.miss){
        resultCode = 'winner-miss';
        reason = 'คะแนนเท่ากัน แต่ Miss น้อยกว่า';
      }else{
        resultCode = 'draw';
        reason = 'คะแนนเท่ากัน';
      }
    }

    if (resultCode === 'draw'){
      return {
        winner: '',
        winnerName: '',
        resultCode,
        reason,
        players: sorted
      };
    }

    return {
      winner: top.pid || top.id || top.key,
      winnerKey: top.key,
      winnerName: top.name,
      resultCode,
      reason,
      players: sorted
    };
  }

  function buildSummary(room){
    const nr = normalizeRoom(room || state.room || {});
    const verdict = determineWinner(nr.raw);

    const players = verdict.players.map(p => ({
      key: p.key,
      pid: p.pid,
      name: p.name,
      displayName: p.name,
      score: p.score,
      points: p.score,
      good: p.good,
      junk: p.junk,
      miss: p.miss,
      hearts: p.hearts,
      hp: p.hp,
      lives: p.lives,
      finished: p.finished,
      result: p.result || '',
      view: p.view,
      role: p.role,
      host: p.host,
      updatedAt: p.updatedAt
    }));

    const me = players.find(p => String(p.pid) === String(state.playerId) || String(p.key) === String(state.playerId));
    const opponent = players.find(p => !(String(p.pid) === String(state.playerId) || String(p.key) === String(state.playerId)));

    return {
      roomCode: nr.code,
      matchId: nr.matchId,
      winner: verdict.winner,
      winnerKey: verdict.winnerKey || '',
      winnerName: verdict.winnerName || '',
      resultCode: verdict.resultCode,
      reason: verdict.reason,
      players,
      me: me || null,
      opponent: opponent || null,
      endedAt: now(),
      updatedAt: now(),
      coreVersion: CORE_VERSION
    };
  }

  async function publishFinalSummary(reason){
    if (!state.roomRef){
      state.roomRef = getRoomRef(state.roomCode);
    }

    if (!state.roomRef) return null;

    await publishCurrentLocal('before-summary');

    const snap = await readRoomOnce();
    const room = snap || state.room || {};
    const summary = buildSummary(room);

    state.finalSummary = summary;

    try{
      await state.roomRef.update({
        phase: 'summary',
        status: 'summary',
        state: 'summary',
        endedAt: now(),
        updatedAt: now(),
        winner: summary.winner,
        winnerName: summary.winnerName,
        resultCode: summary.resultCode,
        reason: reason || summary.reason,
        summary,
        finalSummary: summary
      });
    }catch(err){
      console.warn('[GJ Battle Core] publishFinalSummary failed', err);
    }

    syncWindowState();

    emit('gj:battle-final-summary', summary);

    return summary;
  }

  async function readRoomOnce(){
    if (!state.roomRef){
      state.roomRef = getRoomRef(state.roomCode);
    }

    if (!state.roomRef || typeof state.roomRef.once !== 'function'){
      return null;
    }

    try{
      const snap = await state.roomRef.once('value');
      return snap && typeof snap.val === 'function' ? snap.val() || {} : {};
    }catch(err){
      console.warn('[GJ Battle Core] readRoomOnce failed', err);
      return null;
    }
  }

  function applyRoom(room){
    const nr = normalizeRoom(room);
    state.room = nr.raw;
    state.matchId = nr.matchId || state.matchId;
    state.isHost = isHost(nr.raw);

    const me = nr.me;
    const opponent = nr.opponent;

    if (me){
      state.local = Object.assign({}, state.local, {
        score: me.score,
        points: me.score,
        good: me.good,
        junk: me.junk,
        miss: me.miss,
        hearts: me.hearts,
        hp: me.hp,
        lives: me.lives,
        power: me.power,
        attackPower: me.attackPower,
        bestStreak: me.bestStreak,
        streak: me.streak,
        finished: me.finished,
        done: me.finished,
        result: me.result,
        resultCode: me.resultCode,
        updatedAt: me.updatedAt || now()
      });
    }

    state.opponent = opponent ? {
      key: opponent.key,
      id: opponent.id,
      pid: opponent.pid,
      name: opponent.name,
      displayName: opponent.name,
      score: opponent.score,
      points: opponent.score,
      good: opponent.good,
      junk: opponent.junk,
      miss: opponent.miss,
      hearts: opponent.hearts,
      hp: opponent.hp,
      lives: opponent.lives,
      status: opponent.status,
      left: opponent.left,
      finished: opponent.finished,
      result: opponent.result,
      view: opponent.view,
      updatedAt: opponent.updatedAt
    } : null;

    state.finalSummary =
      safeObj(nr.finalSummary) && Object.keys(nr.finalSummary).length
        ? nr.finalSummary
        : (
          safeObj(nr.summary) && Object.keys(nr.summary).length
            ? nr.summary
            : state.finalSummary
        );

    syncWindowState();

    emit('gj:battle-room-updated', {
      room: nr.raw,
      normalized: nr,
      me: me,
      opponent: state.opponent,
      summary: state.finalSummary,
      coreVersion: CORE_VERSION
    });

    if (state.opponent){
      emit('gj:battle-opponent-updated', state.opponent);
    }

    if (nr.phase === 'summary' || nr.phase === 'ended'){
      emit('gj:battle-summary-updated', {
        room: nr.raw,
        summary: state.finalSummary,
        coreVersion: CORE_VERSION
      });
    }

    if (
      nr.rematch &&
      nr.rematch.status === 'starting' &&
      nr.rematch.matchId &&
      nr.rematch.matchId !== state.matchId
    ){
      emit('gj:battle-rematch-start', {
        roomCode: nr.code,
        matchId: nr.rematch.matchId,
        rematch: nr.rematch,
        coreVersion: CORE_VERSION
      });
    }
  }

  function attachRoomListener(){
    if (!state.roomCode){
      console.warn('[GJ Battle Core] No room code; listener skipped');
      return false;
    }

    if (!state.roomRef){
      state.roomRef = getRoomRef(state.roomCode);
    }

    if (!state.roomRef || typeof state.roomRef.on !== 'function'){
      console.warn('[GJ Battle Core] No roomRef/on; listener skipped');
      return false;
    }

    if (state.listenerAttached){
      return true;
    }

    state.listenerAttached = true;

    state.roomRef.on('value', function(snapshot){
      const room = snapshot && typeof snapshot.val === 'function'
        ? snapshot.val() || {}
        : {};

      applyRoom(room);
    });

    return true;
  }

  async function resetForRematchAsHost(){
    if (!state.roomRef){
      state.roomRef = getRoomRef(state.roomCode);
    }

    if (!state.roomRef) return false;

    const host = isHost(state.room || {});
    if (!host){
      await voteRematch();
      return false;
    }

    const nextMatchId = 'm_' + now() + '_' + Math.random().toString(16).slice(2, 8);

    try{
      const snap = await readRoomOnce();
      const nr = normalizeRoom(snap || state.room || {});
      const players = nr.players || {};

      const updates = {};

      players.forEach(p => {
        updates['players/' + p.key + '/score'] = 0;
        updates['players/' + p.key + '/points'] = 0;
        updates['players/' + p.key + '/good'] = 0;
        updates['players/' + p.key + '/junk'] = 0;
        updates['players/' + p.key + '/miss'] = 0;
        updates['players/' + p.key + '/hearts'] = 3;
        updates['players/' + p.key + '/hp'] = 3;
        updates['players/' + p.key + '/lives'] = 3;
        updates['players/' + p.key + '/power'] = 0;
        updates['players/' + p.key + '/attackPower'] = 0;
        updates['players/' + p.key + '/finished'] = false;
        updates['players/' + p.key + '/done'] = false;
        updates['players/' + p.key + '/result'] = '';
        updates['players/' + p.key + '/resultCode'] = '';
        updates['players/' + p.key + '/status'] = 'in-game';
        updates['players/' + p.key + '/phase'] = 'play';
        updates['players/' + p.key + '/matchId'] = nextMatchId;
        updates['players/' + p.key + '/roundId'] = nextMatchId;
        updates['players/' + p.key + '/rematchReady'] = false;
        updates['players/' + p.key + '/readyRematch'] = false;
        updates['players/' + p.key + '/nextReady'] = false;
        updates['players/' + p.key + '/updatedAt'] = now();
      });

      updates.phase = 'play';
      updates.status = 'play';
      updates.state = 'play';
      updates.matchId = nextMatchId;
      updates.roundId = nextMatchId;
      updates.runId = nextMatchId;
      updates.activeMatchId = nextMatchId;
      updates.startedAt = now();
      updates.endedAt = null;
      updates.winner = null;
      updates.winnerName = null;
      updates.resultCode = null;
      updates.reason = null;
      updates.summary = null;
      updates.finalSummary = null;
      updates.effects = null;
      updates.updatedAt = now();
      updates.rematch = {
        status: 'starting',
        matchId: nextMatchId,
        startedAt: now(),
        updatedAt: now(),
        hostPid: state.playerId,
        coreVersion: CORE_VERSION
      };

      await state.roomRef.update(updates);

      state.matchId = nextMatchId;
      state.local = Object.assign({}, state.local, {
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
        bestStreak: 0,
        streak: 0,
        finished: false,
        done: false,
        result: '',
        resultCode: '',
        updatedAt: now()
      });

      syncWindowState();

      emit('gj:battle-rematch-start', {
        roomCode: state.roomCode,
        matchId: nextMatchId,
        host: true,
        coreVersion: CORE_VERSION
      });

      return true;
    }catch(err){
      console.warn('[GJ Battle Core] resetForRematchAsHost failed', err);
      return false;
    }
  }

  async function voteRematch(){
    if (!state.roomRef){
      state.roomRef = getRoomRef(state.roomCode);
    }

    if (!state.roomRef) return false;

    try{
      await state.roomRef.child('rematch').child('players').child(state.playerId).update({
        pid: state.playerId,
        name: state.playerName,
        ready: true,
        updatedAt: now()
      });

      await state.roomRef.child('players').child(state.playerId).update({
        rematchReady: true,
        readyRematch: true,
        nextReady: true,
        updatedAt: now()
      });

      state.rematchWanted = true;

      emit('gj:battle-rematch-voted', {
        pid: state.playerId,
        name: state.playerName,
        coreVersion: CORE_VERSION
      });

      return true;
    }catch(err){
      console.warn('[GJ Battle Core] voteRematch failed', err);
      return false;
    }
  }

  function bindRuntimeEvents(){
    window.addEventListener('gj:good-collected', function(ev){
      const d = safeObj(ev.detail);

      const scoreAdd = num(d.score ?? d.points, 10);
      const powerAdd = num(d.power, 1);

      updateMyPlayer({
        score: num(state.local.score, 0) + scoreAdd,
        points: num(state.local.score, 0) + scoreAdd,
        good: num(state.local.good, 0) + 1,
        power: clamp(num(state.local.power, 0) + powerAdd, 0, 5),
        attackPower: clamp(num(state.local.attackPower, 0) + powerAdd, 0, 5),
        streak: num(state.local.streak, 0) + 1,
        bestStreak: Math.max(num(state.local.bestStreak, 0), num(state.local.streak, 0) + 1)
      });
    });

    window.addEventListener('gj:junk-hit', function(){
      const nextHearts = clamp(num(state.local.hearts, 3) - 1, 0, 3);

      updateMyPlayer({
        junk: num(state.local.junk, 0) + 1,
        miss: num(state.local.miss, 0) + 1,
        hearts: nextHearts,
        hp: nextHearts,
        lives: nextHearts,
        streak: 0
      });
    });

    window.addEventListener('hha:score', function(ev){
      const d = safeObj(ev.detail);
      const type = String(d.type || '').toLowerCase();

      if (type === 'good'){
        return;
      }

      const scoreAdd = num(d.score ?? d.points, 0);

      if (scoreAdd){
        updateMyPlayer({
          score: num(state.local.score, 0) + scoreAdd,
          points: num(state.local.score, 0) + scoreAdd
        });
      }
    });

    window.addEventListener('hha:miss', function(ev){
      const d = safeObj(ev.detail);
      const type = String(d.type || '').toLowerCase();

      if (type === 'junk'){
        return;
      }

      updateMyPlayer({
        miss: num(state.local.miss, 0) + 1,
        streak: 0
      });
    });

    window.addEventListener('gj:battle-ended', async function(ev){
      const d = safeObj(ev.detail);

      await updateMyPlayer({
        score: num(d.score ?? state.local.score, state.local.score),
        points: num(d.score ?? state.local.score, state.local.score),
        finished: true,
        done: true,
        result: d.result || state.local.result || 'finished',
        resultCode: d.reason || state.local.resultCode || 'ended',
        status: 'finished',
        phase: 'summary'
      }, { force:true });

      setTimeout(function(){
        if (isHost(state.room || {})){
          publishFinalSummary(d.reason || 'runtime-ended');
        }
      }, 600);
    });

    window.addEventListener('gj:battle-state-updated', function(ev){
      const d = safeObj(ev.detail);

      applyExternalLocalState(d);

      if (!state.local.finished){
        updateMyPlayer({}, { force:false });
      }
    });

    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'hidden'){
        publishCurrentLocal('visibility-hidden');
      }else{
        publishCurrentLocal('visibility-visible');
      }
    });

    window.addEventListener('beforeunload', function(){
      publishCurrentLocal('beforeunload');
      markLeft();
    });

    window.addEventListener('pagehide', function(){
      publishCurrentLocal('pagehide');
      markLeft();
    });
  }

  function bindButtons(){
    document.addEventListener('click', function(ev){
      const btn = ev.target && ev.target.closest
        ? ev.target.closest('[data-rematch-btn], .btn-rematch, #btnRematch')
        : null;

      if (btn){
        ev.preventDefault();
        ev.stopPropagation();

        if (isHost(state.room || {})){
          resetForRematchAsHost();
        }else{
          voteRematch();
        }
      }
    }, true);

    document.addEventListener('click', function(ev){
      const lobbyBtn = ev.target && ev.target.closest
        ? ev.target.closest('[data-back-lobby], #btnBackLobby, #btnResultLobby')
        : null;

      if (!lobbyBtn) return;

      ev.preventDefault();

      const out = new URL('./goodjunk-battle-v2-lobby.html', location.href);
      out.searchParams.set('pid', state.playerId);
      out.searchParams.set('name', state.playerName);
      out.searchParams.set('view', state.view);
      out.searchParams.set('diff', DIFF);
      out.searchParams.set('time', String(TIME_SEC));

      if (state.roomCode){
        out.searchParams.set('room', state.roomCode);
        out.searchParams.set('roomCode', state.roomCode);
      }

      const hub = params.get('hub');
      if (hub) out.searchParams.set('hub', hub);

      location.href = out.toString();
    }, true);

    document.addEventListener('click', function(ev){
      const modesBtn = ev.target && ev.target.closest
        ? ev.target.closest('[data-all-modes], #btnAllModes')
        : null;

      if (!modesBtn) return;

      ev.preventDefault();

      const out = new URL('../goodjunk-launcher.html', location.href);
      out.searchParams.set('pid', state.playerId);
      out.searchParams.set('name', state.playerName);
      out.searchParams.set('view', state.view);
      out.searchParams.set('diff', DIFF);
      out.searchParams.set('time', String(TIME_SEC));

      const hub = params.get('hub');
      if (hub) out.searchParams.set('hub', hub);

      location.href = out.toString();
    }, true);

    document.addEventListener('click', function(ev){
      const hubBtn = ev.target && ev.target.closest
        ? ev.target.closest('[data-back-hub], #btnHub, #btnResultHub')
        : null;

      if (!hubBtn) return;

      ev.preventDefault();

      const hub = params.get('hub');

      if (hub){
        location.href = hub;
        return;
      }

      const out = new URL('../nutrition-zone.html', location.href);
      out.searchParams.set('pid', state.playerId);
      out.searchParams.set('name', state.playerName);
      out.searchParams.set('view', state.view);
      out.searchParams.set('diff', DIFF);
      out.searchParams.set('time', String(TIME_SEC));

      location.href = out.toString();
    }, true);
  }

  async function boot(){
    localStorage.setItem('GJ_BATTLE_PID', state.playerId);
    localStorage.setItem('GJ_BATTLE_NAME', state.playerName);
    localStorage.setItem('HHA_GJ_PID', state.playerId);
    localStorage.setItem('HHA_GJ_NAME', state.playerName);

    window.GJ_PLAYER_ID = state.playerId;
    window.MY_PLAYER_ID = state.playerId;
    window.GJ_PLAYER_NAME = state.playerName;
    window.MY_PLAYER_NAME = state.playerName;
    window.GJ_ROOM_CODE = state.roomCode;
    window.ROOM_CODE = state.roomCode;
    window.GJ_MATCH_ID = state.matchId;
    window.GJ_BATTLE_PHASE = 'play';

    syncWindowState();
    bindRuntimeEvents();
    bindButtons();

    const ready = await waitForReady(5200);

    if (!ready){
      console.warn('[GJ Battle Core] Firebase not ready; running with local state only');
      emit('gj:battle-core-ready', {
        ready: false,
        localOnly: true,
        coreVersion: CORE_VERSION
      });
      return;
    }

    state.roomRef = getRoomRef(state.roomCode);

    if (!state.roomRef){
      console.warn('[GJ Battle Core] No roomRef after ready');
      emit('gj:battle-core-ready', {
        ready: false,
        noRoomRef: true,
        coreVersion: CORE_VERSION
      });
      return;
    }

    attachRoomListener();

    await updateMyPlayer({
      status: 'in-game',
      phase: 'play',
      currentPage: 'run',
      matchId: state.matchId,
      roundId: state.matchId
    }, { force:true });

    if (!state.heartbeatTimer){
      state.heartbeatTimer = setInterval(heartbeat, 3500);
    }

    if (!state.publishTimer){
      state.publishTimer = setInterval(function(){
        publishCurrentLocal('interval');
      }, 1500);
    }

    emit('gj:battle-core-ready', {
      ready: true,
      roomCode: state.roomCode,
      matchId: state.matchId,
      playerId: state.playerId,
      playerName: state.playerName,
      view: state.view,
      coreVersion: CORE_VERSION
    });

    console.info('[GoodJunk Battle Core]', CORE_VERSION, 'loaded', {
      roomCode: state.roomCode,
      playerId: state.playerId,
      playerName: state.playerName,
      view: state.view
    });
  }

  window.GJ_BATTLE_CORE = {
    version: CORE_VERSION,
    state,

    normalizeRoomCode,
    normalizeView,
    normalizePlayer,
    normalizeRoom,

    waitForReady,
    isBridgeReady,
    getDb,
    getRoomRef,

    getMyPlayer,
    getOpponent,
    isHost,

    updateMyPlayer,
    updateRoom,
    publishCurrentLocal,
    publishFinalSummary,
    buildSummary,
    determineWinner,

    voteRematch,
    resetForRematchAsHost,

    forceRealtimeSync: publishCurrentLocal,
    readRoomOnce,

    boot
  };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
