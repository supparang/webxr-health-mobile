/* /herohealth/gj-room-adapter.js
   GoodJunk shared room adapter via Firebase Realtime Database
   Uses window.HHA_FIREBASE_READY from /herohealth/firebase-config.js
*/
(function () {
  'use strict';

  const W = window;

  if (W.GJRoomAdapter && typeof W.GJRoomAdapter.makeRoomAdapter === 'function') {
    return;
  }

  const ROOT = 'hha-battle/goodjunk';

  const MODE_TO_NODE = {
    duet: 'duetRooms',
    race: 'raceRooms',
    battle: 'battleRooms',
    coop: 'coopRooms'
  };

  function nowMs() {
    return Date.now();
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function cleanString(v, d = '') {
    const s = String(v ?? '').trim();
    return s || d;
  }

  function normalizeMode(mode) {
    const m = cleanString(mode).toLowerCase();
    return MODE_TO_NODE[m] ? m : '';
  }

  function modeNode(mode) {
    const m = normalizeMode(mode);
    if (!m) throw new Error(`INVALID_MODE:${mode}`);
    return MODE_TO_NODE[m];
  }

  function roomPath(mode, roomId) {
    const rid = cleanString(roomId);
    if (!rid) throw new Error('ROOM_ID_REQUIRED');
    return `${ROOT}/${modeNode(mode)}/${rid}`;
  }

  function normalizePlayers(players) {
    const src = players && typeof players === 'object' ? players : {};
    const out = {};

    Object.keys(src).forEach((pid) => {
      const p = src[pid];
      if (!p || typeof p !== 'object') return;

      out[pid] = {
        pid: cleanString(p.pid, pid),
        name: cleanString(p.name, cleanString(p.nick, pid)),
        nick: cleanString(p.nick, cleanString(p.name, pid)),
        role: cleanString(p.role, 'guest'),
        joinedAt: Number(p.joinedAt || 0) || 0,
        ready: !!p.ready
      };
    });

    return out;
  }

  function normalizeRoom(mode, roomId, room) {
    const safeMode = normalizeMode(mode);
    const rid = cleanString(roomId);

    const src = room && typeof room === 'object' ? room : {};
    const players = normalizePlayers(src.players);

    return {
      roomId: cleanString(src.roomId, rid),
      mode: cleanString(src.mode, safeMode),
      status: cleanString(src.status, 'waiting'),
      hostPid: cleanString(src.hostPid, ''),
      createdAt: Number(src.createdAt || 0) || 0,
      updatedAt: Number(src.updatedAt || 0) || 0,
      startedAt: Number(src.startedAt || 0) || 0,
      diff: cleanString(src.diff, 'normal'),
      time: cleanString(src.time, '90'),
      cap: Number(src.cap || 0) || 0,
      players
    };
  }

  async function getFirebaseCtx() {
    if (!W.HHA_FIREBASE_READY) {
      throw new Error('HHA_FIREBASE_READY_NOT_FOUND');
    }

    const ctx = await W.HHA_FIREBASE_READY;
    if (!ctx || !ctx.db) {
      throw new Error('FIREBASE_DB_NOT_READY');
    }

    return ctx;
  }

  async function getDbRef(mode, roomId) {
    const ctx = await getFirebaseCtx();
    return ctx.db.ref(roomPath(mode, roomId));
  }

  async function loadRoom(mode, roomId) {
    const ref = await getDbRef(mode, roomId);
    const snap = await ref.get();
    const val = snap && typeof snap.val === 'function' ? snap.val() : null;
    if (!val) return null;
    return normalizeRoom(mode, roomId, val);
  }

  async function saveRoom(mode, roomId, room) {
    const ref = await getDbRef(mode, roomId);
    const next = normalizeRoom(mode, roomId, room);
    next.updatedAt = nowMs();
    if (!next.createdAt) next.createdAt = next.updatedAt;
    await ref.set(clone(next));
    return next;
  }

  async function patchRoom(mode, roomId, producer) {
    const ref = await getDbRef(mode, roomId);

    const result = await ref.transaction((current) => {
      const base = normalizeRoom(mode, roomId, current || {});
      const next = typeof producer === 'function'
        ? producer(clone(base))
        : base;

      if (!next) return current || null;

      const normalized = normalizeRoom(mode, roomId, next);
      normalized.updatedAt = nowMs();
      if (!normalized.createdAt) normalized.createdAt = normalized.updatedAt;
      return normalized;
    }, undefined, false);

    if (!result.committed) {
      throw new Error('ROOM_TRANSACTION_NOT_COMMITTED');
    }

    const val = result.snapshot && typeof result.snapshot.val === 'function'
      ? result.snapshot.val()
      : null;

    return val ? normalizeRoom(mode, roomId, val) : null;
  }

  async function removeRoom(mode, roomId) {
    const ref = await getDbRef(mode, roomId);
    await ref.remove();
    return true;
  }

  function subscribeRoom(mode, roomId, cb) {
    let off = null;
    let active = true;

    (async () => {
      const ref = await getDbRef(mode, roomId);

      const handler = (snap) => {
        if (!active) return;
        const val = snap && typeof snap.val === 'function' ? snap.val() : null;
        const room = val ? normalizeRoom(mode, roomId, val) : null;
        cb(room);
      };

      ref.on('value', handler);
      off = () => {
        try { ref.off('value', handler); } catch (_) {}
      };
    })().catch((err) => {
      if (!active) return;
      console.error('[GJRoomAdapter subscribeRoom]', err);
      cb(null);
    });

    return () => {
      active = false;
      try { off && off(); } catch (_) {}
    };
  }

  async function createRoom(mode, room) {
    const safeMode = normalizeMode(mode);
    if (!safeMode) throw new Error(`INVALID_MODE:${mode}`);

    const roomId = cleanString(room && room.roomId);
    if (!roomId) throw new Error('ROOM_ID_REQUIRED');

    return patchRoom(safeMode, roomId, (base) => {
      const existingPlayers = Object.keys(base.players || {});
      if (existingPlayers.length > 0) {
        throw new Error('ROOM_ALREADY_EXISTS');
      }

      return normalizeRoom(safeMode, roomId, {
        ...room,
        mode: safeMode,
        roomId,
        status: cleanString(room.status, 'waiting'),
        createdAt: nowMs(),
        updatedAt: nowMs()
      });
    });
  }

  async function joinRoom(mode, roomId, player, capOverride) {
    const safeMode = normalizeMode(mode);
    const pid = cleanString(player && player.pid);
    if (!pid) throw new Error('PLAYER_PID_REQUIRED');

    return patchRoom(safeMode, roomId, (room) => {
      const players = normalizePlayers(room.players);
      const cap = Math.max(2, Math.min(10, Number(capOverride || room.cap || 2)));

      if (players[pid]) {
        return {
          ...room,
          cap,
          players
        };
      }

      const count = Object.keys(players).length;
      if (count >= cap) {
        throw new Error('ROOM_FULL');
      }

      players[pid] = {
        pid,
        name: cleanString(player.name, cleanString(player.nick, pid)),
        nick: cleanString(player.nick, cleanString(player.name, pid)),
        role: count === 0 ? 'host' : cleanString(player.role, 'guest'),
        joinedAt: nowMs(),
        ready: true
      };

      let hostPid = cleanString(room.hostPid, '');
      if (!hostPid || !players[hostPid]) {
        hostPid = pid;
        players[pid].role = 'host';
      }

      Object.keys(players).forEach((k) => {
        if (k !== hostPid && players[k].role !== 'guest') {
          players[k].role = 'guest';
        }
      });

      return {
        ...room,
        roomId,
        mode: safeMode,
        hostPid,
        cap,
        players,
        status: cleanString(room.status, 'waiting')
      };
    });
  }

  async function leaveRoom(mode, roomId, pid) {
    const safeMode = normalizeMode(mode);
    const playerId = cleanString(pid);
    if (!playerId) throw new Error('PLAYER_PID_REQUIRED');

    return patchRoom(safeMode, roomId, (room) => {
      const players = normalizePlayers(room.players);
      delete players[playerId];

      const ids = Object.keys(players);
      if (!ids.length) {
        return {
          ...room,
          hostPid: '',
          players: {},
          status: 'waiting',
          startedAt: 0
        };
      }

      let hostPid = cleanString(room.hostPid, '');
      if (!hostPid || !players[hostPid]) {
        hostPid = ids[0];
        players[hostPid].role = 'host';
      }

      Object.keys(players).forEach((k) => {
        if (k !== hostPid) players[k].role = 'guest';
      });

      return {
        ...room,
        hostPid,
        players,
        status: 'waiting',
        startedAt: 0
      };
    });
  }

  async function startRoom(mode, roomId, pid) {
    const safeMode = normalizeMode(mode);
    const playerId = cleanString(pid);
    if (!playerId) throw new Error('PLAYER_PID_REQUIRED');

    return patchRoom(safeMode, roomId, (room) => {
      const players = normalizePlayers(room.players);
      const count = Object.keys(players).length;
      const cap = Math.max(2, Math.min(10, Number(room.cap || 2)));

      if (!players[playerId]) {
        throw new Error('PLAYER_NOT_IN_ROOM');
      }

      if (cleanString(room.hostPid) !== playerId) {
        throw new Error('ONLY_HOST_CAN_START');
      }

      if (count < 2) {
        throw new Error('NOT_ENOUGH_PLAYERS');
      }

      if (count > cap) {
        throw new Error('TOO_MANY_PLAYERS');
      }

      return {
        ...room,
        status: 'started',
        startedAt: nowMs()
      };
    });
  }

  async function makeRoomAdapter(mode) {
    const safeMode = normalizeMode(mode);
    if (!safeMode) throw new Error(`INVALID_MODE:${mode}`);

    await getFirebaseCtx();

    return {
      mode: safeMode,
      async loadRoom(roomId) {
        return loadRoom(safeMode, roomId);
      },
      async saveRoom(roomId, room) {
        return saveRoom(safeMode, roomId, room);
      },
      async patchRoom(roomId, producer) {
        return patchRoom(safeMode, roomId, producer);
      },
      async removeRoom(roomId) {
        return removeRoom(safeMode, roomId);
      },
      subscribeRoom(roomId, cb) {
        return subscribeRoom(safeMode, roomId, cb);
      },

      async createRoom(room) {
        return createRoom(safeMode, room);
      },
      async joinRoom(roomId, player, capOverride) {
        return joinRoom(safeMode, roomId, player, capOverride);
      },
      async leaveRoom(roomId, pid) {
        return leaveRoom(safeMode, roomId, pid);
      },
      async startRoom(roomId, pid) {
        return startRoom(safeMode, roomId, pid);
      }
    };
  }

  W.GJRoomAdapter = {
    ROOT,
    MODE_TO_NODE,
    makeRoomAdapter
  };
})();