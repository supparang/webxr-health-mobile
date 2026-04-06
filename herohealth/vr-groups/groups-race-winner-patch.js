(() => {
  'use strict';

  const W = window;
  const D = document;
  const qs = new URLSearchParams(location.search);

  const isRace = qs.get('mode') === 'race' || qs.get('race') === '1';
  const roomCode = cleanRoom(qs.get('roomCode') || '');
  if (!isRace || !roomCode) return;

  const ROOT_PATH = 'hha-battle/groups/raceRooms';
  const ACTIVE_TTL_MS = 15000;

  const now = () => Date.now();
  const num = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  const state = {
    db: null,
    roomRef: null,
    room: null,
    roomListener: null,
    playerId: getPlayerId(),
    isHost: qs.get('isHost') === '1',
    summarySeen: false,
    writing: false,
    lastSignature: '',
    playerName: cleanText(
      qs.get('name') ||
      qs.get('nickName') ||
      qs.get('nick') ||
      'Player',
      24
    )
  };

  boot();

  async function boot() {
    try {
      const fb = await ensureFirebaseCtx();
      state.db = fb.db;
      state.roomRef = state.db.ref(`${ROOT_PATH}/${roomCode}`);
      attachRoom();
      observeSummary();
      setInterval(tickFinalize, 900);
    } catch (err) {
      console.warn('[Groups Race Winner Patch] boot failed:', safeErr(err));
    }
  }

  async function ensureFirebaseCtx() {
    if (W.HHA_FIREBASE && W.HHA_FIREBASE.ready && W.HHA_FIREBASE.db) {
      return W.HHA_FIREBASE;
    }

    if (W.HHA_FIREBASE_READY && typeof W.HHA_FIREBASE_READY.then === 'function') {
      const ctx = await W.HHA_FIREBASE_READY;
      if (ctx && ctx.db) return ctx;
    }

    if (!W.firebase) throw new Error('Firebase SDK not loaded');

    const cfg =
      W.HHA_FIREBASE_CONFIG ||
      W.HEROHEALTH_FIREBASE_CONFIG ||
      W.FIREBASE_CONFIG ||
      W.__firebaseConfig;

    if (!cfg || !cfg.apiKey || !cfg.projectId || !cfg.databaseURL) {
      throw new Error('Missing Firebase config');
    }

    let app;
    try {
      app = (firebase.apps && firebase.apps.length)
        ? firebase.app()
        : firebase.initializeApp(cfg);
    } catch (err) {
      if (firebase.apps && firebase.apps.length) app = firebase.app();
      else throw err;
    }

    const auth = firebase.auth ? firebase.auth() : null;
    const db = firebase.database ? firebase.database() : null;

    if (auth && !auth.currentUser && auth.signInAnonymously) {
      try { await auth.signInAnonymously(); } catch (_) {}
    }

    const ctx = { app, auth, db, config: cfg, ready: true };
    W.HHA_FIREBASE = ctx;
    return ctx;
  }

  function attachRoom() {
    if (!state.roomRef) return;

    state.roomListener = (snap) => {
      state.room = snap.val() || null;
    };

    state.roomRef.on('value', state.roomListener);
  }

  function observeSummary() {
    const mo = new MutationObserver(() => {
      if (findVisibleSummary()) state.summarySeen = true;
    });

    mo.observe(D.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    if (findVisibleSummary()) state.summarySeen = true;
  }

  async function tickFinalize() {
    const room = state.room;
    if (!room || !state.roomRef || state.writing) return;

    const players = getPlayers(room);
    if (players.length < 2) return;

    const endedEnough =
      room.status === 'ended' ||
      state.summarySeen ||
      players.every((p) => p.finished || !p.active);

    if (!endedEnough) return;

    const standings = players.sort(comparePlayers).map((p, idx) => ({
      place: idx + 1,
      playerId: p.playerId,
      name: p.name,
      score: p.score,
      accuracy: p.accuracy,
      miss: p.miss,
      streak: p.streak,
      finishedAt: p.finishedAt,
      active: p.active,
      isHost: p.isHost
    }));

    if (!standings.length) return;

    const winner = standings[0];
    const signature = JSON.stringify({
      winner: [winner.playerId, winner.score, winner.accuracy, winner.miss, winner.streak],
      top3: standings.slice(0, 3).map((p) => [p.playerId, p.score, p.accuracy, p.miss, p.streak]),
      status: room.status || ''
    });

    if (signature === state.lastSignature) return;
    state.lastSignature = signature;

    const mayWrite =
      state.isHost ||
      String(room.ownerPlayerId || '') === String(state.playerId) ||
      !room.raceLastWinner ||
      !room.raceLastEndedAt;

    if (!mayWrite) return;

    state.writing = true;
    try {
      const endedAt = now();
      const update = {
        raceLastEndedAt: endedAt,
        raceLastWinner: {
          playerId: winner.playerId,
          name: winner.name,
          score: winner.score,
          accuracy: winner.accuracy,
          miss: winner.miss,
          streak: winner.streak,
          place: 1,
          roomCode,
          updatedAt: endedAt
        },
        raceLastStandings: standings.slice(0, 8),
        updatedAt: endedAt
      };

      if (room.status !== 'ended') {
        update.status = 'ended';
        update.endedAt = endedAt;
      }

      await state.roomRef.update(update);
    } catch (err) {
      console.warn('[Groups Race Winner Patch] finalize failed:', safeErr(err));
    } finally {
      state.writing = false;
    }
  }

  function findVisibleSummary() {
    const candidates = D.querySelectorAll('.summary, .summary-card, .result-overlay, .end-overlay, .final-summary, [data-summary], [data-role="summary"]');
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width > 120 && r.height > 80 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0') {
        return el;
      }
    }
    return null;
  }

  function getPlayers(room) {
    const map = room && room.players ? room.players : {};
    const t = now();

    return Object.keys(map).map((key) => {
      const p = map[key] || {};
      const live = p.live || {};
      const result = p.result || {};
      const lastSeen = num(p.lastSeen, 0);
      const active = p.presence !== 'left' && (t - lastSeen) <= ACTIVE_TTL_MS;

      return {
        playerId: String(p.playerId || key),
        name: cleanText(p.name || 'Player', 24),
        isHost: !!p.isHost || key === room.ownerPlayerId,
        active,
        finished: p.presence === 'finished' || !!p.finishedAt || room.status === 'ended',
        finishedAt: num(p.finishedAt, 0),
        score: num(result.score, num(live.score, 0)),
        accuracy: num(result.accuracy, num(live.accuracy, 0)),
        miss: num(result.miss, num(live.miss, 0)),
        streak: num(result.streak, num(live.streak, 0))
      };
    });
  }

  function comparePlayers(a, b) {
    if (num(b.score) !== num(a.score)) return num(b.score) - num(a.score);
    if (num(b.accuracy) !== num(a.accuracy)) return num(b.accuracy) - num(a.accuracy);
    if (num(a.miss) !== num(b.miss)) return num(a.miss) - num(b.miss);
    if (num(b.streak) !== num(a.streak)) return num(b.streak) - num(a.streak);
    return num(a.finishedAt, 0) - num(b.finishedAt, 0);
  }

  function getPlayerId() {
    try {
      const saved = localStorage.getItem('HHA_GROUPS_PLAYER_ID');
      if (saved) return saved;
    } catch (_) {}
    return cleanText(qs.get('playerId') || `grp_${Math.random().toString(36).slice(2, 10)}`, 40).toUpperCase();
  }

  function cleanRoom(v) {
    return String(v == null ? '' : v)
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16);
  }

  function cleanText(v, max = 24) {
    return String(v == null ? '' : v)
      .replace(/[^\wก-๙ _-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  function safeErr(err) {
    return err && err.message ? err.message : String(err || 'Unknown error');
  }
})();
