// === /herohealth/vr/hha-cloud-logger.js ===
// HeroHealth — Cloud Logger (Web App / Google Apps Script)
// ✅ Batch queue (sendBeacon + fetch fallback)
// ✅ Auto-captures URL params context (studyId/phase/conditionGroup/student...)
// ✅ Listens to standard HeroHealth events:
//    - hha:log_session  (start / end markers)
//    - hha:log_event    (sparse events: spawn/hit/miss/boss/...)
//    - hha:end          (final summary: scoreFinal, comboMax, misses, goals/minis...)
// ✅ Optional passive snapshots:
//    - hha:score / hha:time / quest:update  (เก็บ last known state; ไม่ยิงถี่)
// ✅ Endpoint:
//    - ?log=<WEB_APP_EXEC_URL>  (recommended)
//    - or window.HHA_LOG_ENDPOINT = ".../exec"
//
// ✅ PATCH (สำคัญ):
// - flatten data -> stringify object/array เพื่อกัน [object Object]
// - FORCE bossJson ตอนจบ (end) เพื่อให้ลงชีทได้ชัวร์
//
// Notes:
// - This file is pure IIFE (no module) for maximum compat.
// - Server side (Code.gs) จะรับ {kind:'hha_batch', items:[...]}

(function (root) {
  'use strict';

  const doc = root.document;
  const nav = root.navigator || {};
  const loc = root.location || { href: '' };
  const TZ = (Intl && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions)
    ? (Intl.DateTimeFormat().resolvedOptions().timeZone || '')
    : '';

  const URLX = new URL(loc.href);
  const Q = URLX.searchParams;

  // ---------- Config ----------
  const CFG = {
    // batching
    flushEveryMs: 2500,
    maxQueue: 40,
    maxPayloadBytes: 220 * 1024, // ~220KB safe-ish
    // endpoints
    endpoint: '',
    // debug
    debug: false,
    // optional: disable logger
    disabled: (Q.get('nolog') === '1'),
  };

  // allow override via global before init
  if (typeof root.HHA_LOG_ENDPOINT === 'string' && root.HHA_LOG_ENDPOINT.trim()) {
    CFG.endpoint = root.HHA_LOG_ENDPOINT.trim();
  } else if (Q.get('log')) {
    CFG.endpoint = String(Q.get('log')).trim();
  }

  // ---------- Helpers ----------
  const now = () => Date.now();

  function safeStr(v) {
    if (v === undefined || v === null) return '';
    return String(v);
  }
  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function tryJson(v) {
    try { return JSON.stringify(v); } catch (_) { return ''; }
  }
  function pick(keys, fallback = '') {
    for (const k of keys) {
      const v = Q.get(k);
      if (v !== null && v !== '') return v;
    }
    return fallback;
  }

  // ---------- Flatten for Sheet (stringify object/array) ----------
  function flatForSheet(obj){
    if (!obj || typeof obj !== 'object') return obj;

    const out = {};
    for (const k in obj){
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      const v = obj[k];

      if (v === undefined) out[k] = '';
      else if (v === null) out[k] = null;
      else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') out[k] = v;
      else {
        // array/object/date/etc -> JSON
        const s = tryJson(v);
        out[k] = (s !== '' ? s : safeStr(v));
      }
    }
    return out;
  }

  function deviceHint() {
    // light heuristic
    // if A-Frame scene in vr-mode -> 'vr'
    try {
      const scene = doc && doc.querySelector && doc.querySelector('a-scene');
      if (scene && scene.is && scene.is('vr-mode')) return 'vr';
    } catch (_) {}
    const ua = (nav.userAgent || '').toLowerCase();
    if (ua.includes('oculus') || ua.includes('quest') || ua.includes('vive')) return 'vr';
    if (ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) return 'mobile';
    return 'desktop';
  }

  // ---------- Context (from URL params) ----------
  const CTX = {
    timestampIso: new Date().toISOString(),

    // Experiment / project tags (รองรับหลาย alias)
    projectTag: pick(['projectTag', 'project', 'tag'], ''),
    runMode: pick(['runMode', 'run', 'mode'], 'play'),
    studyId: pick(['studyId', 'study', 'sid'], ''),
    phase: pick(['phase'], ''),
    conditionGroup: pick(['conditionGroup', 'cond', 'cg'], ''),
    sessionOrder: pick(['sessionOrder', 'order'], ''),
    blockLabel: pick(['blockLabel', 'block'], ''),
    siteCode: pick(['siteCode', 'site'], ''),
    schoolYear: pick(['schoolYear', 'sy'], ''),
    semester: pick(['semester', 'sem'], ''),

    // session / game
    sessionId: pick(['sessionId'], ''),
    gameMode: pick(['gameMode', 'game'], ''),
    diff: pick(['diff'], 'normal'),
    durationPlannedSec: safeNum(pick(['time', 'durationPlannedSec'], '')),

    // meta
    device: deviceHint(),
    gameVersion: pick(['v', 'ver', 'gameVersion'], (root.HHA_GAME_VERSION || '')),
    href: loc.href,
    ua: nav.userAgent || '',
    tz: TZ,

    // student profile (ถ้ามี)
    studentKey: pick(['studentKey'], ''),
    schoolCode: pick(['schoolCode'], ''),
    schoolName: pick(['schoolName'], ''),
    classRoom: pick(['classRoom', 'class'], ''),
    studentNo: pick(['studentNo', 'no'], ''),
    nickName: pick(['nickName', 'nick'], ''),
    gender: pick(['gender'], ''),
    age: pick(['age'], ''),
    gradeLevel: pick(['gradeLevel', 'grade'], ''),
    heightCm: pick(['heightCm'], ''),
    weightKg: pick(['weightKg'], ''),
    bmi: pick(['bmi'], ''),
    bmiGroup: pick(['bmiGroup'], ''),
    vrExperience: pick(['vrExperience'], ''),
    gameFrequency: pick(['gameFrequency'], ''),
    handedness: pick(['handedness'], ''),
    visionIssue: pick(['visionIssue'], ''),
    healthDetail: pick(['healthDetail'], ''),
    consentParent: pick(['consentParent'], ''),
  };

  // ---------- Rolling state (snapshot) ----------
  const STATE = {
    startTimeIso: '',
    endTimeIso: '',
    durationPlayedSec: null,

    scoreFinal: null,
    comboMax: null,
    misses: null,

    goalsCleared: null,
    goalsTotal: null,
    miniCleared: null,
    miniTotal: null,

    // optional counters
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetDiamondSpawned: 0,
    nTargetShieldSpawned: 0,

    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,

    // optional performance
    accuracyGoodPct: null,
    junkErrorPct: null,
    avgRtGoodMs: null,
    medianRtGoodMs: null,
    fastHitRatePct: null,

    reason: '',
  };

  // ---------- Queue / batching ----------
  let queue = [];
  let flushTimer = null;
  let lastFlushAt = 0;

  function logd(...args) {
    if (CFG.debug) console.log('[HHACloudLogger]', ...args);
  }

  function enqueue(type, data) {
    if (CFG.disabled) return;
    if (!CFG.endpoint) return;

    const item = {
      ts: now(),
      type: type,
      href: CTX.href,
      ua: CTX.ua,
      tz: CTX.tz,

      // attach context (flat keys)
      ...CTX,

      // attach data (flatten for sheet)
      data: flatForSheet(data || {})
    };

    queue.push(item);

    // soft cap
    if (queue.length > CFG.maxQueue) {
      queue.splice(0, queue.length - CFG.maxQueue);
    }

    scheduleFlush();
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = root.setTimeout(() => {
      flushTimer = null;
      flush();
    }, CFG.flushEveryMs);
  }

  function flush(force = false) {
    if (CFG.disabled) return;
    if (!CFG.endpoint) return;
    if (!queue.length) return;

    const t = now();
    if (!force && (t - lastFlushAt) < 500) return;

    // pack as batch
    const payload = {
      kind: 'hha_batch',
      v: 1,
      items: queue.splice(0, queue.length)
    };

    // attach a compact "final snapshot" occasionally (helps server mapping)
    payload.snapshot = buildSnapshot_();

    const body = JSON.stringify(payload);
    if (body.length > CFG.maxPayloadBytes) {
      // ถ้า payload ใหญ่ไป: แบ่งครึ่ง
      const items = payload.items || [];
      const mid = Math.max(1, (items.length / 2) | 0);
      const a = { kind: 'hha_batch', v: 1, items: items.slice(0, mid), snapshot: payload.snapshot };
      const b = { kind: 'hha_batch', v: 1, items: items.slice(mid), snapshot: payload.snapshot };
      send_(JSON.stringify(a));
      send_(JSON.stringify(b));
    } else {
      send_(body);
    }

    lastFlushAt = t;
  }

  function send_(bodyStr) {
    try {
      // prefer sendBeacon
      if (nav.sendBeacon) {
        const ok = nav.sendBeacon(CFG.endpoint, new Blob([bodyStr], { type: 'application/json' }));
        logd('beacon', ok, 'bytes', bodyStr.length);
        if (ok) return;
      }
    } catch (_) {}

    // fallback fetch
    try {
      fetch(CFG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        keepalive: true
      }).then(() => logd('fetch ok'))
        .catch(err => logd('fetch fail', err));
    } catch (err) {
      logd('send error', err);
    }
  }

  // ---------- Snapshot building ----------
  function buildSnapshot_() {
    return {
      // context
      ...CTX,

      // state
      startTimeIso: STATE.startTimeIso,
      endTimeIso: STATE.endTimeIso,
      durationPlayedSec: STATE.durationPlayedSec,

      scoreFinal: STATE.scoreFinal,
      comboMax: STATE.comboMax,
      misses: STATE.misses,

      goalsCleared: STATE.goalsCleared,
      goalsTotal: STATE.goalsTotal,
      miniCleared: STATE.miniCleared,
      miniTotal: STATE.miniTotal,

      nTargetGoodSpawned: STATE.nTargetGoodSpawned,
      nTargetJunkSpawned: STATE.nTargetJunkSpawned,
      nTargetStarSpawned: STATE.nTargetStarSpawned,
      nTargetDiamondSpawned: STATE.nTargetDiamondSpawned,
      nTargetShieldSpawned: STATE.nTargetShieldSpawned,

      nHitGood: STATE.nHitGood,
      nHitJunk: STATE.nHitJunk,
      nHitJunkGuard: STATE.nHitJunkGuard,
      nExpireGood: STATE.nExpireGood,

      accuracyGoodPct: STATE.accuracyGoodPct,
      junkErrorPct: STATE.junkErrorPct,
      avgRtGoodMs: STATE.avgRtGoodMs,
      medianRtGoodMs: STATE.medianRtGoodMs,
      fastHitRatePct: STATE.fastHitRatePct,

      device: CTX.device,
      gameVersion: CTX.gameVersion,
      reason: STATE.reason
    };
  }

  // ---------- Event listeners ----------
  function onSession(e) {
    const d = (e && e.detail) ? e.detail : {};
    // session start marker
    if (!STATE.startTimeIso) STATE.startTimeIso = new Date().toISOString();

    // allow sessionId override from engine
    if (d.sessionId) CTX.sessionId = safeStr(d.sessionId);
    if (d.game) CTX.gameMode = safeStr(d.game);
    if (d.mode) CTX.runMode = safeStr(d.mode);
    if (d.diff) CTX.diff = safeStr(d.diff);
    if (d.seed !== undefined) CTX.seed = safeStr(d.seed);

    enqueue('session', d);
  }

  function onEvent(e) {
    const d = (e && e.detail) ? e.detail : {};
    // update rolling state quickly based on event type
    // expected d: { sessionId, game, type, t, score, combo, miss, perfect, fever, shield, lives, data:{} }
    if (d.sessionId) CTX.sessionId = safeStr(d.sessionId);
    if (d.game) CTX.gameMode = safeStr(d.game);

    const et = safeStr(d.type || '');
    const data = d.data || {};

    // simple counters from eventType
    if (et === 'spawn') {
      const k = safeStr(data.kind || data.type || '');
      if (k === 'good') STATE.nTargetGoodSpawned++;
      else if (k === 'junk') STATE.nTargetJunkSpawned++;
      else if (k === 'gold' || k === 'star') STATE.nTargetStarSpawned++;
      else if (k === 'diamond') STATE.nTargetDiamondSpawned++;
      else if (k === 'shield') STATE.nTargetShieldSpawned++;
    }
    if (et === 'hit') {
      const k = safeStr(data.kind || '');
      if (k === 'good' || k === 'gold') STATE.nHitGood++;
      if (k === 'junk') STATE.nHitJunk++;
    }
    if (et === 'miss_expire') {
      STATE.nExpireGood++;
    }
    if (et === 'shield_block') {
      // count guarded junk hit
      STATE.nHitJunkGuard++;
    }

    enqueue('event', d);
  }

  function onEnd(e) {
    const d = (e && e.detail) ? e.detail : {};
    // normalize: accept both direct fields + nested
    if (d.sessionId) CTX.sessionId = safeStr(d.sessionId);
    if (d.game) CTX.gameMode = safeStr(d.game);
    if (d.diff) CTX.diff = safeStr(d.diff);
    if (d.mode) CTX.runMode = safeStr(d.mode);

    STATE.endTimeIso = new Date().toISOString();

    // duration played
    if (STATE.startTimeIso) {
      try {
        const a = new Date(STATE.startTimeIso).getTime();
        const b = new Date(STATE.endTimeIso).getTime();
        if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
          STATE.durationPlayedSec = Math.round((b - a) / 1000);
        }
      } catch (_) {}
    }

    // common summary fields (support multiple names)
    STATE.scoreFinal = safeNum(d.scoreFinal ?? d.score ?? d.finalScore ?? null);
    STATE.comboMax   = safeNum(d.comboMax ?? d.maxCombo ?? null);
    STATE.misses     = safeNum(d.misses ?? d.miss ?? null);

    STATE.goalsCleared = safeNum(d.goalsCleared ?? d.goals ?? null);
    STATE.goalsTotal   = safeNum(d.goalsTotal ?? null);
    STATE.miniCleared  = safeNum(d.miniCleared ?? d.minisCleared ?? d.minis ?? null);
    STATE.miniTotal    = safeNum(d.miniTotal ?? null);

    // optional performance fields if game emits them
    STATE.accuracyGoodPct = safeNum(d.accuracyGoodPct ?? null);
    STATE.junkErrorPct    = safeNum(d.junkErrorPct ?? null);
    STATE.avgRtGoodMs     = safeNum(d.avgRtGoodMs ?? null);
    STATE.medianRtGoodMs  = safeNum(d.medianRtGoodMs ?? null);
    STATE.fastHitRatePct  = safeNum(d.fastHitRatePct ?? null);

    STATE.reason = safeStr(d.reason || (d.gameOver ? 'gameover' : '') || '');

    // include final snapshot in data to help server write long schema
    const merged = Object.assign({}, d, buildSnapshot_());

    // ---- FORCE bossJson ----
    // รองรับทั้ง d.boss (object) หรือ d.bossJson (string)
    const bossObj = merged.boss || d.boss || null;
    const bossJson = safeStr(merged.bossJson || d.bossJson || (bossObj ? tryJson(bossObj) : ''));

    merged.bossJson = bossJson;
    if (bossObj && typeof bossObj === 'object') merged.boss = bossJson;

    const out = flatForSheet(merged);

    enqueue('end', out);

    // flush immediately at end
    flush(true);
  }

  // passive snapshots (optional — does NOT enqueue by default)
  function onScore(e) {
    const d = (e && e.detail) ? e.detail : {};
    // keep last-known for end fallback
    if (d.scoreFinal !== undefined) STATE.scoreFinal = safeNum(d.scoreFinal);
    if (d.score !== undefined) STATE.scoreFinal = safeNum(d.score);
    if (d.comboMax !== undefined) STATE.comboMax = safeNum(d.comboMax);
    if (d.combo !== undefined) STATE.comboMax = Math.max(STATE.comboMax || 0, safeNum(d.combo) || 0);
    if (d.misses !== undefined) STATE.misses = safeNum(d.misses);
    if (d.miss !== undefined) STATE.misses = safeNum(d.miss);
  }

  function onTime(e) {
    const d = (e && e.detail) ? e.detail : {};
    // capture start time on first time event
    if (!STATE.startTimeIso) STATE.startTimeIso = new Date().toISOString();
    // no enqueue
    if (d.sec !== undefined && CTX.durationPlannedSec == null) {
      // leave planned from URL; not override
    }
  }

  function onQuestUpdate(e) {
    const d = (e && e.detail) ? e.detail : {};
    // attempt parse: { goalsCleared, goalsTotal, minisCleared, minisTotal }
    if (d.goalsCleared !== undefined) STATE.goalsCleared = safeNum(d.goalsCleared);
    if (d.goalsTotal !== undefined) STATE.goalsTotal = safeNum(d.goalsTotal);
    if (d.minisCleared !== undefined) STATE.miniCleared = safeNum(d.minisCleared);
    if (d.miniTotal !== undefined) STATE.miniTotal = safeNum(d.miniTotal);
  }

  // ---------- Public API ----------
  const API = {
    init(opts = {}) {
      if (opts && typeof opts.debug === 'boolean') CFG.debug = opts.debug;
      if (opts && typeof opts.endpoint === 'string' && opts.endpoint.trim()) {
        CFG.endpoint = opts.endpoint.trim();
      }
      if (opts && typeof opts.disabled === 'boolean') CFG.disabled = opts.disabled;

      if (!CFG.endpoint) {
        logd('No endpoint. Add ?log=WEB_APP_URL or set window.HHA_LOG_ENDPOINT');
        return;
      }
      if (CFG.disabled) {
        logd('Logger disabled via nolog=1');
        return;
      }

      // bind events
      root.addEventListener('hha:log_session', onSession);
      root.addEventListener('hha:log_event', onEvent);
      root.addEventListener('hha:end', onEnd);

      // optional snapshot listeners
      root.addEventListener('hha:score', onScore);
      root.addEventListener('hha:time', onTime);
      root.addEventListener('quest:update', onQuestUpdate);

      // flush on pagehide/visibility
      root.addEventListener('pagehide', () => flush(true));
      root.addEventListener('beforeunload', () => flush(true));
      doc && doc.addEventListener && doc.addEventListener('visibilitychange', () => {
        if (doc.visibilityState === 'hidden') flush(true);
      });

      // mark start time
      if (!STATE.startTimeIso) STATE.startTimeIso = new Date().toISOString();

      logd('init ok', { endpoint: CFG.endpoint });
    },

    flushNow() { flush(true); },

    // manual log helper (rare use)
    log(type, data) { enqueue(type || 'event', data || {}); },

    getContext() { return Object.assign({}, CTX); },
    getSnapshot() { return buildSnapshot_(); }
  };

  root.HHACloudLogger = API;

  // auto-init if endpoint exists
  try {
    if (!CFG.disabled && CFG.endpoint) API.init({ debug: (Q.get('logdebug') === '1') });
  } catch (_) {}

})(typeof window !== 'undefined' ? window : globalThis);