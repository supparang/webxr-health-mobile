// === /herohealth/vr/hha-cloud-logger.js ===
// HeroHealth — Cloud Logger (STANDARD v2) — Compatible with your Code.gs schema
// ✅ Sends payload: {sessions:[...], events:[...], studentsProfile:[...]}
// ✅ Supports kind-based events (GoodJunk/Plate/Groups/Hydration)
// ✅ Computes timeFromStartMs
// ✅ Flattens objects/arrays -> JSON string (no [object Object])
// ✅ End session is written from hha:end (single row/session) + optional start marker event
// ✅ Optional profile upsert once (students-profile)

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
    flushEveryMs: 2500,
    maxQueue: 80,
    maxPayloadBytes: 220 * 1024,
    endpoint: '',
    debug: false,
    disabled: (Q.get('nolog') === '1'),
  };

  if (typeof root.HHA_LOG_ENDPOINT === 'string' && root.HHA_LOG_ENDPOINT.trim()) {
    CFG.endpoint = root.HHA_LOG_ENDPOINT.trim();
  } else if (Q.get('log')) {
    CFG.endpoint = String(Q.get('log')).trim();
  }

  // ---------- Helpers ----------
  const now = () => Date.now();

  function logd(...args) { if (CFG.debug) console.log('[HHACloudLogger]', ...args); }

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
  function toIso(v) {
    if (!v) return new Date().toISOString();
    if (typeof v === 'string' && v.includes('T')) return v;
    const n = Number(v);
    if (Number.isFinite(n) && n > 1000000000) return new Date(n).toISOString();
    try { return new Date(v).toISOString(); } catch (_) { return new Date().toISOString(); }
  }
  function pick(keys, fallback = '') {
    for (const k of keys) {
      const v = Q.get(k);
      if (v !== null && v !== '') return v;
    }
    return fallback;
  }

  function flatForSheet(obj){
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    for (const k in obj){
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      const v = obj[k];
      if (v === undefined) out[k] = '';
      else if (v === null) out[k] = '';
      else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') out[k] = v;
      else {
        const s = tryJson(v);
        out[k] = (s !== '' ? s : safeStr(v));
      }
    }
    return out;
  }

  function deviceHint() {
    try {
      const scene = doc && doc.querySelector && doc.querySelector('a-scene');
      if (scene && scene.is && scene.is('vr-mode')) return 'vr';
    } catch (_) {}
    const ua = (nav.userAgent || '').toLowerCase();
    if (ua.includes('oculus') || ua.includes('quest') || ua.includes('vive')) return 'vr';
    if (ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) return 'mobile';
    return 'desktop';
  }

  // ---------- Context from URL ----------
  const CTX = {
    // experiment
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

    // game/session
    sessionId: pick(['sessionId'], ''),
    gameMode: pick(['gameMode', 'game'], ''),
    diff: pick(['diff'], 'normal'),
    challenge: pick(['challenge'], ''),      // ✅ NEW
    endPolicy: pick(['endPolicy','end'], ''),// ✅ NEW
    seed: pick(['seed'], ''),                // ✅ NEW
    seedRaw: pick(['seedRaw'], ''),          // ✅ NEW
    durationPlannedSec: safeNum(pick(['time', 'durationPlannedSec'], '')),

    // meta
    device: deviceHint(),
    gameVersion: pick(['v', 'ver', 'gameVersion'], (root.HHA_GAME_VERSION || '')),
    href: loc.href,
    ua: nav.userAgent || '',
    tz: TZ,

    // profile
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
    consentTeacher: pick(['consentTeacher'], ''), // ✅ NEW

    // research admin (optional)
    profileSource: pick(['profileSource'], ''),
    surveyKey: pick(['surveyKey'], ''),
    excludeFlag: pick(['excludeFlag'], ''),
    noteResearcher: pick(['noteResearcher'], ''),
  };

  // ---------- Rolling snapshot ----------
  const SNAP = {
    startIso: '',
    startMs: 0,
    lastScore: null,
    lastCombo: null,
    lastMiss: null,
    lastFever: null,
    lastQuest: null, // {goalsCleared,goalsTotal,minisCleared,minisTotal,...}
  };

  // ---------- Queues (match Code.gs schema) ----------
  let qSessions = [];
  let qEvents = [];
  let qProfiles = [];
  let flushTimer = null;
  let lastFlushAt = 0;

  function capQueues_(){
    const cap = CFG.maxQueue | 0;
    if (qEvents.length > cap) qEvents.splice(0, qEvents.length - cap);
    if (qSessions.length > Math.max(10, (cap/8)|0)) qSessions.splice(0, qSessions.length - Math.max(10,(cap/8)|0));
  }

  function enqueueSessionRow(row){
    if (CFG.disabled || !CFG.endpoint) return;
    qSessions.push(flatForSheet(row || {}));
    capQueues_();
    scheduleFlush();
  }

  function enqueueEventRow(row){
    if (CFG.disabled || !CFG.endpoint) return;
    qEvents.push(flatForSheet(row || {}));
    capQueues_();
    scheduleFlush();
  }

  function enqueueProfileOnce_(){
    // upsert only if studentKey exists
    if (!CTX.studentKey) return;
    // prevent duplicates
    if (qProfiles.length) return;

    const iso = new Date().toISOString();
    const p = {
      timestampIso: iso,
      projectTag: CTX.projectTag,
      runMode: CTX.runMode,

      studentKey: CTX.studentKey,
      schoolCode: CTX.schoolCode,
      schoolName: CTX.schoolName,
      classRoom: CTX.classRoom,
      studentNo: CTX.studentNo,
      nickName: CTX.nickName,

      gender: CTX.gender,
      age: CTX.age,
      gradeLevel: CTX.gradeLevel,

      heightCm: CTX.heightCm,
      weightKg: CTX.weightKg,
      bmi: CTX.bmi,
      bmiGroup: CTX.bmiGroup,

      vrExperience: CTX.vrExperience,
      gameFrequency: CTX.gameFrequency,
      handedness: CTX.handedness,
      visionIssue: CTX.visionIssue,
      healthDetail: CTX.healthDetail,

      consentParent: CTX.consentParent,
      consentTeacher: CTX.consentTeacher,

      createdAtIso: iso,
      updatedAtIso: iso,
      source: CTX.profileSource || 'url'
    };

    qProfiles.push(flatForSheet(p));
    scheduleFlush();
  }

  function scheduleFlush(){
    if (flushTimer) return;
    flushTimer = root.setTimeout(() => {
      flushTimer = null;
      flush();
    }, CFG.flushEveryMs);
  }

  function flush(force=false){
    if (CFG.disabled || !CFG.endpoint) return;

    const t = now();
    if (!force && (t - lastFlushAt) < 500) return;

    if (!qSessions.length && !qEvents.length && !qProfiles.length) return;

    const payload = {
      projectTag: CTX.projectTag || null,
      sessions: qSessions.splice(0, qSessions.length),
      events: qEvents.splice(0, qEvents.length),
      studentsProfile: qProfiles.splice(0, qProfiles.length),
    };

    const body = JSON.stringify(payload);

    if (body.length > CFG.maxPayloadBytes) {
      // split: keep sessions + profiles in first; chunk events
      const eventsAll = payload.events || [];
      const chunkSize = Math.max(10, (eventsAll.length / 2) | 0);

      const a = {
        projectTag: payload.projectTag,
        sessions: payload.sessions,
        studentsProfile: payload.studentsProfile,
        events: eventsAll.slice(0, chunkSize)
      };
      const b = {
        projectTag: payload.projectTag,
        sessions: [],
        studentsProfile: [],
        events: eventsAll.slice(chunkSize)
      };
      send_(JSON.stringify(a));
      send_(JSON.stringify(b));
    } else {
      send_(body);
    }

    lastFlushAt = t;
  }

  function send_(bodyStr){
    try {
      if (nav.sendBeacon) {
        const ok = nav.sendBeacon(CFG.endpoint, new Blob([bodyStr], { type:'application/json' }));
        logd('beacon', ok, 'bytes', bodyStr.length);
        if (ok) return;
      }
    } catch(_) {}

    try {
      fetch(CFG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        keepalive: true
      }).then(() => logd('fetch ok'))
        .catch(err => logd('fetch fail', err));
    } catch(err) {
      logd('send error', err);
    }
  }

  // ---------- Kind parsing -> standardized event row ----------
  function parseKind_(k){
    k = safeStr(k).toLowerCase();
    // spawn_good / spawn_junk / spawn_power / spawn_gold ...
    if (k.startsWith('spawn_')) return { eventType:'spawn', itemType: k.replace('spawn_','') };
    if (k.startsWith('hit_')) return { eventType:'hit', itemType: k.replace('hit_','') };
    if (k === 'expire_good') return { eventType:'miss_expire', itemType:'good' };
    if (k === 'shoot_empty') return { eventType:'shoot', itemType:'empty' };

    // hazards / boss
    if (k.startsWith('boss_')) return { eventType:'boss', itemType:k };
    if (k.startsWith('ring_')) return { eventType:'hazard', itemType:k };
    if (k.startsWith('laser_')) return { eventType:'hazard', itemType:k };
    if (k === 'hazard_hit' || k === 'hazard_block') return { eventType:'hazard', itemType:k };

    return { eventType: k || 'event', itemType:'' };
  }

  function baseEventRow_(iso, tsMs){
    const tf = (SNAP.startMs > 0 && tsMs) ? Math.max(0, tsMs - SNAP.startMs) : null;

    const qp = SNAP.lastQuest || {};
    return {
      timestampIso: iso,
      projectTag: CTX.projectTag,
      runMode: CTX.runMode,
      studyId: CTX.studyId,
      phase: CTX.phase,
      conditionGroup: CTX.conditionGroup,

      sessionId: CTX.sessionId,
      eventType: '',

      gameMode: CTX.gameMode,
      diff: CTX.diff,

      timeFromStartMs: tf,

      targetId: '',
      emoji: '',
      itemType: '',
      lane: '',

      rtMs: null,
      judgment: '',

      totalScore: (SNAP.lastScore != null ? SNAP.lastScore : null),
      combo: (SNAP.lastCombo != null ? SNAP.lastCombo : null),
      isGood: '',

      feverState: '',
      feverValue: (SNAP.lastFever != null ? SNAP.lastFever : null),

      goalProgress: (qp.goalsCleared != null ? `${qp.goalsCleared}/${qp.goalsTotal||''}` : ''),
      miniProgress: (qp.minisCleared != null ? `${qp.minisCleared}/${qp.minisTotal||''}` : ''),

      extra: '',

      studentKey: CTX.studentKey,
      schoolCode: CTX.schoolCode,
      classRoom: CTX.classRoom,
      studentNo: CTX.studentNo,
      nickName: CTX.nickName
    };
  }

  // ---------- Listeners ----------
  function onSession(e){
    const d = (e && e.detail) ? e.detail : {};
    // update context if provided
    if (d.sessionId) CTX.sessionId = safeStr(d.sessionId);
    if (d.gameMode) CTX.gameMode = safeStr(d.gameMode);
    if (d.game) CTX.gameMode = safeStr(d.game);
    if (d.runMode) CTX.runMode = safeStr(d.runMode);
    if (d.mode) CTX.runMode = safeStr(d.mode);
    if (d.diff) CTX.diff = safeStr(d.diff);
    if (d.challenge) CTX.challenge = safeStr(d.challenge);
    if (d.endPolicy) CTX.endPolicy = safeStr(d.endPolicy);
    if (d.seed !== undefined) CTX.seed = safeStr(d.seed);
    if (d.seedRaw !== undefined) CTX.seedRaw = safeStr(d.seedRaw);

    // capture start time precisely when phase=start
    const ph = safeStr(d.phase || '').toLowerCase();
    const tsMs = Number(d.ts || now());
    if (!SNAP.startIso) SNAP.startIso = toIso(d.timestampIso || tsMs);
    if (!SNAP.startMs) SNAP.startMs = tsMs;

    // optional: write a start marker into events (not sessions)
    if (ph === 'start') {
      const iso = toIso(d.timestampIso || tsMs);
      const row = baseEventRow_(iso, tsMs);
      row.eventType = 'session_start';
      row.extra = tryJson({ phase:'start', ...d });
      enqueueEventRow(row);
    }

    // profile upsert
    enqueueProfileOnce_();
  }

  function onScore(e){
    const d = (e && e.detail) ? e.detail : {};
    if (d.score !== undefined) SNAP.lastScore = safeNum(d.score);
    if (d.totalScore !== undefined) SNAP.lastScore = safeNum(d.totalScore);
    if (d.combo !== undefined) SNAP.lastCombo = safeNum(d.combo);
    if (d.misses !== undefined) SNAP.lastMiss = safeNum(d.misses);
    if (d.fever !== undefined) SNAP.lastFever = safeNum(d.fever);
  }

  function onQuestUpdate(e){
    const d = (e && e.detail) ? e.detail : {};
    // normalize both naming styles
    const qc = safeNum(d.goalsCleared ?? d.goals ?? null);
    const qt = safeNum(d.goalsTotal ?? null);
    const mc = safeNum(d.minisCleared ?? d.miniCleared ?? null);
    const mt = safeNum(d.minisTotal ?? d.miniTotal ?? null);
    SNAP.lastQuest = {
      goalsCleared: qc,
      goalsTotal: qt,
      minisCleared: mc,
      minisTotal: mt
    };
  }

  function onEvent(e){
    const d = (e && e.detail) ? e.detail : {};
    // accept both kind/type
    const kindRaw = safeStr(d.kind || d.eventType || d.type || '');
    const tsMs = Number(d.ts || now());
    const iso = toIso(d.timestampIso || tsMs);

    if (d.sessionId) CTX.sessionId = safeStr(d.sessionId);
    if (d.gameMode) CTX.gameMode = safeStr(d.gameMode);
    if (d.game) CTX.gameMode = safeStr(d.game);

    if (!SNAP.startIso) SNAP.startIso = iso;
    if (!SNAP.startMs) SNAP.startMs = tsMs;

    const pk = parseKind_(kindRaw);
    const row = baseEventRow_(iso, tsMs);
    row.eventType = pk.eventType;
    row.itemType = pk.itemType;

    // attempt fill common fields
    row.rtMs = safeNum(d.rtMs ?? d.reactionMs ?? null);
    row.targetId = safeStr(d.targetId ?? d.id ?? '');
    row.emoji = safeStr(d.emoji ?? '');
    row.judgment = safeStr(d.judgment ?? '');

    // infer isGood (only if clear)
    if (pk.eventType === 'hit' && pk.itemType) {
      row.isGood = (pk.itemType === 'good' || pk.itemType === 'gold' || pk.itemType === 'star') ? 1 : 0;
    }

    // attach full detail safely
    row.extra = tryJson(d);

    enqueueEventRow(row);
  }

  function onEnd(e){
    const d = (e && e.detail) ? e.detail : {};
    const tsMs = Number(d.ts || now());
    const endIso = toIso(d.timestampIso || tsMs);

    if (!SNAP.startIso) SNAP.startIso = toIso(d.startTimeIso || d.startedAtIso || '');
    if (!SNAP.startIso) SNAP.startIso = endIso;
    if (!SNAP.startMs) SNAP.startMs = Number(d.startTsMs || now());

    if (d.sessionId) CTX.sessionId = safeStr(d.sessionId);
    if (d.gameMode) CTX.gameMode = safeStr(d.gameMode);
    if (d.game) CTX.gameMode = safeStr(d.game);
    if (d.diff) CTX.diff = safeStr(d.diff);
    if (d.runMode) CTX.runMode = safeStr(d.runMode);
    if (d.mode) CTX.runMode = safeStr(d.mode);
    if (d.challenge) CTX.challenge = safeStr(d.challenge);
    if (d.endPolicy) CTX.endPolicy = safeStr(d.endPolicy);
    if (d.seed !== undefined) CTX.seed = safeStr(d.seed);
    if (d.seedRaw !== undefined) CTX.seedRaw = safeStr(d.seedRaw);

    // compute durationPlayedSec fallback
    let played = safeNum(d.durationPlayedSec ?? null);
    if (played == null && SNAP.startIso) {
      try {
        const a = new Date(SNAP.startIso).getTime();
        const b = new Date(endIso).getTime();
        if (Number.isFinite(a) && Number.isFinite(b) && b >= a) played = Math.round((b - a)/1000);
      } catch(_) {}
    }

    // session row (matches HEADERS_SESSIONS)
    const row = {
      timestampIso: endIso,
      projectTag: (CTX.projectTag || d.projectTag || CTX.gameMode || ''),
      runMode: (CTX.runMode || d.runMode || 'play'),
      studyId: CTX.studyId,
      phase: CTX.phase,
      conditionGroup: CTX.conditionGroup,

      sessionOrder: CTX.sessionOrder,
      blockLabel: CTX.blockLabel,
      siteCode: CTX.siteCode,
      schoolYear: CTX.schoolYear,
      semester: CTX.semester,

      sessionId: CTX.sessionId,
      gameMode: (CTX.gameMode || d.gameMode || 'unknown'),
      diff: (CTX.diff || d.diff || 'normal'),

      // ✅ NEW standard fields (add to HEADERS_SESSIONS in Code.gs)
      challenge: (CTX.challenge || d.challenge || ''),
      endPolicy: (CTX.endPolicy || d.endPolicy || ''),
      seed: (CTX.seed || d.seed || ''),
      seedRaw: (CTX.seedRaw || d.seedRaw || ''),
      grade: safeStr(d.grade || ''),

      durationPlannedSec: safeNum(d.durationPlannedSec ?? CTX.durationPlannedSec ?? null),
      durationPlayedSec: played,

      scoreFinal: safeNum(d.scoreFinal ?? d.score ?? SNAP.lastScore ?? null),
      comboMax: safeNum(d.comboMax ?? null),
      misses: safeNum(d.misses ?? SNAP.lastMiss ?? null),

      goalsCleared: safeNum(d.goalsCleared ?? (SNAP.lastQuest && SNAP.lastQuest.goalsCleared) ?? null),
      goalsTotal: safeNum(d.goalsTotal ?? (SNAP.lastQuest && SNAP.lastQuest.goalsTotal) ?? null),
      miniCleared: safeNum(d.miniCleared ?? (SNAP.lastQuest && (SNAP.lastQuest.minisCleared ?? SNAP.lastQuest.miniCleared)) ?? null),
      miniTotal: safeNum(d.miniTotal ?? (SNAP.lastQuest && (SNAP.lastQuest.minisTotal ?? SNAP.lastQuest.miniTotal)) ?? null),

      nTargetGoodSpawned: safeNum(d.nTargetGoodSpawned ?? null),
      nTargetJunkSpawned: safeNum(d.nTargetJunkSpawned ?? null),
      nTargetStarSpawned: safeNum(d.nTargetStarSpawned ?? null),
      nTargetDiamondSpawned: safeNum(d.nTargetDiamondSpawned ?? null),
      nTargetShieldSpawned: safeNum(d.nTargetShieldSpawned ?? null),

      nHitGood: safeNum(d.nHitGood ?? null),
      nHitJunk: safeNum(d.nHitJunk ?? null),
      nHitJunkGuard: safeNum(d.nHitJunkGuard ?? null),
      nExpireGood: safeNum(d.nExpireGood ?? null),

      accuracyGoodPct: safeNum(d.accuracyGoodPct ?? null),
      junkErrorPct: safeNum(d.junkErrorPct ?? null),
      avgRtGoodMs: safeNum(d.avgRtGoodMs ?? null),
      medianRtGoodMs: safeNum(d.medianRtGoodMs ?? null),
      fastHitRatePct: safeNum(d.fastHitRatePct ?? null),

      device: (d.device || CTX.device || ''),
      gameVersion: (d.gameVersion || CTX.gameVersion || ''),
      reason: safeStr(d.reason || ''),

      startTimeIso: safeStr(d.startTimeIso || d.startedAtIso || SNAP.startIso || ''),
      endTimeIso: safeStr(d.endTimeIso || d.endedAtIso || endIso),

      studentKey: CTX.studentKey,
      schoolCode: CTX.schoolCode,
      schoolName: CTX.schoolName,
      classRoom: CTX.classRoom,
      studentNo: CTX.studentNo,
      nickName: CTX.nickName,

      gender: CTX.gender,
      age: CTX.age,
      gradeLevel: CTX.gradeLevel,

      heightCm: CTX.heightCm,
      weightKg: CTX.weightKg,
      bmi: CTX.bmi,
      bmiGroup: CTX.bmiGroup,

      vrExperience: CTX.vrExperience,
      gameFrequency: CTX.gameFrequency,
      handedness: CTX.handedness,
      visionIssue: CTX.visionIssue,
      healthDetail: CTX.healthDetail,

      consentParent: CTX.consentParent,
      consentTeacher: CTX.consentTeacher,

      profileSource: CTX.profileSource,
      surveyKey: CTX.surveyKey,
      excludeFlag: CTX.excludeFlag,
      noteResearcher: CTX.noteResearcher,
    };

    // attach bossJson safely if exists
    if (d.bossJson) row.bossJson = safeStr(d.bossJson);
    if (d.boss && !d.bossJson) row.bossJson = tryJson(d.boss);

    enqueueSessionRow(row);

    // add end marker event
    const er = baseEventRow_(endIso, tsMs);
    er.eventType = 'session_end';
    er.extra = tryJson({ reason: row.reason, grade: row.grade, scoreFinal: row.scoreFinal });
    enqueueEventRow(er);

    flush(true);
  }

  // ---------- Public API ----------
  const API = {
    init(opts = {}) {
      if (opts && typeof opts.debug === 'boolean') CFG.debug = opts.debug;
      if (opts && typeof opts.endpoint === 'string' && opts.endpoint.trim()) CFG.endpoint = opts.endpoint.trim();
      if (opts && typeof opts.disabled === 'boolean') CFG.disabled = opts.disabled;

      if (!CFG.endpoint) { logd('No endpoint. Add ?log=WEB_APP_URL or set window.HHA_LOG_ENDPOINT'); return; }
      if (CFG.disabled) { logd('Logger disabled via nolog=1'); return; }

      // bind standard events
      root.addEventListener('hha:log_session', onSession);
      root.addEventListener('hha:log_event', onEvent);
      root.addEventListener('hha:end', onEnd);

      // optional snapshots
      root.addEventListener('hha:score', onScore);
      root.addEventListener('quest:update', onQuestUpdate);

      // lifecycle flush
      root.addEventListener('pagehide', () => flush(true));
      root.addEventListener('beforeunload', () => flush(true));
      doc && doc.addEventListener && doc.addEventListener('visibilitychange', () => {
        if (doc.visibilityState === 'hidden') flush(true);
      });

      // mark session start time baseline
      if (!SNAP.startIso) SNAP.startIso = new Date().toISOString();
      if (!SNAP.startMs) SNAP.startMs = now();

      enqueueProfileOnce_(); // upsert profile once (if studentKey exists)
      logd('init ok', { endpoint: CFG.endpoint });
    },

    flushNow() { flush(true); },
    getContext() { return Object.assign({}, CTX); }
  };

  root.HHACloudLogger = API;

  // auto init
  try {
    if (!CFG.disabled && CFG.endpoint) API.init({ debug: (Q.get('logdebug') === '1') });
  } catch (_) {}

})(typeof window !== 'undefined' ? window : globalThis);
