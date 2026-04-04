'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-race.js
 * GoodJunk Race Controller
 * FULL PATCH v20260404-race-controller-compare-full
 * ========================================================= */
(function(){
  var W = window;
  var D = document;

  function qs(key, fallback) {
    try {
      var u = new URL(location.href);
      var v = u.searchParams.get(key);
      return v == null ? (fallback || '') : v;
    } catch (_) {
      return fallback || '';
    }
  }

  function now() {
    return Date.now();
  }

  function wait(ms) {
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function num(v, d) {
    v = Number(v);
    return Number.isFinite(v) ? v : (d || 0);
  }

  function clean(v) {
    return String(v == null ? '' : v).trim();
  }

  function dispatch(name, detail) {
    try {
      W.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (_) {}
  }

  function loadExternalScript(src) {
    return new Promise(function(resolve, reject){
      var s = D.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function(){ resolve(src); };
      s.onerror = function(){ reject(new Error('โหลด script ไม่สำเร็จ: ' + src)); };
      D.head.appendChild(s);
    });
  }

  function cfgVersioned(path) {
    var u = new URL(path, location.href);
    u.searchParams.set('v', '20260404-race-controller-compare-full');
    return u.toString();
  }

  var ctx = {
    mode: 'race',
    pid: qs('pid', 'anon'),
    name: qs('name', qs('nick', 'Player')),
    roomId: qs('roomId', qs('room', '')),
    roomKind: qs('roomKind', ''),
    role: qs('role', 'player'),
    diff: qs('diff', 'normal'),
    time: num(qs('time', '120'), 120),
    seed: qs('seed', String(now())),
    startAt: num(qs('startAt', '0'), 0),
    hub: qs('hub', '../hub.html'),
    wait: qs('wait', '0'),
    host: qs('host', '0'),
    view: qs('view', 'mobile')
  };

  var S = {
    appReady: false,
    db: null,
    auth: null,
    uid: '',
    roomKind: clean(ctx.roomKind),
    refs: null,
    state: {},
    match: {},
    players: {},
    results: {},
    localSummary: null,
    resultSubmitted: false,
    finalSummarySent: false,
    fallbackTimer: 0,
    resultsOff: null,
    stateOff: null,
    matchOff: null,
    playersOff: null,
    metaOff: null
  };

  function debug(tag, extra) {
    console.log('[GJ-RACE-CTRL]', tag, extra || {});
    dispatch('gj:race-debug', {
      tag: tag,
      roomId: ctx.roomId,
      roomKind: S.roomKind,
      stateStatus: S.state && S.state.status,
      matchStatus: S.match && S.match.status,
      participantIds: Array.isArray(S.state && S.state.participantIds) ? S.state.participantIds : [],
      resultCount: Object.keys(S.results || {}).length,
      runStarted: S.appReady,
      resultSubmitted: S.resultSubmitted,
      finalSummarySent: S.finalSummarySent,
      extra: extra || {}
    });
  }

  function roomPath(kind, roomId) {
    return 'hha-battle/goodjunk/' + kind + '/' + roomId;
  }

  function buildRefs(root) {
    return {
      root: root,
      meta: root.child('meta'),
      state: root.child('state'),
      match: root.child('match'),
      players: root.child('players'),
      results: root.child('results')
    };
  }

  async function ensureFirebase() {
    if (!W.firebase || typeof W.firebase.initializeApp !== 'function') {
      await loadExternalScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
      await loadExternalScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js');
      await loadExternalScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js');
    }

    if (!W.HHA_FIREBASE_CONFIG && !W.firebaseConfig && !W.__firebaseConfig) {
      await loadExternalScript(cfgVersioned('../firebase-config.js'));
    }

    var cfg =
      W.HHA_FIREBASE_CONFIG ||
      W.firebaseConfig ||
      W.__firebaseConfig ||
      W.FIREBASE_CONFIG ||
      null;

    if (!cfg) {
      throw new Error('missing firebase config');
    }

    if (!W.firebase.apps || !W.firebase.apps.length) {
      W.firebase.initializeApp(cfg);
    }

    S.db = W.firebase.database();
    S.auth = W.firebase.auth();

    if (S.auth.currentUser && S.auth.currentUser.uid) {
      S.uid = S.auth.currentUser.uid;
      return true;
    }

    await S.auth.signInAnonymously();

    await new Promise(function(resolve, reject){
      var done = false;
      var timer = setTimeout(function(){
        if (done) return;
        done = true;
        reject(new Error('firebase auth timeout'));
      }, 12000);

      var off = S.auth.onAuthStateChanged(function(user){
        if (done) return;
        if (user && user.uid) {
          done = true;
          clearTimeout(timer);
          try { off(); } catch (_) {}
          S.uid = user.uid;
          resolve(true);
        }
      }, function(err){
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { off(); } catch (_) {}
        reject(err || new Error('firebase auth failed'));
      });
    });

    return true;
  }

  async function detectRoomKind() {
    var preferred = clean(ctx.roomKind);
    var order = preferred ? [preferred, 'raceRooms', 'rooms'] : ['raceRooms', 'rooms'];
    var seen = {};

    for (var i = 0; i < order.length; i++) {
      var kind = order[i];
      if (!kind || seen[kind]) continue;
      seen[kind] = true;

      try {
        var snap = await S.db.ref(roomPath(kind, ctx.roomId)).child('meta').once('value');
        if (snap.exists()) {
          S.roomKind = kind;
          return kind;
        }
      } catch (_) {}
    }

    S.roomKind = preferred || 'rooms';
    return S.roomKind;
  }

  function normalizeIncomingSummary(detail) {
    var src = (detail && typeof detail === 'object' && detail.summary && typeof detail.summary === 'object')
      ? detail.summary
      : (detail || {});

    return {
      pid: ctx.pid,
      nick: ctx.name,
      score: num(src.score || src.totalScore || src.playerScore || src.myScore, 0),
      miss: num(src.miss || src.misses || src.totalMiss, 0),
      goodHit: num(src.goodHit || src.hitsGood || src.goodHits || src.correct, 0),
      junkHit: num(src.junkHit || src.hitsBad || src.junkHits || src.wrong, 0),
      bestStreak: num(src.bestStreak || src.streak || src.comboMax, 0),
      duration: num(src.duration || src.durationSec || src.timeUsed, 0),
      reason: clean(src.reason || src.finishReason || src.endReason || 'finished'),
      submittedAt: now(),
      updatedAt: now()
    };
  }

  function computeStandings(resultsObj) {
    var rows = Object.keys(resultsObj || {}).map(function(pid){
      var r = resultsObj[pid] || {};
      return {
        pid: clean(r.pid || pid),
        nick: clean(r.nick || r.name || pid || 'player'),
        score: num(r.score, 0),
        miss: num(r.miss, 0),
        goodHit: num(r.goodHit, 0),
        junkHit: num(r.junkHit, 0),
        bestStreak: num(r.bestStreak, 0),
        duration: num(r.duration, 0),
        reason: clean(r.reason || '')
      };
    });

    rows.sort(function(a, b){
      if (b.score !== a.score) return b.score - a.score;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      return String(a.pid).localeCompare(String(b.pid));
    });

    rows.forEach(function(r, i){
      r.rank = i + 1;
    });

    return rows;
  }

  function buildCompareSummary(standings) {
    var me = null;
    var opponent = null;

    for (var i = 0; i < standings.length; i++) {
      var row = standings[i];
      if (String(row.pid) === String(ctx.pid)) {
        me = row;
      }
    }

    for (var j = 0; j < standings.length; j++) {
      var row2 = standings[j];
      if (!me || String(row2.pid) !== String(me.pid)) {
        opponent = row2;
        break;
      }
    }

    var delta = num((me && me.score) || 0, 0) - num((opponent && opponent.score) || 0, 0);

    return {
      controllerFinal: true,
      roomId: ctx.roomId,
      pid: ctx.pid,
      name: ctx.name,
      role: ctx.role,
      rank: me ? me.rank : '',
      score: me ? me.score : 0,
      players: standings.length,
      miss: me ? me.miss : 0,
      goodHit: me ? me.goodHit : 0,
      junkHit: me ? me.junkHit : 0,
      bestStreak: me ? me.bestStreak : 0,
      duration: me ? me.duration : 0,
      reason: 'compare-ready',
      result: me && me.rank === 1 ? 'เข้าเส้นชัยเป็นที่ 1' : 'จบรอบแล้ว',
      standings: standings,
      compare: {
        me: me,
        opponent: opponent,
        delta: delta
      }
    };
  }

  async function submitOwnResult(summary) {
    if (!S.refs) return;
    if (!summary) return;

    S.localSummary = summary;

    await S.refs.results.child(ctx.pid).set({
      pid: ctx.pid,
      nick: ctx.name,
      score: num(summary.score, 0),
      miss: num(summary.miss, 0),
      goodHit: num(summary.goodHit, 0),
      junkHit: num(summary.junkHit, 0),
      bestStreak: num(summary.bestStreak, 0),
      duration: num(summary.duration, 0),
      reason: clean(summary.reason || 'finished'),
      submittedAt: now(),
      updatedAt: now()
    });

    await S.refs.players.child(ctx.pid).update({
      phase: 'summary',
      finished: true,
      finalScore: num(summary.score, 0),
      score: num(summary.score, 0),
      miss: num(summary.miss, 0),
      streak: num(summary.bestStreak, 0),
      updatedAt: now(),
      lastSeen: now()
    }).catch(function(){});

    S.resultSubmitted = true;
    debug('submitOwnResult', { score: summary.score });
  }

  async function finalizeRoomIfNeeded(standings) {
    if (!S.refs) return;
    if (!Array.isArray(standings) || standings.length < 2) return;
    if (S.finalSummarySent && String((S.state && S.state.status) || '') === 'ended') return;
    if (!(String(ctx.host) === '1' || String((S.players[ctx.pid] && S.players[ctx.pid].pid) || '') === String((S.state && S.state.hostPid) || ''))) {
      if (!(S.state && Array.isArray(S.state.participantIds) && S.state.participantIds[0] === ctx.pid)) {
        return;
      }
    }

    var winner = standings[0] || null;
    var loser = standings[1] || null;

    await S.refs.match.update({
      status: 'finished',
      participantIds: standings.map(function(r){ return r.pid; }),
      finishedAt: now(),
      winnerId: winner ? winner.pid : '',
      loserId: loser ? loser.pid : ''
    }).catch(function(){});

    await S.refs.state.update({
      status: 'ended',
      participantIds: standings.map(function(r){ return r.pid; }),
      winnerId: winner ? winner.pid : '',
      loserId: loser ? loser.pid : '',
      endedAt: now(),
      updatedAt: now()
    }).catch(function(){});

    debug('finalizeRoomIfNeeded', {
      winnerId: winner ? winner.pid : '',
      loserId: loser ? loser.pid : ''
    });
  }

  function emitFinalCompareSummary(standings) {
    var summary = buildCompareSummary(standings);
    S.finalSummarySent = true;
    dispatch('gj:race-summary', summary);
    debug('emitFinalCompareSummary', {
      rank: summary.rank,
      score: summary.score
    });
  }

  function maybeClearFallbackTimer() {
    if (S.fallbackTimer) {
      clearTimeout(S.fallbackTimer);
      S.fallbackTimer = 0;
    }
  }

  function scheduleFallbackSummary() {
    maybeClearFallbackTimer();

    if (!S.localSummary) return;
    if (S.finalSummarySent) return;

    S.fallbackTimer = setTimeout(function(){
      if (S.finalSummarySent) return;
      var localOnly = {
        controllerFinal: true,
        roomId: ctx.roomId,
        pid: ctx.pid,
        name: ctx.name,
        role: ctx.role,
        rank: '',
        score: num(S.localSummary.score, 0),
        players: Object.keys(S.results || {}).length || 1,
        miss: num(S.localSummary.miss, 0),
        goodHit: num(S.localSummary.goodHit, 0),
        junkHit: num(S.localSummary.junkHit, 0),
        bestStreak: num(S.localSummary.bestStreak, 0),
        duration: num(S.localSummary.duration, 0),
        reason: 'fallback-local',
        result: 'จบรอบแล้ว',
        standings: computeStandings(S.results || {}),
        compare: null
      };
      S.finalSummarySent = true;
      dispatch('gj:race-summary', localOnly);
      debug('fallbackSummary', localOnly);
    }, 6500);
  }

  async function onResultsChanged(snap) {
    S.results = snap.val() || {};
    var standings = computeStandings(S.results || {});
    var count = standings.length;

    debug('resultsChanged', { count: count });

    if (count >= 2) {
      maybeClearFallbackTimer();
      await finalizeRoomIfNeeded(standings);
      emitFinalCompareSummary(standings);
      return;
    }

    if (S.resultSubmitted) {
      scheduleFallbackSummary();
    }
  }

  async function onStateChanged(snap) {
    S.state = snap.val() || {};
    debug('stateChanged', {
      status: S.state.status,
      participantIds: S.state.participantIds || []
    });
  }

  async function onMatchChanged(snap) {
    S.match = snap.val() || {};
    debug('matchChanged', { status: S.match.status });
  }

  async function onPlayersChanged(snap) {
    S.players = snap.val() || {};
    debug('playersChanged', { count: Object.keys(S.players || {}).length });
  }

  function bindSummaryCapture() {
    function handler(evt) {
      var detail = evt && evt.detail ? evt.detail : null;
      if (!detail || typeof detail !== 'object') return;
      if (detail && detail.controllerFinal === true) return;

      var normalized = normalizeIncomingSummary(detail);
      submitOwnResult(normalized)
        .then(function(){ return onResultsChanged({ val: function(){ return S.results || {}; } }); })
        .catch(function(err){ console.error('[GJ-RACE-CTRL] submit summary failed', err); });
    }

    W.addEventListener('gj:summary', handler);
    W.addEventListener('hha:summary', handler);
    W.addEventListener('hha:session-summary', handler);
  }

  async function initRoomBindings() {
    if (!ctx.roomId) {
      debug('no-roomId');
      return;
    }

    await detectRoomKind();

    var root = S.db.ref(roomPath(S.roomKind, ctx.roomId));
    S.refs = buildRefs(root);

    S.refs.state.on('value', onStateChanged);
    S.refs.match.on('value', onMatchChanged);
    S.refs.players.on('value', onPlayersChanged);
    S.refs.results.on('value', function(snap){
      onResultsChanged(snap).catch(function(err){
        console.error('[GJ-RACE-CTRL] results watcher failed', err);
      });
    });

    await S.refs.players.child(ctx.pid).update({
      pid: ctx.pid,
      nick: ctx.name,
      connected: true,
      phase: 'run',
      updatedAt: now(),
      lastSeen: now()
    }).catch(function(){});

    try {
      S.refs.players.child(ctx.pid).onDisconnect().remove();
    } catch (_) {}

    debug('initRoomBindings', {
      roomKind: S.roomKind,
      roomId: ctx.roomId
    });
  }

  async function init() {
    try {
      await ensureFirebase();
      await initRoomBindings();
      bindSummaryCapture();
      S.appReady = true;
      debug('ready', {
        roomId: ctx.roomId,
        roomKind: S.roomKind,
        pid: ctx.pid
      });
    } catch (err) {
      console.error('[GJ-RACE-CTRL] init failed', err);
      debug('init-failed', { message: String(err && err.message ? err.message : err) });
    }
  }

  init();
})();