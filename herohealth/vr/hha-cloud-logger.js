// === /herohealth/vr/hha-cloud-logger.js ===
// HeroHealth — Cloud Logger (Google Apps Script Web App)
// Usage: add ?log=<WEB_APP_EXEC_URL>
// Listens: hha:log_session, hha:log_event, hha:end
// ✅ Converts to GAS schema payload: { sessions:[...], events:[...], studentsProfile:[...] }
// ✅ sendBeacon + fetch(no-cors, text/plain) fallback
// ✅ flushNow() + auto flush on pagehide/beforeunload

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  function getEndpoint(){
    try{
      const u = new URL(location.href);
      const ep = u.searchParams.get('log');
      return ep ? String(ep) : null;
    }catch(_){ return null; }
  }

  const ENDPOINT = getEndpoint();
  let DEBUG = false;

  // ---- queue ----
  const Q = [];
  let flushing = false;

  function nowIso(){ return new Date().toISOString(); }

  function safeStr(v){ return (v===null||v===undefined) ? '' : String(v); }
  function safeNum(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : '';
  }

  function postPayload(payload){
    if (!ENDPOINT) return Promise.resolve(false);

    const body = JSON.stringify(payload);

    // Prefer beacon (best chance to survive navigation)
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(
          ENDPOINT,
          new Blob([body], { type: 'text/plain;charset=UTF-8' })
        );
        if (ok) return Promise.resolve(true);
      }
    }catch(_){}

    // Fallback fetch (no-cors + keepalive)
    return fetch(ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
      keepalive: true
    }).then(()=>true).catch(()=>false);
  }

  function enqueue(payload){
    if (!ENDPOINT) return;
    Q.push(payload);
    flushSoon();
  }

  function flushSoon(){
    if (flushing) return;
    flushing = true;
    setTimeout(async () => {
      try{
        while(Q.length){
          const payload = Q.shift();
          await postPayload(payload);
        }
      } finally {
        flushing = false;
      }
    }, 120);
  }

  async function flushNow(){
    if (!ENDPOINT) return;
    while(Q.length){
      const payload = Q.shift();
      await postPayload(payload);
    }
  }

  // ---- normalize helpers (accept multiple emitter styles) ----
  function pickCtx(detail){
    return (detail && detail.ctx && typeof detail.ctx === 'object') ? detail.ctx : (detail || {});
  }

  function ctxFields(ctx){
    ctx = ctx || {};
    return {
      projectTag: safeStr(ctx.projectTag),
      runMode: safeStr(ctx.runMode || ctx.run || ctx.mode),
      studyId: safeStr(ctx.studyId),
      phase: safeStr(ctx.phase),
      conditionGroup: safeStr(ctx.conditionGroup),

      sessionOrder: safeStr(ctx.sessionOrder),
      blockLabel: safeStr(ctx.blockLabel),
      siteCode: safeStr(ctx.siteCode),
      schoolYear: safeStr(ctx.schoolYear),
      semester: safeStr(ctx.semester),

      studentKey: safeStr(ctx.studentKey),
      schoolCode: safeStr(ctx.schoolCode),
      schoolName: safeStr(ctx.schoolName),
      classRoom: safeStr(ctx.classRoom),
      studentNo: safeStr(ctx.studentNo),
      nickName: safeStr(ctx.nickName),

      gender: safeStr(ctx.gender),
      age: safeStr(ctx.age),
      gradeLevel: safeStr(ctx.gradeLevel),

      heightCm: safeStr(ctx.heightCm),
      weightKg: safeStr(ctx.weightKg),
      bmi: safeStr(ctx.bmi),
      bmiGroup: safeStr(ctx.bmiGroup),

      vrExperience: safeStr(ctx.vrExperience),
      gameFrequency: safeStr(ctx.gameFrequency),
      handedness: safeStr(ctx.handedness),
      visionIssue: safeStr(ctx.visionIssue),
      healthDetail: safeStr(ctx.healthDetail),

      consentParent: safeStr(ctx.consentParent),
      consentTeacher: safeStr(ctx.consentTeacher),

      profileSource: safeStr(ctx.profileSource),
      surveyKey: safeStr(ctx.surveyKey),
      excludeFlag: safeStr(ctx.excludeFlag),
      noteResearcher: safeStr(ctx.noteResearcher),
    };
  }

  // Convert event in HHA Standard style: { type, data:{...}, ctx:{...} }
  function toEventRow(detail){
    const ctx = ctxFields(pickCtx(detail));
    const type = safeStr(detail && detail.type) || 'event';
    const data = (detail && detail.data && typeof detail.data === 'object') ? detail.data : {};

    const goalProg = (data.goalsCleared!==undefined && data.goalsTotal!==undefined)
      ? `${safeNum(data.goalsCleared)}/${safeNum(data.goalsTotal)}`
      : safeStr(data.goalProgress);

    const miniProg = (data.minisCleared!==undefined && data.minisTotal!==undefined)
      ? `${safeNum(data.minisCleared)}/${safeNum(data.minisTotal)}`
      : safeStr(data.miniProgress);

    const feverPct = (data.feverPct!==undefined) ? safeNum(data.feverPct) : safeNum(data.feverValue);
    const feverState = safeStr(data.feverState || (feverPct>=100 ? 'on' : ''));

    const kind = safeStr(data.kind || data.itemType || '');
    const judge = safeStr(data.judge || data.judgment || '');
    const emoji = safeStr(data.emoji || '');
    const isGood = (data.isGood!==undefined) ? !!data.isGood : (kind==='good' || kind==='gold');

    return {
      timestampIso: nowIso(),
      projectTag: ctx.projectTag,
      runMode: ctx.runMode,
      studyId: ctx.studyId,
      phase: ctx.phase,
      conditionGroup: ctx.conditionGroup,

      sessionId: safeStr(data.sessionId || detail.sessionId || ctx.sessionId),
      eventType: type,
      gameMode: safeStr(data.game || data.gameMode || ''),
      diff: safeStr(data.diff || ''),

      timeFromStartMs: safeNum(data.timeFromStartMs),
      targetId: safeStr(data.targetId || ''),
      emoji,
      itemType: kind,
      lane: safeStr(data.lane || ''),
      rtMs: safeNum(data.rtMs),
      judgment: judge,

      totalScore: safeNum(data.score || data.totalScore),
      combo: safeNum(data.combo),
      isGood: isGood ? 1 : 0,

      feverState,
      feverValue: feverPct,

      goalProgress: goalProg,
      miniProgress: miniProg,
      extra: (function(){
        try{ return JSON.stringify(data.extra || data || {}); }catch(_){ return safeStr(data.extra || ''); }
      })(),

      studentKey: ctx.studentKey,
      schoolCode: ctx.schoolCode,
      classRoom: ctx.classRoom,
      studentNo: ctx.studentNo,
      nickName: ctx.nickName,
    };
  }

  // Convert session detail: accept either {row:{...}} or raw row object
  function toSessionRow(detail){
    if (!detail) return null;
    const row = (detail.row && typeof detail.row === 'object') ? detail.row : detail;
    if (!row || typeof row !== 'object') return null;

    // Ensure timestampIso
    if (!row.timestampIso) row.timestampIso = nowIso();
    return row;
  }

  function toEndRow(detail){
    // optional: we let the game emit log_session final rows; end used for safety flush.
    return detail || {};
  }

  // ---- event listeners ----
  root.addEventListener('hha:log_event', (e) => {
    try{
      const d = e && e.detail;
      if (!d) return;

      // If already in GAS envelope, pass-through
      if (d.sessions || d.events || d.studentsProfile){
        enqueue(d);
        return;
      }

      // Standard {type,data,ctx}
      if (d.type && d.data){
        enqueue({ events: [toEventRow(d)] });
        return;
      }

      // Unknown: best-effort store as extra
      enqueue({ events: [ { timestampIso: nowIso(), eventType:'event', extra: safeStr(JSON.stringify(d)) } ] });
    }catch(err){
      if(DEBUG) console.warn('[HHACloudLogger] event error', err);
    }
  });

  root.addEventListener('hha:log_session', (e) => {
    try{
      const d = e && e.detail;
      if (!d) return;

      // Pass-through envelope
      if (d.sessions || d.events || d.studentsProfile){
        enqueue(d);
        return;
      }

      const row = toSessionRow(d);
      if (row) enqueue({ sessions: [row] });
    }catch(err){
      if(DEBUG) console.warn('[HHACloudLogger] session error', err);
    }
  });

  root.addEventListener('hha:end', (e) => {
    try{
      const d = e && e.detail;
      if (!d) return;

      // If end already provided envelope, pass-through
      if (d.sessions || d.events || d.studentsProfile){
        enqueue(d);
        return;
      }

      // We mainly use this to “force flush” moments. Keep as lightweight event row.
      const row = {
        timestampIso: nowIso(),
        eventType: 'end',
        extra: (function(){ try{ return JSON.stringify(toEndRow(d)); }catch(_){ return safeStr(d); } })()
      };
      enqueue({ events: [row] });
    }catch(err){
      if(DEBUG) console.warn('[HHACloudLogger] end error', err);
    }
  });

  // Auto flush on navigation
  function autoFlush(){
    try{ flushNow(); }catch(_){}
  }
  root.addEventListener('pagehide', autoFlush);
  root.addEventListener('beforeunload', autoFlush);
  doc.addEventListener('visibilitychange', ()=>{
    if (doc.visibilityState === 'hidden') autoFlush();
  });

  const api = {
    flushNow,
    init(opts){
      DEBUG = !!(opts && opts.debug);
      if(DEBUG) console.log('[HHACloudLogger] init ok', { ENDPOINT });
    }
  };

  root.HHACloudLogger = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.HHACloudLogger = api;

})(window);
