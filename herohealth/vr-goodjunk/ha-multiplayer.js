// /herohealth/vr-goodjunk/ha-multiplayer.js
// FULL PATCH v20260327-GJBATTLE-MP-AUTH-R2
(function () {
  'use strict';

  const W = window;

  const PRESENCE_TTL_MS = 12000;
  const HEARTBEAT_MS = 2500;
  const ATTACK_TTL_MS = 30000;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function clamp(v, a, b) {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function num(v, d = 0) {
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function safeStr(v, d = '') {
    return (v == null ? d : String(v)).trim();
  }

  function sanitizeRoomId(v) {
    v = safeStr(v, 'GJ-' + Math.random().toString(36).slice(2, 8).toUpperCase());
    v = v.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
    if (!v) v = 'GJ-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    return v;
  }

  function isActivePlayer(p, nowTs = Date.now()) {
    if (!p) return false;
    if (p.connected === false) return false;

    const lastSeen = num(p.lastSeen || p.updatedAt || p.joinedAt, 0);
    if (!lastSeen) return true;

    return (nowTs - lastSeen) <= PRESENCE_TTL_MS;
  }

  async function waitForFirebase(timeoutMs = 12000) {
    const until = Date.now() + timeoutMs;
    let lastErr = null;

    while (Date.now() < until) {
      try {
        if (typeof W.HHA_initFirebaseCompat === 'function') {
          W.HHA_initFirebaseCompat();
        }

        if (typeof W.HHA_ensureAnonymousAuth === 'function') {
          await W.HHA_ensureAnonymousAuth();
        }

        const f = W.firebase;
        const auth = f && typeof f.auth === 'function' ? f.auth() : null;
        const uid = auth && auth.currentUser && auth.currentUser.uid ? String(auth.currentUser.uid) : '';

        if (
          f &&
          f.apps &&
          f.apps.length > 0 &&
          typeof f.database === 'function' &&
          typeof f.auth === 'function' &&
          uid
        ) {
          return { firebase: f, uid };
        }
      } catch (err) {
        lastErr = err;
      }

      await sleep(125);
    }

    throw lastErr || new Error('Firebase/Auth ยังไม่พร้อม');
  }

  async function createBattleRoom(opts = {}) {
    const ready = await waitForFirebase(opts.timeoutMs || 12000);
    const firebase = ready.firebase;
    const authUid = String(ready.uid || '');
    const db = firebase.database();
    const TS = firebase.database.ServerValue.TIMESTAMP;

    const roomId = sanitizeRoomId(opts.roomId);
    const pid = authUid;
    const nick = safeStr(opts.nick, (opts.pid || 'Player')).slice(0, 24) || 'Player';
    const plannedSec = clamp(opts.plannedSec || 90, 20, 600);
    const diff = safeStr(opts.diff, 'normal').toLowerCase();
    const mode = safeStr(opts.mode, 'battle').toLowerCase();

    const basePath = `hha-battle/goodjunk/rooms/${roomId}`;
    const root = db.ref(basePath);

    const refs = {
      root,
      meta: root.child('meta'),
      state: root.child('state'),
      players: root.child('players'),
      attacks: root.child('attacks')
    };

    const api = {
      firebase,
      db,
      roomId,
      pid,
      nick,
      plannedSec,
      diff,
      mode,
      refs,
      meta: {},
      state: {},
      players: {},
      isHost: false,
      _offs: [],
      _heartbeatTimer: 0,
      _selfRef: refs.players.child(pid),
      _connected: false,
      _playersCbs: [],
      _stateCbs: [],
      _metaCbs: [],
      _attackCbs: []
    };

    api.getConnectedPlayers = function () {
      const nowTs = Date.now();
      return Object.values(api.players || {})
        .filter(p => isActivePlayer(p, nowTs))
        .sort((a, b) => {
          return num(a.joinedAt, 0) - num(b.joinedAt, 0);
        });
    };

    api.onPlayers = function (cb) {
      if (typeof cb === 'function') api._playersCbs.push(cb);
    };

    api.onState = function (cb) {
      if (typeof cb === 'function') api._stateCbs.push(cb);
    };

    api.onMeta = function (cb) {
      if (typeof cb === 'function') api._metaCbs.push(cb);
    };

    api.onAttack = function (cb) {
      if (typeof cb === 'function') api._attackCbs.push(cb);
    };

    api._emitPlayers = function () {
      api._playersCbs.forEach(cb => {
        try { cb(api.players); } catch (err) { console.error(err); }
      });
    };

    api._emitState = function () {
      api._stateCbs.forEach(cb => {
        try { cb(api.state); } catch (err) { console.error(err); }
      });
    };

    api._emitMeta = function () {
      api._metaCbs.forEach(cb => {
        try { cb(api.meta); } catch (err) { console.error(err); }
      });
    };

    api._emitAttack = function (payload) {
      api._attackCbs.forEach(cb => {
        try { cb(payload); } catch (err) { console.error(err); }
      });
    };

    api.updateSelf = async function (patch = {}) {
      return api._selfRef.update(Object.assign({
        pid,
        nick,
        connected: true,
        lastSeen: TS,
        updatedAt: TS
      }, patch || {}));
    };

    api.updateState = async function (patch = {}) {
      return refs.state.update(Object.assign({
        updatedAt: Date.now()
      }, patch || {}));
    };

    api.updateMeta = async function (patch = {}) {
      return refs.meta.update(Object.assign({
        updatedAt: Date.now()
      }, patch || {}));
    };

    api.sendAttack = async function ({ toPid, dmg, type = 'charge' }) {
      toPid = safeStr(toPid);
      dmg = clamp(dmg, 1, 100);

      const row = {
        fromPid: pid,
        fromNick: nick,
        toPid,
        dmg,
        type,
        createdAt: Date.now()
      };

      const ref = refs.attacks.push();
      await ref.set(row);
      return ref.key;
    };

    api.ackAttack = async function (attackId) {
      if (!attackId) return;
      return refs.attacks.child(attackId).child('handledBy').child(pid).set(Date.now());
    };

    api.ensureHost = async function () {
      const connected = api.getConnectedPlayers();
      const nextHost = connected[0] ? connected[0].pid : '';

      if (nextHost && api.meta.hostPid !== nextHost) {
        await refs.meta.update({
          hostPid: nextHost,
          updatedAt: Date.now()
        });
      }

      api.isHost = !!nextHost && api.pid === nextHost;
    };

    api.pruneStaleRoom = async function () {
      const nowTs = Date.now();

      const [playersSnap, attacksSnap] = await Promise.all([
        refs.players.once('value'),
        refs.attacks.once('value')
      ]);

      const players = playersSnap.val() || {};
      const attacks = attacksSnap.val() || {};

      const jobs = [];

      Object.keys(players).forEach((playerId) => {
        const p = players[playerId] || {};
        const lastSeen = num(p.lastSeen || p.updatedAt || p.joinedAt, 0);
        const inactiveTooLong =
          p.connected === false ||
          (lastSeen > 0 && (nowTs - lastSeen) > PRESENCE_TTL_MS);

        if (inactiveTooLong) {
          jobs.push(
            refs.players.child(playerId).remove().catch(() => {})
          );
        }
      });

      Object.keys(attacks).forEach((attackId) => {
        const atk = attacks[attackId] || {};
        const createdAt = num(atk.createdAt, 0);
        const handledBy = atk.handledBy && typeof atk.handledBy === 'object'
          ? Object.keys(atk.handledBy).length
          : 0;

        const expired = createdAt > 0 && (nowTs - createdAt) > ATTACK_TTL_MS;
        const fullyHandled = handledBy > 0;

        if (expired || fullyHandled) {
          jobs.push(
            refs.attacks.child(attackId).remove().catch(() => {})
          );
        }
      });

      await Promise.all(jobs);
    };

    api.resetRoomIfNeeded = async function () {
      await api.pruneStaleRoom();

      const nowTs = Date.now();

      const [metaSnap, stateSnap, playersSnap] = await Promise.all([
        refs.meta.once('value'),
        refs.state.once('value'),
        refs.players.once('value')
      ]);

      const meta = metaSnap.val() || {};
      const state = stateSnap.val() || {};
      const players = playersSnap.val() || {};

      const activePlayers = Object.values(players).filter(p => isActivePlayer(p, nowTs));
      const activeCount = activePlayers.length;

      const countdownExpired =
        state.status === 'countdown' &&
        num(state.countdownEndsAt, 0) > 0 &&
        num(state.countdownEndsAt, 0) < (nowTs - 5000);

      const matchExpired =
        state.status === 'playing' &&
        num(state.startedAt, 0) > 0 &&
        nowTs > (num(state.startedAt, 0) + ((num(state.plannedSec, plannedSec) + 5) * 1000)) &&
        activeCount <= 1;

      const shouldReset =
        activeCount === 0 ||
        (state.status === 'ended' && activeCount <= 1) ||
        countdownExpired ||
        matchExpired;

      if (!shouldReset) return;

      await refs.attacks.remove().catch(() => {});

      await refs.state.set({
        status: 'waiting',
        plannedSec,
        createdAt: num(state.createdAt, 0) || nowTs,
        updatedAt: nowTs
      });

      await refs.meta.update({
        roomId,
        game: 'goodjunk',
        mode,
        diff,
        hostPid: pid,
        createdAt: num(meta.createdAt, 0) || nowTs,
        updatedAt: nowTs
      });
    };

    api.connect = async function () {
      await api.resetRoomIfNeeded();

      await refs.meta.transaction((current) => {
        current = current || {};
        if (!current.roomId) current.roomId = roomId;
        if (!current.game) current.game = 'goodjunk';
        if (!current.mode) current.mode = mode;
        if (!current.diff) current.diff = diff;
        if (!current.hostPid) current.hostPid = pid;
        if (!current.createdAt) current.createdAt = Date.now();
        current.updatedAt = Date.now();
        return current;
      });

      await refs.state.transaction((current) => {
        current = current || {};
        if (!current.status || current.status === 'ended') current.status = 'waiting';
        if (!current.plannedSec) current.plannedSec = plannedSec;
        if (!current.createdAt) current.createdAt = Date.now();
        current.updatedAt = Date.now();
        return current;
      });

      await api._selfRef.set({
        pid,
        nick,
        connected: true,
        ready: true,
        hp: 100,
        score: 0,
        combo: 0,
        miss: 0,
        acc: 0,
        charge: 0,
        hits: 0,
        badHits: 0,
        totalTap: 0,
        status: 'waiting',
        joinedAt: Date.now(),
        updatedAt: Date.now(),
        lastSeen: Date.now()
      });

      try {
        api._selfRef.onDisconnect().remove();
      } catch (_) {}

      if (api._heartbeatTimer) {
        clearInterval(api._heartbeatTimer);
      }

      api._heartbeatTimer = setInterval(() => {
        api.updateSelf({
          connected: true,
          status: (api.state && api.state.status) || 'waiting'
        }).catch(() => {});
      }, HEARTBEAT_MS);

      const metaHandler = (snap) => {
        api.meta = snap.val() || {};
        api.isHost = api.meta.hostPid === pid;
        api._emitMeta();
      };
      refs.meta.on('value', metaHandler);
      api._offs.push(() => refs.meta.off('value', metaHandler));

      const stateHandler = (snap) => {
        api.state = snap.val() || {};
        api._emitState();
      };
      refs.state.on('value', stateHandler);
      api._offs.push(() => refs.state.off('value', stateHandler));

      const playersHandler = async (snap) => {
        api.players = snap.val() || {};
        try {
          await api.ensureHost();
        } catch (_) {}
        api._emitPlayers();
      };
      refs.players.on('value', playersHandler);
      api._offs.push(() => refs.players.off('value', playersHandler));

      const attackHandler = (snap) => {
        const val = snap.val() || {};
        const id = snap.key;
        api._emitAttack(Object.assign({ id }, val));
      };
      refs.attacks.on('child_added', attackHandler);
      api._offs.push(() => refs.attacks.off('child_added', attackHandler));

      api._connected = true;
      return api;
    };

    api.disconnect = async function () {
      try {
        if (api._heartbeatTimer) {
          clearInterval(api._heartbeatTimer);
          api._heartbeatTimer = 0;
        }
      } catch (_) {}

      try {
        await api._selfRef.remove();
      } catch (_) {}

      while (api._offs.length) {
        const fn = api._offs.pop();
        try { fn(); } catch (_) {}
      }

      api._connected = false;
    };

    return api;
  }

  W.HHAMP = {
    waitForFirebase,
    createBattleRoom
  };
})();