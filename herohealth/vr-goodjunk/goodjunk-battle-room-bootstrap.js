// === /herohealth/vr-goodjunk/goodjunk-battle-room-bootstrap.js ===
// PATCH v20260430e-GJ-BATTLE-FIREBASE-SHARED-ROOM
// ✅ Shared Firebase room for Battle across devices
// ✅ localStorage fallback only when Firebase unavailable
// ✅ compatible with goodjunk-battle-room.js adapter API:
//    loadRoom / saveRoom / patchRoom / subscribeRoom
// ✅ room path: hha-battle/goodjunk/battleRooms/{roomId}

(function () {
  'use strict';

  const qs = new URLSearchParams(location.search);
  const DEBUG = qs.get('debug') === '1';

  const STORAGE = {
    localPrefix: 'GJ_BATTLE_SHARED_LOCAL:'
  };

  function log(...args) {
    if (!DEBUG) return;
    try { console.log('[GJ-BATTLE-BOOT]', ...args); } catch (_) {}
  }

  function warn(...args) {
    try { console.warn('[GJ-BATTLE-BOOT]', ...args); } catch (_) {}
  }

  function now() {
    return Date.now();
  }

  function clean(v, d = '') {
    const s = String(v ?? '').trim();
    return s || d;
  }

  function safeKey(raw) {
    return String(raw || '')
      .trim()
      .replace(/[.#$/\[\]]/g, '_')
      .slice(0, 96) || 'anon';
  }

  function cleanPath(path) {
    return String(path || '')
      .trim()
      .replace(/\/+/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
  }

  function normalizeRoomId(raw) {
    let v = String(raw || '').trim().toUpperCase();
    v = v.replace(/\s+/g, '');
    v = v.replace(/[^A-Z0-9-]/g, '');

    if (!v) return '';

    if (!v.startsWith('GJ-BT-')) {
      v = 'GJ-BT-' + v
        .replace(/^GJ/i, '')
        .replace(/^BT/i, '')
        .replace(/^-+/, '');
    }

    return v.slice(0, 18);
  }

  function roomPath(roomId) {
    const id = normalizeRoomId(roomId);
    return cleanPath(`hha-battle/goodjunk/battleRooms/${id}`);
  }

  function localKey(roomId) {
    return STORAGE.localPrefix + normalizeRoomId(roomId);
  }

  function emptyRoom(roomId) {
    const id = normalizeRoomId(roomId);
    const t = now();

    return {
      roomId: id,
      mode: 'battle',
      status: 'waiting',
      hostPid: '',
      createdAt: t,
      updatedAt: t,
      startedAt: 0,
      players: {},
      attacks: [],
      effects: [],
      lastAttackAt: 0
    };
  }

  function normalizePlayer(pidKey, p) {
    p = p && typeof p === 'object' ? p : {};
    const pid = safeKey(p.pid || pidKey || 'anon');

    return {
      pid,
      name: clean(p.name || p.nick || pid, 'Player'),
      nick: clean(p.nick || p.name || pid, 'Player'),
      role: clean(p.role, 'player'),
      joinedAt: Number(p.joinedAt || 0) || now(),
      ready: p.ready === true,

      score: Number(p.score || 0) || 0,
      combo: Number(p.combo || 0) || 0,
      hp: Number.isFinite(Number(p.hp)) ? Number(p.hp) : 3,
      shield: Number.isFinite(Number(p.shield)) ? Number(p.shield) : 0,
      attackMeter: Number.isFinite(Number(p.attackMeter)) ? Number(p.attackMeter) : 0,

      goodHits: Number(p.goodHits || 0) || 0,
      junkHits: Number(p.junkHits || 0) || 0,
      attacksSent: Number(p.attacksSent || 0) || 0,
      attacksBlocked: Number(p.attacksBlocked || 0) || 0,
      attacksReceived: Number(p.attacksReceived || 0) || 0,

      online: p.online !== false,
      lastSeenAt: Number(p.lastSeenAt || p.updatedAt || 0) || now(),
      updatedAt: Number(p.updatedAt || 0) || now()
    };
  }

  function normalizeRoom(roomId, raw) {
    if (!raw || typeof raw !== 'object') return null;

    const id = normalizeRoomId(raw.roomId || roomId);
    const playersRaw = raw.players && typeof raw.players === 'object' ? raw.players : {};
    const players = {};

    Object.keys(playersRaw).forEach((pid) => {
      const p = normalizePlayer(pid, playersRaw[pid]);
      if (p && p.pid) players[p.pid] = p;
    });

    return {
      roomId: id,
      mode: clean(raw.mode, 'battle'),
      status: clean(raw.status, 'waiting'),
      hostPid: clean(raw.hostPid, ''),
      createdAt: Number(raw.createdAt || 0) || now(),
      updatedAt: Number(raw.updatedAt || 0) || now(),
      startedAt: Number(raw.startedAt || 0) || 0,
      players,
      attacks: Array.isArray(raw.attacks) ? raw.attacks.slice(-30) : [],
      effects: Array.isArray(raw.effects) ? raw.effects.slice(-20) : [],
      lastAttackAt: Number(raw.lastAttackAt || 0) || 0
    };
  }

  function mergeById(prevList, nextList, limit = 30) {
    const map = new Map();

    (Array.isArray(prevList) ? prevList : []).forEach((item) => {
      if (!item) return;
      const id = String(item.id || Math.random()).trim();
      map.set(id, item);
    });

    (Array.isArray(nextList) ? nextList : []).forEach((item) => {
      if (!item) return;
      const id = String(item.id || Math.random()).trim();
      map.set(id, item);
    });

    return Array.from(map.values()).slice(-limit);
  }

  async function getFirebaseCtx() {
    try {
      if (window.HHA_FIREBASE_READY) {
        const out = await window.HHA_FIREBASE_READY;
        if (out && out.db) return out;
      }
    } catch (err) {
      warn('HHA_FIREBASE_READY failed', err);
    }

    try {
      if (window.HHA_FIREBASE && window.HHA_FIREBASE.db) {
        return window.HHA_FIREBASE;
      }
    } catch (_) {}

    try {
      if (window.firebase && typeof window.firebase.database === 'function') {
        return {
          db: window.firebase.database(),
          auth: window.firebase.auth ? window.firebase.auth() : null
        };
      }
    } catch (_) {}

    return null;
  }

  async function getDb() {
    const ctx = await getFirebaseCtx();
    return ctx && ctx.db ? ctx.db : null;
  }

  async function dbOnce(path) {
    const db = await getDb();
    if (!db) return null;

    return await new Promise((resolve, reject) => {
      try {
        db.ref(cleanPath(path)).once(
          'value',
          (snap) => resolve(snap && typeof snap.val === 'function' ? snap.val() : null),
          reject
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  async function dbTransaction(path, updateFn) {
    const db = await getDb();
    if (!db) throw new Error('firebase unavailable');

    return await new Promise((resolve, reject) => {
      try {
        db.ref(cleanPath(path)).transaction(
          updateFn,
          (err, committed, snap) => {
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

  function readLocal(roomId) {
    try {
      const raw = localStorage.getItem(localKey(roomId));
      if (!raw) return null;
      return normalizeRoom(roomId, JSON.parse(raw));
    } catch (_) {
      return null;
    }
  }

  function writeLocal(roomId, room) {
    const next = normalizeRoom(roomId, room) || emptyRoom(roomId);
    next.updatedAt = now();

    try {
      localStorage.setItem(localKey(roomId), JSON.stringify(next));
    } catch (_) {}

    try {
      window.dispatchEvent(new CustomEvent('hha:gjbattle-local-room-update', {
        detail: next
      }));
    } catch (_) {}

    return next;
  }

  async function loadRoom(roomId) {
    const id = normalizeRoomId(roomId);
    if (!id) return null;

    const db = await getDb();

    if (db) {
      const raw = await dbOnce(roomPath(id));
      return normalizeRoom(id, raw);
    }

    return readLocal(id);
  }

  async function patchRoom(roomId, patch) {
    const id = normalizeRoomId(roomId);
    if (!id) return null;

    const db = await getDb();

    if (db) {
      let output = null;

      await dbTransaction(roomPath(id), (current) => {
        const prev = normalizeRoom(id, current) || emptyRoom(id);
        const incoming = patch && typeof patch === 'object' ? patch : {};

        const merged = {
          ...prev,
          ...incoming,
          roomId: id,
          mode: 'battle',
          players: incoming.players && typeof incoming.players === 'object'
            ? { ...prev.players, ...incoming.players }
            : prev.players,
          attacks: Array.isArray(incoming.attacks)
            ? mergeById(prev.attacks, incoming.attacks, 30)
            : prev.attacks,
          effects: Array.isArray(incoming.effects)
            ? mergeById(prev.effects, incoming.effects, 20)
            : prev.effects,
          updatedAt: now()
        };

        output = merged;
        return merged;
      });

      return output || await loadRoom(id);
    }

    const prev = readLocal(id) || emptyRoom(id);
    const incoming = patch && typeof patch === 'object' ? patch : {};

    const merged = {
      ...prev,
      ...incoming,
      roomId: id,
      mode: 'battle',
      players: incoming.players && typeof incoming.players === 'object'
        ? { ...prev.players, ...incoming.players }
        : prev.players,
      attacks: Array.isArray(incoming.attacks)
        ? mergeById(prev.attacks, incoming.attacks, 30)
        : prev.attacks,
      effects: Array.isArray(incoming.effects)
        ? mergeById(prev.effects, incoming.effects, 20)
        : prev.effects,
      updatedAt: now()
    };

    return writeLocal(id, merged);
  }

  async function saveRoom(roomId, payload) {
    return await patchRoom(roomId, payload);
  }

  function subscribeRoom(roomId, callback) {
    const id = normalizeRoomId(roomId);
    let stopped = false;
    let firebaseRef = null;
    let firebaseHandler = null;
    let localTimer = 0;

    function stopLocal() {
      try { clearInterval(localTimer); } catch (_) {}
      localTimer = 0;
    }

    function startLocal() {
      const emit = () => {
        if (stopped) return;
        callback(readLocal(id));
      };

      window.addEventListener('hha:gjbattle-local-room-update', emit);
      localTimer = setInterval(emit, 650);
      emit();

      return () => {
        try { window.removeEventListener('hha:gjbattle-local-room-update', emit); } catch (_) {}
        stopLocal();
      };
    }

    let offLocal = null;

    async function start() {
      const db = await getDb();

      if (stopped) return;

      if (db) {
        firebaseRef = db.ref(roomPath(id));
        firebaseHandler = (snap) => {
          if (stopped) return;
          const value = snap && typeof snap.val === 'function' ? snap.val() : null;
          callback(normalizeRoom(id, value));
        };

        firebaseRef.on('value', firebaseHandler);
        return;
      }

      offLocal = startLocal();
    }

    start().catch((err) => {
      warn('subscribeRoom failed; fallback local', err);
      if (!offLocal) offLocal = startLocal();
    });

    return function unsubscribe() {
      stopped = true;

      try {
        if (firebaseRef && firebaseHandler) {
          firebaseRef.off('value', firebaseHandler);
        }
      } catch (_) {}

      try {
        if (typeof offLocal === 'function') offLocal();
      } catch (_) {}
    };
  }

  const adapter = {
    type: 'firebase-battle-shared-adapter',
    loadRoom,
    saveRoom,
    patchRoom,
    subscribeRoom
  };

  window.HHA_BATTLE_ROOM_ADAPTER = adapter;
  window.HHA_BATTLE_ROOM_BOOT = {
    adapter,
    normalizeRoomId,
    roomPath,
    loadRoom,
    saveRoom,
    patchRoom,
    subscribeRoom
  };

  log('ready');
})();