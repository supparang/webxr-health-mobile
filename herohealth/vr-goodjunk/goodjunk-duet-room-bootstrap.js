(function () {
  'use strict';

  const qs = new URLSearchParams(location.search);

  const ctx = {
    pid: String(qs.get('pid') || 'anon').trim(),
    name: String(qs.get('name') || qs.get('nick') || 'Hero').trim(),
    role: String(qs.get('role') || (qs.get('host') === '1' ? 'host' : 'guest')).trim().toLowerCase(),
    roomId: String(qs.get('roomId') || qs.get('room') || '').trim().toUpperCase(),
    game: 'goodjunk',
    mode: 'duet'
  };

  const DEBUG = qs.get('debug') === '1';

  const FALLBACK_ROOM_PREFIX = 'DU-';
  const LOCAL_KEY = ctx.roomId ? `HHA_GJ_DUET_ROOM__${ctx.roomId}` : 'HHA_GJ_DUET_ROOM__DEFAULT';
  const CHANNEL_KEY = ctx.roomId ? `hha-gj-duet-room-${ctx.roomId}` : 'hha-gj-duet-room-default';

  const bc = ('BroadcastChannel' in window)
    ? new BroadcastChannel(CHANNEL_KEY)
    : null;

  let firebaseDb = null;
  let firebaseReady = false;
  let localListeners = [];
  let beforeUnloadBound = false;

  function dlog() {
    if (!DEBUG) return;
    try { console.log('[GJ-DUET-BOOT]', ...arguments); } catch (_) {}
  }

  function cleanPath(path) {
    return String(path || '')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '');
  }

  function now() {
    return Date.now();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function ensureRoomId(raw) {
    const value = String(raw || '').trim().toUpperCase();
    if (value) return value;
    return `${FALLBACK_ROOM_PREFIX}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  function ensureRole(raw) {
    const value = String(raw || '').trim().toLowerCase();
    return value === 'host' ? 'host' : 'guest';
  }

  function getRoomId() {
    if (!ctx.roomId) ctx.roomId = ensureRoomId('');
    return ctx.roomId;
  }

  function getRole() {
    ctx.role = ensureRole(ctx.role || (qs.get('host') === '1' ? 'host' : 'guest'));
    return ctx.role;
  }

  function isHost() {
    return getRole() === 'host';
  }

  function defaultRoomRootPath() {
    return `/hha-battle/goodjunk/duetRooms/${getRoomId()}`;
  }

  function getRoomRootPath() {
    const explicit = String(qs.get('roomPath') || window.HHA_GJ_DUET_ROOM_PATH || '').trim();
    return cleanPath(explicit || defaultRoomRootPath());
  }

  function getMatchPath(matchId) {
    return cleanPath(`${getRoomRootPath()}/matches/${String(matchId || '').trim()}`);
  }

  function getRunPath() {
    return cleanPath(`${getRoomRootPath()}/currentRun`);
  }

  function getPlayersPath() {
    return cleanPath(`${getRoomRootPath()}/players`);
  }

  function getPlayerPath(pid) {
    return cleanPath(`${getPlayersPath()}/${String(pid || ctx.pid || 'anon').trim()}`);
  }

  function detectFirebaseDb() {
    if (firebaseReady && firebaseDb) return firebaseDb;

    try {
      if (window.HHA_FIREBASE_DB) {
        firebaseDb = window.HHA_FIREBASE_DB;
        firebaseReady = true;
        return firebaseDb;
      }

      if (window.firebase && typeof window.firebase.database === 'function') {
        firebaseDb = window.firebase.database();
        firebaseReady = !!firebaseDb;
        return firebaseDb;
      }
    } catch (_) {}

    firebaseDb = null;
    firebaseReady = false;
    return null;
  }

  function hasFirebase() {
    return !!detectFirebaseDb();
  }

  function dbMode() {
    return hasFirebase() ? 'firebase' : 'local';
  }

  function ref(path) {
    const db = detectFirebaseDb();
    if (!db) throw new Error('firebase db unavailable');
    return db.ref(cleanPath(path));
  }

  function readLocalRoom() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function writeLocalRoom(next) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next || {}));
    } catch (_) {}

    try {
      if (bc) bc.postMessage({ type: 'room:update', value: next || {} });
    } catch (_) {}

    try {
      window.dispatchEvent(new CustomEvent('hha:gjduet-room-local-update', {
        detail: next || {}
      }));
    } catch (_) {}
  }

  function ensureLocalRoomShape() {
    const current = readLocalRoom();
    if (current && typeof current === 'object') return current;

    const initial = {
      roomId: getRoomId(),
      mode: 'duet',
      game: 'goodjunk',
      createdAt: now(),
      updatedAt: now(),
      status: 'lobby',
      activeMatchId: '',
      currentRun: null,
      players: {},
      matches: {}
    };

    writeLocalRoom(initial);
    return initial;
  }

  function mergeLocalRoom(mutator) {
    const current = ensureLocalRoomShape();
    const draft = JSON.parse(JSON.stringify(current));
    const output = mutator(draft) || draft;
    output.updatedAt = now();
    writeLocalRoom(output);
    return output;
  }

  function getRoomSnapshotValue(snap) {
    if (!snap) return null;
    if (typeof snap.val === 'function') return snap.val();
    return snap.value || null;
  }

  async function readRoom() {
    if (hasFirebase()) {
      const snap = await ref(getRoomRootPath()).once('value');
      return getRoomSnapshotValue(snap);
    }
    return ensureLocalRoomShape();
  }

  async function ensureRoom() {
    if (hasFirebase()) {
      const roomRef = ref(getRoomRootPath());
      const snap = await roomRef.once('value');
      const current = getRoomSnapshotValue(snap);

      if (current && typeof current === 'object') {
        return current;
      }

      const initial = {
        roomId: getRoomId(),
        mode: 'duet',
        game: 'goodjunk',
        createdAt: now(),
        updatedAt: now(),
        status: 'lobby',
        activeMatchId: '',
        currentRun: null,
        players: {}
      };

      await roomRef.set(initial);
      return initial;
    }

    return ensureLocalRoomShape();
  }

  function bindBeforeUnloadOnce() {
    if (beforeUnloadBound) return;
    beforeUnloadBound = true;

    window.addEventListener('beforeunload', function () {
      try {
        leaveRoom().catch(() => {});
      } catch (_) {}
    });
  }

  async function setPresence(extra) {
    bindBeforeUnloadOnce();

    const payload = Object.assign({
      pid: ctx.pid,
      name: ctx.name,
      role: getRole(),
      online: true,
      joinedAt: now(),
      lastSeen: now()
    }, extra || {});

    if (hasFirebase()) {
      const playerRef = ref(getPlayerPath(ctx.pid));
      await playerRef.update(payload);

      try {
        playerRef.onDisconnect().update({
          online: false,
          lastSeen: now()
        });
      } catch (_) {}

      return payload;
    }

    mergeLocalRoom((room) => {
      room.players = room.players || {};
      room.players[ctx.pid] = Object.assign({}, room.players[ctx.pid] || {}, payload);
      return room;
    });

    return payload;
  }

  async function leaveRoom() {
    if (hasFirebase()) {
      try {
        await ref(getPlayerPath(ctx.pid)).update({
          online: false,
          lastSeen: now()
        });
      } catch (_) {}
      return;
    }

    mergeLocalRoom((room) => {
      room.players = room.players || {};
      if (room.players[ctx.pid]) {
        room.players[ctx.pid].online = false;
        room.players[ctx.pid].lastSeen = now();
      }
      return room;
    });
  }

  async function readActiveMatchId() {
    if (hasFirebase()) {
      const snap = await ref(`${getRoomRootPath()}/activeMatchId`).once('value');
      return String(getRoomSnapshotValue(snap) || '').trim();
    }

    const room = ensureLocalRoomShape();
    return String(room.activeMatchId || '').trim();
  }

  async function writeActiveMatchId(matchId) {
    const clean = String(matchId || '').trim();

    if (hasFirebase()) {
      await ref(getRoomRootPath()).update({
        activeMatchId: clean,
        updatedAt: now()
      });
      return clean;
    }

    mergeLocalRoom((room) => {
      room.activeMatchId = clean;
      return room;
    });

    return clean;
  }

  function buildMatchId() {
    return 'MT-' + now() + '-' + Math.random().toString(36).slice(2, 7);
  }

  async function ensureMatchId(hostCanCreate) {
    const allowCreate = typeof hostCanCreate === 'boolean' ? hostCanCreate : isHost();

    let active = await readActiveMatchId();
    if (active) return active;

    if (allowCreate) {
      active = buildMatchId();

      if (hasFirebase()) {
        const roomRef = ref(getRoomRootPath());
        const matchRef = ref(getMatchPath(active));

        await roomRef.update({
          activeMatchId: active,
          updatedAt: now(),
          status: 'lobby'
        });

        await matchRef.update({
          matchId: active,
          createdAt: now(),
          updatedAt: now(),
          mode: 'duet',
          game: 'goodjunk',
          roomId: getRoomId(),
          finalSummary: null
        });

        return active;
      }

      mergeLocalRoom((room) => {
        room.activeMatchId = active;
        room.matches = room.matches || {};
        room.matches[active] = Object.assign({}, room.matches[active] || {}, {
          matchId: active,
          createdAt: now(),
          updatedAt: now(),
          mode: 'duet',
          game: 'goodjunk',
          roomId: getRoomId(),
          finalSummary: null
        });
        return room;
      });

      return active;
    }

    for (let i = 0; i < 40; i++) {
      await sleep(250);
      active = await readActiveMatchId();
      if (active) return active;
    }

    const fallback = buildMatchId();
    await writeActiveMatchId(fallback);

    if (!hasFirebase()) {
      mergeLocalRoom((room) => {
        room.matches = room.matches || {};
        room.matches[fallback] = Object.assign({}, room.matches[fallback] || {}, {
          matchId: fallback,
          createdAt: now(),
          updatedAt: now(),
          mode: 'duet',
          game: 'goodjunk',
          roomId: getRoomId(),
          finalSummary: null
        });
        return room;
      });
    } else {
      await ref(getMatchPath(fallback)).update({
        matchId: fallback,
        createdAt: now(),
        updatedAt: now(),
        mode: 'duet',
        game: 'goodjunk',
        roomId: getRoomId(),
        finalSummary: null
      });
    }

    return fallback;
  }

  async function readMatch(matchId) {
    const clean = String(matchId || '').trim();
    if (!clean) return null;

    if (hasFirebase()) {
      const snap = await ref(getMatchPath(clean)).once('value');
      return getRoomSnapshotValue(snap);
    }

    const room = ensureLocalRoomShape();
    return room.matches && room.matches[clean] ? room.matches[clean] : null;
  }

  function countFinishedPlayers(resultMap) {
    if (!resultMap || typeof resultMap !== 'object') return 0;
    return Object.keys(resultMap).filter((k) => resultMap[k]).length;
  }

  function calcTeamGrade(summary) {
    const score = Number(summary.score || 0);
    const miss = Number(summary.miss || 0);
    const good = Number(summary.good || 0);
    const best = Number(summary.streak || 0);

    if (score >= 1800 && miss <= 10 && good >= 110 && best >= 20) return 'S';
    if (score >= 1300 && miss <= 18 && good >= 80) return 'A';
    if (score >= 700 && good >= 40) return 'B';
    return 'C';
  }

  function medalForGrade(grade) {
    if (grade === 'S') return '🏆';
    if (grade === 'A') return '🥇';
    if (grade === 'B') return '🥈';
    return '🥉';
  }

  function titleForGrade(grade) {
    if (grade === 'S') return 'ยอดเยี่ยม!';
    if (grade === 'A') return 'เก่งมาก!';
    if (grade === 'B') return 'ดีมาก!';
    return 'สู้ต่อได้!';
  }

  function noteForGrade(grade) {
    if (grade === 'S') return 'ช่วยกันได้ยอดเยี่ยมมาก ทั้งแม่นและพลาดน้อย';
    if (grade === 'A') return 'ทำงานเป็นทีมได้ดีมาก รอบหน้าลองเก็บ good ให้ต่อเนื่องขึ้นอีก';
    if (grade === 'B') return 'ช่วยกันได้ดี รอบหน้าลองหลบ junk ให้มากขึ้น';
    return 'เริ่มต้นได้ดี รอบหน้าช่วยกันเก็บ good ให้เยอะขึ้น';
  }

  function combineDuetSummary(matchId, playerResults) {
    const list = Object.keys(playerResults || {})
      .map((k) => playerResults[k])
      .filter(Boolean);

    const merged = {
      final: true,
      roomId: getRoomId(),
      matchId: String(matchId || '').trim(),
      mode: 'DUET',
      ts: now(),
      players: list.map((item) => ({
        pid: String(item.pid || '').trim(),
        name: String(item.name || '').trim(),
        score: Number(item.score || 0),
        good: Number(item.good || 0),
        junk: Number(item.junk || 0),
        miss: Number(item.miss || 0),
        streak: Number(item.streak || 0)
      })),
      score: 0,
      good: 0,
      junk: 0,
      miss: 0,
      streak: 0,
      finishedPlayers: list.length
    };

    list.forEach((item) => {
      merged.score += Number(item.score || 0);
      merged.good += Number(item.good || 0);
      merged.junk += Number(item.junk || 0);
      merged.miss += Number(item.miss || 0);
      merged.streak = Math.max(merged.streak, Number(item.streak || 0));
    });

    merged.grade = calcTeamGrade(merged);
    merged.medal = medalForGrade(merged.grade);
    merged.title = titleForGrade(merged.grade);
    merged.note = noteForGrade(merged.grade);

    return merged;
  }

  async function publishPlayerResult(matchId, payload) {
    const cleanMatchId = String(matchId || '').trim();
    if (!cleanMatchId) throw new Error('publishPlayerResult requires matchId');

    const result = Object.assign({
      pid: ctx.pid,
      name: ctx.name,
      submittedAt: now()
    }, payload || {});

    if (hasFirebase()) {
      await ref(`${getMatchPath(cleanMatchId)}/playerResults/${ctx.pid}`).set(result);
      await ref(getMatchPath(cleanMatchId)).update({ updatedAt: now() });
    } else {
      mergeLocalRoom((room) => {
        room.matches = room.matches || {};
        room.matches[cleanMatchId] = room.matches[cleanMatchId] || {
          matchId: cleanMatchId,
          createdAt: now(),
          updatedAt: now()
        };
        room.matches[cleanMatchId].playerResults = room.matches[cleanMatchId].playerResults || {};
        room.matches[cleanMatchId].playerResults[ctx.pid] = result;
        room.matches[cleanMatchId].updatedAt = now();
        return room;
      });
    }

    return result;
  }

  async function readPlayerResults(matchId) {
    const cleanMatchId = String(matchId || '').trim();
    if (!cleanMatchId) return {};

    if (hasFirebase()) {
      const snap = await ref(`${getMatchPath(cleanMatchId)}/playerResults`).once('value');
      return getRoomSnapshotValue(snap) || {};
    }

    const match = await readMatch(cleanMatchId);
    return (match && match.playerResults) ? match.playerResults : {};
  }

  async function readFinalSummary(matchId) {
    const cleanMatchId = String(matchId || '').trim();
    if (!cleanMatchId) return null;

    if (hasFirebase()) {
      const snap = await ref(`${getMatchPath(cleanMatchId)}/finalSummary`).once('value');
      return getRoomSnapshotValue(snap);
    }

    const match = await readMatch(cleanMatchId);
    return match && match.finalSummary ? match.finalSummary : null;
  }

  async function publishFinalSummary(matchId, summary) {
    const cleanMatchId = String(matchId || '').trim();
    if (!cleanMatchId) throw new Error('publishFinalSummary requires matchId');

    const payload = Object.assign({}, summary || {}, {
      final: true,
      roomId: getRoomId(),
      matchId: cleanMatchId,
      publishedAt: now()
    });

    if (hasFirebase()) {
      const finalRef = ref(`${getMatchPath(cleanMatchId)}/finalSummary`);
      const txn = await finalRef.transaction((current) => current || payload);
      const committed = !!(txn && txn.committed);
      const snapshot = txn && txn.snapshot ? txn.snapshot.val() : payload;
      await ref(getMatchPath(cleanMatchId)).update({
        endedAt: now(),
        updatedAt: now()
      });
      return committed ? payload : (snapshot || payload);
    }

    let written = payload;
    mergeLocalRoom((room) => {
      room.matches = room.matches || {};
      room.matches[cleanMatchId] = room.matches[cleanMatchId] || {
        matchId: cleanMatchId,
        createdAt: now(),
        updatedAt: now()
      };
      if (!room.matches[cleanMatchId].finalSummary) {
        room.matches[cleanMatchId].finalSummary = payload;
      }
      room.matches[cleanMatchId].endedAt = now();
      room.matches[cleanMatchId].updatedAt = now();
      written = room.matches[cleanMatchId].finalSummary;
      return room;
    });

    return written;
  }

  async function finalizeMatchFromRoomResults(matchId, opts) {
    const cleanMatchId = String(matchId || '').trim();
    if (!cleanMatchId) throw new Error('finalizeMatchFromRoomResults requires matchId');

    const options = Object.assign({
      expectedPlayers: 2,
      force: false,
      reason: 'finished'
    }, opts || {});

    const existing = await readFinalSummary(cleanMatchId);
    if (existing && existing.final) return existing;

    const playerResults = await readPlayerResults(cleanMatchId);
    const count = countFinishedPlayers(playerResults);

    if (!options.force && count < options.expectedPlayers) {
      return null;
    }

    const summary = combineDuetSummary(cleanMatchId, playerResults);
    summary.reason = options.reason || 'finished';

    return await publishFinalSummary(cleanMatchId, summary);
  }

  async function waitForAllPlayerResults(matchId, opts) {
    const cleanMatchId = String(matchId || '').trim();
    const options = Object.assign({
      expectedPlayers: 2,
      timeoutMs: 6000,
      intervalMs: 250
    }, opts || {});

    const startedAt = now();

    while ((now() - startedAt) < options.timeoutMs) {
      const results = await readPlayerResults(cleanMatchId);
      if (countFinishedPlayers(results) >= options.expectedPlayers) {
        return results;
      }
      await sleep(options.intervalMs);
    }

    return await readPlayerResults(cleanMatchId);
  }

  async function subscribeFinalSummary(matchId, cb) {
    const cleanMatchId = String(matchId || '').trim();
    if (!cleanMatchId || typeof cb !== 'function') return function(){};

    if (hasFirebase()) {
      const finalRef = ref(`${getMatchPath(cleanMatchId)}/finalSummary`);
      const handler = (snap) => {
        const value = getRoomSnapshotValue(snap);
        if (value && value.final) cb(value);
      };
      finalRef.on('value', handler);
      return function unsubscribe() {
        try { finalRef.off('value', handler); } catch (_) {}
      };
    }

    const notify = () => {
      const room = ensureLocalRoomShape();
      const summary =
        room.matches &&
        room.matches[cleanMatchId] &&
        room.matches[cleanMatchId].finalSummary
          ? room.matches[cleanMatchId].finalSummary
          : null;
      if (summary && summary.final) cb(summary);
    };

    const winHandler = () => notify();
    window.addEventListener('hha:gjduet-room-local-update', winHandler);

    if (bc) {
      bc.addEventListener('message', notify);
    }

    notify();

    return function unsubscribe() {
      try { window.removeEventListener('hha:gjduet-room-local-update', winHandler); } catch (_) {}
      try { if (bc) bc.removeEventListener('message', notify); } catch (_) {}
    };
  }

  async function subscribeRoomRun(cb) {
    if (typeof cb !== 'function') return function(){};

    if (hasFirebase()) {
      const runRef = ref(getRunPath());
      const handler = (snap) => {
        cb(getRoomSnapshotValue(snap) || null);
      };
      runRef.on('value', handler);
      return function unsubscribe() {
        try { runRef.off('value', handler); } catch (_) {}
      };
    }

    const notify = () => {
      const room = ensureLocalRoomShape();
      cb(room.currentRun || null);
    };

    const winHandler = () => notify();
    window.addEventListener('hha:gjduet-room-local-update', winHandler);

    if (bc) {
      bc.addEventListener('message', notify);
    }

    notify();

    return function unsubscribe() {
      try { window.removeEventListener('hha:gjduet-room-local-update', winHandler); } catch (_) {}
      try { if (bc) bc.removeEventListener('message', notify); } catch (_) {}
    };
  }

  async function startRoomRun(matchId, runtimeUrl) {
    const cleanMatchId = String(matchId || '').trim();
    const url = String(runtimeUrl || '').trim();
    if (!cleanMatchId) throw new Error('startRoomRun requires matchId');
    if (!url) throw new Error('startRoomRun requires runtimeUrl');

    const payload = {
      state: 'running',
      roomId: getRoomId(),
      matchId: cleanMatchId,
      runtimeUrl: url,
      startedAt: now(),
      startedBy: {
        pid: ctx.pid,
        name: ctx.name,
        role: getRole()
      }
    };

    if (hasFirebase()) {
      await ref(getRoomRootPath()).update({
        status: 'running',
        activeMatchId: cleanMatchId,
        updatedAt: now()
      });
      await ref(getRunPath()).set(payload);
      return payload;
    }

    mergeLocalRoom((room) => {
      room.status = 'running';
      room.activeMatchId = cleanMatchId;
      room.currentRun = payload;
      return room;
    });

    return payload;
  }

  async function resetRoomRun() {
    if (hasFirebase()) {
      await ref(getRoomRootPath()).update({
        status: 'lobby',
        updatedAt: now()
      });
      await ref(getRunPath()).remove();
      return;
    }

    mergeLocalRoom((room) => {
      room.status = 'lobby';
      room.currentRun = null;
      return room;
    });
  }

  async function listPlayers() {
    if (hasFirebase()) {
      const snap = await ref(getPlayersPath()).once('value');
      const value = getRoomSnapshotValue(snap) || {};
      return Object.keys(value).map((k) => value[k]).filter(Boolean);
    }

    const room = ensureLocalRoomShape();
    const players = room.players || {};
    return Object.keys(players).map((k) => players[k]).filter(Boolean);
  }

  async function markLobbyReady(flag) {
    const ready = !!flag;
    if (hasFirebase()) {
      await ref(getPlayerPath(ctx.pid)).update({
        ready: ready,
        lastSeen: now()
      });
      return;
    }

    mergeLocalRoom((room) => {
      room.players = room.players || {};
      room.players[ctx.pid] = Object.assign({}, room.players[ctx.pid] || {}, {
        pid: ctx.pid,
        name: ctx.name,
        role: getRole(),
        ready: ready,
        online: true,
        lastSeen: now()
      });
      return room;
    });
  }

  window.HHA_DUET_ROOM_BOOT = {
    ctx,
    getDbMode: dbMode,
    hasFirebase,
    getRoomId,
    getRole,
    isHost,
    getRoomRootPath,
    ensureRoom,
    ensureMatchId,
    readMatch,
    readRoom,
    setPresence,
    leaveRoom,
    listPlayers,
    markLobbyReady,
    readFinalSummary,
    readPlayerResults,
    publishPlayerResult,
    publishFinalSummary,
    finalizeMatchFromRoomResults,
    waitForAllPlayerResults,
    subscribeFinalSummary,
    subscribeRoomRun,
    startRoomRun,
    resetRoomRun,
    combineDuetSummary
  };

  dlog('boot ready', {
    roomId: getRoomId(),
    role: getRole(),
    dbMode: dbMode(),
    roomRoot: getRoomRootPath()
  });
})();