// /herohealth/vr-goodjunk/goodjunk-duet-room-bootstrap.js
// GoodJunk Duet Room Bootstrap + Shared Final Summary Bridge
// PATCH v20260413b-GJ-DUET-ROOM-BOOTSTRAP-PROD

(function () {
  'use strict';

  const qs = new URLSearchParams(location.search);
  const DEBUG = qs.get('debug') === '1';

  const roomId = String(qs.get('roomId') || qs.get('room') || '').trim();
  const pid = String(qs.get('pid') || 'anon').trim();
  const name = String(qs.get('name') || qs.get('nick') || 'Hero').trim();
  const role = String(qs.get('role') || '').trim().toLowerCase();
  const hostFlag = String(qs.get('host') || '0').trim();
  const pagePath = String(location.pathname || '').toLowerCase();

  const runtimePathDefault = './goodjunk-duet-runtime.html';
  const hubDefault = qs.get('hub') || '../hub-v2.html';

  function dlog() {
    if (!DEBUG) return;
    try { console.log('[GJ-DUET-BOOT]', ...arguments); } catch (_) {}
  }

  function clampNum(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function firstNonEmpty() {
    for (let i = 0; i < arguments.length; i++) {
      const v = String(arguments[i] || '').trim();
      if (v) return v;
    }
    return '';
  }

  function isRuntimePage() {
    return pagePath.indexOf('goodjunk-duet-runtime') >= 0;
  }

  function isHostLike() {
    return role === 'host' || hostFlag === '1';
  }

  function randomSuffix() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function createMatchId() {
    return `MT-${Date.now()}-${randomSuffix()}`;
  }

  function buildLocalSummaryKey(matchId) {
    return `HHA_GJ_DUET_SHARED_SUMMARY__${roomId || 'noroom'}__${matchId || 'default'}`;
  }

  function buildLocalStartKey() {
    return `HHA_GJ_DUET_RUNTIME_START__${roomId || 'noroom'}`;
  }

  function buildLocalLatestMatchKey() {
    return `HHA_GJ_DUET_LATEST_MATCH__${roomId || 'noroom'}`;
  }

  function safeJsonParse(text, fallback) {
    try { return JSON.parse(text); } catch (_) { return fallback; }
  }

  function normalizePayload(payload, matchId) {
    const src = payload && typeof payload === 'object' ? payload : {};
    const finalMatchId = String(matchId || src.matchId || 'default').trim() || 'default';

    return {
      source: 'goodjunk-duet-room-bootstrap',
      final: true,
      mode: 'DUET',
      roomId: roomId || String(src.roomId || ''),
      matchId: finalMatchId,
      pid: String(src.pid || pid || 'anon'),
      name: String(src.name || name || 'Hero'),
      score: Math.max(0, clampNum(src.score, 0)),
      miss: Math.max(0, clampNum(src.miss, 0)),
      good: Math.max(0, clampNum(src.good, 0)),
      junk: Math.max(0, clampNum(src.junk, 0)),
      streak: Math.max(0, clampNum(src.streak, 0)),
      grade: String(src.grade || 'C'),
      reason: String(src.reason || 'timeup'),
      ts: clampNum(src.ts, Date.now()),
      hub: String(src.hub || hubDefault),
      by: {
        pid: String(src.by && src.by.pid || pid || 'anon'),
        name: String(src.by && src.by.name || name || 'Hero')
      }
    };
  }

  function normalizeStartPayload(payload) {
    const src = payload && typeof payload === 'object' ? payload : {};
    return {
      roomId: roomId,
      matchId: String(src.matchId || '').trim(),
      startAt: clampNum(src.startAt, Date.now()),
      runtimePath: String(src.runtimePath || runtimePathDefault),
      hub: String(src.hub || hubDefault),
      diff: String(src.diff || qs.get('diff') || 'normal'),
      time: String(src.time || qs.get('time') || '90'),
      view: String(src.view || qs.get('view') || 'mobile'),
      mode: 'duet',
      entry: 'duet',
      ts: clampNum(src.ts, Date.now())
    };
  }

  function readLocalSummary(matchId) {
    try {
      const raw = localStorage.getItem(buildLocalSummaryKey(matchId));
      if (!raw) return null;
      const parsed = safeJsonParse(raw, null);
      return parsed ? normalizePayload(parsed, matchId) : null;
    } catch (_) {
      return null;
    }
  }

  function writeLocalSummary(payload, matchId) {
    const finalPayload = normalizePayload(payload, matchId);
    try {
      localStorage.setItem(
        buildLocalSummaryKey(finalPayload.matchId),
        JSON.stringify(finalPayload)
      );
    } catch (_) {}
    return finalPayload;
  }

  function clearLocalSummary(matchId) {
    try {
      localStorage.removeItem(buildLocalSummaryKey(matchId));
    } catch (_) {}
  }

  function readLocalStart() {
    try {
      const raw = localStorage.getItem(buildLocalStartKey());
      if (!raw) return null;
      const parsed = safeJsonParse(raw, null);
      return parsed ? normalizeStartPayload(parsed) : null;
    } catch (_) {
      return null;
    }
  }

  function writeLocalStart(payload) {
    const data = normalizeStartPayload(payload);
    try {
      localStorage.setItem(buildLocalStartKey(), JSON.stringify(data));
    } catch (_) {}
    return data;
  }

  function clearLocalStart() {
    try {
      localStorage.removeItem(buildLocalStartKey());
    } catch (_) {}
  }

  function readLocalLatestMatchId() {
    try {
      return String(localStorage.getItem(buildLocalLatestMatchKey()) || '').trim();
    } catch (_) {
      return '';
    }
  }

  function writeLocalLatestMatchId(matchId) {
    try {
      localStorage.setItem(buildLocalLatestMatchKey(), String(matchId || '').trim());
    } catch (_) {}
  }

  function encodeRuntimeUrl(runtimePath, startPayload) {
    const url = new URL(runtimePath || runtimePathDefault, location.href);

    const passthroughKeys = [
      'pid', 'name', 'nick', 'studyId', 'hub', 'zone', 'cat', 'game', 'gameId',
      'theme', 'run', 'view', 'diff', 'time', 'seed', 'api', 'log', 'debug'
    ];

    passthroughKeys.forEach((k) => {
      const v = qs.get(k);
      if (v != null && v !== '') url.searchParams.set(k, v);
    });

    url.searchParams.set('roomId', roomId);
    url.searchParams.set('room', roomId);
    url.searchParams.set('mode', 'duet');
    url.searchParams.set('entry', 'duet');
    url.searchParams.set('matchId', startPayload.matchId);
    url.searchParams.set('startAt', String(startPayload.startAt));
    url.searchParams.set('runtimePath', String(startPayload.runtimePath || runtimePathDefault));
    url.searchParams.set('hub', String(startPayload.hub || hubDefault));
    url.searchParams.set('diff', String(startPayload.diff || qs.get('diff') || 'normal'));
    url.searchParams.set('time', String(startPayload.time || qs.get('time') || '90'));
    url.searchParams.set('view', String(startPayload.view || qs.get('view') || 'mobile'));
    url.searchParams.set('pid', pid);
    url.searchParams.set('name', name);

    if (role) url.searchParams.set('role', role);
    if (hostFlag) url.searchParams.set('host', hostFlag);

    return url.toString();
  }

  function installLocalFallback() {
    dlog('install local fallback');

    async function readMatchSummary(matchId) {
      return readLocalSummary(matchId);
    }

    async function publishMatchSummary(matchId, payload) {
      return writeLocalSummary(payload, matchId);
    }

    async function clearMatchSummary(matchId) {
      clearLocalSummary(matchId);
      return true;
    }

    async function readLatestMatchId() {
      return readLocalLatestMatchId();
    }

    async function writeLatestMatchId(matchId) {
      writeLocalLatestMatchId(matchId);
      return true;
    }

    async function publishStart(payload) {
      return writeLocalStart(payload);
    }

    async function readStart() {
      return readLocalStart();
    }

    function subscribeStart(cb) {
      const onStorage = function (ev) {
        if (ev.key !== buildLocalStartKey()) return;
        const data = readLocalStart();
        if (data && data.matchId) cb(data);
      };
      window.addEventListener('storage', onStorage);
      return function () {
        window.removeEventListener('storage', onStorage);
      };
    }

    function subscribeSummary(matchId, cb) {
      const key = buildLocalSummaryKey(matchId);
      const onStorage = function (ev) {
        if (ev.key !== key) return;
        const data = readLocalSummary(matchId);
        if (data) cb(data);
      };
      window.addEventListener('storage', onStorage);
      return function () {
        window.removeEventListener('storage', onStorage);
      };
    }

    return {
      type: 'localFallback',
      async getOrCreateMatchId(forceNew) {
        if (forceNew) {
          const matchId = createMatchId();
          await writeLatestMatchId(matchId);
          return matchId;
        }

        const existing =
          firstNonEmpty(qs.get('matchId'), await readLatestMatchId());

        if (existing) return existing;

        const matchId = createMatchId();
        await writeLatestMatchId(matchId);
        return matchId;
      },
      readMatchSummary,
      publishMatchSummary,
      clearMatchSummary,
      publishStart,
      readStart,
      subscribeStart,
      subscribeSummary
    };
  }

  function installFirebaseBridge() {
    if (!window.firebase || !window.firebase.database || !roomId) {
      return installLocalFallback();
    }

    const db = window.firebase.database();
    const roomRef = db.ref(`/hha-battle/goodjunk/duetRooms/${roomId}`);
    const latestMatchRef = roomRef.child('latestMatchId');
    const latestSummaryRef = roomRef.child('latestFinalSummary');
    const finalSummaryRootRef = roomRef.child('finalSummaryByMatch');
    const runtimeSignalRef = roomRef.child('runtimeSignal');

    function summaryRef(matchId) {
      return finalSummaryRootRef.child(String(matchId || 'default'));
    }

    function dbGet(ref) {
      return new Promise((resolve) => {
        ref.once('value', (snap) => resolve(snap.val()), () => resolve(null));
      });
    }

    function dbSet(ref, value) {
      return new Promise((resolve, reject) => {
        ref.set(value, (err) => err ? reject(err) : resolve(true));
      });
    }

    function dbRemove(ref) {
      return new Promise((resolve) => {
        ref.remove(() => resolve(true));
      });
    }

    function dbTransaction(ref, updateFn) {
      return new Promise((resolve) => {
        ref.transaction(
          updateFn,
          function (_err, _committed, snap) {
            resolve(snap && snap.val ? snap.val() : null);
          },
          false
        );
      });
    }

    async function readMatchSummary(matchId) {
      const val = await dbGet(summaryRef(matchId));
      return val ? normalizePayload(val, matchId) : null;
    }

    async function publishMatchSummary(matchId, payload) {
      const finalPayload = normalizePayload(payload, matchId);

      const out = await dbTransaction(summaryRef(matchId), function (current) {
        if (current && current.final) return current;
        return finalPayload;
      });

      const published = out ? normalizePayload(out, matchId) : finalPayload;

      try { await dbSet(latestMatchRef, matchId); } catch (_) {}
      try { await dbSet(latestSummaryRef, published); } catch (_) {}
      try { writeLocalSummary(published, matchId); } catch (_) {}

      return published;
    }

    async function clearMatchSummary(matchId) {
      try { await dbRemove(summaryRef(matchId)); } catch (_) {}
      try {
        const latest = await dbGet(latestMatchRef);
        if (String(latest || '') === String(matchId || '')) {
          await dbRemove(latestSummaryRef);
        }
      } catch (_) {}
      clearLocalSummary(matchId);
      return true;
    }

    async function readLatestMatchId() {
      const latest = await dbGet(latestMatchRef);
      return String(latest || '').trim();
    }

    async function writeLatestMatchId(matchId) {
      try { await dbSet(latestMatchRef, matchId); } catch (_) {}
      writeLocalLatestMatchId(matchId);
      return true;
    }

    async function publishStart(payload) {
      const data = normalizeStartPayload(payload);

      try {
        await dbSet(runtimeSignalRef, data);
      } catch (_) {}

      try {
        await dbSet(latestMatchRef, data.matchId);
      } catch (_) {}

      writeLocalLatestMatchId(data.matchId);
      writeLocalStart(data);

      return data;
    }

    async function readStart() {
      const val = await dbGet(runtimeSignalRef);
      return val ? normalizeStartPayload(val) : readLocalStart();
    }

    function subscribeStart(cb) {
      const handler = function (snap) {
        const val = snap.val();
        if (!val) return;
        const data = normalizeStartPayload(val);
        try { writeLocalStart(data); } catch (_) {}
        cb(data);
      };

      runtimeSignalRef.on('value', handler);

      const onStorage = function (ev) {
        if (ev.key !== buildLocalStartKey()) return;
        const data = readLocalStart();
        if (data && data.matchId) cb(data);
      };
      window.addEventListener('storage', onStorage);

      return function () {
        try { runtimeSignalRef.off('value', handler); } catch (_) {}
        window.removeEventListener('storage', onStorage);
      };
    }

    function subscribeSummary(matchId, cb) {
      const ref = summaryRef(matchId);

      const handler = function (snap) {
        const val = snap.val();
        if (!val) return;
        const data = normalizePayload(val, matchId);
        try { writeLocalSummary(data, matchId); } catch (_) {}
        cb(data);
      };

      ref.on('value', handler);

      const key = buildLocalSummaryKey(matchId);
      const onStorage = function (ev) {
        if (ev.key !== key) return;
        const data = readLocalSummary(matchId);
        if (data) cb(data);
      };
      window.addEventListener('storage', onStorage);

      return function () {
        try { ref.off('value', handler); } catch (_) {}
        window.removeEventListener('storage', onStorage);
      };
    }

    return {
      type: 'firebase',
      async getOrCreateMatchId(forceNew) {
        if (forceNew) {
          const matchId = createMatchId();
          await writeLatestMatchId(matchId);
          return matchId;
        }

        const queryMatch = firstNonEmpty(qs.get('matchId'));
        if (queryMatch) {
          await writeLatestMatchId(queryMatch);
          return queryMatch;
        }

        const latest = await readLatestMatchId();
        if (latest) return latest;

        const matchId = createMatchId();
        await writeLatestMatchId(matchId);
        return matchId;
      },
      readMatchSummary,
      publishMatchSummary,
      clearMatchSummary,
      publishStart,
      readStart,
      subscribeStart,
      subscribeSummary
    };
  }

  const adapter = installFirebaseBridge();

  const api = {
    roomId,
    pid,
    name,
    role,
    isRuntimePage,
    isHostLike,

    async ensureMatchId(forceNew) {
      return await adapter.getOrCreateMatchId(!!forceNew);
    },

    async hostStartMatch(options) {
      const opts = options && typeof options === 'object' ? options : {};
      const runtimePath = String(opts.runtimePath || runtimePathDefault);
      const matchId = await adapter.getOrCreateMatchId(true);

      await adapter.clearMatchSummary(matchId);

      const payload = normalizeStartPayload({
        matchId,
        startAt: Date.now(),
        runtimePath,
        hub: String(opts.hub || qs.get('hub') || hubDefault),
        diff: String(opts.diff || qs.get('diff') || 'normal'),
        time: String(opts.time || qs.get('time') || '90'),
        view: String(opts.view || qs.get('view') || 'mobile'),
        ts: Date.now()
      });

      await adapter.publishStart(payload);

      return {
        matchId,
        startAt: payload.startAt,
        payload,
        url: encodeRuntimeUrl(runtimePath, payload)
      };
    },

    async readCurrentStartSignal() {
      return await adapter.readStart();
    },

    subscribeRuntimeStart(cb) {
      return adapter.subscribeStart(cb);
    },

    buildRuntimeUrl(options) {
      const opts = options && typeof options === 'object' ? options : {};
      const payload = normalizeStartPayload({
        matchId: String(opts.matchId || qs.get('matchId') || ''),
        startAt: clampNum(opts.startAt, Date.now()),
        runtimePath: String(opts.runtimePath || runtimePathDefault),
        hub: String(opts.hub || qs.get('hub') || hubDefault),
        diff: String(opts.diff || qs.get('diff') || 'normal'),
        time: String(opts.time || qs.get('time') || '90'),
        view: String(opts.view || qs.get('view') || 'mobile'),
        ts: Date.now()
      });

      return {
        payload,
        url: encodeRuntimeUrl(payload.runtimePath, payload)
      };
    },

    async clearCurrentMatchSummary(matchId) {
      const m = String(matchId || qs.get('matchId') || '').trim();
      if (!m) return false;
      return await adapter.clearMatchSummary(m);
    },

    async readFinalSummary(matchId) {
      const m = String(matchId || qs.get('matchId') || '').trim();
      if (!m) return null;
      return await adapter.readMatchSummary(m);
    },

    subscribeFinalSummary(matchId, cb) {
      const m = String(matchId || qs.get('matchId') || '').trim();
      if (!m) return function(){};
      return adapter.subscribeSummary(m, cb);
    },

    async publishFinalSummary(matchId, payload) {
      const m = String(matchId || qs.get('matchId') || '').trim();
      if (!m) return null;
      return await adapter.publishMatchSummary(m, payload);
    },

    debugInfo() {
      return {
        adapter: adapter.type,
        roomId,
        pid,
        name,
        role,
        hostFlag,
        pagePath
      };
    }
  };

  window.HHA_DUET_ROOM_BOOT = api;

  window.HHA_DUET_REMOTE_READ_SUMMARY = async function () {
    const matchId = await api.ensureMatchId(false);
    return await api.readFinalSummary(matchId);
  };

  window.HHA_DUET_REMOTE_PUBLISH_SUMMARY = async function (payload) {
    const matchId = await api.ensureMatchId(false);
    return await api.publishFinalSummary(matchId, payload);
  };

  window.HHA_DUET_REMOTE_CLEAR_SUMMARY = async function () {
    const matchId = await api.ensureMatchId(false);
    return await api.clearCurrentMatchSummary(matchId);
  };

  window.HHA_DUET_REMOTE_SUBSCRIBE_SUMMARY = function (cb) {
    let activeUnsub = function(){};

    api.ensureMatchId(false).then(function (matchId) {
      activeUnsub = api.subscribeFinalSummary(matchId, cb);
    }).catch(function () {});

    return function () {
      try { activeUnsub(); } catch (_) {}
    };
  };

  dlog('bootstrap ready', api.debugInfo());
})();