'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-duet-play-bridge.js
 * GoodJunk Duet Play Bridge
 * PATCH v20260406-gjduet-play-bridge-r1
 *
 * Requires:
 *   ../firebase-config.js
 *   ../herohealth-logger.js
 *   ../room-engine.js
 *
 * Exposes:
 *   window.HHA_DUET_BRIDGE.ready
 *   window.HHA_DUET_BRIDGE.ctx
 *   window.HHA_DUET_BRIDGE.waitForStart()
 *   window.HHA_DUET_BRIDGE.tick(state)
 *   window.HHA_DUET_BRIDGE.event(type, detail)
 *   window.HHA_DUET_BRIDGE.finish(summary)
 *   window.HHA_DUET_BRIDGE.abort(reason)
 * ========================================================= */
(function () {
  const W = window;
  const D = document;

  const UPDATE_PROGRESS_MIN_MS = 150;
  const WATCHDOG_MS = 1200;
  const HUB_FALLBACK = '../hub.html';

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
    watchdog: 0,
    startPromise: null,
    startResolve: null,
    startReject: null
  };

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

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      app_version: 'v20260406-gjduet-play-bridge-r1',
      start_at: num(qs('startAt', 0), 0),
      autostart: qs('autostart', '0') === '1',
      wait: qs('wait', '0') === '1'
    };
  }

  function isHost() {
    return (S.ctx && S.ctx.role === 'host') || qs('host', '0') === '1';
  }

  function saveLastSummary(row) {
    try {
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(row));
      localStorage.setItem('GJ_DUET_LAST_SUMMARY', JSON.stringify(row));
    } catch (_) {}
  }

  function makeStartPromise() {
    if (S.startPromise) return S.startPromise;
    S.startPromise = new Promise((resolve, reject) => {
      S.startResolve = resolve;
      S.startReject = reject;
    });
    return S.startPromise;
  }

  function resolveStart() {
    if (S.started) return;
    S.started = true;
    if (typeof S.startResolve === 'function') S.startResolve(true);
  }

  function rejectStart(err) {
    if (typeof S.startReject === 'function') S.startReject(err);
  }

  function setOverlay(msg) {
    let el = D.getElementById('hhaDuetOverlay');
    if (!el) {
      el = D.createElement('div');
      el.id = 'hhaDuetOverlay';
      el.style.position = 'fixed';
      el.style.inset = '0';
      el.style.zIndex = '9999';
      el.style.display = 'grid';
      el.style.placeItems = 'center';
      el.style.background = 'rgba(8,14,40,.70)';
      el.style.backdropFilter = 'blur(3px)';
      el.style.fontFamily = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai","Noto Sans",Arial,sans-serif';
      el.innerHTML = `
        <div style="min-width:220px;max-width:92vw;padding:18px 20px;border-radius:20px;background:rgba(14,22,58,.96);border:1px solid rgba(140,170,255,.22);box-shadow:0 20px 48px rgba(0,0,0,.35);text-align:center;color:#fff;">
          <div style="font-size:14px;font-weight:1000;opacity:.92;margin-bottom:8px;">GOODJUNK DUET</div>
          <div id="hhaDuetOverlayText" style="font-size:26px;font-weight:1100;line-height:1.15;">เตรียมพร้อม</div>
          <div style="margin-top:10px;font-size:12px;font-weight:900;color:#c7d2fe;">รอเริ่มพร้อมกันทั้ง 2 เครื่อง</div>
        </div>
      `;
      D.body.appendChild(el);
    }
    const txt = D.getElementById('hhaDuetOverlayText');
    if (txt) txt.textContent = String(msg || '');
    el.style.display = 'grid';
  }

  function hideOverlay() {
    const el = D.getElementById('hhaDuetOverlay');
    if (el) el.style.display = 'none';
  }

  function setStatusChip(text) {
    let el = D.getElementById('hhaDuetStatusChip');
    if (!el) {
      el = D.createElement('div');
      el.id = 'hhaDuetStatusChip';
      el.style.position = 'fixed';
      el.style.top = '12px';
      el.style.right = '12px';
      el.style.zIndex = '9998';
      el.style.padding = '8px 12px';
      el.style.borderRadius = '999px';
      el.style.background = 'rgba(11,27,66,.88)';
      el.style.border = '1px solid rgba(122,162,255,.24)';
      el.style.color = '#eef4ff';
      el.style.font = '900 12px ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai","Noto Sans",Arial,sans-serif';
      D.body.appendChild(el);
    }
    el.textContent = String(text || '');
  }

  async function init() {
    if (!W.HHA_ROOM) throw new Error('Missing /herohealth/room-engine.js');
    if (!W.HeroHealthLogger) throw new Error('Missing /herohealth/herohealth-logger.js');

    const out = await W.HHA_ROOM.init(W.HHA_FIREBASE_CONFIG || W.FIREBASE_CONFIG);
    S.uid = out && out.uid ? out.uid : '';
    S.ctx = getCtx();

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
    makeStartPromise();
    startWatchdog();

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
      setOverlay('3');
      waitForStart().catch((err) => {
        console.error('[duet-bridge] waitForStart failed', err);
      });
    } else {
      hideOverlay();
      resolveStart();
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

        setStatusChip(`Duet • ${meta.state || 'waiting'} • ${players.length}/2`);

        if ((meta.state === 'countdown') && num(meta.countdownAt, 0) > 0 && !S.started) {
          const leftMs = num(meta.countdownAt, 0) - now();
          const sec = Math.max(0, Math.ceil(leftMs / 1000));
          setOverlay(sec > 0 ? String(sec) : 'GO!');
          if (leftMs <= 0) {
            hideOverlay();
            resolveStart();
          }
        }

        if ((meta.state === 'running') && !S.started) {
          hideOverlay();
          resolveStart();
        }

        if (meta.state === 'aborted' && !S.finished) {
          await abort('room_aborted');
          return;
        }

        if (isHost() && !S.finished) {
          const done = Object.values(results).filter((r) => !!r.finished);
          if (players.length >= 2 && done.length >= 2 && meta.matchId) {
            const teamScore = done.reduce((sum, r) => sum + num(r.score, 0), 0);
            const team = {
              score: teamScore,
              goal: 0,
              progress: 1
            };
            try {
              await W.HHA_ROOM.finishMatch({
                game: S.ctx.game,
                mode: S.ctx.mode,
                roomId: S.ctx.room_id,
                matchId: meta.matchId,
                team
              });
            } catch (_) {}
          }
        }
      }
    });
  }

  function startWatchdog() {
    clearInterval(S.watchdog);
    S.watchdog = setInterval(async () => {
      if (!S.ready || !S.ctx || !S.ctx.room_id || S.finished) return;
      try {
        await W.HHA_ROOM.attachPresence({
          pid: S.ctx.pid,
          name: S.ctx.display_name,
          game: S.ctx.game,
          mode: S.ctx.mode,
          roomId: S.ctx.room_id,
          state: S.started ? 'running' : 'lobby'
        });
      } catch (_) {}
    }, WATCHDOG_MS);
  }

  async function waitForStart() {
    makeStartPromise();

    const startAt = num(S.ctx.start_at, 0);
    if (startAt > 0 && !S.started) {
      while (now() < startAt && !S.started) {
        const leftMs = startAt - now();
        const sec = Math.max(0, Math.ceil(leftMs / 1000));
        setOverlay(sec > 0 ? String(sec) : 'GO!');
        await sleep(80);
      }
    }

    if (!S.started) {
      hideOverlay();
      resolveStart();
    }

    return S.startPromise;
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

    if ((t - S.lastProgressAt) < UPDATE_PROGRESS_MIN_MS) return;
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
      started_at_ms: (S.logger && S.logger.session && S.logger.session.started_at_ms) || (finishedAt - 1000),
      ended_at_ms: finishedAt,
      duration_ms: Math.max(0, finishedAt - (((S.logger && S.logger.session && S.logger.session.started_at_ms) || finishedAt))),
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
          started_at_ms: sessionRow.started_at_ms,
          ended_at_ms: finishedAt
        }]);
      }
    } catch (err) {
      console.error('[duet-bridge] logger finish failed', err);
    }

    saveLastSummary(sessionRow);
    hideOverlay();
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

    hideOverlay();

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

  W.addEventListener('pagehide', () => {
    try {
      if (S.logger) S.logger.flush('pagehide');
    } catch (_) {}
  });

  init().catch((err) => {
    console.error('[duet-bridge] init failed', err);
    rejectStart(err);
  });
})();