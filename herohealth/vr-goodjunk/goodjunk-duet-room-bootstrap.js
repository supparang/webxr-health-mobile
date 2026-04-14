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
  const MAX_ROOM_PLAYERS = 2;
  const FALLBACK_ROOM_PREFIX = 'DU-';
  const LOCAL_KEY = ctx.roomId ? `HHA_GJ_DUET_ROOM__${ctx.roomId}` : 'HHA_GJ_DUET_ROOM__DEFAULT';
  const CHANNEL_KEY = ctx.roomId ? `hha-gj-duet-room-${ctx.roomId}` : 'hha-gj-duet-room-default';
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

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function cleanPath(path) {
    return String(path || '')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '');
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
    return db.ref(cleanPath(path));
  }

  function dbOnce(path) {
    return new Promise((resolve, reject) => {
      try {
        dbRef(path).once('value', (snap) => {
          try {
            resolve(snap && typeof snap.val === 'function' ? snap.val() : null);
          } catch (err) {
            reject(err);
          }
        }, reject);
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
    return {
      pid: String(p.pid || pidKey || '').trim(),
      name: String(p.name || p.pid || pidKey || 'Player').trim(),
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
      (Array.isArray(players) ? players : []).filter((p) => p && p.online !== false)
    );

    if (!online.length) return '';

    const currentHost = online.find((p) => String(p.role || '').toLowerCase() === 'host');
    if (currentHost) return String(currentHost.pid || '').trim();

    return String(online[0].pid || '').trim();
  }

  async function listPlayers() {
    if (hasFirebase()) {
      const value = await dbOnce(getPlayersPath()) || {};
      return Object.keys(value).map((k) => normalizePlayerShape(value[k], k)).filter(Boolean);
    }

    const room = ensureLocalRoomShape();
    const players = room.players || {};
    return Object.keys(players).map((k) => normalizePlayerShape(players[k], k)).filter(Boolean);
  }

  async function validateRoomJoin(pid) {
    const cleanPid = String(pid || ctx.pid || '').trim();
    const players = await listPlayers();

    const alreadyKnown = players.some((p) => String(p.pid || '').trim() === cleanPid);
    const onlineCount = players.filter((p) => p && p.online !== false).length;

    if (!alreadyKnown && onlineCount >= MAX_ROOM_PLAYERS) {
      return {
        ok: false,
        reason: 'room_full',
        onlineCount: onlineCount,
        maxPlayers: MAX_ROOM_PLAYERS
      };
    }

    return {
      ok: true,
      reason: '',
      onlineCount: onlineCount,
      maxPlayers: MAX_ROOM_PLAYERS
    };
  }

  async function setPresence(extra) {
    bindBeforeUnloadOnce();

    const roomCheck = await validateRoomJoin(ctx.pid);
    if (!roomCheck.ok) {
      const err = new Error('room_full');
      err.code = 'room_full';
      err.detail = roomCheck;
      throw err;
    }

    const payload = Object.assign({
      pid: ctx.pid,
      name: ctx.name,
      role: getRole(),
      online: true,
      joinedAt: now(),
      lastSeen: now()
    }, extra || {});

    if (hasFirebase()) {
      await dbUpdate(getPlayerPath(ctx.pid), payload);

      try {
        dbRef(getPlayerPath(ctx.pid)).onDisconnect().update({
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
        await dbUpdate(getPlayerPath(ctx.pid), {
          online: false,
          inRuntime: false,
          lastSeen: now()
        });
      } catch (_) {}
      return;
    }

    mergeLocalRoom((room) => {
      room.players = room.players || {};
      if (room.players[ctx.pid]) {
        room.players[ctx.pid].online = false;
        room.players[ctx.pid].inRuntime = false;
        room.players[ctx.pid].lastSeen = now();
      }
      return room;
    });
  }

  async function markLobbyReady(flag) {
    const ready = !!flag;
    return await setPresence({
      ready: ready,
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
        const players = Object.keys(value).map((k) => normalizePlayerShape(value[k], k)).filter(Boolean);
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
    const effectiveHostPid = chooseEffectiveHost(players);
    if (!effectiveHostPid) return '';

    const normalized = players.map((p) => Object.assign({}, p, {
      role: String(p.pid || '') === effectiveHostPid ? 'host' : 'guest'
    }));

    if (hasFirebase()) {
      const rootUpdates = {};
      normalized.forEach((p) => {
        rootUpdates[`${getPlayersPath()}/${p.pid}/role`] = p.role;
        rootUpdates[`${getPlayersPath()}/${p.pid}/lastSeen`] = now();
      });
      await dbRef('/').update(rootUpdates);
      return effectiveHostPid;
    }

    mergeLocalRoom((room) => {
      room.players = room.players || {};
      normalized.forEach((p) => {
        room.players[p.pid] = Object.assign({}, room.players[p.pid] || {}, p, {
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
    const allowCreate = typeof hostCanCreate === 'boolean' ? hostCanCreate : (await isEffectiveHost());

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
    return room.matches && room.matches[cleanMatchId] ? room.matches[cleanMatchId] : null;
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
        streak: Number(item.streak || 0),
        role: String(item.role || 'guest').trim().toLowerCase()
      })),
      score: 0,
      good: 0,
      junk: 0,
      miss: 0,
      streak: 0,
      expectedPlayers: Number(metaInfo.expectedPlayers || 2),
      finishedPlayers: Number(metaInfo.finishedPlayers || list.length),
      partial: !!metaInfo.partial
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
      await dbSet(`${getMatchPath(cleanMatchId)}/playerResults/${ctx.pid}`, result);
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
        room.matches[cleanMatchId].playerResults[ctx.pid] = result;
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
      const txn = await dbTransaction(`${getMatchPath(cleanMatchId)}/finalSummary`, (current) => current || payload);
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
    const finishedCount = countFinishedPlayers(playerResults);

    if (finishedCount <= 0) {
      return null;
    }

    const players = await listPlayers();
    const activeRuntimePlayers = players.filter((p) => p && p.online !== false && (p.inRuntime || p.ready));

    const dynamicExpected = clamp(
      activeRuntimePlayers.length > 0
        ? Math.min(Number(options.expectedPlayers || 2), activeRuntimePlayers.length)
        : Math.min(Number(options.expectedPlayers || 2), Math.max(1, finishedCount)),
      1,
      2
    );

    if (!options.force && finishedCount < dynamicExpected) {
      return null;
    }

    const partial = finishedCount < Number(options.expectedPlayers || 2);

    const summary = combineDuetSummary(cleanMatchId, playerResults, {
      expectedPlayers: Number(options.expectedPlayers || 2),
      finishedPlayers: finishedCount,
      partial: partial
    });

    summary.reason = options.reason || (partial ? 'timeout_partial_finalize' : 'finished');

    return await publishFinalSummary(cleanMatchId, summary);
  }

  async function finalizeMatchWithPolicy(matchId, opts) {
    const cleanMatchId = String(matchId || '').trim();
    if (!cleanMatchId) throw new Error('finalizeMatchWithPolicy requires matchId');

    const options = Object.assign({
      expectedPlayers: 2,
      waitTimeoutMs: 8000,
      intervalMs: 250,
      reason: 'finished'
    }, opts || {});

    const existing = await readFinalSummary(cleanMatchId);
    if (existing && existing.final) return existing;

    const results = await waitForAllPlayerResults(cleanMatchId, {
      expectedPlayers: Number(options.expectedPlayers || 2),
      timeoutMs: Number(options.waitTimeoutMs || 8000),
      intervalMs: Number(options.intervalMs || 250)
    });

    const finishedCount = countFinishedPlayers(results);

    let summary = await finalizeMatchFromRoomResults(cleanMatchId, {
      expectedPlayers: Number(options.expectedPlayers || 2),
      force: finishedCount >= Number(options.expectedPlayers || 2),
      reason: options.reason || 'finished'
    });

    if (summary && summary.final) return summary;

    summary = await finalizeMatchFromRoomResults(cleanMatchId, {
      expectedPlayers: Number(options.expectedPlayers || 2),
      force: true,
      reason: 'timeout_partial_finalize'
    });

    return summary;
  }

  async function subscribeFinalSummary(matchId, cb) {
    const cleanMatchId = String(matchId || '').trim();
    if (!cleanMatchId || typeof cb !== 'function') return function(){};

    if (hasFirebase()) {
      const finalRef = dbRef(`${getMatchPath(cleanMatchId)}/finalSummary`);
      const handler = (snap) => {
        const value = snap && typeof snap.val === 'function' ? snap.val() : null;
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

  async function acquireRoomActionLock(kind, ttlMs) {
    const cleanKind = String(kind || 'action').trim();
    const ttl = Math.max(1500, Number(ttlMs || 5000));

    const payload = {
      kind: cleanKind,
      pid: ctx.pid,
      name: ctx.name,
      at: now(),
      ttlMs: ttl
    };

    if (hasFirebase()) {
      const txn = await dbTransaction(getActionLockPath(), (current) => {
        if (
          current &&
          typeof current === 'object' &&
          Number(current.at || 0) > 0 &&
          (now() - Number(current.at || 0)) < Number(current.ttlMs || ttl)
        ) {
          return;
        }
        return payload;
      });

      if (txn && txn.committed) return payload;
      return null;
    }

    let acquired = null;
    mergeLocalRoom((room) => {
      const current = room.actionLock || null;
      if (
        current &&
        typeof current === 'object' &&
        Number(current.at || 0) > 0 &&
        (now() - Number(current.at || 0)) < Number(current.ttlMs || ttl)
      ) {
        acquired = null;
        return room;
      }

      room.actionLock = payload;
      acquired = payload;
      return room;
    });

    return acquired;
  }

  async function releaseRoomActionLock(lock) {
    const payload = lock && typeof lock === 'object' ? lock : null;
    if (!payload) return false;

    if (hasFirebase()) {
      const txn = await dbTransaction(getActionLockPath(), (current) => {
        if (!current || typeof current !== 'object') return null;
        if (
          String(current.pid || '') === String(payload.pid || '') &&
          String(current.kind || '') === String(payload.kind || '')
        ) {
          return null;
        }
        return current;
      });
      return !!txn;
    }

    mergeLocalRoom((room) => {
      const current = room.actionLock || null;
      if (
        current &&
        String(current.pid || '') === String(payload.pid || '') &&
        String(current.kind || '') === String(payload.kind || '')
      ) {
        room.actionLock = null;
      }
      return room;
    });

    return true;
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
      runToken: buildRunToken(cleanMatchId),
      startedAt: now(),
      startedBy: {
        pid: ctx.pid,
        name: ctx.name,
        role: getRole()
      }
    };

    if (hasFirebase()) {
      await dbUpdate(getRoomRootPath(), {
        status: 'running',
        activeMatchId: cleanMatchId,
        updatedAt: now()
      });
      await dbSet(getRunPath(), payload);
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
      await dbUpdate(getRoomRootPath(), {
        status: 'lobby',
        updatedAt: now()
      });
      await dbRemove(getRunPath());
      return;
    }

    mergeLocalRoom((room) => {
      room.status = 'lobby';
      room.currentRun = null;
      return room;
    });
  }

  async function clearActiveMatchIfEquals(matchId) {
    const cleanMatchId = String(matchId || '').trim();
    if (!cleanMatchId) return;

    if (hasFirebase()) {
      const current = String(await dbOnce(`${getRoomRootPath()}/activeMatchId`) || '').trim();
      if (current === cleanMatchId) {
        await dbUpdate(getRoomRootPath(), {
          activeMatchId: '',
          updatedAt: now()
        });
      }
      return;
    }

    mergeLocalRoom((room) => {
      if (String(room.activeMatchId || '').trim() === cleanMatchId) {
        room.activeMatchId = '';
      }
      return room;
    });
  }

  async function finishRoomRun(matchId) {
    const cleanMatchId = String(matchId || '').trim();

    await resetRoomRun();
    await clearActiveMatchIfEquals(cleanMatchId);

    if (hasFirebase()) {
      await dbUpdate(getRoomRootPath(), {
        status: 'lobby',
        updatedAt: now()
      });
    } else {
      mergeLocalRoom((room) => {
        room.status = 'lobby';
        return room;
      });
    }

    return true;
  }

  async function readFreshRun(maxAgeMs) {
    let runState = null;

    if (hasFirebase()) {
      runState = await dbOnce(getRunPath());
    } else {
      const room = ensureLocalRoomShape();
      runState = room.currentRun || null;
    }

    return isRunFresh(runState, maxAgeMs || 15000) ? runState : null;
  }

  async function subscribeRoomRun(cb) {
    if (typeof cb !== 'function') return function(){};

    if (hasFirebase()) {
      const runRef = dbRef(getRunPath());
      const handler = (snap) => {
        const value = snap && typeof snap.val === 'function' ? snap.val() : null;
        cb(value);
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

  async function publishRematchSignal(payload) {
    const clean = Object.assign({
      roomId: getRoomId(),
      fromMatchId: '',
      nextMatchId: '',
      runtimeUrl: '',
      createdAt: now(),
      rematchToken: ''
    }, payload || {});

    clean.fromMatchId = String(clean.fromMatchId || '').trim();
    clean.nextMatchId = String(clean.nextMatchId || '').trim();
    clean.runtimeUrl = String(clean.runtimeUrl || '').trim();
    clean.rematchToken = String(clean.rematchToken || buildRematchToken(clean.nextMatchId)).trim();
    clean.by = {
      pid: ctx.pid,
      name: ctx.name,
      role: getRole()
    };

    if (!clean.nextMatchId || !clean.runtimeUrl) {
      throw new Error('publishRematchSignal requires nextMatchId and runtimeUrl');
    }

    if (hasFirebase()) {
      await dbSet(getRematchPath(), clean);
      return clean;
    }

    mergeLocalRoom((room) => {
      room.rematchSignal = clean;
      return room;
    });

    return clean;
  }

  async function readFreshRematch(maxAgeMs) {
    let rematch = null;

    if (hasFirebase()) {
      rematch = await dbOnce(getRematchPath());
    } else {
      const room = ensureLocalRoomShape();
      rematch = room.rematchSignal || null;
    }

    const ageLimit = Number(maxAgeMs || 15000);
    if (!rematch || typeof rematch !== 'object') return null;
    const createdAt = Number(rematch.createdAt || 0);
    if (!createdAt) return null;
    if ((now() - createdAt) > ageLimit) return null;

    return rematch;
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

  async function subscribeRematch(cb) {
    if (typeof cb !== 'function') return function(){};

    if (hasFirebase()) {
      const rematchRef = dbRef(getRematchPath());
      const handler = (snap) => {
        const value = snap && typeof snap.val === 'function' ? snap.val() : null;
        if (value) cb(value);
      };
      rematchRef.on('value', handler);
      return function unsubscribe() {
        try { rematchRef.off('value', handler); } catch (_) {}
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

  async function forceResetRoomState() {
    if (hasFirebase()) {
      await dbUpdate(getRoomRootPath(), {
        status: 'lobby',
        activeMatchId: '',
        updatedAt: now()
      });
      await dbRemove(getRunPath());
      return true;
    }

    mergeLocalRoom((room) => {
      room.status = 'lobby';
      room.activeMatchId = '';
      room.currentRun = null;
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

    ensureRoom,
    readRoom,

    setPresence,
    leaveRoom,
    markLobbyReady,

    validateRoomJoin,
    listPlayers,
    subscribePlayers,
    maybePromoteHost,
    getEffectiveHostPid,
    isEffectiveHost,

    ensureMatchId,
    readMatch,
    readPlayerResults,
    readFinalSummary,
    publishPlayerResult,
    publishFinalSummary,

    appendMatchEvent,

    combineDuetSummary,
    waitForAllPlayerResults,
    finalizeMatchFromRoomResults,
    finalizeMatchWithPolicy,

    acquireRoomActionLock,
    releaseRoomActionLock,

    startRoomRun,
    resetRoomRun,
    finishRoomRun,
    clearActiveMatchIfEquals,
    readFreshRun,
    subscribeRoomRun,

    publishRematchSignal,
    readFreshRematch,
    clearRematchSignal,
    subscribeRematch,

    forceResetRoomState
  };

  dlog('boot ready', {
    roomId: getRoomId(),
    role: getRole(),
    dbMode: getDbMode(),
    roomRoot: getRoomRootPath()
  });
})();