// === /herohealth/vr/hha-cloud-logger.js ===
// Hero Health Academy — Cloud Logger (IIFE)
// ✅ Schema Bridge v2: ส่งให้ GAS ตามสคีมาอาจารย์: {sessions[], events[], studentsProfile[]}
// ✅ Listens: hha:log_session, hha:log_event, hha:log_profile
// ✅ Queue + retry + localStorage buffer (offline-safe)
// ✅ no-cors best-effort

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // prevent double bind
  if (root.__HHA_LOGGER_BOUND__) return;
  root.__HHA_LOGGER_BOUND__ = true;

  const sp = new URLSearchParams(root.location && root.location.search ? root.location.search : '');

  // ---- config ----
  const META_ENDPOINT = (function(){
    try{
      const m = doc.querySelector('meta[name="hha-log-endpoint"]');
      return m ? (m.getAttribute('content') || '') : '';
    }catch{ return ''; }
  })();

  const ENDPOINT = String(
    root.HHA_LOG_ENDPOINT ||
    sp.get('endpoint') ||
    META_ENDPOINT ||
    ''
  ).trim();

  const ENABLED = !!ENDPOINT;
  const DEBUG = (sp.get('log') === '1');

  // storage keys
  const LS_KEY = 'HHA_LOG_QUEUE_V2';
  const LS_KEY_LAST = 'HHA_LOG_LAST_V2';

  // retry
  const RETRY_BASE_MS = 900;
  const RETRY_MAX_MS  = 12000;
  const FLUSH_EVERY_MS = 900;
  const BATCH_MAX = 14; // ต่อรอบ flush

  // ---- helpers ----
  function isoNow(){ try { return new Date().toISOString(); } catch { return ''; } }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function safeJsonParse(s, fallback){ try{ return JSON.parse(s); }catch{ return fallback; } }
  function safeJsonStringify(o){ try{ return JSON.stringify(o); }catch{ return '{}'; } }
  function uid(){ return 'hha_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16); }

  function getUA(){ try{ return navigator.userAgent || ''; }catch{ return ''; } }
  function getScreen(){ try{ return { w: root.innerWidth||0, h: root.innerHeight||0, dpr: root.devicePixelRatio||1 }; }catch{ return {w:0,h:0,dpr:1}; } }
  function getNet(){
    try{
      const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!c) return {};
      return { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: !!c.saveData };
    }catch{ return {}; }
  }

  function pickParam(...keys){
    for (let i=0;i<keys.length;i++){
      const v = sp.get(keys[i]);
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  // ---- context (map to research schema-ish) ----
  // URL params suggestion:
  // schoolCode, schoolName, classRoom, studentNo, nickName, studentKey, studyId, phase, conditionGroup
  const CONTEXT_BASE = {
    projectTag: pickParam('projectTag','project','tag') || 'HeroHealth',
    runMode:    pickParam('runMode','run','mode') || '',
    studyId:    pickParam('studyId') || '',
    phase:      pickParam('phase') || '',
    conditionGroup: pickParam('conditionGroup','group','challenge') || '',

    studentKey: pickParam('studentKey','studentId','sid','student') || '',
    schoolCode: pickParam('schoolCode','school','sch') || '',
    schoolName: pickParam('schoolName') || '',
    classRoom:  pickParam('classRoom','class','cls','room') || '',
    studentNo:  pickParam('studentNo','no') || '',
    nickName:   pickParam('nickName','nick','name') || '',

    schoolYear: pickParam('schoolYear') || '',
    semester:   pickParam('semester') || '',

    deviceTag:  pickParam('device','Device') || '',
    seed:       pickParam('seed') || ''
  };

  // ---- queue ----
  let queue = [];
  let flushing = false;
  let flushTimer = null;
  let lastFailAt = 0;
  let backoffMs = RETRY_BASE_MS;

  // session cache
  let sessionId = '';
  const sessionStartCache = new Map(); // sessionId -> {startTimeIso, durationPlannedSec,...}
  let lastProfile = null;

  function loadQueue(){
    const raw = (function(){ try{ return localStorage.getItem(LS_KEY) || ''; }catch{ return ''; } })();
    const arr = safeJsonParse(raw, []);
    if (Array.isArray(arr)) queue = arr;
  }
  function saveQueue(){ try{ localStorage.setItem(LS_KEY, safeJsonStringify(queue)); }catch{} }
  function setLastStatus(obj){ try{ localStorage.setItem(LS_KEY_LAST, safeJsonStringify(obj||{})); }catch{} }
  function getLastStatus(){ try{ return safeJsonParse(localStorage.getItem(LS_KEY_LAST)||'{}', {}); }catch{ return {}; } }

  function pushItem(item){
    queue.push(item);
    if (queue.length > 2000) queue = queue.slice(queue.length - 2000);
    saveQueue();
    if (DEBUG) dbg(`queued: ${item.type} (${queue.length})`);
  }

  // ---- debug UI ----
  let dbgEl = null;
  function ensureDebugUI(){
    if (!DEBUG) return;
    if (dbgEl) return;
    dbgEl = doc.createElement('div');
    dbgEl.style.cssText =
      'position:fixed;left:10px;bottom:10px;z-index:99999;max-width:min(520px,calc(100%-20px));' +
      'background:rgba(2,6,23,.72);border:1px solid rgba(148,163,184,.22);border-radius:14px;' +
      'padding:10px 12px;color:#e5e7eb;font:12px/1.35 system-ui;backdrop-filter:blur(10px);' +
      'box-shadow:0 18px 50px rgba(0,0,0,.42);pointer-events:none;white-space:pre-wrap;';
    dbgEl.textContent = 'Logger: ready';
    (doc.body||doc.documentElement).appendChild(dbgEl);
  }
  function dbg(msg){
    if (!DEBUG) return;
    ensureDebugUI();
    if (!dbgEl) return;
    const last = getLastStatus();
    dbgEl.textContent =
      `Logger ${ENABLED ? 'ON' : 'OFF'} | q=${queue.length} | backoff=${backoffMs}ms\n` +
      `[${new Date().toLocaleTimeString()}] ${msg}\n` +
      (last && last.lastOk ? `lastOk=${last.lastOk}` : '') +
      (last && last.lastErr ? ` | lastErr=${last.lastErr}` : '');
  }

  // ---- normalize helpers ----
  function baseRow(){
    // ใส่ให้ครบ key หลักที่ GAS schema ใช้ (ที่เหลือปล่อยว่างได้)
    return {
      timestampIso: isoNow(),
      projectTag: CONTEXT_BASE.projectTag || 'HeroHealth',
      runMode: CONTEXT_BASE.runMode || '',
      studyId: CONTEXT_BASE.studyId || '',
      phase: CONTEXT_BASE.phase || '',
      conditionGroup: CONTEXT_BASE.conditionGroup || '',
      sessionId: sessionId || '',
      studentKey: CONTEXT_BASE.studentKey || '',
      schoolCode: CONTEXT_BASE.schoolCode || '',
      schoolName: CONTEXT_BASE.schoolName || '',
      classRoom: CONTEXT_BASE.classRoom || '',
      studentNo: CONTEXT_BASE.studentNo || '',
      nickName: CONTEXT_BASE.nickName || '',
      schoolYear: CONTEXT_BASE.schoolYear || '',
      semester: CONTEXT_BASE.semester || ''
    };
  }

  function mapEventType(name){
    name = String(name||'').toLowerCase();
    if (!name) return 'event';
    if (name.startsWith('hit_good')) return 'hit';
    if (name.startsWith('hit_gold')) return 'hit';
    if (name.startsWith('hit_power')) return 'hit';
    if (name.startsWith('hit_boss')) return 'hit';
    if (name.startsWith('hit_bad')) return 'junk_hit';
    if (name.startsWith('hazard_hit')) return 'junk_hit';
    if (name.startsWith('good_expired')) return 'miss';
    if (name.startsWith('block_bad')) return 'guard';
    if (name.startsWith('shield_break')) return 'guard';
    if (name.startsWith('stun_start')) return 'stun_start';
    if (name.startsWith('stun_end')) return 'stun_end';
    if (name.startsWith('boss_spawn')) return 'boss_spawn';
    if (name.startsWith('boss_clear')) return 'boss_clear';
    if (name.startsWith('power_')) return 'power';
    if (name === 'shoot_miss') return 'miss';
    if (name === 'end_summary') return 'end';
    return name;
  }

  function normalizeEvent(meta){
    const row = baseRow();
    const tsIso = meta.tsIso || meta.timestampIso || row.timestampIso;

    row.timestampIso = tsIso;
    row.projectTag = meta.projectTag || row.projectTag;

    row.runMode = meta.runMode || meta.run || row.runMode;
    row.studyId = meta.studyId || row.studyId;
    row.phase   = meta.phase || row.phase;
    row.conditionGroup = meta.conditionGroup || meta.challenge || row.conditionGroup;

    row.sessionId = meta.sessionId || row.sessionId;

    // Events schema fields
    return Object.assign(row, {
      eventType: mapEventType(meta.name || meta.kind || meta.eventType),
      gameMode: meta.gameMode || meta.game || 'goodjunk',
      diff: meta.diff || '',
      timeFromStartMs: meta.timeFromStartMs || meta.tMs || meta.timeMs || '',
      targetId: meta.targetId || '',
      emoji: meta.emoji || meta.emo || '',
      itemType: meta.itemType || meta.kind2 || '',
      lane: meta.lane || '',
      rtMs: meta.rtMs || meta.rt || '',
      judgment: meta.judgment || '',

      totalScore: meta.totalScore != null ? meta.totalScore : (meta.score != null ? meta.score : ''),
      combo: meta.combo != null ? meta.combo : '',
      isGood: meta.isGood != null ? meta.isGood : '',

      feverState: meta.feverState || '',
      feverValue: meta.feverValue != null ? meta.feverValue : (meta.fever != null ? meta.fever : ''),

      goalProgress: meta.goalProgress || '',
      miniProgress: meta.miniProgress || '',
      extra: meta.extra || (function(){
        // เก็บ detail อื่น ๆ ลง extra เพื่อไม่ทิ้งข้อมูล
        const copy = Object.assign({}, meta);
        // ตัด key ใหญ่ ๆ
        delete copy.ua; delete copy.screen; delete copy.net;
        return safeJsonStringify(copy);
      })()
    });
  }

  function normalizeSessionRow(endMeta){
    const row = baseRow();

    const sid = String(endMeta.sessionId || row.sessionId || '');
    const start = sessionStartCache.get(sid) || {};

    const startIso = start.startTimeIso || start.startedIso || endMeta.startedIso || '';
    const endIso   = endMeta.endTimeIso || endMeta.endedIso || endMeta.endTime || endMeta.endedAtIso || isoNow();

    row.timestampIso = endIso || isoNow();
    row.projectTag   = endMeta.projectTag || row.projectTag;
    row.runMode      = endMeta.runMode || endMeta.run || row.runMode;
    row.studyId      = endMeta.studyId || row.studyId;
    row.phase        = endMeta.phase || row.phase;
    row.conditionGroup = endMeta.conditionGroup || endMeta.challenge || row.conditionGroup;

    row.sessionId = sid;

    return Object.assign(row, {
      sessionOrder: endMeta.sessionOrder || '',
      blockLabel: endMeta.blockLabel || '',
      siteCode: endMeta.siteCode || '',

      gameMode: endMeta.gameMode || endMeta.game || 'goodjunk',
      diff: endMeta.diff || '',

      durationPlannedSec: endMeta.durationPlannedSec != null ? endMeta.durationPlannedSec : (endMeta.durationSec != null ? endMeta.durationSec : (start.durationSec||'')),
      durationPlayedSec:  endMeta.durationPlayedSec  != null ? endMeta.durationPlayedSec  : (endMeta.durationSec != null ? endMeta.durationSec : ''),

      scoreFinal: endMeta.scoreFinal != null ? endMeta.scoreFinal : (endMeta.score != null ? endMeta.score : ''),
      comboMax: endMeta.comboMax != null ? endMeta.comboMax : '',
      misses: endMeta.misses != null ? endMeta.misses : '',

      // quest counts ถ้า engine ส่งมาจะลงให้ทันที (ยังไม่ส่งก็ว่างได้)
      goalsCleared: endMeta.goalsCleared != null ? endMeta.goalsCleared : '',
      goalsTotal:   endMeta.goalsTotal   != null ? endMeta.goalsTotal   : '',
      miniCleared:  endMeta.miniCleared  != null ? endMeta.miniCleared  : '',
      miniTotal:    endMeta.miniTotal    != null ? endMeta.miniTotal    : '',

      // spawn/hit/expire (ถ้า engine ส่งมา)
      nTargetGoodSpawned:   endMeta.nTargetGoodSpawned   != null ? endMeta.nTargetGoodSpawned   : '',
      nTargetJunkSpawned:   endMeta.nTargetJunkSpawned   != null ? endMeta.nTargetJunkSpawned   : '',
      nTargetStarSpawned:   endMeta.nTargetStarSpawned   != null ? endMeta.nTargetStarSpawned   : '',
      nTargetDiamondSpawned:endMeta.nTargetDiamondSpawned!= null ? endMeta.nTargetDiamondSpawned: '',
      nTargetShieldSpawned: endMeta.nTargetShieldSpawned != null ? endMeta.nTargetShieldSpawned : '',

      nHitGood:      endMeta.nHitGood      != null ? endMeta.nHitGood      : (endMeta.goodHits != null ? endMeta.goodHits : ''),
      nHitJunk:      endMeta.nHitJunk      != null ? endMeta.nHitJunk      : (endMeta.junkHits != null ? endMeta.junkHits : ''),
      nHitJunkGuard: endMeta.nHitJunkGuard != null ? endMeta.nHitJunkGuard : '',
      nExpireGood:   endMeta.nExpireGood   != null ? endMeta.nExpireGood   : (endMeta.goodExpired != null ? endMeta.goodExpired : ''),

      accuracyGoodPct: endMeta.accuracyGoodPct != null ? endMeta.accuracyGoodPct : '',
      junkErrorPct:    endMeta.junkErrorPct    != null ? endMeta.junkErrorPct    : '',
      avgRtGoodMs:     endMeta.avgRtGoodMs     != null ? endMeta.avgRtGoodMs     : '',
      medianRtGoodMs:  endMeta.medianRtGoodMs  != null ? endMeta.medianRtGoodMs  : '',
      fastHitRatePct:  endMeta.fastHitRatePct  != null ? endMeta.fastHitRatePct  : '',

      device: endMeta.device || CONTEXT_BASE.deviceTag || '',
      gameVersion: endMeta.gameVersion || endMeta.version || '',
      reason: endMeta.reason || endMeta.kind || 'end',

      startTimeIso: startIso || '',
      endTimeIso: endIso || ''
    });
  }

  function normalizeProfile(meta){
    // ให้ GAS รับ studentsProfile: [...]
    const base = baseRow();
    const nowI = isoNow();
    return {
      timestampIso: nowI,
      projectTag: meta.projectTag || base.projectTag,
      runMode: meta.runMode || base.runMode,

      studentKey: meta.studentKey || base.studentKey,
      schoolCode: meta.schoolCode || base.schoolCode,
      schoolName: meta.schoolName || base.schoolName,
      classRoom:  meta.classRoom  || base.classRoom,
      studentNo:  meta.studentNo  || base.studentNo,
      nickName:   meta.nickName   || base.nickName,

      gender: meta.gender || '',
      age: meta.age || '',
      gradeLevel: meta.gradeLevel || '',

      heightCm: meta.heightCm || '',
      weightKg: meta.weightKg || '',
      bmi: meta.bmi || '',
      bmiGroup: meta.bmiGroup || '',

      vrExperience: meta.vrExperience || '',
      gameFrequency: meta.gameFrequency || '',
      handedness: meta.handedness || '',
      visionIssue: meta.visionIssue || '',
      healthDetail: meta.healthDetail || '',

      consentParent: meta.consentParent || '',
      consentTeacher: meta.consentTeacher || '',

      createdAtIso: meta.createdAtIso || nowI,
      updatedAtIso: nowI,
      source: meta.source || meta.profileSource || 'logger'
    };
  }

  // ---- transport ----
  async function postJSON(url, payload){
    const body = safeJsonStringify(payload);
    const res = await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    return res;
  }

  function canFlush(){
    if (!ENABLED) return false;
    if (queue.length <= 0) return false;
    const t = Date.now();
    if (lastFailAt && (t - lastFailAt) < backoffMs) return false;
    return true;
  }

  async function flush(){
    if (flushing) return;
    if (!canFlush()) return;

    flushing = true;
    const batch = queue.slice(0, BATCH_MAX);

    // Build GAS payload shape
    const sessions = [];
    const events = [];
    const studentsProfile = [];

    for (const it of batch){
      if (!it) continue;
      if (it.type === 'session_row'){
        sessions.push(it.row);
      } else if (it.type === 'event_row'){
        events.push(it.row);
      } else if (it.type === 'profile_row'){
        studentsProfile.push(it.row);
      }
    }

    const payload = {
      projectTag: CONTEXT_BASE.projectTag || 'HeroHealth',
      runMode: CONTEXT_BASE.runMode || '',
      studyId: CONTEXT_BASE.studyId || '',
      phase: CONTEXT_BASE.phase || '',
      conditionGroup: CONTEXT_BASE.conditionGroup || '',
      sessions,
      events,
      studentsProfile
    };

    try{
      await postJSON(ENDPOINT, payload);

      queue = queue.slice(batch.length);
      saveQueue();

      backoffMs = RETRY_BASE_MS;
      lastFailAt = 0;
      setLastStatus({ lastOk: isoNow(), lastErr: '' });

      if (DEBUG) dbg(`flush ok: sessions=${sessions.length}, events=${events.length}, profiles=${studentsProfile.length}, remainQ=${queue.length}`);

    } catch (err){
      lastFailAt = Date.now();
      backoffMs = clamp(backoffMs * 1.6, RETRY_BASE_MS, RETRY_MAX_MS);
      setLastStatus({ lastOk: getLastStatus().lastOk || '', lastErr: String(err && err.message ? err.message : err) });
      if (DEBUG) dbg(`flush fail: ${String(err)} (backoff ${backoffMs}ms)`);
    } finally {
      flushing = false;
    }
  }

  function startFlushLoop(){
    if (flushTimer) return;
    flushTimer = setInterval(flush, FLUSH_EVERY_MS);
  }

  // ---- public API ----
  function setContext(patch){
    if (!patch) return;
    Object.assign(CONTEXT_BASE, patch);
    if (DEBUG) dbg(`context patched: ${safeJsonStringify(patch)}`);
  }

  // ---- event handlers ----
  function onSession(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if (!sessionId) sessionId = String(d.sessionId || uid());
    if (d.sessionId) sessionId = String(d.sessionId);

    // sync context
    if (d.projectTag) CONTEXT_BASE.projectTag = String(d.projectTag);
    if (d.runMode || d.run) CONTEXT_BASE.runMode = String(d.runMode || d.run);
    if (d.studyId) CONTEXT_BASE.studyId = String(d.studyId);
    if (d.phase) CONTEXT_BASE.phase = String(d.phase);
    if (d.conditionGroup || d.challenge) CONTEXT_BASE.conditionGroup = String(d.conditionGroup || d.challenge);

    const kind = String(d.kind || 'start').toLowerCase();

    if (kind === 'start'){
      sessionStartCache.set(sessionId, {
        startTimeIso: d.startTimeIso || d.startedIso || isoNow(),
        durationSec: d.durationSec || d.durationPlannedSec || ''
      });
      // start เป็น event แถวหนึ่งได้ (optional)
      const er = normalizeEvent(Object.assign({}, d, { sessionId, name:'start' }));
      pushItem({ type:'event_row', row: er });

      if (DEBUG) dbg(`session start: sid=${sessionId}`);

    } else if (kind === 'end'){
      const sr = normalizeSessionRow(Object.assign({}, d, { sessionId }));
      pushItem({ type:'session_row', row: sr });

      // end เป็น event แถวหนึ่งด้วย
      const er = normalizeEvent(Object.assign({}, d, { sessionId, name:'end' }));
      pushItem({ type:'event_row', row: er });

      if (DEBUG) dbg(`session end: sid=${sessionId} score=${sr.scoreFinal} miss=${sr.misses}`);
    }

    flush();
  }

  function onEvent(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if (!sessionId && d.sessionId) sessionId = String(d.sessionId);
    if (!sessionId) sessionId = uid();

    // sync context if present
    if (d.projectTag) CONTEXT_BASE.projectTag = String(d.projectTag);
    if (d.runMode || d.run) CONTEXT_BASE.runMode = String(d.runMode || d.run);
    if (d.studyId) CONTEXT_BASE.studyId = String(d.studyId);
    if (d.phase) CONTEXT_BASE.phase = String(d.phase);
    if (d.conditionGroup || d.challenge) CONTEXT_BASE.conditionGroup = String(d.conditionGroup || d.challenge);

    const meta = Object.assign({ sessionId }, d);
    const er = normalizeEvent(meta);
    pushItem({ type:'event_row', row: er });

    if (queue.length <= 30 || (queue.length % 6 === 0)) flush();
  }

  function onProfile(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    // เก็บ latest profile ไว้ (จะ flush ไปพร้อม batch)
    lastProfile = Object.assign({}, d);
    const pr = normalizeProfile(lastProfile);
    pushItem({ type:'profile_row', row: pr });
    flush();
  }

  // ---- expose ----
  const api = {
    enabled: ENABLED,
    endpoint: ENDPOINT,
    getQueueSize: () => queue.length,
    flush,
    setContext
  };
  root.HHA_Logger = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Logger = api;

  // ---- init ----
  loadQueue();
  startFlushLoop();
  ensureDebugUI();
  if (DEBUG) dbg(`init ${ENABLED ? 'OK' : 'NO ENDPOINT'} | endpoint=${ENABLED ? 'set' : 'missing'}`);

  // Bind events
  root.addEventListener('hha:log_session', onSession);
  root.addEventListener('hha:log_event', onEvent);
  root.addEventListener('hha:log_profile', onProfile);

  // capture end summary (คุณมีอยู่แล้ว)
  root.addEventListener('hha:end', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    onEvent({ detail: Object.assign({ name:'end_summary' }, d) });
  });

  // flush on online/hidden
  root.addEventListener('online', ()=>{ if (DEBUG) dbg('online -> flush'); flush(); });
  doc.addEventListener('visibilitychange', ()=>{
    if (doc.visibilityState === 'hidden') { if (DEBUG) dbg('hidden -> flush'); flush(); }
  });

})(window);
