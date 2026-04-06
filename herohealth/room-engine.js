(function (W) {
  'use strict';

  const H = {};
  let _app = null;
  let _auth = null;
  let _db = null;

  function now() { return Date.now(); }
  function svNow() { return firebase.database.ServerValue.TIMESTAMP; }

  function makeId(prefix) {
    return (prefix || 'ID') + '_' + Math.random().toString(36).slice(2, 6).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
  }

  H.init = async function init(firebaseConfig) {
    if (!W.firebase) throw new Error('Firebase compat SDK not loaded');

    if (!_app) {
      if (!firebase.apps.length) {
        _app = firebase.initializeApp(firebaseConfig || W.HHA_FIREBASE_CONFIG || W.FIREBASE_CONFIG);
      } else {
        _app = firebase.app();
      }
      _auth = firebase.auth();
      _db = firebase.database();
    }

    if (!_auth.currentUser) {
      await _auth.signInAnonymously();
    }

    return {
      app: _app,
      auth: _auth,
      db: _db,
      uid: _auth.currentUser.uid,
      user: _auth.currentUser
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

    ref.onDisconnect().set({
      uid,
      pid: ctx.pid || 'anon',
      state: 'offline',
      roomId: '',
      game: ctx.game || '',
      mode: ctx.mode || '',
      updatedAt: now()
    });

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
    updates[base + '/progress/' + uid] = { updatedAt: now(), progress: 0, score: 0, miss: 0, bestStreak: 0 };
    updates[base + '/rematchVotes/' + uid] = false;

    await H.ref('/').update(updates);

    H.ref(base + '/players/' + uid).onDisconnect().remove();
    H.ref(base + '/progress/' + uid).onDisconnect().remove();
    H.ref(base + '/rematchVotes/' + uid).onDisconnect().remove();

    if (opts.logger) {
      opts.logger.base.room_id = roomId;
      await opts.logger.roomAudit('room_create', {
        room_id: roomId, game, mode, actor_uid: uid, actor_pid: opts.pid || 'anon', meta
      });
    }

    await H.attachPresence({
      pid: opts.pid || 'anon',
      name: opts.name || '',
      game,
      mode,
      roomId,
      state: 'lobby'
    });

    return { roomId, base, meta, player };
  };

  H.joinRoom = async function joinRoom(opts) {
    await H.init();
    opts = opts || {};

    const uid = H.uid();
    const game = opts.game;
    const mode = opts.mode;
    const roomId = opts.roomId;
    const base = H.roomBase(game, mode, roomId);

    const snap = await H.ref(base + '/meta').once('value');
    if (!snap.exists()) throw new Error('Room not found');

    const meta = snap.val();
    if (meta.state !== 'lobby') throw new Error('Room is not joinable');

    const playersSnap = await H.ref(base + '/players').once('value');
    const players = playersSnap.val() || {};
    const count = Object.keys(players).length;
    if (count >= Number(meta.capacity || 2)) throw new Error('Room full');

    const lane = count + 1;

    const player = {
      uid,
      pid: opts.pid || 'anon',
      name: opts.name || '',
      ready: false,
      role: 'peer',
      lane,
      joinedAt: now(),
      lastPingAt: now()
    };

    const updates = {};
    updates[base + '/players/' + uid] = player;
    updates[base + '/progress/' + uid] = { updatedAt: now(), progress: 0, score: 0, miss: 0, bestStreak: 0 };
    updates[base + '/rematchVotes/' + uid] = false;
    updates[base + '/meta/updatedAt'] = now();

    await H.ref('/').update(updates);

    H.ref(base + '/players/' + uid).onDisconnect().remove();
    H.ref(base + '/progress/' + uid).onDisconnect().remove();
    H.ref(base + '/rematchVotes/' + uid).onDisconnect().remove();

    await H.attachPresence({
      pid: opts.pid || 'anon',
      name: opts.name || '',
      game,
      mode,
      roomId,
      state: 'lobby'
    });

    if (opts.logger) {
      opts.logger.base.room_id = roomId;
      await opts.logger.roomAudit('room_join', {
        room_id: roomId, game, mode, actor_uid: uid, actor_pid: opts.pid || 'anon'
      });
    }

    return { roomId, base, player, meta };
  };

  H.setReady = async function setReady(opts) {
    await H.init();
    opts = opts || {};
    const uid = H.uid();
    const base = H.roomBase(opts.game, opts.mode, opts.roomId);

    await H.ref(base + '/players/' + uid).update({
      ready: !!opts.ready,
      lastPingAt: now()
    });

    await H.ref(base + '/meta/updatedAt').set(now());

    if (opts.logger) {
      await opts.logger.roomAudit('ready_' + (!!opts.ready), {
        room_id: opts.roomId, game: opts.game, mode: opts.mode, actor_uid: uid, actor_pid: opts.pid || ''
      });
    }

    return { ok: true };
  };

  H.startMatch = async function startMatch(opts) {
    await H.init();
    opts = opts || {};
    const uid = H.uid();
    const base = H.roomBase(opts.game, opts.mode, opts.roomId);

    const metaSnap = await H.ref(base + '/meta').once('value');
    if (!metaSnap.exists()) throw new Error('Room not found');
    const meta = metaSnap.val();
    if (meta.hostUid !== uid) throw new Error('Only host can start');

    const playersSnap = await H.ref(base + '/players').once('value');
    const players = playersSnap.val() || {};
    const allReady = Object.keys(players).length > 0 && Object.values(players).every(p => !!p.ready);
    if (!allReady) throw new Error('Not all players ready');

    const matchId = makeId('M');

    const updates = {};
    updates[base + '/meta/state'] = 'countdown';
    updates[base + '/meta/countdownAt'] = now() + Number(opts.countdownMs || 3000);
    updates[base + '/meta/matchId'] = matchId;
    updates[base + '/meta/updatedAt'] = now();

    updates[H.matchBase(opts.game, opts.mode, matchId) + '/meta'] = {
      matchId,
      roomId: opts.roomId,
      game: opts.game,
      zone: meta.zone,
      mode: opts.mode,
      hostUid: uid,
      state: 'running',
      seed: String(meta.seed),
      diff: meta.diff,
      timeSec: meta.timeSec,
      startedAt: now(),
      endedAt: ''
    };

    Object.keys(players).forEach(playerUid => {
      const p = players[playerUid];
      updates[H.matchBase(opts.game, opts.mode, matchId) + '/players/' + playerUid] = {
        uid: playerUid,
        pid: p.pid || '',
        score: 0,
        miss: 0,
        bestStreak: 0,
        progress: 0,
        updatedAt: now()
      };
    });

    await H.ref('/').update(updates);

    setTimeout(async () => {
      try {
        await H.ref(base + '/meta').update({
          state: 'running',
          startedAt: now(),
          updatedAt: now()
        });
      } catch (_) {}
    }, Number(opts.countdownMs || 3000));

    if (opts.logger) {
      await opts.logger.roomAudit('match_start', {
        room_id: opts.roomId, match_id: matchId, game: opts.game, mode: opts.mode, actor_uid: uid
      });
    }

    return { ok: true, matchId };
  };

  H.updateProgress = async function updateProgress(opts) {
    await H.init();
    opts = opts || {};
    const uid = H.uid();
    const base = H.roomBase(opts.game, opts.mode, opts.roomId);
    const matchId = opts.matchId || '';

    const progressRow = {
      updatedAt: now(),
      progress: Number(opts.progress || 0),
      score: Number(opts.score || 0),
      miss: Number(opts.miss || 0),
      bestStreak: Number(opts.bestStreak || 0),
      hp: Number.isFinite(Number(opts.hp)) ? Number(opts.hp) : '',
      lives: Number.isFinite(Number(opts.lives)) ? Number(opts.lives) : ''
    };

    const updates = {};
    updates[base + '/progress/' + uid] = progressRow;
    updates[base + '/players/' + uid + '/lastPingAt'] = now();
    updates[base + '/meta/updatedAt'] = now();

    if (matchId) {
      updates[H.matchBase(opts.game, opts.mode, matchId) + '/players/' + uid] = {
        uid,
        pid: opts.pid || '',
        score: Number(opts.score || 0),
        miss: Number(opts.miss || 0),
        bestStreak: Number(opts.bestStreak || 0),
        progress: Number(opts.progress || 0),
        updatedAt: now()
      };
    }

    await H.ref('/').update(updates);
    return { ok: true };
  };

  H.submitResult = async function submitResult(opts) {
    await H.init();
    opts = opts || {};
    const uid = H.uid();
    const base = H.roomBase(opts.game, opts.mode, opts.roomId);

    const row = {
      uid,
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

    const updates = {};
    updates[base + '/results/' + uid] = row;
    updates[base + '/meta/updatedAt'] = now();

    if (opts.matchId) {
      updates[H.matchBase(opts.game, opts.mode, opts.matchId) + '/players/' + uid] = {
        uid,
        pid: opts.pid || 'anon',
        score: Number(opts.score || 0),
        miss: Number(opts.miss || 0),
        bestStreak: Number(opts.bestStreak || 0),
        progress: Number(opts.progress || 1),
        updatedAt: now()
      };
    }

    await H.ref('/').update(updates);

    return row;
  };

  H.finishMatch = async function finishMatch(opts) {
    await H.init();
    opts = opts || {};
    const uid = H.uid();
    const matchBase = H.matchBase(opts.game, opts.mode, opts.matchId);
    const roomBase = H.roomBase(opts.game, opts.mode, opts.roomId);

    const roomMeta = await H.ref(roomBase + '/meta').once('value');
    if (!roomMeta.exists()) throw new Error('Room not found');
    if (roomMeta.val().hostUid !== uid) throw new Error('Only host can finish');

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
    await H.ref(base + '/meta/updatedAt').set(now());

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

    const updates = {};
    updates[base + '/players/' + uid] = null;
    updates[base + '/progress/' + uid] = null;
    updates[base + '/results/' + uid] = null;
    updates[base + '/rematchVotes/' + uid] = null;
    updates[base + '/meta/updatedAt'] = now();

    const remaining = Object.keys(players).filter(k => k !== uid);

    if (meta.hostUid === uid) {
      if (!remaining.length) {
        updates[base] = null;
      } else {
        updates[base + '/meta/state'] = 'aborted';
      }
    }

    await H.ref('/').update(updates);

    await H.attachPresence({
      pid: opts.pid || 'anon',
      name: opts.name || '',
      game: opts.game,
      mode: opts.mode,
      roomId: '',
      state: 'online'
    });

    if (opts.logger) {
      await opts.logger.roomAudit('room_leave', {
        room_id: opts.roomId, game: opts.game, mode: opts.mode, actor_uid: uid, actor_pid: opts.pid || ''
      });
    }

    return { ok: true };
  };

  H.watchRoom = function watchRoom(opts) {
    opts = opts || {};
    const base = H.roomBase(opts.game, opts.mode, opts.roomId);
    const ref = H.ref(base);

    const handler = snap => {
      if (opts.onValue) opts.onValue(snap.val() || null, snap);
    };

    ref.on('value', handler);
    return function unwatch() {
      ref.off('value', handler);
    };
  };

  H.watchOpenRooms = function watchOpenRooms(opts) {
    opts = opts || {};
    const ref = H.ref('rooms/' + opts.game + '/' + opts.mode)
      .orderByChild('meta/state')
      .equalTo('lobby');

    const handler = snap => {
      const out = [];
      snap.forEach(child => {
        const val = child.val() || {};
        out.push({
          roomId: child.key,
          meta: val.meta || {},
          players: val.players || {}
        });
      });
      if (opts.onValue) opts.onValue(out, snap);
    };

    ref.on('value', handler);
    return function unwatch() {
      ref.off('value', handler);
    };
  };

  W.HHA_ROOM = H;
})(window);
