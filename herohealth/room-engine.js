(function (W) {
  'use strict';

  const H = {};
  let _app = null;
  let _auth = null;
  let _db = null;

  function now() { return Date.now(); }

  function makeId(prefix) {
    return (prefix || 'ID') + '_' +
      Math.random().toString(36).slice(2, 6).toUpperCase() +
      Date.now().toString(36).slice(-4).toUpperCase();
  }

  function getFirebase() {
    return W.firebase || null;
  }

  async function ensureAnonAuth() {
    const fb = getFirebase();
    if (!fb) throw new Error('Firebase compat SDK not loaded');

    if (fb.auth().currentUser) return fb.auth().currentUser;

    if (typeof W.HHA_ensureAnonymousAuth === 'function') {
      const user = await W.HHA_ensureAnonymousAuth();
      if (user) return user;
    }

    await fb.auth().signInAnonymously();
    if (!fb.auth().currentUser) throw new Error('Anonymous auth failed');
    return fb.auth().currentUser;
  }

  H.init = async function init(firebaseConfig) {
    const fb = getFirebase();
    if (!fb) throw new Error('Firebase compat SDK not loaded');

    if (!_app) {
      const cfg = firebaseConfig || W.HHA_FIREBASE_CONFIG || W.FIREBASE_CONFIG;
      if (!cfg) throw new Error('Missing Firebase config');

      if (!fb.apps || !fb.apps.length) {
        _app = fb.initializeApp(cfg);
      } else {
        _app = fb.app();
      }

      _auth = fb.auth();
      _db = fb.database();
    }

    await ensureAnonAuth();

    return {
      app: _app,
      auth: _auth,
      db: _db,
      uid: _auth.currentUser ? _auth.currentUser.uid : '',
      user: _auth.currentUser || null
    };
  };

  H.uid = function uid() {
    return _auth && _auth.currentUser ? _auth.currentUser.uid : '';
  };

  H.ref = function ref(path) {
    if (!_db) throw new Error('Call HHA_ROOM.init() first');
    return _db.ref(path);
  };

  H.attachPresence = async function attachPresence(ctx) {
    await H.init();
    ctx = ctx || {};

    const uid = H.uid();
    const path = 'presence/' + uid;
    const ref = H.ref(path);

    const payload = {
      uid,
      pid: ctx.pid || 'anon',
      state: ctx.state || 'online',
      roomId: ctx.roomId || '',
      game: ctx.game || '',
      mode: ctx.mode || '',
      updatedAt: now()
    };

    await ref.set(payload);

    try {
      ref.onDisconnect().set({
        uid,
        pid: ctx.pid || 'anon',
        state: 'offline',
        roomId: '',
        game: ctx.game || '',
        mode: ctx.mode || '',
        updatedAt: getFirebase().database.ServerValue.TIMESTAMP
      });
    } catch (_) {}

    const playerRef = H.ref('players/' + uid);
    await playerRef.update({
      uid,
      pid: ctx.pid || 'anon',
      displayName: ctx.name || '',
      grade: ctx.grade || '',
      lastSeenAt: now()
    });

    return payload;
  };

  H.makeRoomId = function makeRoomId(mode) {
    const p = String(mode || 'RM').slice(0, 2).toUpperCase();
    return makeId(p);
  };

  H.roomBase = function roomBase(game, mode, roomId) {
    return 'rooms/' + game + '/' + mode + '/' + roomId;
  };

  H.matchBase = function matchBase(game, mode, matchId) {
    return 'matches/' + game + '/' + mode + '/' + matchId;
  };

  H.createRoom = async function createRoom(opts) {
    await H.init();
    opts = opts || {};

    const uid = H.uid();
    const game = opts.game;
    const zone = opts.zone;
    const mode = opts.mode;
    const roomId = opts.roomId || H.makeRoomId(mode);
    const base = H.roomBase(game, mode, roomId);

    const meta = {
      roomId,
      game,
      zone,
      mode,
      hostUid: uid,
      state: 'lobby',
      diff: opts.diff || 'normal',
      timeSec: Number(opts.timeSec || 90),
      seed: String(opts.seed || Date.now()),
      capacity: Number(opts.capacity || 2),
      teamMode: !!opts.teamMode,
      createdAt: now(),
      updatedAt: now()
    };

    const player = {
      uid,
      pid: opts.pid || 'anon',
      name: opts.name || '',
      ready: false,
      role: 'host',
      lane: Number(opts.lane || 1),
      joinedAt: now(),
      lastPingAt: now()
    };

    const updates = {};
    updates[base + '/meta'] = meta;
    updates[base + '/players/' + uid] = player;
    updates[base + '/progress/' + uid] = {
      uid,
      pid: opts.pid || 'anon',
      updatedAt: now(),
      progress: 0,
      score: 0,
      miss: 0,
      bestStreak: 0
    };
    updates[base + '/rematchVotes/' + uid] = false;

    await H.ref('/').update(updates);

    try {
      H.ref(base + '/players/' + uid).onDisconnect().remove();
      H.ref(base + '/progress/' + uid).onDisconnect().remove();
      H.ref(base + '/rematch