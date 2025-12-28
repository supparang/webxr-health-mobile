// === /herohealth/vr/hha-cloud-logger.js ===
// HeroHealth — Cloud Logger (Google Apps Script Web App)
// GAS expects POST JSON (text/plain ok, no-cors):
//   { sessions:[row...], events:[row...], studentsProfile:[row...] }
// Usage: add ?log=<WEB_APP_EXEC_URL>
// Listens:
//  - hha:log_session  (start/end update; will MERGE to single session row by sessionId)
//  - hha:log_event    (append events)
//  - hha:end          (finalize session row + flush)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // ---------- endpoint ----------
  function getEndpoint(){
    try{
      const u = new URL(location.href);
      const ep = u.searchParams.get('log');
      return ep ? String(ep) : null;
    }catch(_){ return null; }
  }
  const ENDPOINT = getEndpoint();

  // ---------- utils ----------
  const isObj = (v)=>v && typeof v === 'object' && !Array.isArray(v);
  const pick1 = (...xs)=>{ for(const x of xs){ if(x!==undefined && x!==null && String(x)!=='') return x; } return ''; };
  const isoNow = ()=>{ try{ return new Date().toISOString(); }catch(_){ return ''; } };
  const numOrBlank = (v)=>{
    if (v===undefined || v===null || v==='') return '';
    const n = Number(v);
    return Number.isFinite(n) ? n : '';
  };
  const safeJson = (v)=>{
    try{
      if (v == null) return '';
      if (typeof v === 'string') return v;
      return JSON.stringify(v);
    }catch(_){ return ''; }
  };

  function detectDevice(){
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    const isVR = /Oculus|Quest|Vive|XR/i.test(ua);
    if (isVR) return 'vr';
    return isMobile ? 'mobile' : 'pc';
  }

  // ---------- queues / buffers ----------
  // We MERGE session rows by sessionId to write only once when finalized
  const sessionBuf = new Map(); // sessionId -> row
  const Q = { sessions: [], events: [], studentsProfile: [] };

  let flushing = false;
  let profileSentKey = ''; // avoid sending profile many times

  // ---------- transport (no-cors friendly) ----------
  function postBatch(payload){
    if (!ENDPOINT) return;

    const body = JSON.stringify(payload);

    // 1) sendBeacon (best for no-cors + page unload)
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain;charset=utf-8' }));
        if (ok) return true;
      }
    }catch(_){}

    // 2) fetch fallback (no-cors, text/plain)
    return fetch(ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      keepalive: true
    }).then(()=>true).catch(()=>false);
  }

  function flushSoon(){
    if (flushing) return;
    flushing = true;
    setTimeout(async () => {
      try{
        await flushNow();
      } finally {
        flushing = false;
      }
    }, 180);
  }

  async function flushNow(){
    if (!ENDPOINT) return;
    if (!Q.sessions.length && !Q.events.length && !Q.studentsProfile.length) return;

    // กัน payload ใหญ่เกิน: ตัดเป็นก้อนย่อย
    const MAX_EVENTS = 60;
    const MAX_SESS   = 10;
    const MAX_PROF   = 3;

    while(Q.sessions.length || Q.events.length || Q.studentsProfile.length){
      const payload = {
        projectTag: pick1(
          (Q.sessions[0] && Q.sessions[0].projectTag),
          (Q.events[0] && Q.events[0].projectTag),
          (Q.studentsProfile[0] && Q.studentsProfile[0].projectTag),
          ''
        ),
        sessions: Q.sessions.splice(0, MAX_SESS),
        events: Q.events.splice(0, MAX_EVENTS),
        studentsProfile: Q.studentsProfile.splice(0, MAX_PROF)
      };
      await postBatch(payload);
    }
  }

  // ---------- normalizers ----------
  function normalizeCtx(detail){
    // รองรับทั้ง flat หรือ {ctx, data}
    const ctx = (isObj(detail) && isObj(detail.ctx)) ? detail.ctx : (isObj(detail) ? detail : {});
    const data = (isObj(detail) && isObj(detail.data)) ? detail.data : {};
    return { ctx, data };
  }

  // EVENTS schema keys (ตาม GAS)
  function normalizeEvent(detail){
    const { ctx, data } = normalizeCtx(detail);

    const eventType = String(pick1(
      data.eventType,
      detail && detail.eventType,
      detail && detail.type,
      data.type,
      'event'
    ));

    const row = {
      // context
      timestampIso: pick1(ctx.timestampIso, detail && detail.timestampIso, data.timestampIso, isoNow()),
      projectTag: pick1(ctx.projectTag, detail && detail.projectTag, data.projectTag),
      runMode: pick1(ctx.runMode, detail && detail.runMode, detail && detail.run, data.runMode),
      studyId: pick1(ctx.studyId, detail && detail.studyId, data.studyId),
      phase: pick1(ctx.phase, detail && detail.phase, data.phase),
      conditionGroup: pick1(ctx.conditionGroup, detail && detail.conditionGroup, data.conditionGroup),

      sessionId: pick1(detail && detail.sessionId, data.sessionId, ctx.sessionId),
      eventType,
      gameMode: pick1(detail && detail.gameMode, detail && detail.game, data.gameMode, ctx.gameMode, 'unknown'),
      diff: pick1(detail && detail.diff, data.diff, ctx.diff),

      timeFromStartMs: numOrBlank(pick1(detail && detail.timeFromStartMs, data.timeFromStartMs, detail && detail.t, data.t)),
      targetId: String(pick1(data.targetId, detail && detail.targetId, '')),
      emoji: String(pick1(data.emoji, detail && detail.emoji, '')),
      itemType: String(pick1(data.itemType, data.kind, detail && detail.itemType, detail && detail.kind, '')),
      lane: String(pick1(data.lane, detail && detail.lane, '')),
      rtMs: numOrBlank(pick1(data.rtMs, detail && detail.rtMs, '')),
      judgment: String(pick1(data.judgment, detail && detail.judgment, '')),

      totalScore: numOrBlank(pick1(data.totalScore, detail && detail.totalScore, detail && detail.score, data.score, '')),
      combo: numOrBlank(pick1(data.combo, detail && detail.combo, '')),
      isGood: (data.isGood === true || data.isGood === 1) ? 1 : (data.isGood === false || data.isGood === 0) ? 0 : '',

      feverState: String(pick1(
        data.feverState,
        detail && detail.feverState,
        (detail && detail.feverOn === true) ? 'on' : (detail && detail.feverOn === false) ? 'off' : ''
      )),
      feverValue: numOrBlank(pick1(data.feverValue, detail && detail.feverValue, detail && detail.fever, '')),

      goalProgress: String(pick1(data.goalProgress, detail && detail.goalProgress, '')),
      miniProgress: String(pick1(data.miniProgress, detail && detail.miniProgress, '')),
      extra: safeJson(pick1(data.extra, detail && detail.extra, data, detail)),

      studentKey: pick1(ctx.studentKey, detail && detail.studentKey, data.studentKey),
      schoolCode: pick1(ctx.schoolCode, detail && detail.schoolCode, data.schoolCode),
      classRoom: pick1(ctx.classRoom, detail && detail.classRoom, data.classRoom),
      studentNo: pick1(ctx.studentNo, detail && detail.studentNo, data.studentNo),
      nickName: pick1(ctx.nickName, detail && detail.nickName, data.nickName),
    };

    return row;
  }

  // SESSIONS schema keys (ตาม GAS)
  // เราจะ "merge" start/end ให้เหลือ 1 row ต่อ sessionId แล้วค่อย push ลง Q.sessions
  function normalizeSessionPatch(detail){
    const { ctx, data } = normalizeCtx(detail);

    const sessionId = pick1(detail && detail.sessionId, data.sessionId, ctx.sessionId);
    const phase = String(pick1(detail && detail.phase, data.phase, ctx.phase, ''));
    const gameMode = pick1(detail && detail.gameMode, detail && detail.game, data.gameMode, ctx.gameMode, 'unknown');

    const patch = {
      timestampIso: pick1(ctx.timestampIso, detail && detail.timestampIso, isoNow()),
      projectTag: pick1(ctx.projectTag, detail && detail.projectTag),
      runMode: pick1(ctx.runMode, detail && detail.runMode, detail && detail.run, (detail && detail.mode==='research') ? 'study' : ''),
      studyId: pick1(ctx.studyId, detail && detail.studyId),
      phase: pick1(ctx.phase, detail && detail.phase),
      conditionGroup: pick1(ctx.conditionGroup, detail && detail.conditionGroup),

      sessionOrder: pick1(ctx.sessionOrder, detail && detail.sessionOrder),
      blockLabel: pick1(ctx.blockLabel, detail && detail.blockLabel),
      siteCode: pick1(ctx.siteCode, detail && detail.siteCode),
      schoolYear: pick1(ctx.schoolYear, detail && detail.schoolYear),
      semester: pick1(ctx.semester, detail && detail.semester),

      sessionId,
      gameMode,
      diff: pick1(detail && detail.diff, ctx.diff),

      durationPlannedSec: numOrBlank(pick1(
        detail && detail.durationPlannedSec,
        detail && detail.timeTotal, // plate ส่ง timeTotal
        data.durationPlannedSec
      )),

      durationPlayedSec: numOrBlank(pick1(detail && detail.durationPlayedSec, data.durationPlayedSec)),

      scoreFinal: numOrBlank(pick1(detail && detail.scoreFinal, detail && detail.score, data.scoreFinal, data.score)),
      comboMax: numOrBlank(pick1(detail && detail.comboMax, detail && detail.maxCombo, data.comboMax, data.maxCombo)),
      misses: numOrBlank(pick1(detail && detail.misses, detail && detail.miss, data.misses, data.miss)),

      goalsCleared: numOrBlank(pick1(detail && detail.goalsCleared, data.goalsCleared)),
      goalsTotal: numOrBlank(pick1(detail && detail.goalsTotal, data.goalsTotal)),
      miniCleared: numOrBlank(pick1(detail && detail.miniCleared, data.miniCleared)),
      miniTotal: numOrBlank(pick1(detail && detail.miniTotal, data.miniTotal)),

      // counters (ถ้าเกมส่งมาก็ใส่)
      nTargetGoodSpawned: numOrBlank(pick1(detail && detail.nTargetGoodSpawned, data.nTargetGoodSpawned)),
      nTargetJunkSpawned: numOrBlank(pick1(detail && detail.nTargetJunkSpawned, data.nTargetJunkSpawned)),
      nTargetStarSpawned: numOrBlank(pick1(detail && detail.nTargetStarSpawned, data.nTargetStarSpawned)),
      nTargetDiamondSpawned: numOrBlank(pick1(detail && detail.nTargetDiamondSpawned, data.nTargetDiamondSpawned)),
      nTargetShieldSpawned: numOrBlank(pick1(detail && detail.nTargetShieldSpawned, data.nTargetShieldSpawned)),
      nHitGood: numOrBlank(pick1(detail && detail.nHitGood, data.nHitGood)),
      nHitJunk: numOrBlank(pick1(detail && detail.nHitJunk, data.nHitJunk)),
      nHitJunkGuard: numOrBlank(pick1(detail && detail.nHitJunkGuard, data.nHitJunkGuard)),
      nExpireGood: numOrBlank(pick1(detail && detail.nExpireGood, data.nExpireGood)),
      accuracyGoodPct: numOrBlank(pick1(detail && detail.accuracyGoodPct, data.accuracyGoodPct)),
      junkErrorPct: numOrBlank(pick1(detail && detail.junkErrorPct, data.junkErrorPct)),
      avgRtGoodMs: numOrBlank(pick1(detail && detail.avgRtGoodMs, data.avgRtGoodMs)),
      medianRtGoodMs: numOrBlank(pick1(detail && detail.medianRtGoodMs, data.medianRtGoodMs)),
      fastHitRatePct: numOrBlank(pick1(detail && detail.fastHitRatePct, data.fastHitRatePct)),

      device: pick1(detail && detail.device, detectDevice()),
      gameVersion: pick1(detail && detail.gameVersion, ''),
      reason: pick1(detail && detail.reason, phase),

      startTimeIso: pick1(detail && detail.startTimeIso, ''),
      endTimeIso: pick1(detail && detail.endTimeIso, ''),

      studentKey: pick1(ctx.studentKey, detail && detail.studentKey),
      schoolCode: pick1(ctx.schoolCode, detail && detail.schoolCode),
      schoolName: pick1(ctx.schoolName, detail && detail.schoolName),
      classRoom: pick1(ctx.classRoom, detail && detail.classRoom),
      studentNo: pick1(ctx.studentNo, detail && detail.studentNo),
      nickName: pick1(ctx.nickName, detail && detail.nickName),

      gender: pick1(ctx.gender, detail && detail.gender),
      age: numOrBlank(pick1(ctx.age, detail && detail.age)),
      gradeLevel: pick1(ctx.gradeLevel, detail && detail.gradeLevel),

      heightCm: numOrBlank(pick1(ctx.heightCm, detail && detail.heightCm)),
      weightKg: numOrBlank(pick1(ctx.weightKg, detail && detail.weightKg)),
      bmi: numOrBlank(pick1(ctx.bmi, detail && detail.bmi)),
      bmiGroup: pick1(ctx.bmiGroup, detail && detail.bmiGroup),

      vrExperience: pick1(ctx.vrExperience, detail && detail.vrExperience),
      gameFrequency: pick1(ctx.gameFrequency, detail && detail.gameFrequency),
      handedness: pick1(ctx.handedness, detail && detail.handedness),
      visionIssue: pick1(ctx.visionIssue, detail && detail.visionIssue),
      healthDetail: pick1(ctx.healthDetail, detail && detail.healthDetail),

      consentParent: pick1(ctx.consentParent, detail && detail.consentParent),
      consentTeacher: pick1(ctx.consentTeacher, detail && detail.consentTeacher),

      profileSource: pick1(ctx.profileSource, detail && detail.profileSource),
      surveyKey: pick1(ctx.surveyKey, detail && detail.surveyKey),
      excludeFlag: pick1(ctx.excludeFlag, detail && detail.excludeFlag),
      noteResearcher: pick1(ctx.noteResearcher, detail && detail.noteResearcher),

      // internal
      __phase: phase,
      __gameMode: gameMode
    };

    return patch;
  }

  function isFinalizePhase(phase){
    const p = String(phase || '').toLowerCase();
    return (p === 'end' || p === 'gameover' || p === 'finish' || p === 'done');
  }

  function mergeSessionRow(base, patch){
    const out = Object.assign({}, base || {});
    for(const k in patch){
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      const v = patch[k];

      // ไม่เขียนคีย์ internal
      if (k.startsWith('__')) continue;

      // ถ้าเป็นค่าว่าง อย่าไปทับค่าที่มีอยู่
      if (v === '' || v === null || v === undefined) continue;
      out[k] = v;
    }
    return out;
  }

  // ---------- profile auto-upsert ----------
  function maybeQueueProfileFromDetail(detail){
    const { ctx, data } = normalizeCtx(detail);
    const studentKey = pick1(ctx.studentKey, detail && detail.studentKey, data.studentKey);
    if (!studentKey) return;

    // กันส่งซ้ำ (ต่อหน้าเดียว)
    if (String(studentKey) === String(profileSentKey)) return;
    profileSentKey = String(studentKey);

    const row = {
      timestampIso: pick1(ctx.timestampIso, isoNow()),
      projectTag: pick1(ctx.projectTag, detail && detail.projectTag, ''),
      runMode: pick1(ctx.runMode, detail && detail.runMode, detail && detail.run, ''),
      studentKey: studentKey,

      schoolCode: pick1(ctx.schoolCode, detail && detail.schoolCode, ''),
      schoolName: pick1(ctx.schoolName, detail && detail.schoolName, ''),
      classRoom: pick1(ctx.classRoom, detail && detail.classRoom, ''),
      studentNo: pick1(ctx.studentNo, detail && detail.studentNo, ''),
      nickName: pick1(ctx.nickName, detail && detail.nickName, ''),

      gender: pick1(ctx.gender, detail && detail.gender, ''),
      age: numOrBlank(pick1(ctx.age, detail && detail.age, '')),
      gradeLevel: pick1(ctx.gradeLevel, detail && detail.gradeLevel, ''),

      heightCm: numOrBlank(pick1(ctx.heightCm, detail && detail.heightCm, '')),
      weightKg: numOrBlank(pick1(ctx.weightKg, detail && detail.weightKg, '')),
      bmi: numOrBlank(pick1(ctx.bmi, detail && detail.bmi, '')),
      bmiGroup: pick1(ctx.bmiGroup, detail && detail.bmiGroup, ''),

      vrExperience: pick1(ctx.vrExperience, detail && detail.vrExperience, ''),
      gameFrequency: pick1(ctx.gameFrequency, detail && detail.gameFrequency, ''),
      handedness: pick1(ctx.handedness, detail && detail.handedness, ''),
      visionIssue: pick1(ctx.visionIssue, detail && detail.visionIssue, ''),
      healthDetail: pick1(ctx.healthDetail, detail && detail.healthDetail, ''),

      consentParent: pick1(ctx.consentParent, detail && detail.consentParent, ''),
      consentTeacher: pick1(ctx.consentTeacher, detail && detail.consentTeacher, ''),

      createdAtIso: '', // GAS จะเติมเองถ้าไม่มี
      updatedAtIso: '',
      source: pick1(ctx.profileSource, 'query')
    };

    Q.studentsProfile.push(row);
  }

  // ---------- event handlers ----------
  function onLogEvent(detail){
    if (!ENDPOINT) return;
    const row = normalizeEvent(detail || {});
    Q.events.push(row);
    maybeQueueProfileFromDetail(detail || {});
    flushSoon();
  }

  function onLogSession(detail){
    if (!ENDPOINT) return;

    const patch = normalizeSessionPatch(detail || {});
    const sid = patch.sessionId || '';
    if (!sid) {
      // ไม่มี sessionId ก็ส่งแบบแถวเดียวไปเลย (fallback)
      const row = mergeSessionRow({}, patch);
      Q.sessions.push(row);
      maybeQueueProfileFromDetail(detail || {});
      flushSoon();
      return;
    }

    const prev = sessionBuf.get(sid) || {};
    let merged = mergeSessionRow(prev, patch);

    // จับ start/end เวลา ถ้าเกมไม่ส่งให้
    // - ถ้า phase เหมือน start -> เติม startTimeIso ถ้ายังไม่มี
    // - ถ้า phase เหมือน end/gameover -> เติม endTimeIso
    const ph = String(pick1(patch.__phase, patch.phase)).toLowerCase();
    if (!merged.startTimeIso && (ph === 'start' || ph === 'begin')) merged.startTimeIso = isoNow();
    if (isFinalizePhase(ph) && !merged.endTimeIso) merged.endTimeIso = isoNow();

    // ถ้ามี start/end แล้วแต่ยังไม่คำนวณ durationPlayedSec -> คำนวณให้
    if (merged.startTimeIso && merged.endTimeIso && (merged.durationPlayedSec === '' || merged.durationPlayedSec === undefined)){
      const a = Date.parse(merged.startTimeIso);
      const b = Date.parse(merged.endTimeIso);
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a){
        merged.durationPlayedSec = Math.round((b - a) / 1000);
      }
    }

    sessionBuf.set(sid, merged);
    maybeQueueProfileFromDetail(detail || {});

    // ถ้าเป็น end/gameover -> finalize: push ลง Q.sessions แล้วล้าง buffer
    if (isFinalizePhase(ph)){
      Q.sessions.push(merged);
      sessionBuf.delete(sid);
      flushSoon();
    } else {
      // ยังไม่จบ ไม่ต้องเขียนลงชีตทันที
      flushSoon();
    }
  }

  function onEnd(detail){
    // hha:end ถือเป็นจบแน่นอน → finalize session ถ้า sessionId มี
    onLogSession(Object.assign({}, detail || {}, { phase: 'end' }));
    flushSoon();
    // พยายาม flush ทันที (ตอนจบเกม)
    flushNow();
  }

  // ---------- listeners ----------
  root.addEventListener('hha:log_event', (e) => onLogEvent(e.detail || {}));
  root.addEventListener('hha:log_session', (e) => onLogSession(e.detail || {}));
  root.addEventListener('hha:end', (e) => onEnd(e.detail || {}));

  // ---------- expose ----------
  root.HHACloudLogger = { flushNow };
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.HHACloudLogger = root.HHACloudLogger;

})(window);
