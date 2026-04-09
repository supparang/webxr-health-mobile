(function (W) {
  'use strict';

  if (W.HHA_ROOM) return;

  const H = {};
  let _app = null;
  let _auth = null;
  let _db = null;

  function now() {
    return Date.now();
  }

  function fb() {
    return W.firebase || null;
  }

  function ensureConfig(firebaseConfig) {
    return (
      firebaseConfig ||
      W.HHA_FIREBASE_CONFIG ||
      W.__HHA_FIREBASE_CONFIG__ ||
      W.FIREBASE_CONFIG ||
      W.firebaseConfig ||
      W.__firebaseConfig ||
      null
    );
  }

  function makeId(prefix) {
    return String(prefix || 'ID') + '_' +
      Math.random().toString(36).slice(2, 6).toUpperCase() +
      Date.now().toString(36).slice(-4).toUpperCase();
  }

  async function ensureAnonAuth() {
    const F = fb();
    if (!F) throw new Error('Firebase compat SDK not loaded');

    const auth = F.auth();

    if (auth.currentUser) return auth.currentUser;

    if (typeof W.HHA_ensureAnonymousAuth === 'function') {
      const user = await W.HHA_ensureAnonymousAuth();
      if (user) return user;
    }

    await auth.signInAnonymously();

    if (auth.currentUser) return auth.currentUser;

    await new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error('Anonymous auth timeout'));
      }, 10000);

      const off = auth.onAuthStateChanged(function (user) {
        if (done) return;
        if (!user) return;
        done = true;
        clearTimeout(timer);
        try { off(); } catch (_) {}
        resolve(user);
      }, function (err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { off(); } catch (_) {}
        reject(err || new Error('Anonymous auth failed'));
      });
    });

    if (!auth.currentUser) {
      throw new Error('Anonymous auth finished without currentUser');
    }

    return auth.currentUser;
  }

  H.init = async function init(firebaseConfig) {
    const F = fb();
    if (!F) throw new Error('Firebase compat SDK not loaded');

    const cfg = ensureConfig(firebaseConfig);
    if (!cfg) throw new Error('Missing Firebase config');

    if (!_app) {
      if (!F.apps || !F.apps.length) {
        _app = F.initializeApp(cfg);
      } else {
        _app = F.app();
      }
      _auth = F.auth();
      _db = F.database();
    }

    await ensureAnonAuth();

    return {
      app: _app,
      auth: _auth,
      db: _db,
      uid: _auth && _auth.currentUser ? _auth.currentUser.uid : '',
      user: _auth ? _auth.currentUser : null
    };
  };

  H.uid = function uid() {
    return _auth && _auth.currentUser ? _auth.currentUser.uid : '';
  };

  H.ref = function ref(path) {
    if (!_db) throw new Error('Call HHA_ROOM.init() first');
    return _db.ref(path);
  };

  H.makeRoomId = function makeRoomId(mode) {
    const p = String(mode || 'RM').slice(0, 2).toUpperCase();
    return makeId(p);
  };

  H.roomBase = function roomBase(game, mode, roomId) {
    return 'rooms/' + String(game) + '/' + String(mode) + '/' + String(roomId);
  };

  H.matchBase = function matchBase(game, mode, matchId) {
    return 'matches/' + String(game) + '/' + String(mode) + '/' + String(matchId);
  };

  H.attachPresence = async function attachPresence(ctx) {
    await H.init();
    ctx = ctx || {};

    const uid = H.uid();
    const presencePath = 'presence/' + uid;
    const ref = H.ref(presencePath);

    const payload = {
      uid: uid,
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
        uid: uid,
        pid: ctx.pid || 'anon',
        state: 'offline',
        roomId: '',
        game: ctx.game || '',
        mode: ctx.mode || '',
        updatedAt: fb().database.ServerValue.TIMESTAMP
      });
    } catch (_) {}

    const profileRef = H.ref('players/' + uid);
    await profileRef.update({
      uid: uid,
      pid: ctx.pid || 'anon',
      displayName: ctx.name || '',
      grade: ctx.grade || '',
      lastSeenAt: now()
    });

    return payload;
  };

  H.createRoom = async function createRoom(opts) {
    await H.init();
    opts = opts || {};

    const uid = H.uid();
    const game = opts.game || 'goodjunk';
    const zone = opts.zone || '';
    const mode = opts.mode || 'duet';
    const roomId = opts.roomId || H.makeRoomId(mode);
    const base = H.roomBase(game, mode, roomId);

    const meta = {
      roomId: roomId,
      game: game,
      zone: zone,
      mode: mode,
      hostUid: uid,
      state: 'lobby',
      diff: opts.diff || 'normal',
      timeSec: Number(opts.timeSec || 90),
      seed: String(opts.seed || now()),
      capacity: Number(opts.capacity || 2),
      teamMode: !!opts.teamMode,
      createdAt: now(),
      updatedAt: now()
    };

    const player = {
      uid: uid,
      pid: opts.pid || 'anon',
      name: opts.name || '',
      ready: false,
      role: 'host',
      lane: Number(opts.lane || 1),
      joinedAt: now(),
      lastSeen: now()
    };

    const updates = {};
    updates[base + '/meta'] = meta;
    updates[base + '/players/' + uid] = player;
    updates[base + '/progress/' + uid] = {
      uid: uid,
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
      H.ref(base + '/rematchVotes/' + uid).onDisconnect().remove();
    } catch (_) {}

    await H.attachPresence({
      pid: opts.pid || 'anon',
      name: opts.name || '',
      game: game,
      mode: mode,
      roomId: roomId,
      state: 'lobby'
    });

    if (opts.logger && typeof opts.logger.roomAudit === 'function') {
      try {
        opts.logger.base.room_id = roomId;
        await opts.logger.roomAudit('room_create', {
          room_id: roomId,
          game: game,
          mode: mode,
          actor_uid: uid,
          actor_pid: opts.pid || 'anon',
          meta: meta
        });
      } catch (_) {}
    }

    return { roomId: roomId, base: base, meta: meta, player: player };
  };

  H.joinRoom = async function joinRoom(opts) {
    await H.init();
    opts = opts || {};

    const uid = H.uid();
    const game = opts.game || 'goodjunk';
    const mode = opts.mode || 'duet';
    const roomId = opts.roomId;
    if (!roomId) throw new Error('Missing roomId');

    const base = H.roomBase(game, mode, roomId);
    const metaSnap = await H.ref(base + '/meta').once('value');
    if (!metaSnap.exists()) throw new Error('Room not found');

    const meta = metaSnap.val() || {};
    if (String(meta.state || 'lobby') !== 'lobby') {
      throw new Error('Room is not joinable');
    }

    const playersSnap = await H.ref(base + '/players').once('value');
    const players = playersSnap.val() || {};
    const count = Object.keys(players).length;
    if (count >= Number(meta.capacity || 2)) {
      throw new Error('Room full');
    }

    const lane = count + 1;
    const player = {
      uid: uid,
      pid: opts.pid || 'anon',
      name: opts.name || '',
      ready: false,
      role: 'guest',
      lane: lane,
      joinedAt: now(),
      lastSeen: now()
    };

    const updates = {};
    updates[base + '/players/' + uid] = player;
    updates[base + '/progress/' + uid] = {
      uid: uid,
      pid: opts.pid || 'anon',
      updatedAt: now(),
      progress: 0,
      score: 0,
      miss: 0,
      bestStreak: 0
    };
    updates[base + '/rematchVotes/' + uid] = false;
    updates[base + '/meta/updatedAt'] = now();

    await H.ref('/').update(updates);

    try {
      H.ref(base + '/players/' + uid).onDisconnect().remove();
      H.ref(base + '/progress/' + uid).onDisconnect().remove();
      H.ref(base + '/rematchVotes/' + uid).onDisconnect().remove();
    } catch (_) {}

    await H.attachPresence({
      pid: opts.pid || 'anon',
      name: opts.name || '',
      game: game,
      mode: mode,
      roomId: roomId,
      state: 'lobby'
    });

    if (opts.logger && typeof opts.logger.roomAudit === 'function') {
      try {
        opts.logger.base.room_id = roomId;
        await opts.logger.roomAudit('room_join', {
          room_id: roomId,
          game: game,
          mode: mode,
          actor_uid: uid,
          actor_pid: opts.pid || 'anon'
        });
      } catch (_) {}
    }

    return { roomId: roomId, base: base, player: player, meta: meta };
  };

  H.setReady = async function setReady(opts) {
    await H.init();
    opts = opts || {};

    const uid = H.uid();
    const base = H.roomBase(opts.game, opts.mode, opts.roomId);

    await H.ref(base + '/players/' + uid).update({
      ready: !!opts.ready,
      lastSeen: now()
    });

    await H.ref(base + '/meta').update({
      updatedAt: now()
    });

    if (opts.logger && typeof opts.logger.roomAudit === 'function') {
      try {
        await opts.logger.roomAudit('ready_' + (!!opts.ready), {
          room_id: opts.roomId,
          game: opts.game,
          mode: opts.mode,
          actor_uid: uid,
          actor_pid: opts.pid || ''
        });
      } catch (_) {}
    }

    return { ok: true };
  };

  H.startMatch = async function startMatch(opts) {
    await H.init();
    opts = opts || {};

    const uid = H.uid();
    const game = opts.game || 'goodjunk';
    const mode = opts.mode || 'duet';
    const roomId = opts.roomId;
    const base = H.roomBase(game, mode, roomId);

    const metaSnap = await H.ref(base + '/meta').once('value');
    if (!metaSnap.exists()) throw new Error('Room not found');

    const meta = metaSnap.val() || {};
    if (String(meta.hostUid || '') !== String(uid)) {
      throw new Error('Only host can start');
    }

    const playersSnap = await H.ref(base + '/players').once('value');
    const players = playersSnap.val() || {};
    const keys = Object.keys(players);
    const allReady = keys.length > 0 && keys.every(function (k) {
      return !!players[k].ready;
    });

    if (!allReady) throw new Error('Not all players ready');

    const matchId = makeId('M');
    const countdownMs = Number(opts.countdownMs || 3000);
    const countdownAt = now() + countdownMs;
    const matchBase = H.matchBase(game, mode, matchId);

    const updates = {};
    updates[base + '/meta/matchId'] = matchId;
    updates[base + '/meta/state'] = 'countdown';
    updates[base + '/meta/countdownAt'] = countdownAt;
    updates[base + '/meta/updatedAt'] = now();

    updates[matchBase + '/meta'] = {
      matchId: matchId,
      roomId: roomId,
      game: game,
      zone: meta.zone || '',
      mode: mode,
      hostUid: uid,
      state: 'running',
      seed: String(meta.seed || now()),
      diff: meta.diff || 'normal',
      timeSec: Number(meta.timeSec || 90),
      startedAt: now(),
      endedAt: ''
    };

    await H.ref('/').update(updates);

    setTimeout(function () {
      H.ref(base + '/meta').update({
        state: 'running',
        startedAt: now(),
        updatedAt: now()
      }).catch(function(){});
    }, countdownMs);

    if (opts.logger && typeof opts.logger.roomAudit === 'function') {
      try {
        await opts.logger.roomAudit('match_start', {
          room_id: roomId,
          match_id: matchId,
          game: game,
          mode: mode,
          actor_uid: uid
        });
      } catch (_) {}
    }

    return { ok: true, matchId: matchId, countdownAt: countdownAt };
  };

  H.updateProgress = async function updateProgress(opts) {
    await H.init();
    opts = opts || {};

    const uid = H.uid();
    const base = H.roomBase(opts.game, opts.mode, opts.roomId);

    const row = {
      uid: uid,
      pid: opts.pid || '',
      updatedAt: now(),
      progress: Number(opts.progress || 0),
      score: Number(opts.score || 0),
      miss: Number(opts.miss || 0),
      bestStreak: Number(opts.bestStreak || 0),
      hp: Number.isFinite(Number(opts.hp)) ? Number(opts.hp) : '',
      lives: Number.isFinite(Number(opts.lives)) ? Number(opts.lives) : ''
    };

    try {
      await H.ref(base + '/progress/' + uid).set(row);
    } catch (err) {
      console.error('[HHA_ROOM.updateProgress] progress write failed', {
        roomId: opts.roomId,
        uid: uid,
        path: base + '/progress/' + uid,
        err: err && err.message ? err.message : err
      });
      throw err;
    }

    return { ok: true };
  };

  H.submitResult = async function submitResult(opts) {
    await H.init();
    opts = opts || {};

    const uid = H.uid();
    const base = H.roomBase(opts.game, opts.mode, opts.roomId);

    const row = {
      uid: uid,
      pid: opts.pid || 'anon',
      score: Number(opts.score || 0),
      miss: Number(opts.miss || 0),
      bestStreak: Number(opts.bestStreak || 0),
      finished: !!opts.finished,
      rank: Number.isFinite(Number(opts.rank)) ? Number(opts.rank) : '',
      contribution: Number.isFinite(Number(opts.contribution)) ? Number(opts.contribution) : '',
      accuracy: Number.isFinite(Number(opts.accuracy)) ? Number(opts.accuracy) : '',
      updatedAt: now()
    };

    try {
      await H.ref(base + '/results/' + uid).set(row);
      await H.ref(base + '/players/' + uid).update({
        finished: !!opts.finished,
        finalScore: Number(opts.score || 0),
        updatedAt: now(),
        lastSeen: now()
      });
    } catch (err) {
      console.error('[HHA_ROOM.submitResult] results write failed', {
        roomId: opts.roomId,
        uid: uid,
        path: base + '/results/' + uid,
        err: err && err.message ? err.message : err
      });
      throw err;
    }

    return row;
  };

  H.finishMatch = async function finishMatch(opts) {
    await H.init();
    opts = opts || {};

    const uid = H.uid();
    const matchBase = H.matchBase(opts.game, opts.mode, opts.matchId);
    const roomBase = H.roomBase(opts.game, opts.mode, opts.roomId);

    const roomMetaSnap = await H.ref(roomBase + '/meta').once('value');
    if (!roomMetaSnap.exists()) throw new Error('Room not found');

    const roomMeta = roomMetaSnap.val() || {};
    if (String(roomMeta.hostUid || '') !== String(uid)) {
      throw new Error('Only host can finish');
    }

    const updates = {};
    updates[matchBase + '/meta/state'] = 'ended';
    updates[matchBase + '/meta/endedAt'] = now();
    updates[roomBase + '/meta/state'] = 'ended';
    updates[roomBase + '/meta/updatedAt'] = now();

    if (opts.team) {
      updates[matchBase + '/team'] = Object.assign({}, opts.team, { updatedAt: now() });
    }

    await H.ref('/').update(updates);
    return { ok: true };
  };

  H.voteRematch = async function voteRematch(opts) {
    await H.init();
    opts = opts || {};

    const uid = H.uid();
    const base = H.roomBase(opts.game, opts.mode, opts.roomId);

    await H.ref(base + '/rematchVotes/' + uid).set(!!opts.vote);
    await H.ref(base + '/meta').update({ updatedAt: now() });
    return { ok: true };
  };

  H.leaveRoom = async function leaveRoom(opts) {
    await H.init();
    opts = opts || {};

    const uid = H.uid();
    const base = H.roomBase(opts.game, opts.mode, opts.roomId);

    const metaSnap = await H.ref(base + '/meta').once('value');
    const playersSnap = await H.ref(base + '/players').once('value');

    const meta = metaSnap.val() || {};
    const players = playersSnap.val() || {};
    const remaining = Object.keys(players).filter(function (k) {
      return k !== uid;
    });

    const updates = {};
    updates[base + '/players/' + uid] = null;
    updates[base + '/progress/' + uid] = null;
    updates[base + '/results/' + uid] = null;
    updates[base + '/rematchVotes/' + uid] = null;

    if (String(meta.hostUid || '') === String(uid)) {
      if (!remaining.length) {
        updates[base] = null;
      } else {
        updates[base + '/meta/state'] = 'aborted';
        updates[base + '/meta/updatedAt'] = now();
      }
    } else {
      updates[base + '/meta/updatedAt'] = now();
    }

    await H.ref('/').update(updates);

    await H.attachPresence({
      pid: opts.pid || 'anon',
      name: opts.name || '',
      game: opts.game || '',
      mode: opts.mode || '',
      roomId: '',
      state: 'online'
    });

    if (opts.logger && typeof opts.logger.roomAudit === 'function') {
      try {
        await opts.logger.roomAudit('room_leave', {
          room_id: opts.roomId,
          game: opts.game,
          mode: opts.mode,
          actor_uid: uid,
          actor_pid: opts.pid || ''
        });
      } catch (_) {}
    }

    return { ok: true };
  };

  H.watchRoom = function watchRoom(opts) {
    opts = opts || {};
    const base = H.roomBase(opts.game, opts.mode, opts.roomId);
    const ref = H.ref(base);

    const handler = function (snap) {
      if (opts.onValue) opts.onValue(snap.val() || null, snap);
    };

    ref.on('value', handler);

    return function unwatch() {
      ref.off('value', handler);
    };
  };

  H.watchOpenRooms = function watchOpenRooms(opts) {
    opts = opts || {};

    const ref = H.ref('rooms/' + String(opts.game) + '/' + String(opts.mode))
      .orderByChild('meta/state')
      .equalTo('lobby');

    const handler = function (snap) {
      const rows = [];
      snap.forEach(function (child) {
        const val = child.val() || {};
        rows.push({
          roomId: child.key,
          meta: val.meta || {},
          players: val.players || {}
        });
      });

      if (opts.onValue) opts.onValue(rows, snap);
    };

    ref.on('value', handler);

    return function unwatch() {
      ref.off('value', handler);
    };
  };

  W.HHA_ROOM = H;
})(window);