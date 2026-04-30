// === /herohealth/vr-goodjunk/goodjunk-duet-room-bootstrap.js ===
// GoodJunk Duet Room Bootstrap
// PATCH v20260430-gjduet-v4
// ✅ fix Firebase invalid path "" from leading slash
// ✅ sanitize Firebase paths and keys
// ✅ host migration
// ✅ players presence
// ✅ currentRun sync
// ✅ finalSummary sync
// ✅ local fallback for same-browser testing

(function () {
  'use strict';

  const qs = new URLSearchParams(location.search);

  const DEBUG = qs.get('debug') === '1';
  const MAX_ROOM_PLAYERS = 2;
  const FALLBACK_ROOM_PREFIX = 'DU-';

  const ctx = {
    pid: safeKey(String(qs.get('pid') || 'anon').trim() || 'anon'),
    name: String(qs.get('name') || qs.get('nick') || 'Hero').trim() || 'Hero',
    role: String(qs.get('role') || (qs.get('host') === '1' ? 'host' : 'guest')).trim().toLowerCase(),
    roomId: normalizeRoomId(String(qs.get('roomId') || qs.get('room') || '').trim()),
    game: 'goodjunk',
    mode: 'duet'
  };

  const LOCAL_KEY = ctx.roomId
    ? `HHA_GJ_DUET_ROOM__${ctx.roomId}`
    : 'HHA_GJ_DUET_ROOM__DEFAULT';

  const CHANNEL_KEY = ctx.roomId
    ? `hha-gj-duet-room-${ctx.roomId}`
    : 'hha-gj-duet-room-default';

  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel(CHANNEL_KEY) : null;

  let firebaseDb = null;
  let beforeUnloadBound = false;

  function dlog() {
    if (!DEBUG) return;
    try { console.log('[GJ-DUET-BOOT]', ...arguments); } catch (_) {}
  }

  function now() {
    return Date.now();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function safeKey(raw) {
    return String(raw || '')
      .trim()
      .replace(/[.#$/\[\]]/g, '_')
      .slice(0, 96) || 'anon';
  }

  function normalizeRoomId(raw) {
    let v = String(raw || '').trim().toUpperCase();
    v = v.replace(/\s+/g, '');
    v = v.replace(/[^A-Z0-9-]/g, '');

    if (!v || v === 'DU-XXXXXX') return '';

    if (!v.startsWith('DU-')) {
      v = 'DU-' + v.replace(/^DU/, '').replace(/^-/, '');
    }

    return v.slice(0, 9);
  }

  function cleanPath(path) {
    return String(path || '')
      .trim()
      .replace(/\/+/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
  }

  function ensureRoomId(raw) {
    const value = normalizeRoomId(raw);
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
    return `hha-battle/goodjunk/duetRooms/${getRoomId()}`;
  }

  function getRoomRootPath() {
    const explicit = String(qs.get('roomPath') || window.HHA_GJ_DUET_ROOM_PATH || '').trim();
    return cleanPath(explicit || defaultRoomRootPath());
  }

  function getMatchPath(matchId) {
    return cleanPath(`${getRoomRootPath()}/matches/${safeKey(matchId)}`);
  }

  function getRunPath() {
    return cleanPath(`${getRoomRootPath()}/currentRun`);
  }

  function getPlayersPath() {
    return cleanPath(`${getRoomRootPath()}/players`);
  }

  function getPlayerPath(pid) {
    return cleanPath(`${getPlayersPath()}/${safeKey(pid || ctx.pid || 'anon')}`);
  }

  function getRematchPath() {
    return cleanPath(`${getRoomRootPath()}/rematchSignal`);
  }

  function getActionLockPath() {
    return cleanPath(`${getRoomRootPath()}/actionLock`);
  }

  function getMatchEventsPath(matchId) {
    return cleanPath(`${getMatchPath(matchId)}/events`);
  }

  function buildRunToken(matchId) {
    return 'RUN-' + String(matchId || '').trim() + '-' + now();
  }

  function buildRematchToken(matchId) {
    return 'REMATCH-' + String(matchId || '').trim() + '-' + now();
  }

  function isRunFresh(runState, maxAgeMs) {
    const ageLimit = Number(maxAgeMs || 15000);
    if (!runState || typeof runState !== 'object') return false;

    const startedAt = Number(runState.startedAt || 0);
    if (!startedAt) return false;

    return (now() - startedAt) <= ageLimit;
  }

  function getFirebaseDb() {
    if (firebaseDb) return firebaseDb;

    try {
      if (window.HHA_FIREBASE && window.HHA_FIREBASE.db) {
        firebaseDb = window.HHA_FIREBASE.db;
        return firebaseDb;
      }

      if (window.HHA_FIREBASE_DB) {
        firebaseDb = window.HHA_FIREBASE_DB;
        return firebaseDb;
      }

      if (window.firebase && typeof window.firebase.database === 'function') {
        firebaseDb = window.firebase.database();
        return firebaseDb;
      }
    } catch (_) {}

    firebaseDb = null;
    return null;
  }

  function hasFirebase() {
    return !!getFirebaseDb();
  }

  function getDbMode() {
    return hasFirebase() ? 'firebase' : 'local';
  }

  function dbRef(path) {
    const db = getFirebaseDb();
    if (!db) throw new Error('firebase db unavailable');

    const clean = cleanPath(path);
    return clean ? db.ref(clean) : db.ref();
  }

  function dbOnce(path) {
    return new Promise((resolve, reject) => {
      try {
        dbRef(path).once(
          'value',
          (snap) => {
            try {
              resolve(snap && typeof snap.val === 'function' ? snap.val() : null);
            } catch (err) {
              reject(err);
            }
          },
          reject
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  function dbSet(path, value) {
    return new Promise((resolve, reject) => {
      try {
        dbRef(path).set(value, (err) => err ? reject(err) : resolve(true));
      } catch (err) {
        reject(err);
      }
    });
  }

  function dbUpdate(path, value) {
    return new Promise((resolve, reject) => {
      try {
        dbRef(path).update(value, (err) => err ? reject(err) : resolve(true));
      } catch (err) {
        reject(err);
      }
    });
  }

  function dbRemove(path) {
    return new Promise((resolve, reject) => {
      try {
        dbRef(path).remove((err) => err ? reject(err) : resolve(true));
      } catch (err) {
        reject(err);
      }
    });
  }

  function dbTransaction(path, updateFn) {
    return new Promise((resolve, reject) => {
      try {
        dbRef(path).transaction(
          updateFn,
          function (err, committed, snap) {
            if (err) {
              reject(err);
              return;
            }

            resolve({
              committed: !!committed,
              value: snap && typeof snap.val === 'function' ? snap.val() : null
            });
          },
          false
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  async function dbPushSet(path, value) {
    const ref = dbRef(path).push();

    await new Promise((resolve, reject) => {
      ref.set(value, (err) => err ? reject(err) : resolve(true));
    });

    return value;
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
      rematchSignal: null,
      actionLock: null,
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

  async function readRoom() {
    if (hasFirebase()) {
      return await dbOnce(getRoomRootPath());
    }

    return ensureLocalRoomShape();
  }

  async function ensureRoom() {
    if (hasFirebase()) {
      const current = await dbOnce(getRoomRootPath());

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
        rematchSignal: null,
        actionLock: null,
        players: {}
      };

      await dbSet(getRoomRootPath(), initial);
      return initial;
    }

    return ensureLocalRoomShape();
  }

  function bindBeforeUnloadOnce() {
    if (beforeUnloadBound) return;
    beforeUnloadBound = true;

    window.addEventListener('beforeunload', function () {
      try { leaveRoom().catch(() => {}); } catch (_) {}
    });
  }

  function normalizePlayerShape(player, pidKey) {
    const p = player && typeof player === 'object' ? player : {};
    const pid = safeKey(p.pid || pidKey || '');

    return {
      pid,
      name: String(p.name || p.pid || pidKey || 'Player').trim() || 'Player',
      role: String(p.role || 'guest').trim().toLowerCase() === 'host' ? 'host' : 'guest',
      online: p.online !== false,
      ready: !!p.ready,
      inRuntime: !!p.inRuntime,
      joinedAt: Number(p.joinedAt || 0),
      lastSeen: Number(p.lastSeen || 0),
      runtimeAt: Number(p.runtimeAt || 0)
    };
  }

  function sortPlayersForElection(players) {
    return (Array.isArray(players) ? players.slice() : []).sort((a, b) => {
      const aj = Number(a.joinedAt || 0) || Number(a.lastSeen || 0) || 0;
      const bj = Number(b.joinedAt || 0) || Number(b.lastSeen || 0) || 0;

      if (aj !== bj) return aj - bj;

      return String(a.pid || '').localeCompare(String(b.pid || ''));
    });
  }

  function chooseEffectiveHost(players) {
    const online = sortPlayersForElection(
      (Array.isArray(players) ? players : [])
        .filter((p) => p && String(p.pid || '').trim() && p.online !== false)
    );

    if (!online.length) return '';

    const currentHost = online.find((p) => String(p.role || '').toLowerCase() === 'host');
    if (currentHost) return String(currentHost.pid || '').trim();

    return String(online[0].pid || '').trim();
  }

  async function listPlayers() {
    if (hasFirebase()) {
      const value = await dbOnce(getPlayersPath()) || {};

      return Object.keys(value)
        .map((k) => normalizePlayerShape(value[k], k))
        .filter((p) => p && String(p.pid || '').trim());
    }

    const room = ensureLocalRoomShape();
    const players = room.players || {};

    return Object.keys(players)
      .map((k) => normalizePlayerShape(players[k], k))
      .filter((p) => p && String(p.pid || '').trim());
  }

  async function validateRoomJoin(pid) {
    const cleanPid = safeKey(pid || ctx.pid || '');
    const players = await listPlayers();

    const alreadyKnown = players.some((p) => String(p.pid || '').trim() === cleanPid);
    const onlineCount = players.filter((p) => p && p.online !== false).length;

    if (!alreadyKnown && onlineCount >= MAX_ROOM_PLAYERS) {
      return {
        ok: false,
        reason: 'room_full',
        onlineCount,
        maxPlayers: MAX_ROOM_PLAYERS
      };
    }

    return {
      ok: true,
      reason: '',
      onlineCount,
      maxPlayers: MAX_ROOM_PLAYERS
    };
  }

  async function setPresence(extra) {
    bindBeforeUnloadOnce();

    const cleanPid = safeKey(ctx.pid || 'anon');
    ctx.pid = cleanPid;

    const roomCheck = await validateRoomJoin(cleanPid);

    if (!roomCheck.ok) {
      const err = new Error('room_full');
      err.code = 'room_full';
      err.detail = roomCheck;
      throw err;
    }

    const payload = Object.assign({
      pid: cleanPid,
      name: ctx.name,
      role: getRole(),
      online: true,
      joinedAt: now(),
      lastSeen: now()
    }, extra || {});

    if (hasFirebase()) {
      await dbUpdate(getPlayerPath(cleanPid), payload);

      try {
        dbRef(getPlayerPath(cleanPid)).onDisconnect().update({
          online: false,
          inRuntime: false,
          lastSeen: now()
        });
      } catch (_) {}

      return payload;
    }

    mergeLocalRoom((room) => {
      room.players = room.players || {};
      room.players[cleanPid] = Object.assign({}, room.players[cleanPid] || {}, payload);
      return room;
    });

    return payload;
  }

  async function leaveRoom() {
    const cleanPid = safeKey(ctx.pid || 'anon');

    if (hasFirebase()) {
      try {
        await dbUpdate(getPlayerPath(cleanPid), {
          online: false,
          inRuntime: false,
          lastSeen: now()
        });
      } catch (_) {}
      return;
    }

    mergeLocalRoom((room) => {
      room.players = room.players || {};

      if (room.players[cleanPid]) {
        room.players[cleanPid].online = false;
        room.players[cleanPid].inRuntime = false;
        room.players[cleanPid].lastSeen = now();
      }

      return room;
    });
  }

  async function markLobbyReady(flag) {
    return await setPresence({
      ready: !!flag,
      inRuntime: false,
      lastSeen: now()
    });
  }

  async function subscribePlayers(cb) {
    if (typeof cb !== 'function') return function(){};

    if (hasFirebase()) {
      const playersRef = dbRef(getPlayersPath());

      const handler = (snap) => {
        const value = snap && typeof snap.val === 'function' ? (snap.val() || {}) : {};

        const players = Object.keys(value)
          .map((k) => normalizePlayerShape(value[k], k))
          .filter((p) => p && String(p.pid || '').trim());

        cb(players);
      };

      playersRef.on('value', handler);

      return function unsubscribe() {
        try { playersRef.off('value', handler); } catch (_) {}
      };
    }

    const notify = async () => {
      const players = await listPlayers();
      cb(players);
    };

    const winHandler = () => { notify().catch(() => {}); };
    window.addEventListener('hha:gjduet-room-local-update', winHandler);

    let bcHandler = null;

    if (bc) {
      bcHandler = () => { notify().catch(() => {}); };
      bc.addEventListener('message', bcHandler);
    }

    notify().catch(() => {});

    return function unsubscribe() {
      try { window.removeEventListener('hha:gjduet-room-local-update', winHandler); } catch (_) {}
      try { if (bc && bcHandler) bc.removeEventListener('message', bcHandler); } catch (_) {}
    };
  }

  async function maybePromoteHost() {
    const players = await listPlayers();

    const validPlayers = players
      .filter((p) => p && String(p.pid || '').trim())
      .map((p) => Object.assign({}, p, {
        pid: safeKey(p.pid)
      }));

    const effectiveHostPid = chooseEffectiveHost(validPlayers);
    if (!effectiveHostPid) return '';

    const normalized = validPlayers.map((p) => Object.assign({}, p, {
      role: String(p.pid || '') === effectiveHostPid ? 'host' : 'guest'
    }));

    if (hasFirebase()) {
      for (const p of normalized) {
        const pid = safeKey(p.pid);
        if (!pid) continue;

        await dbUpdate(getPlayerPath(pid), {
          role: p.role,
          lastSeen: now()
        });
      }

      return effectiveHostPid;
    }

    mergeLocalRoom((room) => {
      room.players = room.players || {};

      normalized.forEach((p) => {
        const pid = safeKey(p.pid);
        if (!pid) return;

        room.players[pid] = Object.assign({}, room.players[pid] || {}, p, {
          role: p.role,
          lastSeen: now()
        });
      });

      return room;
    });

    return effectiveHostPid;
  }

  async function getEffectiveHostPid() {
    return await maybePromoteHost();
  }

  async function isEffectiveHost() {
    const hostPid = await getEffectiveHostPid();
    return String(hostPid || '').trim() === String(ctx.pid || '').trim();
  }

  async function readActiveMatchId() {
    if (hasFirebase()) {
      return String(await dbOnce(`${getRoomRootPath()}/activeMatchId`) || '').trim();
    }

    const room = ensureLocalRoomShape();
    return String(room.activeMatchId || '').trim();
  }

  async function writeActiveMatchId(matchId) {
    const clean = String(matchId || '').trim();

    if (hasFirebase()) {
      await dbUpdate(getRoomRootPath(), {
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
    const allowCreate = typeof hostCanCreate === 'boolean'
      ? hostCanCreate
      : (await isEffectiveHost());

    let active = await readActiveMatchId();

    if (active) return active;

    if (allowCreate) {
      active = buildMatchId();

      if (hasFirebase()) {
        await dbUpdate(getRoomRootPath(), {
          activeMatchId: active,
          updatedAt: now(),
          status: 'lobby'
        });

        await dbUpdate(getMatchPath(active), {
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

    active = buildMatchId();
    await writeActiveMatchId(active);

    if (hasFirebase()) {
      await dbUpdate(getMatchPath(active), {
        matchId: active,
        createdAt: now(),
        updatedAt: now(),
        mode: 'duet',
        game: 'goodjunk',
        roomId: getRoomId(),
        finalSummary: null
      });
    } else {
      mergeLocalRoom((room) => {
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
    }

    return active;
  }

  async function readMatch(matchId) {
    const cleanMatchId = String(matchId || '').trim();
    if (!cleanMatchId) return null;

    if (hasFirebase()) {
      return await dbOnce(getMatchPath(cleanMatchId));
    }

    const room = ensureLocalRoomShape();
    return room.matches && room.matches[cleanMatchId]
      ? room.matches[cleanMatchId]
      : null;
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

  function getPartialSummaryNote(finishedPlayers, expectedPlayers) {
    const done = Number(finishedPlayers || 0);
    const expected = Number(expectedPlayers || 2);

    if (done >= expected) return '';
    if (done <= 0) return 'รอบนี้ยังไม่มีข้อมูลผู้เล่นพอสำหรับสรุปทีม';

    return 'อีกฝั่งส่งผลไม่ทัน ระบบจึงสรุปจากข้อมูลที่มาถึงก่อนเพื่อไม่ให้เกมค้าง';
  }

  function combineDuetSummary(matchId, playerResults, meta) {
    const metaInfo = Object.assign({
      expectedPlayers: 2,
      finishedPlayers: 0,
      partial: false
    }, meta || {});

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
        streak: Number(item.streak || item.bestStreak || 0),
        role: String(item.role || 'guest').trim().toLowerCase()
      })),
      score: 0,
      good: 0,
      junk: 0,
      miss: 0,
      streak: 0,
      expectedPlayers: Number(metaInfo.expectedPlayers || 2),
      finishedPlayers: Number(metaInfo.finishedPlayers || list.length),
      partial: !!metaInfo.partial,
      reason: String(metaInfo.reason || '')
    };

    list.forEach((item) => {
      merged.score += Number(item.score || 0);
      merged.good += Number(item.good || 0);
      merged.junk += Number(item.junk || 0);
      merged.miss += Number(item.miss || 0);
      merged.streak = Math.max(merged.streak, Number(item.streak || item.bestStreak || 0));
    });

    merged.grade = calcTeamGrade(merged);
    merged.medal = medalForGrade(merged.grade);
    merged.title = titleForGrade(merged.grade);
    merged.note = merged.partial
      ? getPartialSummaryNote(merged.finishedPlayers, merged.expectedPlayers)
      : noteForGrade(merged.grade);

    return merged;
  }

  async function readPlayerResults(matchId) {
    const cleanMatchId = String(matchId || '').trim();
    if (!cleanMatchId) return {};

    if (hasFirebase()) {
      return await dbOnce(`${getMatchPath(cleanMatchId)}/playerResults`) || {};
    }

    const match = await readMatch(cleanMatchId);
    return (match && match.playerResults) ? match.playerResults : {};
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
      await dbSet(`${getMatchPath(cleanMatchId)}/playerResults/${safeKey(ctx.pid)}`, result);
      await dbUpdate(getMatchPath(cleanMatchId), { updatedAt: now() });
    } else {
      mergeLocalRoom((room) => {
        room.matches = room.matches || {};

        room.matches[cleanMatchId] = room.matches[cleanMatchId] || {
          matchId: cleanMatchId,
          createdAt: now(),
          updatedAt: now()
        };

        room.matches[cleanMatchId].playerResults = room.matches[cleanMatchId].playerResults || {};
        room.matches[cleanMatchId].playerResults[safeKey(ctx.pid)] = result;
        room.matches[cleanMatchId].updatedAt = now();

        return room;
      });
    }

    return result;
  }

  async function readFinalSummary(matchId) {
    const cleanMatchId = String(matchId || '').trim();
    if (!cleanMatchId) return null;

    if (hasFirebase()) {
      return await dbOnce(`${getMatchPath(cleanMatchId)}/finalSummary`);
    }

    const match = await readMatch(cleanMatchId);
    return match && match.finalSummary ? match.finalSummary : null;
  }

  async function appendMatchEvent(matchId, type, detail) {
    const cleanMatchId = String(matchId || '').trim();
    if (!cleanMatchId) return null;

    const payload = {
      ts: now(),
      type: String(type || 'event').trim(),
      detail: detail || {},
      by: {
        pid: ctx.pid,
        name: ctx.name,
        role: getRole()
      }
    };

    if (hasFirebase()) {
      await dbPushSet(getMatchEventsPath(cleanMatchId), payload);
      return payload;
    }

    mergeLocalRoom((room) => {
      room.matches = room.matches || {};

      room.matches[cleanMatchId] = room.matches[cleanMatchId] || {
        matchId: cleanMatchId,
        createdAt: now(),
        updatedAt: now()
      };

      room.matches[cleanMatchId].events = room.matches[cleanMatchId].events || [];
      room.matches[cleanMatchId].events.push(payload);
      room.matches[cleanMatchId].updatedAt = now();

      return room;
    });

    return payload;
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

    let written = payload;

    if (hasFirebase()) {
      const txn = await dbTransaction(`${getMatchPath(cleanMatchId)}/finalSummary`, (current) => {
        return current || payload;
      });

      written = txn.committed ? payload : (txn.value || payload);

      await dbUpdate(getMatchPath(cleanMatchId), {
        endedAt: now(),
        updatedAt: now()
      });
    } else {
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
    }

    try {
      await appendMatchEvent(cleanMatchId, 'final_summary_published', {
        partial: !!written.partial,
        finishedPlayers: Number(written.finishedPlayers || 0),
        expectedPlayers: Number(written.expectedPlayers || 2),
        grade: String(written.grade || ''),
        score: Number(written.score || 0),
        reason: String(written.reason || '')
      });
    } catch (_) {}

    return written;
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

  async function readFreshRun(maxAgeMs) {
    const runState = hasFirebase()
      ? await dbOnce(getRunPath())
      : (ensureLocalRoomShape().currentRun || null);

    return isRunFresh(runState, maxAgeMs) ? runState : null;
  }

  async function startRoomRun(matchId, runtimeUrl) {
    const cleanMatchId = String(matchId || '').trim();

    const payload = {
      state: 'running',
      matchId: cleanMatchId,
      runtimeUrl: String(runtimeUrl || '').trim(),
      startedAt: now(),
      runToken: buildRunToken(cleanMatchId)
    };

    if (hasFirebase()) {
      await dbSet(getRunPath(), payload);
      await dbUpdate(getRoomRootPath(), {
        status: 'running',
        activeMatchId: cleanMatchId,
        updatedAt: now()
      });

      return payload;
    }

    mergeLocalRoom((room) => {
      room.currentRun = payload;
      room.status = 'running';
      room.activeMatchId = cleanMatchId;
      return room;
    });

    return payload;
  }

  async function clearRoomRun() {
    if (hasFirebase()) {
      await dbRemove(getRunPath());
      await dbUpdate(getRoomRootPath(), {
        status: 'lobby',
        updatedAt: now()
      });

      return true;
    }

    mergeLocalRoom((room) => {
      room.currentRun = null;
      room.status = 'lobby';
      return room;
    });

    return true;
  }

  async function subscribeRoomRun(cb) {
    if (typeof cb !== 'function') return function(){};

    if (hasFirebase()) {
      const ref = dbRef(getRunPath());

      const handler = (snap) => {
        const value = snap && typeof snap.val === 'function' ? snap.val() : null;
        cb(value);
      };

      ref.on('value', handler);

      return function unsubscribe() {
        try { ref.off('value', handler); } catch (_) {}
      };
    }

    const notify = () => {
      const room = ensureLocalRoomShape();
      cb(room.currentRun || null);
    };

    const winHandler = () => notify();
    window.addEventListener('hha:gjduet-room-local-update', winHandler);

    let bcHandler = null;

    if (bc) {
      bcHandler = () => notify();
      bc.addEventListener('message', bcHandler);
    }

    notify();

    return function unsubscribe() {
      try { window.removeEventListener('hha:gjduet-room-local-update', winHandler); } catch (_) {}
      try { if (bc && bcHandler) bc.removeEventListener('message', bcHandler); } catch (_) {}
    };
  }

  async function clearRematchSignal() {
    if (hasFirebase()) {
      await dbRemove(getRematchPath());
      return true;
    }

    mergeLocalRoom((room) => {
      room.rematchSignal = null;
      return room;
    });

    return true;
  }

  async function sendRematchSignal(nextMatchId, runtimeUrl) {
    const cleanMatchId = String(nextMatchId || '').trim();

    const payload = {
      nextMatchId: cleanMatchId,
      runtimeUrl: String(runtimeUrl || '').trim(),
      token: buildRematchToken(cleanMatchId),
      createdAt: now()
    };

    if (hasFirebase()) {
      await dbSet(getRematchPath(), payload);
      return payload;
    }

    mergeLocalRoom((room) => {
      room.rematchSignal = payload;
      return room;
    });

    return payload;
  }

  async function subscribeRematch(cb) {
    if (typeof cb !== 'function') return function(){};

    if (hasFirebase()) {
      const ref = dbRef(getRematchPath());

      const handler = (snap) => {
        const value = snap && typeof snap.val === 'function' ? snap.val() : null;
        cb(value);
      };

      ref.on('value', handler);

      return function unsubscribe() {
        try { ref.off('value', handler); } catch (_) {}
      };
    }

    const notify = () => {
      const room = ensureLocalRoomShape();
      cb(room.rematchSignal || null);
    };

    const winHandler = () => notify();
    window.addEventListener('hha:gjduet-room-local-update', winHandler);

    let bcHandler = null;

    if (bc) {
      bcHandler = () => notify();
      bc.addEventListener('message', bcHandler);
    }

    notify();

    return function unsubscribe() {
      try { window.removeEventListener('hha:gjduet-room-local-update', winHandler); } catch (_) {}
      try { if (bc && bcHandler) bc.removeEventListener('message', bcHandler); } catch (_) {}
    };
  }

  async function acquireRoomActionLock(action, ttlMs) {
    const cleanAction = String(action || 'action').trim();
    const ttl = Number(ttlMs || 5000);
    const token = cleanAction + '-' + safeKey(ctx.pid) + '-' + now();

    const payload = {
      action: cleanAction,
      token,
      byPid: ctx.pid,
      byName: ctx.name,
      createdAt: now(),
      expiresAt: now() + ttl
    };

    if (hasFirebase()) {
      const txn = await dbTransaction(getActionLockPath(), (current) => {
        if (!current || Number(current.expiresAt || 0) < now()) {
          return payload;
        }

        return undefined;
      });

      if (!txn.committed) return null;
      return payload;
    }

    let locked = null;

    mergeLocalRoom((room) => {
      const current = room.actionLock;

      if (!current || Number(current.expiresAt || 0) < now()) {
        room.actionLock = payload;
        locked = payload;
      }

      return room;
    });

    return locked;
  }

  async function releaseRoomActionLock(lock) {
    if (!lock || !lock.token) return true;

    if (hasFirebase()) {
      const current = await dbOnce(getActionLockPath());

      if (current && current.token === lock.token) {
        await dbRemove(getActionLockPath());
      }

      return true;
    }

    mergeLocalRoom((room) => {
      if (room.actionLock && room.actionLock.token === lock.token) {
        room.actionLock = null;
      }

      return room;
    });

    return true;
  }

  async function forceResetRoomState() {
    if (hasFirebase()) {
      await dbUpdate(getRoomRootPath(), {
        currentRun: null,
        rematchSignal: null,
        actionLock: null,
        activeMatchId: '',
        status: 'lobby',
        updatedAt: now()
      });

      return true;
    }

    mergeLocalRoom((room) => {
      room.currentRun = null;
      room.rematchSignal = null;
      room.actionLock = null;
      room.activeMatchId = '';
      room.status = 'lobby';
      return room;
    });

    return true;
  }

  window.HHA_DUET_ROOM_BOOT = {
    ctx,

    getDbMode,
    hasFirebase,

    getRoomId,
    getRole,
    isHost,

    getRoomRootPath,
    getPlayersPath,
    getPlayerPath,
    getRunPath,
    getRematchPath,
    getActionLockPath,
    getMatchPath,

    readRoom,
    ensureRoom,

    setPresence,
    leaveRoom,
    markLobbyReady,

    listPlayers,
    subscribePlayers,
    getEffectiveHostPid,
    isEffectiveHost,

    readActiveMatchId,
    writeActiveMatchId,
    ensureMatchId,
    readMatch,

    readFreshRun,
    startRoomRun,
    clearRoomRun,
    subscribeRoomRun,

    clearRematchSignal,
    sendRematchSignal,
    subscribeRematch,

    acquireRoomActionLock,
    releaseRoomActionLock,
    forceResetRoomState,

    publishPlayerResult,
    readPlayerResults,
    readFinalSummary,
    publishFinalSummary,
    waitForAllPlayerResults,
    combineDuetSummary,
    appendMatchEvent
  };

  dlog('ready', {
    mode: getDbMode(),
    roomId: getRoomId(),
    pid: ctx.pid,
    role: ctx.role,
    root: getRoomRootPath()
  });
})();
