'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-coop-run.js
 * GoodJunk Coop Run Controller
 * FULL PATCH v20260331-coop-run-full
 * ========================================================= */
(function(){
  const W = window;

  const ctx = W.__GJ_RUN_CTX__ || {};
  const UI = W.__GJ_COOP_UI__ || {
    setStatus(){},
    setStateChip(){},
    setTeamCount(){},
    setDebug(){},
    showSummary(){}
  };

  const ROOM_PATH = `hha-battle/goodjunk/coopRooms/${ctx.roomId}`;
  const RESULT_PATH = `${ROOM_PATH}/results`;
  const FIREBASE_WAIT_MS = 12000;

  const S = {
    uid: '',
    db: null,
    refs: null,
    meta: {},
    state: {},
    players: {},
    results: {},
    started: false,
    submitted: false,
    heartbeat: 0,
    watchers: [],
    countdownTick: 0
  };

  const num = (v, d=0) => {
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  };

  function debugLines(extra){
    const lines = [
      `[MODE] coop`,
      `[PID] ${S.uid || ctx.pid || '-'}`,
      `[ROOM] ${ctx.roomId || '-'}`,
      `[ROLE] ${ctx.role || '-'}`,
      `[START_AT] ${ctx.startAt || 0}`,
      `[STATE] ${String((S.state && S.state.status) || '-')}`,
      `[PLAYERS] ${Object.keys(S.players || {}).length}`,
      `[RESULTS] ${Object.keys(S.results || {}).length}`
    ];
    if (extra) lines.push('', String(extra));
    UI.setDebug(lines.join('\n'));
  }

  function wait(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
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

    if (typeof W.HHA_ensureAnonymousAuth !== 'function') {
      throw new Error('HHA_ensureAnonymousAuth not found');
    }
    if (typeof W.HHA_ENSURE_FIREBASE_DB !== 'function' && !W.HHA_FIREBASE_DB) {
      throw new Error('firebase db helper not found');
    }

    const user = await W.HHA_ensureAnonymousAuth();
    if (!user || !user.uid) throw new Error('anonymous auth failed');

    S.uid = user.uid;
    S.db = W.HHA_FIREBASE_DB || W.HHA_ENSURE_FIREBASE_DB();

    S.refs = {
      root: S.db.ref(ROOM_PATH),
      meta: S.db.ref(`${ROOM_PATH}/meta`),
      state: S.db.ref(`${ROOM_PATH}/state`),
      players: S.db.ref(`${ROOM_PATH}/players`),
      results: S.db.ref(`${ROOM_PATH}/results`),
      myPlayer: S.db.ref(`${ROOM_PATH}/players/${S.uid}`),
      myResult: S.db.ref(`${ROOM_PATH}/results/${S.uid}`)
    };
  }

  function coreReady(){
    return (
      typeof W.__GJ_SET_PAUSED__ === 'function' ||
      typeof W.__GJ_START_NOW__ === 'function' ||
      typeof W.__GJ_GET_SCORE__ === 'function'
    );
  }

  async function waitForCore(timeoutMs = 8000){
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (coreReady()) return true;
      await wait(80);
    }
    return false;
  }

  function pauseCore(v){
    try {
      if (typeof W.__GJ_SET_PAUSED__ === 'function') W.__GJ_SET_PAUSED__(!!v);
    } catch(_) {}
  }

  function startCoreNow(){
    try {
      if (typeof W.__GJ_START_NOW__ === 'function') W.__GJ_START_NOW__();
    } catch(_) {}
    pauseCore(false);
    S.started = true;
    UI.setStatus('เริ่มแล้ว!', 'กำลังเล่นรอบ coop ของทีม');
    UI.setStateChip('running');
    debugLines('core started');
  }

  function readMetrics(){
    const score = num(W.__GJ_GET_SCORE__?.() ?? 0);
    const shots = num(W.__GJ_GET_SHOTS__?.() ?? 0);
    const hits = num(W.__GJ_GET_HITS__?.() ?? 0);
    const miss = num(W.__GJ_GET_MISS__?.() ?? 0);
    const finishMs = num(W.__GJ_GET_FINISH_MS__?.() ?? 0);
    const goodHit = hits;
    const junkHit = Math.max(0, shots - hits - miss);
    const bestStreak = num(W.__GJ_GET_BEST_STREAK__?.() ?? 0);
    const duration = finishMs > 0 ? Math.round(finishMs / 1000) : num(ctx.time, 120);

    return {
      score,
      shots,
      hits,
      miss,
      goodHit,
      junkHit,
      bestStreak,
      duration
    };
  }

  function activePlayers(){
    return Object.values(S.players || {}).filter(Boolean);
  }

  function participantIds(){
    return Array.isArray(S.state && S.state.participantIds)
      ? S.state.participantIds.map((x) => String(x || ''))
      : [];
  }

  function participantPlayers(){
    const ids = new Set(participantIds());
    return activePlayers().filter((p) => ids.has(p.pid));
  }

  function amIParticipant(){
    return participantIds().includes(S.uid);
  }

  function calcTeamSummary(myReason='finish'){
    const my = S.results && S.results[S.uid] ? S.results[S.uid] : {};
    const ids = participantIds();
    const rows = Object.values(S.results || {}).filter((r) => !ids.length || ids.includes(String(r.pid || '')));

    const teamScore = rows.reduce((s, r) => s + num(r.score, 0), 0);
    const teamGood = rows.reduce((s, r) => s + num(r.goodHit, 0), 0);
    const teamJunk = rows.reduce((s, r) => s + num(r.junkHit, 0), 0);
    const teamMiss = rows.reduce((s, r) => s + num(r.miss, 0), 0);
    const teamPlayers = Math.max(rows.length, participantPlayers().length, ids.length);
    const myScore = num(my.score, 0);

    let stars = 1;
    if (teamScore >= 1500) stars = 3;
    else if (teamScore >= 700) stars = 2;

    return {
      reason: myReason,
      myScore,
      myGood: num(my.goodHit, 0),
      myJunk: num(my.junkHit, 0),
      myMiss: num(my.miss, 0),
      teamScore,
      teamGood,
      teamJunk,
      teamMiss,
      teamPlayers,
      duration: num(my.duration, num(ctx.time, 120)),
      stars
    };
  }

  async function submitResult(reason='finish'){
    if (S.submitted) return;
    S.submitted = true;

    const m = readMetrics();
    const payload = {
      pid: S.uid,
      nick: String(ctx.name || ctx.pid || 'Player'),
      roomId: ctx.roomId,
      reason,
      score: num(m.score, 0),
      shots: num(m.shots, 0),
      hits: num(m.hits, 0),
      miss: num(m.miss, 0),
      goodHit: num(m.goodHit, 0),
      junkHit: num(m.junkHit, 0),
      bestStreak: num(m.bestStreak, 0),
      duration: num(m.duration, num(ctx.time, 120)),
      at: Date.now(),
      final: true
    };

    try {
      await S.refs.myResult.set(payload);
      await S.refs.myPlayer.update({
        score: payload.score,
        contribution: payload.score,
        ready: true,
        connected: true,
        phase: 'done',
        updatedAt: Date.now(),
        lastSeen: Date.now()
      });

      S.results[S.uid] = payload;
    } catch (err) {
      console.error('[goodjunk-coop-run] submitResult failed:', err);
    }

    const ids = participantIds();
    const doneCount = Object.values(S.results || {}).filter((r) => ids.includes(String(r.pid || '')) && r.final).length;

    if (String((S.state && S.state.status) || '') === 'running' && doneCount >= ids.length && ids.length > 0) {
      try {
        await S.refs.state.update({
          status: 'ended',
          updatedAt: Date.now()
        });
      } catch(_) {}
    }

    const summary = calcTeamSummary(reason);
    UI.showSummary(summary);
    debugLines('summary shown');
  }

  function subscribeRoom(){
    const onMeta = (snap) => {
      S.meta = snap.val() || {};
      UI.setTeamCount(participantPlayers().length || participantIds().length || 0);
      debugLines();
    };
    const onState = async (snap) => {
      S.state = snap.val() || {};
      const status = String((S.state && S.state.status) || 'waiting');
      UI.setStateChip(status);

      if (status === 'countdown') {
        const targetAt = num(S.state.startAt || S.state.countdownEndsAt, 0);
        if (targetAt > 0) runCountdown(targetAt);
      } else {
        clearInterval(S.countdownTick);
        S.countdownTick = 0;
      }

      if (status === 'running' && !S.started && amIParticipant()) {
        maybeStartByClock();
      }

      if (status === 'ended' && !W.__GJ_COOP_LAST_SUMMARY__) {
        const summary = calcTeamSummary('ended');
        UI.showSummary(summary);
      }

      debugLines();
    };
    const onPlayers = (snap) => {
      S.players = snap.val() || {};
      UI.setTeamCount(participantPlayers().length || participantIds().length || 0);
      debugLines();
    };
    const onResults = (snap) => {
      S.results = snap.val() || {};
      debugLines();
    };
    const onError = (err) => {
      console.error('[goodjunk-coop-run] subscribe failed:', err);
      UI.setStatus('เชื่อมห้องไม่สำเร็จ', String(err && err.message ? err.message : err));
      debugLines(`subscribe error: ${String(err && err.message ? err.message : err)}`);
    };

    S.refs.meta.on('value', onMeta, onError);
    S.refs.state.on('value', onState, onError);
    S.refs.players.on('value', onPlayers, onError);
    S.refs.results.on('value', onResults, onError);

    S.watchers.push(() => S.refs.meta.off('value', onMeta));
    S.watchers.push(() => S.refs.state.off('value', onState));
    S.watchers.push(() => S.refs.players.off('value', onPlayers));
    S.watchers.push(() => S.refs.results.off('value', onResults));
  }

  function runCountdown(targetAt){
    clearInterval(S.countdownTick);
    S.countdownTick = setInterval(() => {
      const leftMs = targetAt - Date.now();
      const sec = Math.max(0, Math.ceil(leftMs / 1000));
      UI.setStatus('กำลังนับถอยหลัง…', sec > 0 ? `เริ่มในอีก ${sec} วินาที` : 'GO!');

      if (leftMs <= 0) {
        clearInterval(S.countdownTick);
        S.countdownTick = 0;
        maybeStartByClock();
      }
    }, 100);
  }

  function maybeStartByClock(){
    if (S.started) return;
    if (!amIParticipant()) {
      UI.setStatus('รอบนี้กำลังเล่นอยู่', 'คุณไม่ได้อยู่ใน participant ของรอบนี้');
      return;
    }

    const startAt = num(S.state.startAt || S.state.countdownEndsAt || ctx.startAt, 0);
    if (startAt > Date.now()) {
      runCountdown(startAt);
      pauseCore(true);
      return;
    }

    startCoreNow();
  }

  function startHeartbeat(){
    clearInterval(S.heartbeat);
    S.heartbeat = setInterval(() => {
      S.refs.myPlayer.update({
        nick: String(ctx.name || ctx.pid || 'Player'),
        connected: true,
        updatedAt: Date.now(),
        lastSeen: Date.now(),
        phase: S.submitted ? 'done' : (S.started ? 'run' : 'lobby')
      }).catch(()=>{});
    }, 2500);
  }

  async function boot(){
    try {
      UI.setStatus('กำลังเตรียม Coop Run…', 'กำลังเชื่อม Firebase');
      debugLines('boot start');

      await ensureAuth();
      await waitForCore(8000);

      if (!coreReady()) {
        UI.setStatus('ยังไม่พบ game core', 'โหลด goodjunk.safe.race.js ไม่สำเร็จ');
        debugLines('core not ready');
        return;
      }

      subscribeRoom();
      startHeartbeat();

      if (!amIParticipant() && participantIds().length) {
        UI.setStatus('รอบนี้ถูกล็อกแล้ว', 'คุณไม่ได้อยู่ใน participant ของรอบนี้');
      }

      pauseCore(true);

      const startAt = num(S.state.startAt || ctx.startAt, 0);
      if (startAt > 0) {
        runCountdown(startAt);
      } else {
        UI.setStatus('พร้อมแล้ว!', 'กำลังรอสัญญาณเริ่มจากห้องทีม');
      }

      debugLines('boot ok');
    } catch (err) {
      console.error('[goodjunk-coop-run] boot failed:', err);
      UI.setStatus('เริ่ม Coop Run ไม่สำเร็จ', String(err && err.message ? err.message : err));
      debugLines(`boot failed: ${String(err && err.message ? err.message : err)}`);
    }
  }

  W.addEventListener('hha:end', () => {
    submitResult('finish');
  });

  W.addEventListener('pagehide', () => {
    if (!S.submitted) {
      const m = readMetrics();
      if (num(m.score,0) > 0 || num(m.shots,0) > 0 || num(m.goodHit,0) > 0) {
        submitResult('pagehide');
      }
    }
    clearInterval(S.heartbeat);
    clearInterval(S.countdownTick);
    while (S.watchers.length) {
      const fn = S.watchers.pop();
      try { fn(); } catch(_) {}
    }
  });

  setTimeout(() => {
    if (!S.submitted && !W.__GJ_COOP_LAST_SUMMARY__ && String((S.state && S.state.status) || '') === 'running') {
      const fallbackMs = num(ctx.time, 120) * 1000 + 2500;
      setTimeout(() => {
        if (!S.submitted) submitResult('timeout');
      }, fallbackMs);
    }
  }, 1200);

  boot();
})();