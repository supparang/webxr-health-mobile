'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-duet-play-bridge.js
 * GoodJunk Duet Run Bridge
 * PATCH v20260406-gjduet-play-bridge-r2
 * - reuse existing duet countdown overlay in goodjunk-duet-play.html
 * - connect run page to /herohealth/room-engine.js
 * - connect archive/research log to /herohealth/herohealth-logger.js
 * ========================================================= */
(function () {
  const W = window;
  const D = document;

  const S = {
    ready: false,
    started: false,
    finished: false,
    uid: '',
    ctx: null,
    logger: null,
    room: null,
    unwatchRoom: null,
    lastProgressAt: 0,
    lastTickState: null,
    sessionStartedAt: Date.now()
  };

  const PROGRESS_MIN_MS = 150;
  const HUB_FALLBACK = '../hub.html';

  function qs(key, fallback = '') {
    try {
      const v = new URL(location.href).searchParams.get(key);
      return v == null || v === '' ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function clean(v, max = 64) {
    return String(v == null ? '' : v)
      .replace(/[^a-zA-Z0-9ก-๙ _-]/g, '')
      .trim()
      .slice(0, max);
  }

  function now() {
    return Date.now();
  }

  function byId(id) {
    return D.getElementById(id);
  }

  function overlayEls() {
    return {
      wrap: byId('duetCountdownOverlay'),
      num: byId('duetCountdownNum'),
      text: byId('duetCountdownText')
    };
  }

  function resultMount() {
    return byId('duetResultMount');
  }

  function getCtx() {
    return {
      pid: clean(qs('pid', 'anon'), 64) || 'anon',
      uid: S.uid || '',
      display_name: clean(qs('name', qs('nick', 'Player')), 32) || 'Player',
      name: clean(qs('name', qs('nick', 'Player')), 32) || 'Player',
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'duet',
      diff: clean(qs('diff', 'normal'), 24) || 'normal',
      time_sec: num(qs('time', 90), 90),
      seed: String(qs('seed', String(Date.now()))),
      view: clean(qs('view', 'mobile'), 24) || 'mobile',
      run: clean(qs('run', 'play'), 24) || 'play',
      hub: qs('hub', HUB_FALLBACK),
      room_id: clean(qs('roomId', qs('room', '')), 32),
      match_id: clean(qs('matchId', ''), 48),
      role: clean(qs('role', qs('host', '0') === '1' ? 'host' : 'player'), 24) || 'player',
      app_version: 'v20260406-gjduet-play-bridge-r2',
      start_at: num(qs('startAt', 0), 0),
      autostart: qs('autostart', '0') === '1',
      wait: qs('wait', '0') === '1'
    };
  }

  function isHost() {
    return !!S.ctx && S.ctx.role === 'host';
  }

  function showCountdown(value, message) {
    const el = overlayEls();
    if (!el.wrap) return;
    el.wrap.classList.add('show');
    if (el.num) el.num.textContent = String(value == null ? '' : value);
    if (el.text) el.text.textContent = String(message || 'เตรียมตัวเก็บของดีให้ถึงเป้าหมายคู่');
  }

  function hideCountdown() {
    const el = overlayEls();
    if (!el.wrap) return;
    el.wrap.classList.remove('show');
  }

  function showResultMount() {
    const el = resultMount();
    if (el) el.hidden = false;
  }

  function saveLastSummary(row) {
    try {
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(row));
      localStorage.setItem('GJ_DUET_LAST_SUMMARY', JSON.stringify(row));
    } catch (_) {}
  }

  async function init() {
    if (!W.HHA_ROOM) throw new Error('Missing /herohealth/room-engine.js');
    if (!W.HeroHealthLogger) throw new Error('Missing /herohealth/herohealth-logger.js');

    const out = await W.HHA_ROOM.init(W.HHA_FIREBASE_CONFIG || W.FIREBASE_CONFIG);
    S.uid = out && out.uid ? out.uid : '';
    S.ctx = getCtx();
    S.sessionStartedAt = now();

    S.logger = new W.HeroHealthLogger({
      endpoint: W.HHA_APPS_SCRIPT_URL || '',
      secret: W.HHA_INGEST_SECRET || '',
      base: S.ctx
    });

    S.logger.startSession(S.ctx);

    await W.HHA_ROOM.attachPresence({
      pid: S.ctx.pid,
      name: S.ctx.display_name,
      game: S.ctx.game,
      mode: S.ctx.mode,
      roomId: S.ctx.room_id,
      state: 'running'
    });

    bindRoomWatch();
    bindSummaryEvents();

    W.HHA_DUET_BRIDGE = {
      ready: true,
      ctx: S.ctx,
      waitForStart,
      tick,
      event,
      finish,
      abort
    };

    S.ready = true;

    if (S.ctx.wait || S.ctx.autostart) {
      await waitForStart();
    } else {
      hideCountdown();
      S.started = true;
    }
  }

  function bindRoomWatch() {
    if (typeof S.unwatchRoom === 'function') {
      try { S.unwatchRoom(); } catch (_) {}
    }

    S.unwatchRoom = W.HHA_ROOM.watchRoom({
      game: S.ctx.game,
      mode: S.ctx.mode,
      roomId: S.ctx.room_id,
      onValue: async (room) => {
        S.room = room || null;
        const meta = room && room.meta ? room.meta : {};
        const players = room && room.players ? Object.values(room.players) : [];
        const results = room && room.results ? room.results : {};

        if (meta.state === 'countdown' && num(meta.countdownAt, 0) > 0 && !S.started) {
          const leftMs = num(meta.countdownAt, 0) - now();
          const sec = Math.max(0, Math.ceil(leftMs / 1000));
          showCountdown(sec > 0 ? sec : 'GO!', 'เริ่มพร้อมกันทั้ง 2 เครื่อง');
          if (leftMs <= 0) {
            hideCountdown();
            S.started = true;
          }
        }

        if (meta.state === 'running' && !S.started) {
          hideCountdown();
          S.started = true;
        }

        if (meta.state === 'aborted' && !S.finished) {
          await abort('room_aborted');
          return;
        }

        if (isHost() && !S.finished) {
          const done = Object.values(results).filter((r) => !!r.finished);
          if (players.length >= 2 && done.length >= 2 && meta.matchId) {
            const teamScore = done.reduce((sum, r) => sum + num(r.score, 0), 0);
            try {
              await W.HHA_ROOM.finishMatch({
                game: S.ctx.game,
                mode: S.ctx.mode,
                roomId: S.ctx.room_id,
                matchId: meta.matchId,
                team: {
                  score: teamScore,
                  goal: 0,
                  progress: 1
                }
              });
            } catch (_) {}
          }
        }
      }
    });
  }

  async function waitForStart() {
    const startAt = num(S.ctx.start_at, 0);

    if (startAt > 0 && !S.started) {
      while (now() < startAt && !S.started) {
        const leftMs = startAt - now();
        const sec = Math.max(0, Math.ceil(leftMs / 1000));
        showCountdown(sec > 0 ? sec : 'GO!', 'เริ่มพร้อมกันทั้ง 2 เครื่อง');
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }

    hideCountdown();
    S.started = true;
    return true;
  }

  async function event(type, detail) {
    if (!S.logger) return null;
    return S.logger.event(type, Object.assign({
      match_id: S.ctx.match_id,
      room_id: S.ctx.room_id,
      game: S.ctx.game,
      zone: S.ctx.zone,
      mode: S.ctx.mode,
      uid: S.uid,
      pid: S.ctx.pid
    }, detail || {}));
  }

  async function tick(state) {
    if (!S.ready || S.finished) return;
    const t = now();
    S.lastTickState = Object.assign({}, state || {});

    if ((t - S.lastProgressAt) < PROGRESS_MIN_MS) return;
    S.lastProgressAt = t;

    try {
      await W.HHA_ROOM.updateProgress({
        game: S.ctx.game,
        mode: S.ctx.mode,
        roomId: S.ctx.room_id,
        matchId: S.ctx.match_id,
        pid: S.ctx.pid,
        progress: num(state && state.progress, 0),
        score: num(state && state.score, 0),
        miss: num(state && state.miss, 0),
        bestStreak: num(state && (state.bestStreak ?? state.streak), 0),
        hp: state && state.hp,
        lives: state && state.lives
      });
    } catch (err) {
      console.error('[duet-bridge] updateProgress failed', err);
    }
  }

  async function finish(summary) {
    if (S.finished) return;
    S.finished = true;

    const finalState = Object.assign({}, S.lastTickState || {}, summary || {});
    const finishedAt = now();

    const score = num(finalState.score, 0);
    const miss = num(finalState.miss, 0);
    const bestStreak = num(finalState.best_streak ?? finalState.bestStreak ?? finalState.streak, 0);
    const accuracy = num(finalState.accuracy, 0);
    const contribution = num(finalState.contribution, 0);
    const progress = Math.max(1, num(finalState.progress, 1));

    try {
      await W.HHA_ROOM.submitResult({
        game: S.ctx.game,
        mode: S.ctx.mode,
        roomId: S.ctx.room_id,
        matchId: S.ctx.match_id,
        pid: S.ctx.pid,
        score,
        miss,
        bestStreak,
        progress,
        finished: true,
        rank: finalState.rank,
        contribution,
        accuracy
      });
    } catch (err) {
      console.error('[duet-bridge] submitResult failed', err);
    }

    const sessionRow = {
      session_id: (S.logger && S.logger.session && S.logger.session.session_id) || '',
      match_id: S.ctx.match_id,
      room_id: S.ctx.room_id,
      uid: S.uid,
      pid: S.ctx.pid,
      display_name: S.ctx.display_name,
      game: S.ctx.game,
      zone: S.ctx.zone,
      mode: S.ctx.mode,
      role: S.ctx.role,
      team_id: '',
      run: S.ctx.run,
      diff: S.ctx.diff,
      time_sec: S.ctx.time_sec,
      seed: S.ctx.seed,
      view: S.ctx.view,
      device_type: /android|iphone|ipad|mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      app_version: S.ctx.app_version,
      started_at_ms: S.sessionStartedAt,
      ended_at_ms: finishedAt,
      duration_ms: Math.max(0, finishedAt - S.sessionStartedAt),
      score,
      correct: num(finalState.correct, 0),
      wrong: num(finalState.wrong, 0),
      miss,
      best_streak: bestStreak,
      accuracy,
      rank: finalState.rank ?? '',
      stars: num(finalState.stars, 0),
      medal: finalState.medal || '',
      contribution,
      team_score: num(finalState.team_score, 0),
      outcome: finalState.outcome || 'clear',
      study_id: '',
      school_code: '',
      class_room: '',
      hub: S.ctx.hub,
      referrer: document.referrer || ''
    };

    try {
      if (S.logger) {
        await S.logger.endSession(sessionRow);
        await S.logger.modeResults([{
          match_id: S.ctx.match_id,
          room_id: S.ctx.room_id,
          game: S.ctx.game,
          zone: S.ctx.zone,
          mode: S.ctx.mode,
          uid: S.uid,
          pid: S.ctx.pid,
          role: S.ctx.role,
          team_id: '',
          seed: S.ctx.seed,
          diff: S.ctx.diff,
          time_sec: S.ctx.time_sec,
          score,
          rank: finalState.rank ?? '',
          finished: true,
          dnf: false,
          winner: !!finalState.winner,
          best_streak: bestStreak,
          miss,
          accuracy,
          contribution,
          team_score: num(finalState.team_score, 0),
          team_goal: num(finalState.team_goal, 0),
          team_progress: num(finalState.team_progress, 0),
          started_at_ms: S.sessionStartedAt,
          ended_at_ms: finishedAt
        }]);
      }
    } catch (err) {
      console.error('[duet-bridge] logger finish failed', err);
    }

    saveLastSummary(sessionRow);
    showResultMount();
    hideCountdown();
    return sessionRow;
  }

  async function abort(reason) {
    if (S.finished) return;
    S.finished = true;

    try {
      if (S.logger) {
        await S.logger.event('duet_abort', {
          phase: 'run',
          result: 'aborted',
          payload_json: { reason: reason || 'unknown' }
        });
        await S.logger.flush('abort');
      }
    } catch (_) {}

    hideCountdown();

    const lobby = new URL('./goodjunk-duet-lobby.html', location.href);
    lobby.searchParams.set('mode', 'duet');
    lobby.searchParams.set('roomId', S.ctx.room_id || '');
    lobby.searchParams.set('room', S.ctx.room_id || '');
    lobby.searchParams.set('pid', S.ctx.pid || 'anon');
    lobby.searchParams.set('name', S.ctx.display_name || 'Player');
    lobby.searchParams.set('diff', S.ctx.diff || 'normal');
    lobby.searchParams.set('time', String(S.ctx.time_sec || 90));
    lobby.searchParams.set('seed', String(S.ctx.seed || Date.now()));
    lobby.searchParams.set('view', S.ctx.view || 'mobile');
    lobby.searchParams.set('hub', S.ctx.hub || HUB_FALLBACK);

    location.href = lobby.toString();
  }

  function bindSummaryEvents() {
    W.addEventListener('gj:summary', async function (evt) {
      const detail = evt && evt.detail ? evt.detail : null;
      if (!detail) return;
      await finish(detail);
    });

    W.addEventListener('hha:summary', async function (evt) {
      const detail = evt && evt.detail ? evt.detail : null;
      if (!detail) return;
      await finish(detail);
    });

    W.addEventListener('hha:session-summary', async function (evt) {
      const detail = evt && evt.detail ? evt.detail : null;
      if (!detail) return;
      await finish(detail);
    });
  }

  W.addEventListener('pagehide', () => {
    try {
      if (S.logger) S.logger.flush('pagehide');
    } catch (_) {}
  });

  init().catch((err) => {
    console.error('[duet-bridge] init failed', err);
  });
})();