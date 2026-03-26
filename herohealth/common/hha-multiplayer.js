/* =========================================================
 * /herohealth/common/hha-multiplayer.js
 * HeroHealth Multiplayer Helper
 * Shared helper for goodjunk / groups / plate
 * modes: duet / race / battle / coop
 * path: hha-battle/{game}/{modeRooms}/{roomCode}
 * ========================================================= */

(function () {
  'use strict';

  if (window.HHAMulti) return;

  const GAME_SET = new Set(['goodjunk', 'groups', 'plate']);
  const MODE_SET = new Set(['duet', 'race', 'battle', 'coop']);
  const VIEW_SET = new Set(['pc', 'mobile', 'cvr']);
  const DIFF_SET = new Set(['easy', 'normal', 'hard']);

  function nowMs() {
    return Date.now();
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function safeStr(v, fallback = '') {
    return String(v == null ? fallback : v).trim();
  }

  function modeRooms(mode) {
    mode = safeStr(mode).toLowerCase();
    if (!MODE_SET.has(mode)) throw new Error('Invalid mode: ' + mode);
    return mode + 'Rooms';
  }

  function normalizeGame(game) {
    game = safeStr(game).toLowerCase();
    if (!GAME_SET.has(game)) throw new Error('Invalid game: ' + game);
    return game;
  }

  function normalizeMode(mode) {
    mode = safeStr(mode).toLowerCase();
    if (!MODE_SET.has(mode)) throw new Error('Invalid mode: ' + mode);
    return mode;
  }

  function normalizeView(view) {
    view = safeStr(view || 'mobile').toLowerCase();
    return VIEW_SET.has(view) ? view : 'mobile';
  }

  function normalizeDiff(diff) {
    diff = safeStr(diff || 'normal').toLowerCase();
    return DIFF_SET.has(diff) ? diff : 'normal';
  }

  function normalizeRoomCode(roomCode) {
    return safeStr(roomCode).replace(/\s+/g, '').slice(0, 40).toUpperCase();
  }

  function defaultMaxPlayers(mode) {
    switch (mode) {
      case 'duet': return 2;
      case 'battle': return 2;
      case 'race': return 2;
      case 'coop': return 2;
      default: return 2;
    }
  }

  function defaultTeam(mode, role, currentCount) {
    if (mode === 'coop') return 'A';
    if (mode === 'duet') return currentCount % 2 === 0 ? 'A' : 'B';
    if (mode === 'battle') return currentCount % 2 === 0 ? 'A' : 'B';
    if (mode === 'race') return currentCount % 2 === 0 ? 'A' : 'B';
    return role === 'host' ? 'A' : 'B';
  }

  function rootRef(game, mode, roomCode) {
    const db = firebase.database();
    return db.ref(`hha-battle/${normalizeGame(game)}/${modeRooms(mode)}/${normalizeRoomCode(roomCode)}`);
  }

  function makePlayerId(prefix = 'p') {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  }

  function makeSeed() {
    return Math.floor(Math.random() * 2147483647);
  }

  async function readRoom(game, mode, roomCode) {
    const snap = await rootRef(game, mode, roomCode).get();
    return snap.exists() ? snap.val() : null;
  }

  async function createRoom(opts) {
    const game = normalizeGame(opts.game);
    const mode = normalizeMode(opts.mode);
    const roomCode = normalizeRoomCode(opts.roomCode);
    const hostPlayerId = safeStr(opts.hostPlayerId || makePlayerId());
    const hostName = safeStr(opts.hostName || 'Host').slice(0, 40);
    const diff = normalizeDiff(opts.diff);
    const view = normalizeView(opts.view);
    const timeSec = clamp(opts.timeSec || 90, 15, 900);
    const maxPlayers = clamp(opts.maxPlayers || defaultMaxPlayers(mode), 1, 8);
    const pid = safeStr(opts.pid || 'anon').slice(0, 80);
    const seed = Number.isFinite(Number(opts.seed)) ? Number(opts.seed) : makeSeed();
    const now = nowMs();

    const ref = rootRef(game, mode, roomCode);
    const payload = {
      meta: {
        game,
        mode,
        roomCode,
        hostName,
        hostPlayerId,
        diff,
        timeSec,
        view,
        seed,
        status: 'lobby',
        maxPlayers,
        createdAt: now,
        updatedAt: now
      },
      players: {
        [hostPlayerId]: {
          playerId: hostPlayerId,
          name: hostName,
          role: 'host',
          team: defaultTeam(mode, 'host', 0),
          ready: false,
          online: true,
          joinedAt: now,
          lastSeenAt: now,
          view,
          pid
        }
      },
      scores: {
        [hostPlayerId]: {
          playerId: hostPlayerId,
          score: 0,
          combo: 0,
          miss: 0,
          acc: 0,
          hp: 100,
          done: false,
          updatedAt: now
        }
      },
      match: {
        started: false,
        locked: false,
        phase: 'lobby',
        countdownStartAt: 0,
        startedAt: 0,
        endedAt: 0,
        roundNo: 1
      },
      rematch: {
        requestedBy: {},
        readyCount: 0,
        updatedAt: now
      },
      reports: {}
    };

    await ref.set(payload);
    return {
      roomCode,
      playerId: hostPlayerId,
      ref
    };
  }

  async function joinRoom(opts) {
    const game = normalizeGame(opts.game);
    const mode = normalizeMode(opts.mode);
    const roomCode = normalizeRoomCode(opts.roomCode);
    const playerId = safeStr(opts.playerId || makePlayerId());
    const name = safeStr(opts.name || 'Guest').slice(0, 40);
    const pid = safeStr(opts.pid || 'anon').slice(0, 80);
    const view = normalizeView(opts.view);
    const ref = rootRef(game, mode, roomCode);
    const now = nowMs();

    const result = await ref.transaction((room) => {
      if (!room) return room;

      room.meta = room.meta || {};
      room.players = room.players || {};
      room.scores = room.scores || {};
      room.match = room.match || {};
      room.rematch = room.rematch || { requestedBy: {}, readyCount: 0, updatedAt: now };

      const players = room.players;
      const ids = Object.keys(players);
      const maxPlayers = clamp(room.meta.maxPlayers || defaultMaxPlayers(mode), 1, 8);

      if (room.match.locked || room.meta.status === 'closed') return;
      if (!players[playerId] && ids.length >= maxPlayers) return;

      const role = ids.length === 0 ? 'host' : (ids.length === 1 ? 'guest' : 'player');
      const team = defaultTeam(mode, role, ids.length);

      players[playerId] = {
        playerId,
        name,
        role,
        team,
        ready: !!(players[playerId] && players[playerId].ready),
        online: true,
        joinedAt: players[playerId]?.joinedAt || now,
        lastSeenAt: now,
        view,
        pid
      };

      room.scores[playerId] = room.scores[playerId] || {
        playerId,
        score: 0,
        combo: 0,
        miss: 0,
        acc: 0,
        hp: 100,
        done: false,
        updatedAt: now
      };

      room.meta.updatedAt = now;
      return room;
    }, { applyLocally: false });

    if (!result.committed) {
      throw new Error('joinRoom failed: room missing, locked, or full');
    }

    return {
      roomCode,
      playerId,
      ref
    };
  }

  async function leaveRoom(opts) {
    const { game, mode, roomCode, playerId } = opts;
    const ref = rootRef(game, mode, roomCode);
    const now = nowMs();

    const result = await ref.transaction((room) => {
      if (!room) return room;
      room.players = room.players || {};
      room.meta = room.meta || {};
      room.scores = room.scores || {};
      room.reports = room.reports || {};

      if (!room.players[playerId]) return room;

      delete room.players[playerId];
      delete room.scores[playerId];
      delete room.reports[playerId];

      const ids = Object.keys(room.players);
      if (ids.length === 0) {
        return null;
      }

      const hostId = room.meta.hostPlayerId;
      if (!room.players[hostId]) {
        const nextHostId = ids[0];
        room.meta.hostPlayerId = nextHostId;
        room.meta.hostName = room.players[nextHostId]?.name || 'Host';
        room.players[nextHostId].role = 'host';
      }

      room.meta.updatedAt = now;
      return room;
    }, { applyLocally: false });

    return result.committed;
  }

  async function setReady(opts) {
    const { game, mode, roomCode, playerId } = opts;
    const ready = !!opts.ready;
    const ref = rootRef(game, mode, roomCode).child(`players/${playerId}`);
    await ref.child('ready').set(ready);
    await ref.child('lastSeenAt').set(nowMs());
    await rootRef(game, mode, roomCode).child('meta/updatedAt').set(nowMs());
  }

  async function heartbeat(opts) {
    const { game, mode, roomCode, playerId } = opts;
    const base = rootRef(game, mode, roomCode).child(`players/${playerId}`);
    const now = nowMs();
    await base.update({
      online: true,
      lastSeenAt: now
    });
  }

  async function setOffline(opts) {
    const { game, mode, roomCode, playerId } = opts;
    const base = rootRef(game, mode, roomCode).child(`players/${playerId}`);
    const now = nowMs();
    await base.update({
      online: false,
      lastSeenAt: now
    });
  }

  async function startMatch(opts) {
    const game = normalizeGame(opts.game);
    const mode = normalizeMode(opts.mode);
    const roomCode = normalizeRoomCode(opts.roomCode);
    const playerId = safeStr(opts.playerId);
    const countdownSec = clamp(opts.countdownSec || 3, 0, 15);
    const ref = rootRef(game, mode, roomCode);
    const now = nowMs();

    const result = await ref.transaction((room) => {
      if (!room) return room;
      room.meta = room.meta || {};
      room.players = room.players || {};
      room.match = room.match || {};

      if (room.meta.hostPlayerId !== playerId) return;
      if (room.match.locked || room.match.started) return;

      const players = Object.values(room.players);
      if (!players.length) return;

      const allReady = players.every(p => !!p.ready);
      if (!allReady) return;

      room.meta.status = countdownSec > 0 ? 'countdown' : 'playing';
      room.meta.updatedAt = now;

      room.match.locked = true;
      room.match.started = countdownSec <= 0;
      room.match.phase = countdownSec > 0 ? 'countdown' : 'playing';
      room.match.countdownStartAt = countdownSec > 0 ? now : 0;
      room.match.startedAt = countdownSec > 0 ? 0 : now;
      room.match.endedAt = 0;
      room.match.roundNo = Math.max(1, Number(room.match.roundNo || 1));

      return room;
    }, { applyLocally: false });

    if (!result.committed) {
      throw new Error('startMatch failed: not host, not ready, or already started');
    }

    return true;
  }

  async function promoteCountdownToPlaying(opts) {
    const { game, mode, roomCode } = opts;
    const ref = rootRef(game, mode, roomCode);
    const now = nowMs();

    const result = await ref.transaction((room) => {
      if (!room) return room;
      room.meta = room.meta || {};
      room.match = room.match || {};
      if (room.match.phase !== 'countdown') return room;

      room.meta.status = 'playing';
      room.meta.updatedAt = now;
      room.match.phase = 'playing';
      room.match.started = true;
      room.match.startedAt = now;
      return room;
    }, { applyLocally: false });

    return result.committed;
  }

  async function submitScore(opts) {
    const game = normalizeGame(opts.game);
    const mode = normalizeMode(opts.mode);
    const roomCode = normalizeRoomCode(opts.roomCode);
    const playerId = safeStr(opts.playerId);
    const now = nowMs();

    const payload = {
      playerId,
      score: clamp(opts.score || 0, 0, 999999999),
      combo: clamp(opts.combo || 0, 0, 999999),
      miss: clamp(opts.miss || 0, 0, 999999),
      acc: clamp(opts.acc || 0, 0, 100),
      hp: clamp(opts.hp == null ? 100 : opts.hp, 0, 100),
      done: !!opts.done,
      updatedAt: now
    };

    if (opts.result) {
      payload.result = String(opts.result);
    }

    await rootRef(game, mode, roomCode).child(`scores/${playerId}`).update(payload);
    await rootRef(game, mode, roomCode).child('meta/updatedAt').set(now);

    return payload;
  }

  async function submitReport(opts) {
    const game = normalizeGame(opts.game);
    const mode = normalizeMode(opts.mode);
    const roomCode = normalizeRoomCode(opts.roomCode);
    const playerId = safeStr(opts.playerId);
    const now = nowMs();

    const payload = {
      playerId,
      result: safeStr(opts.result || 'finished'),
      score: clamp(opts.score || 0, 0, 999999999),
      combo: clamp(opts.combo || 0, 0, 999999),
      miss: clamp(opts.miss || 0, 0, 999999),
      acc: clamp(opts.acc || 0, 0, 100),
      finishedAt: now
    };

    await rootRef(game, mode, roomCode).child(`reports/${playerId}`).set(payload);
    return payload;
  }

  async function finishMatch(opts) {
    const game = normalizeGame(opts.game);
    const mode = normalizeMode(opts.mode);
    const roomCode = normalizeRoomCode(opts.roomCode);
    const now = nowMs();
    const ref = rootRef(game, mode, roomCode);

    const result = await ref.transaction((room) => {
      if (!room) return room;
      room.meta = room.meta || {};
      room.match = room.match || {};
      room.scores = room.scores || {};
      room.players = room.players || {};

      const scoreEntries = Object.entries(room.scores);
      let winnerPlayerId = '';
      let winnerTeam = 'none';
      let bestScore = -1;

      for (const [pid, s] of scoreEntries) {
        const score = Number(s?.score || 0);
        if (score > bestScore) {
          bestScore = score;
          winnerPlayerId = pid;
          winnerTeam = room.players[pid]?.team || 'none';
        }
      }

      room.meta.status = 'ended';
      room.meta.updatedAt = now;

      room.match.phase = 'ended';
      room.match.started = true;
      room.match.locked = true;
      room.match.endedAt = now;
      room.match.winnerPlayerId = winnerPlayerId || '';
      room.match.winnerTeam = winnerTeam || 'none';
      room.match.endSummary = {
        winnerPlayerId: winnerPlayerId || '',
        winnerTeam: winnerTeam || 'none',
        bestScore: Math.max(0, bestScore),
        endedAt: now
      };

      return room;
    }, { applyLocally: false });

    if (!result.committed) {
      throw new Error('finishMatch failed');
    }
    return true;
  }

  async function requestRematch(opts) {
    const { game, mode, roomCode, playerId } = opts;
    const roomRef = rootRef(game, mode, roomCode);
    const now = nowMs();

    await roomRef.child(`rematch/requestedBy/${playerId}`).set(true);

    const room = await readRoom(game, mode, roomCode);
    const requestedBy = room?.rematch?.requestedBy || {};
    const readyCount = Object.values(requestedBy).filter(Boolean).length;

    await roomRef.child('rematch').update({
      readyCount,
      updatedAt: now
    });

    return readyCount;
  }

  async function resetForRematch(opts) {
    const game = normalizeGame(opts.game);
    const mode = normalizeMode(opts.mode);
    const roomCode = normalizeRoomCode(opts.roomCode);
    const playerId = safeStr(opts.playerId);
    const ref = rootRef(game, mode, roomCode);
    const now = nowMs();

    const result = await ref.transaction((room) => {
      if (!room) return room;
      room.meta = room.meta || {};
      room.players = room.players || {};
      room.scores = room.scores || {};
      room.match = room.match || {};
      room.rematch = room.rematch || {};

      if (room.meta.hostPlayerId !== playerId) return;

      for (const pid of Object.keys(room.players)) {
        room.players[pid].ready = false;
      }

      for (const pid of Object.keys(room.scores)) {
        room.scores[pid] = {
          playerId: pid,
          score: 0,
          combo: 0,
          miss: 0,
          acc: 0,
          hp: 100,
          done: false,
          updatedAt: now
        };
      }

      room.meta.status = 'lobby';
      room.meta.updatedAt = now;

      room.match.started = false;
      room.match.locked = false;
      room.match.phase = 'lobby';
      room.match.countdownStartAt = 0;
      room.match.startedAt = 0;
      room.match.endedAt = 0;
      room.match.roundNo = Number(room.match.roundNo || 1) + 1;
      room.match.winnerPlayerId = '';
      room.match.winnerTeam = 'none';
      room.match.endSummary = {};

      room.rematch = {
        requestedBy: {},
        readyCount: 0,
        updatedAt: now
      };

      room.reports = {};
      return room;
    }, { applyLocally: false });

    if (!result.committed) {
      throw new Error('resetForRematch failed: only host can reset');
    }

    return true;
  }

  function watchRoom(opts, onValue, onError) {
    const { game, mode, roomCode } = opts;
    const ref = rootRef(game, mode, roomCode);
    const cb = (snap) => onValue && onValue(snap.val(), snap);
    const err = (e) => onError && onError(e);
    ref.on('value', cb, err);
    return () => ref.off('value', cb);
  }

  function watchPlayers(opts, onValue, onError) {
    const { game, mode, roomCode } = opts;
    const ref = rootRef(game, mode, roomCode).child('players');
    const cb = (snap) => onValue && onValue(snap.val() || {}, snap);
    const err = (e) => onError && onError(e);
    ref.on('value', cb, err);
    return () => ref.off('value', cb);
  }

  window.HHAMulti = {
    GAME_SET,
    MODE_SET,
    modeRooms,
    rootRef,
    makePlayerId,
    makeSeed,
    readRoom,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    heartbeat,
    setOffline,
    startMatch,
    promoteCountdownToPlaying,
    submitScore,
    submitReport,
    finishMatch,
    requestRematch,
    resetForRematch,
    watchRoom,
    watchPlayers
  };
})();
