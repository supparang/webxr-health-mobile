'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-race.js
 * GoodJunk Race Controller
 * PATCH v20260403-race-controller-debug-full
 * ========================================================= */
(function(){
  const W = window;
  if (W.__GJ_RACE_CONTROLLER_INSTALLED__) return;
  W.__GJ_RACE_CONTROLLER_INSTALLED__ = true;

  const ctx = W.__GJ_RUN_CTX__ || W.__GJ_MULTI_RUN_CTX__ || {};
  const GAME = 'goodjunk';
  const MODE = 'race';
  const roomId = String(ctx.roomId || ctx.room || '').trim();
  const preferredRoomKind = String(ctx.roomKind || '').trim();
  const FIREBASE_WAIT_MS = 12000;
  const HEARTBEAT_MS = 2500;
  const SCORE_SYNC_MS = 700;

  const state = {
    uid: '',
    db: null,
    rootKind: preferredRoomKind || '',
    refs: null,

    meta: {},
    roomState: {},
    match: {},
    players: {},
    results: {},

    participantIds: [],
    runStarted: false,
    resultSubmitted: false,
    finalSummarySent: false,
    latestBaseSummary: null,

    heartbeatTimer: 0,
    scoreSyncTimer: 0,
    countdownTimer: 0,
    offFns: [],

    debug: {
      roomKind: '',
      participantIds: [],
      resultCount: 0,
      finalCount: 0,
      stateStatus: 'waiting',
      matchStatus: 'idle',
      lastEmitAt: 0,
      lastCloseAt: 0,
      lastSubmitAt: 0
    }
  };

  function now(){ return Date.now(); }
  function num(v, d=0){ v = Number(v); return Number.isFinite(v) ? v : d; }
  function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

  function buildControllerDebug() {
    const resultKeys = Object.keys(state.results || {});
    const finalCount = resultKeys.filter((id) => {
      const r = state.results && state.results[id];
      return !!(r && r.final);
    }).length;

    state.debug.roomKind = state.rootKind || '';
    state.debug.participantIds = (state.participantIds || []).slice();
    state.debug.resultCount = resultKeys.length;
    state.debug.finalCount = finalCount;
    state.debug.stateStatus = String((state.roomState && state.roomState.status) || 'waiting');
    state.debug.matchStatus = String((state.match && state.match.status) || 'idle');

    return {
      roomId,
      roomKind: state.debug.roomKind,
      participantIds: state.debug.participantIds.slice(),
      resultCount: state.debug.resultCount,
      finalCount: state.debug.finalCount,
      stateStatus: state.debug.stateStatus,
      matchStatus: state.debug.matchStatus,
      runStarted: !!state.runStarted,
      resultSubmitted: !!state.resultSubmitted,
      finalSummarySent: !!state.finalSummarySent,
      lastEmitAt: state.debug.lastEmitAt || 0,
      lastCloseAt: state.debug.lastCloseAt || 0,
      lastSubmitAt: state.debug.lastSubmitAt || 0
    };
  }

  function emitControllerDebug(tag, extra = {}) {
    const payload = Object.assign({
      tag,
      at: now()
    }, buildControllerDebug(), extra || {});

    try {
      window.__GJ_RACE_CONTROLLER_DEBUG__ = payload;
    } catch (_) {}

    try {
      W.dispatchEvent(new CustomEvent('gj:race-debug', { detail: payload }));
    } catch (_) {}

    console.log('[race-controller:debug]', payload);
  }

  function safeDispatch(name, detail){
    try { W.dispatchEvent(new CustomEvent(name, { detail })); } catch(_) {}
  }

  function getSafe(){
    return W.GJRaceSafe || W.RaceSafe || null;
  }

  function safeShowLoading(msg){
    const s = getSafe();
    if (s && typeof s.showLoading === 'function') s.showLoading(msg);
  }
  function safeShowWarn(msg){
    const s = getSafe();
    if (s && typeof s.showWarn === 'function') s.showWarn(msg);
  }
  function safeShowError(msg){
    const s = getSafe();
    if (s && typeof s.showError === 'function') s.showError(msg);
  }
  function safeClearMessage(){
    const s = getSafe();
    if (s && typeof s.clearMessage === 'function') s.clearMessage();
  }
  function safeSyncBridge(){
    const s = getSafe();
    if (!s) return;
    try {
      if (typeof s.syncRoom === 'function') {
        s.syncRoom({
          meta: state.meta,
          state: state.roomState,
          match: state.match,
          players: state.players,
          results: state.results
        });
      }
    } catch(_) {}
  }

  async function waitForFirebaseReady(timeoutMs = FIREBASE_WAIT_MS){
    if (W.HHA_FIREBASE_READY && W.HHA_FIREBASE_DB) return true;

    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('firebase not ready')), timeoutMs);
      W.addEventListener('hha:firebase_ready', (ev) => {
        clearTimeout(timer);
        if (ev && ev.detail && ev.detail.ok) resolve(true);
        else reject(new Error((ev && ev.detail && ev.detail.error) || 'firebase not ready'));
      }, { once:true });
    });
  }

  async function ensureAuth(){
    await waitForFirebaseReady();

    if (typeof W.HHA_ensureAnonymousAuth === 'function') {
      const u = await W.HHA_ensureAnonymousAuth();
      if (u && u.uid) {
        state.uid = u.uid;
        return u;
      }
    }

    if (!W.firebase || !W.firebase.auth) {
      throw new Error('firebase auth sdk not loaded');
    }

    const auth = W.firebase.auth();
    if (auth.currentUser && auth.currentUser.uid) {
      state.uid = auth.currentUser.uid;
      return auth.currentUser;
    }

    await auth.signInAnonymously();

    const user = await new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error('anonymous auth timeout'));
      }, 12000);

      const off = auth.onAuthStateChanged((u) => {
        if (done) return;
        if (u && u.uid) {
          done = true;
          clearTimeout(timer);
          try { off(); } catch(_) {}
          resolve(u);
        }
      }, (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { off(); } catch(_) {}
        reject(err || new Error('auth state failed'));
      });
    });

    state.uid = user.uid;
    return user;
  }

  function getDb(){
    if (state.db) return state.db;
    if (W.HHA_FIREBASE_DB) {
      state.db = W.HHA_FIREBASE_DB;
      return state.db;
    }
    if (typeof W.HHA_ENSURE_FIREBASE_DB === 'function') {
      state.db = W.HHA_ENSURE_FIREBASE_DB();
      return state.db;
    }
    if (W.firebase && W.firebase.database) {
      state.db = W.firebase.database();
      return state.db;
    }
    throw new Error('firebase db not ready');
  }

  function roomRootPath(kind) {
    return `hha-battle/${GAME}/${kind}/${roomId}`;
  }

  async function resolveRootKind(){
    const db = getDb();

    if (state.rootKind) {
      try {
        const snap = await db.ref(roomRootPath(state.rootKind)).child('meta').once('value');
        if (snap.exists()) {
          return state.rootKind;
        }
      } catch (_) {}
    }

    const candidates = ['raceRooms', 'rooms'];

    for (const kind of candidates) {
      try {
        const snap = await db.ref(roomRootPath(kind)).child('meta').once('value');
        if (snap.exists()) {
          state.rootKind = kind;
          return kind;
        }
      } catch(_) {}
    }

    state.rootKind = preferredRoomKind || 'raceRooms';
    return state.rootKind;
  }

  function attachRefs(){
    const db = getDb();
    const root = db.ref(roomRootPath(state.rootKind));
    state.refs = {
      root,
      meta: root.child('meta'),
      state: root.child('state'),
      match: root.child('match'),
      players: root.child('players'),
      results: root.child('results'),
      myPlayer: root.child(`players/${state.uid}`),
      myResult: root.child(`results/${state.uid}`)
    };
    emitControllerDebug('attach-refs');
  }

  function getMetricsFromCore(){
    const score = num(typeof W.__GJ_GET_SCORE__ === 'function' ? W.__GJ_GET_SCORE__() : 0, 0);
    const shots = num(typeof W.__GJ_GET_SHOTS__ === 'function' ? W.__GJ_GET_SHOTS__() : 0, 0);
    const hits = num(typeof W.__GJ_GET_HITS__ === 'function' ? W.__GJ_GET_HITS__() : 0, 0);
    const miss = num(typeof W.__GJ_GET_MISS__ === 'function' ? W.__GJ_GET_MISS__() : 0, 0);
    const goodHit = num(typeof W.__GJ_GET_HITS_GOOD__ === 'function' ? W.__GJ_GET_HITS_GOOD__() : hits, hits);
    const junkHit = num(typeof W.__GJ_GET_HITS_JUNK__ === 'function' ? W.__GJ_GET_HITS_JUNK__() : Math.max(0, shots - hits - miss), 0);
    const goodMiss = num(typeof W.__GJ_GET_GOOD_MISS__ === 'function' ? W.__GJ_GET_GOOD_MISS__() : 0, 0);
    const bestStreak = num(typeof W.__GJ_GET_BEST_STREAK__ === 'function' ? W.__GJ_GET_BEST_STREAK__() : 0, 0);
    const finishMs = num(typeof W.__GJ_GET_FINISH_MS__ === 'function' ? W.__GJ_GET_FINISH_MS__() : 0, 0);
    const duration = finishMs > 0 ? Math.round(finishMs / 1000) : Math.max(0, num(ctx.time, 90));

    return {
      score,
      shots,
      hits,
      miss,
      goodHit,
      junkHit,
      goodMiss,
      bestStreak,
      duration
    };
  }

  function getParticipantIds(){
    const fromState = Array.isArray(state.roomState && state.roomState.participantIds)
      ? state.roomState.participantIds : [];
    const fromMatch = Array.isArray(state.match && state.match.participantIds)
      ? state.match.participantIds : [];
    return (fromState.length ? fromState : fromMatch).map(x => String(x || '')).filter(Boolean);
  }

  function amIParticipant(){
    const ids = state.participantIds.length ? state.participantIds : getParticipantIds();
    if (!ids.length) return true;
    return ids.includes(state.uid);
  }

  function startCoreNow(){
    if (state.runStarted) return;
    if (!amIParticipant()) {
      safeShowWarn('รอบนี้คุณไม่ได้อยู่ใน participant ของห้องนี้');
      emitControllerDebug('not-participant');
      return;
    }

    state.runStarted = true;
    clearInterval(state.countdownTimer);
    state.countdownTimer = 0;

    try {
      if (typeof W.__GJ_SET_PAUSED__ === 'function') W.__GJ_SET_PAUSED__(false);
    } catch(_) {}

    try {
      if (typeof W.__GJ_START_NOW__ === 'function') {
        W.__GJ_START_NOW__();
      } else if (typeof W.__GJ_BOOT__ === 'function') {
        W.__GJ_BOOT__();
      }
    } catch (err) {
      console.error('[race-controller] start core failed', err);
    }

    try {
      state.refs.myPlayer.update({
        connected: true,
        ready: true,
        phase: 'run',
        updatedAt: now(),
        lastSeen: now()
      });
    } catch(_) {}

    emitControllerDebug('start-core');
    safeClearMessage();
  }

  function startCountdownLoop(targetAt){
    clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(() => {
      const leftMs = num(targetAt, 0) - now();
      const sec = Math.max(0, Math.ceil(leftMs / 1000));

      safeShowLoading(sec > 0 ? `เริ่มแข่งใน ${sec}` : 'GO!');

      if (leftMs <= 0) {
        clearInterval(state.countdownTimer);
        state.countdownTimer = 0;
        startCoreNow();
      }
    }, 100);
  }

  function handleRoomState(){
    state.participantIds = getParticipantIds();
    emitControllerDebug('room-state');
    safeSyncBridge();

    const status = String((state.roomState && state.roomState.status) || '');
    const targetAt = num(state.roomState.startAt || state.roomState.countdownEndsAt || ctx.startAt, 0);

    if (!state.runStarted) {
      try {
        if (typeof W.__GJ_SET_PAUSED__ === 'function') W.__GJ_SET_PAUSED__(true);
      } catch(_) {}
    }

    if (status === 'waiting') {
      if (!state.runStarted) safeShowLoading('กำลังรอ host เริ่มเกม');
      return;
    }

    if (status === 'countdown') {
      if (!amIParticipant()) {
        safeShowWarn('รอบนี้ไม่ได้อยู่ใน participant');
        return;
      }
      if (targetAt > 0) startCountdownLoop(targetAt);
      else safeShowLoading('กำลังเตรียมเริ่มเกม');
      return;
    }

    if (status === 'running' || status === 'playing') {
      if (!amIParticipant()) {
        safeShowWarn('รอบนี้ไม่ได้อยู่ใน participant');
        return;
      }
      if (targetAt > now()) startCountdownLoop(targetAt);
      else startCoreNow();
      return;
    }

    if (status === 'ended' && state.latestBaseSummary && !state.finalSummarySent) {
      maybeEmitFinalSummary(true);
    }
  }

  function subscribeRoom(){
    const onMeta = (snap) => {
      state.meta = snap.val() || {};
      if (state.meta && state.meta.roomKind && !state.rootKind) {
        state.rootKind = String(state.meta.roomKind || '').trim();
      }
      emitControllerDebug('meta-update');
      safeSyncBridge();
    };

    const onState = (snap) => {
      state.roomState = snap.val() || {};
      handleRoomState();
    };

    const onMatch = (snap) => {
      state.match = snap.val() || {};
      emitControllerDebug('match-update');
      handleRoomState();
    };

    const onPlayers = (snap) => {
      state.players = snap.val() || {};
      emitControllerDebug('players-update');
      safeSyncBridge();
    };

    const onResults = async (snap) => {
      state.results = snap.val() || {};
      emitControllerDebug('results-update');
      safeSyncBridge();

      if (ctx.host === '1' || ctx.host === 1 || ctx.role === 'host') {
        await maybeCloseRace();
      }

      if (state.latestBaseSummary) {
        maybeEmitFinalSummary(false);
      }
    };

    const onError = (err) => {
      console.error('[race-controller] subscribe failed', err);
      safeShowError(`เชื่อมห้องไม่สำเร็จ: ${err && err.message ? err.message : err}`);
    };

    state.refs.meta.on('value', onMeta, onError);
    state.refs.state.on('value', onState, onError);
    state.refs.match.on('value', onMatch, onError);
    state.refs.players.on('value', onPlayers, onError);
    state.refs.results.on('value', onResults, onError);

    state.offFns.push(() => state.refs.meta.off('value', onMeta));
    state.offFns.push(() => state.refs.state.off('value', onState));
    state.offFns.push(() => state.refs.match.off('value', onMatch));
    state.offFns.push(() => state.refs.players.off('value', onPlayers));
    state.offFns.push(() => state.refs.results.off('value', onResults));
  }

  async function joinPresence(){
    await state.refs.myPlayer.update({
      pid: state.uid,
      nick: String(ctx.name || ctx.nick || 'Player'),
      connected: true,
      ready: true,
      joinedAt: now(),
      updatedAt: now(),
      lastSeen: now(),
      phase: 'lobby',
      score: 0,
      contribution: 0
    });

    try {
      state.refs.myPlayer.onDisconnect().remove();
    } catch(_) {}

    emitControllerDebug('join-presence');
  }

  function startHeartbeat(){
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = setInterval(() => {
      state.refs.myPlayer.update({
        nick: String(ctx.name || ctx.nick || 'Player'),
        connected: true,
        updatedAt: now(),
        lastSeen: now(),
        phase: state.resultSubmitted ? 'done' : (state.runStarted ? 'run' : 'lobby')
      }).catch(()=>{});
    }, HEARTBEAT_MS);
  }

  function startScoreSync(){
    clearInterval(state.scoreSyncTimer);
    state.scoreSyncTimer = setInterval(() => {
      const metrics = getMetricsFromCore();
      state.refs.myPlayer.update({
        connected: true,
        score: metrics.score,
        contribution: metrics.score,
        miss: metrics.miss,
        streak: metrics.bestStreak,
        updatedAt: now(),
        lastSeen: now(),
        phase: state.resultSubmitted ? 'done' : (state.runStarted ? 'run' : 'lobby')
      }).catch(()=>{});
    }, SCORE_SYNC_MS);
  }

  function stopTimers(){
    clearInterval(state.heartbeatTimer);
    clearInterval(state.scoreSyncTimer);
    clearInterval(state.countdownTimer);
    state.heartbeatTimer = 0;
    state.scoreSyncTimer = 0;
    state.countdownTimer = 0;
  }

  async function submitResultFromSummary(detail){
    if (state.resultSubmitted) return;

    const base = Object.assign({}, detail || {});
    const metrics = getMetricsFromCore();

    const payload = {
      pid: state.uid,
      nick: String(ctx.name || ctx.nick || 'Player'),
      roomId,
      reason: String(base.reason || base.finishReason || 'finish'),
      score: num(base.score, metrics.score),
      shots: num(base.shots, metrics.shots),
      hits: num(base.hits, metrics.hits),
      miss: num(base.miss, metrics.miss),
      goodHit: num(base.goodHit, metrics.goodHit),
      junkHit: num(base.junkHit, metrics.junkHit),
      bestStreak: num(base.bestStreak, metrics.bestStreak),
      duration: num(base.duration, metrics.duration),
      at: now(),
      final: true
    };

    state.resultSubmitted = true;
    state.latestBaseSummary = Object.assign({}, base, payload);
    state.debug.lastSubmitAt = now();
    emitControllerDebug('submit-result', {
      submittedScore: payload.score,
      submittedMiss: payload.miss
    });

    try {
      await state.refs.myResult.set(payload);
    } catch (err) {
      console.error('[race-controller] write result failed', err);
    }

    try {
      await state.refs.myPlayer.update({
        connected: true,
        phase: 'done',
        score: payload.score,
        contribution: payload.score,
        miss: payload.miss,
        streak: payload.bestStreak,
        updatedAt: now(),
        lastSeen: now()
      });
    } catch(_) {}

    safeShowLoading('ส่งผลของคุณแล้ว กำลังรออีกคน');
    maybeEmitFinalSummary(false);
  }

  function buildRankedRows(){
    const ids = state.participantIds.length
      ? state.participantIds.slice()
      : Object.keys(state.results || {});

    const rows = ids.map((id) => {
      const r = state.results && state.results[id] ? state.results[id] : null;
      const p = state.players && state.players[id] ? state.players[id] : null;

      return {
        pid: id,
        nick: (r && r.nick) || (p && p.nick) || 'player',
        score: num(r && r.score, num(p && (p.finalScore ?? p.score), 0)),
        miss: num(r && r.miss, num(p && p.miss, 0)),
        duration: num(r && r.duration, 999999),
        goodHit: num(r && r.goodHit, 0),
        junkHit: num(r && r.junkHit, 0),
        bestStreak: num(r && r.bestStreak, 0),
        final: !!(r && r.final)
      };
    }).filter(Boolean);

    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.duration !== b.duration) return a.duration - b.duration;
      return a.miss - b.miss;
    });

    return rows;
  }

  function maybeEmitFinalSummary(force){
    if (!state.latestBaseSummary) return;

    const rows = buildRankedRows();
    if (!rows.length) return;

    const expected = state.participantIds.length || rows.length;
    const finals = rows.filter(r => r.final).length;
    const roomEnded = String((state.roomState && state.roomState.status) || '') === 'ended';

    if (!force && !roomEnded && finals < expected) {
      emitControllerDebug('emit-blocked', {
        expectedParticipants: expected,
        finalsReady: finals
      });
      return;
    }

    const myIndex = rows.findIndex(r => r.pid === state.uid);
    const rank = myIndex >= 0 ? myIndex + 1 : rows.length;
    const me = myIndex >= 0 ? rows[myIndex] : rows[0];
    const opponent = rows.find(r => r.pid !== state.uid) || null;

    const finalSummary = Object.assign({}, state.latestBaseSummary, {
      rank,
      place: rank,
      players: rows.length,
      result: rank === 1 ? 'ชนะรอบนี้' : `อันดับ ${rank}`,
      score: num(me && me.score, state.latestBaseSummary.score),
      miss: num(me && me.miss, state.latestBaseSummary.miss),
      goodHit: num(me && me.goodHit, state.latestBaseSummary.goodHit),
      junkHit: num(me && me.junkHit, state.latestBaseSummary.junkHit),
      bestStreak: num(me && me.bestStreak, state.latestBaseSummary.bestStreak),
      controllerFinal: true,
      standings: rows,
      compare: {
        me: me || null,
        opponent: opponent || null,
        deltaScore: opponent ? num((me && me.score), 0) - num(opponent.score, 0) : 0
      },
      controllerDebug: buildControllerDebug()
    });

    state.finalSummarySent = true;

    state.debug.lastEmitAt = now();
    emitControllerDebug('emit-final-summary', {
      force: !!force,
      rank,
      players: rows.length
    });

    safeDispatch('gj:race-summary', finalSummary);
    safeDispatch('gj:summary', finalSummary);
    safeDispatch('hha:summary', finalSummary);

    try {
      const s = getSafe();
      if (s && typeof s.setSummary === 'function') {
        s.setSummary(finalSummary);
      }
    } catch(_) {}

    safeClearMessage();
  }

  async function maybeCloseRace(){
    const ids = state.participantIds.length ? state.participantIds.slice() : [];
    if (!ids.length) return;

    const finals = ids.filter((id) => {
      const r = state.results && state.results[id];
      return !!(r && r.final);
    });

    emitControllerDebug('close-check', {
      expectedParticipants: ids.length,
      finalsReady: finals.length
    });

    if (finals.length >= ids.length) {
      try {
        await state.refs.state.update({
          status: 'ended',
          updatedAt: now()
        });
      } catch(_) {}

      try {
        await state.refs.match.update({
          status: 'finished'
        });
      } catch(_) {}

      state.debug.lastCloseAt = now();
      emitControllerDebug('close-race', {
        expectedParticipants: ids.length,
        finalsReady: finals.length
      });
    }
  }

  function handleSummaryEvent(evt){
    const detail = evt && evt.detail ? evt.detail : null;
    if (!detail || typeof detail !== 'object') return;
    if (detail.controllerFinal) return;
    if (detail.mode && String(detail.mode) !== MODE) return;
    submitResultFromSummary(detail);
  }

  function bindSummaryEvents(){
    ['gj:race-summary', 'gj:summary', 'hha:summary'].forEach((name) => {
      W.addEventListener(name, handleSummaryEvent);
      state.offFns.push(() => W.removeEventListener(name, handleSummaryEvent));
    });
  }

  async function boot(){
    if (!roomId) {
      safeShowError('ไม่พบ roomId ของ race');
      return;
    }

    try {
      safeShowLoading('กำลังเชื่อมห้อง Race…');

      await ensureAuth();
      await resolveRootKind();
      console.log('[race-controller] using roomKind =', state.rootKind || '(empty)');
      attachRefs();
      bindSummaryEvents();

      await joinPresence();
      subscribeRoom();
      startHeartbeat();
      startScoreSync();

      if (!ctx.wait && !ctx.startAt) {
        safeShowLoading('กำลังเริ่มเกม…');
        await wait(250);
        startCoreNow();
      } else {
        handleRoomState();
      }
    } catch (err) {
      console.error('[race-controller] boot failed', err);
      safeShowError(`เริ่ม race controller ไม่สำเร็จ: ${err && err.message ? err.message : err}`);
    }
  }

  W.addEventListener('pagehide', () => {
    stopTimers();
    while (state.offFns.length) {
      const fn = state.offFns.pop();
      try { fn(); } catch(_) {}
    }
  });

  boot();
})();