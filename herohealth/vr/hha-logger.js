// === /herohealth/vr/hha-logger.js ===
// HeroHealth Universal Logger (Pack 23) — Queue + Offline + Retry + Flush-Hardened
// ✅ Captures: session + events
// ✅ Persist queue in localStorage
// ✅ Batch flush + retry/backoff
// ✅ pagehide/hidden flush + optional sendBeacon
// ✅ Works with Google Apps Script endpoint (recommended POST JSON)

(function(ROOT){
  'use strict';
  const DOC = ROOT.document;

  const LSQ = 'HHA_LOG_QUEUE_V1';
  const LSM = 'HHA_LOG_META_V1';

  const nowIso = ()=> new Date().toISOString();
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  function safeJson(x){ try{ return JSON.stringify(x); }catch{ return ''; } }
  function safeParse(s){ try{ return JSON.parse(s); }catch{ return null; } }

  function uid(){
    // short-ish unique id
    return (Date.now().toString(36) + Math.random().toString(36).slice(2,8)).toUpperCase();
  }

  // ---- queue storage ----
  function loadQueue(){
    const q = safeParse(localStorage.getItem(LSQ)||'[]');
    return Array.isArray(q) ? q : [];
  }
  function saveQueue(q){
    try{ localStorage.setItem(LSQ, safeJson(q)); }catch(_){}
  }
  function loadMeta(){
    const m = safeParse(localStorage.getItem(LSM)||'{}');
    return (m && typeof m==='object') ? m : {};
  }
  function saveMeta(m){
    try{ localStorage.setItem(LSM, safeJson(m)); }catch(_){}
  }

  // ---- default schema builder ----
  function buildSessionBase(ctx){
    const url = location.href;

    const runMode = String(ctx.runMode ?? ctx.run ?? qs('run','play')).toLowerCase();
    const diff = String(ctx.diff ?? qs('diff','normal')).toLowerCase();
    const device = String(ctx.device ?? ctx.view ?? qs('view','mobile')).toLowerCase();

    const hub = ctx.hub ?? qs('hub', null);

    const sessionId = String(ctx.sessionId ?? qs('sessionId', qs('sid', '')) || '').trim() || ('S-'+uid());
    const seed = ctx.seed ?? qs('seed', null);

    return {
      // ---- session header (align with your sheet) ----
      timestampIso: nowIso(),
      projectTag: String(ctx.projectTag || ctx.gameTag || 'HeroHealth'),
      runMode,                       // play | research
      studyId: ctx.studyId ?? qs('studyId', qs('study', null)),
      phase: ctx.phase ?? qs('phase', null),
      conditionGroup: ctx.conditionGroup ?? qs('conditionGroup', qs('cond', null)),
      sessionOrder: ctx.sessionOrder ?? qs('sessionOrder', null),
      blockLabel: ctx.blockLabel ?? qs('blockLabel', null),

      siteCode: ctx.siteCode ?? qs('siteCode', qs('site', null)),
      schoolYear: ctx.schoolYear ?? qs('schoolYear', null),
      semester: ctx.semester ?? qs('semester', null),

      sessionId,
      gameMode: ctx.gameMode ?? ctx.challenge ?? qs('challenge', qs('gameMode', 'rush')),
      diff,
      durationPlannedSec: ctx.durationPlannedSec ?? Number(qs('time', ctx.time || 70)) || 70,
      durationPlayedSec: ctx.durationPlayedSec ?? null,

      // ---- outcomes (filled later) ----
      scoreFinal: null,
      comboMax: null,
      misses: null,

      goalsCleared: null,
      goalsTotal: null,
      miniCleared: null,
      miniTotal: null,

      // ---- counts (optional) ----
      nTargetGoodSpawned: null,
      nTargetJunkSpawned: null,
      nTargetStarSpawned: null,
      nTargetDiamondSpawned: null,
      nTargetShieldSpawned: null,

      nHitGood: null,
      nHitJunk: null,
      nHitJunkGuard: null,
      nExpireGood: null,

      accuracyGoodPct: null,
      junkErrorPct: null,
      avgRtGoodMs: null,
      medianRtGoodMs: null,
      fastHitRatePct: null,

      device,
      gameVersion: ctx.gameVersion ?? ctx.version ?? qs('v', null),
      reason: null,

      startTimeIso: ctx.startTimeIso ?? nowIso(),
      endTimeIso: null,

      // ---- identity profile (optional passthrough; keep null by default) ----
      studentKey: ctx.studentKey ?? null,
      schoolCode: ctx.schoolCode ?? null,
      schoolName: ctx.schoolName ?? null,
      classRoom: ctx.classRoom ?? null,
      studentNo: ctx.studentNo ?? null,
      nickName: ctx.nickName ?? null,
      gender: ctx.gender ?? null,
      age: ctx.age ?? null,
      gradeLevel: ctx.gradeLevel ?? null,

      heightCm: ctx.heightCm ?? null,
      weightKg: ctx.weightKg ?? null,
      bmi: ctx.bmi ?? null,
      bmiGroup: ctx.bmiGroup ?? null,
      vrExperience: ctx.vrExperience ?? null,
      gameFrequency: ctx.gameFrequency ?? null,
      handedness: ctx.handedness ?? null,
      visionIssue: ctx.visionIssue ?? null,
      healthDetail: ctx.healthDetail ?? null,
      consentParent: ctx.consentParent ?? null,

      // ---- extra meta ----
      seed,
      hub,
      url
    };
  }

  function mergeSession(session, patch){
    if(!patch || typeof patch!=='object') return session;
    for(const k of Object.keys(patch)){
      const v = patch[k];
      if (v !== undefined) session[k] = v;
    }
    return session;
  }

  // ---- network ----
  async function postJson(endpoint, payload, timeoutMs=8000){
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), timeoutMs);
    try{
      const res = await fetch(endpoint, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: safeJson(payload),
        keepalive: true,
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (!res.ok) throw new Error('HTTP '+res.status);
      // Apps Script sometimes returns text; ignore
      return true;
    }catch(err){
      clearTimeout(t);
      throw err;
    }
  }

  function beacon(endpoint, payload){
    try{
      if (!navigator.sendBeacon) return false;
      const blob = new Blob([safeJson(payload)], { type:'application/json' });
      return navigator.sendBeacon(endpoint, blob);
    }catch(_){
      return false;
    }
  }

  // ---- logger core ----
  function createLogger(opts={}){
    const endpoint = String(opts.endpoint || '').trim();
    if (!endpoint) console.warn('[HHA_LOG] endpoint missing');

    const batchSize = clamp(opts.batchSize ?? 20, 5, 60);
    const flushIntervalMs = clamp(opts.flushIntervalMs ?? 3500, 1200, 15000);

    const maxQueue = clamp(opts.maxQueue ?? 1200, 200, 5000);

    let enabled = !!endpoint;
    let flushing = false;

    let meta = loadMeta();
    if (!meta.installId) meta.installId = 'I-'+uid();
    saveMeta(meta);

    // session cache (per page)
    let session = null;
    let sessionStarted = false;

    // backoff
    let failCount = 0;
    let nextAllowAt = 0;

    function enqueue(item){
      const q = loadQueue();
      q.push(item);

      // guard growth
      if (q.length > maxQueue){
        q.splice(0, q.length - maxQueue);
      }
      saveQueue(q);
    }

    function makeEvent(type, payload){
      return {
        kind:'event',
        installId: meta.installId,
        type,
        atIso: nowIso(),
        sessionId: session?.sessionId || (payload && payload.sessionId) || null,
        projectTag: session?.projectTag || payload?.projectTag || null,
        runMode: session?.runMode || payload?.runMode || null,
        diff: session?.diff || payload?.diff || null,
        device: session?.device || payload?.device || null,
        data: payload || {}
      };
    }

    function startSession(detail){
      session = buildSessionBase(detail || {});
      sessionStarted = true;

      // ensure startTimeIso stable
      session.startTimeIso = detail?.startTimeIso || session.startTimeIso || nowIso();

      enqueue({ kind:'session_start', installId: meta.installId, atIso: nowIso(), session });
      enqueue(makeEvent('start', detail || {}));
      scheduleFlush(250);
    }

    function patchSession(patch){
      if (!session) return;
      mergeSession(session, patch);
      enqueue({ kind:'session_patch', installId: meta.installId, atIso: nowIso(), sessionId: session.sessionId, patch });
    }

    function endSession(detail){
      if (!session) {
        // still record end event
        enqueue(makeEvent('end', detail||{}));
        scheduleFlush(200);
        return;
      }
      const s = session;

      // map common end keys into session row
      const reason = detail?.reason || detail?.endReason || 'end';
      patchSession({
        reason,
        endTimeIso: detail?.endTimeIso || nowIso(),

        durationPlayedSec: detail?.durationPlayedSec ?? detail?.durationSec ?? s.durationPlayedSec,
        durationPlannedSec: detail?.durationPlannedSec ?? s.durationPlannedSec,

        scoreFinal: detail?.scoreFinal ?? detail?.score ?? s.scoreFinal,
        comboMax: detail?.comboMax ?? s.comboMax,
        misses: detail?.misses ?? detail?.miss ?? s.misses,

        goalsCleared: detail?.goalsCleared ?? s.goalsCleared,
        goalsTotal: detail?.goalsTotal ?? s.goalsTotal,
        miniCleared: detail?.miniCleared ?? s.miniCleared,
        miniTotal: detail?.miniTotal ?? s.miniTotal,

        nTargetGoodSpawned: detail?.nTargetGoodSpawned ?? s.nTargetGoodSpawned,
        nTargetJunkSpawned: detail?.nTargetJunkSpawned ?? s.nTargetJunkSpawned,
        nTargetStarSpawned: detail?.nTargetStarSpawned ?? s.nTargetStarSpawned,
        nTargetShieldSpawned: detail?.nTargetShieldSpawned ?? s.nTargetShieldSpawned,

        nHitGood: detail?.nHitGood ?? s.nHitGood,
        nHitJunk: detail?.nHitJunk ?? s.nHitJunk,
        nHitJunkGuard: detail?.nHitJunkGuard ?? s.nHitJunkGuard,
        nExpireGood: detail?.nExpireGood ?? s.nExpireGood,

        accuracyGoodPct: detail?.accuracyGoodPct ?? s.accuracyGoodPct,
        junkErrorPct: detail?.junkErrorPct ?? s.junkErrorPct,
        avgRtGoodMs: detail?.avgRtGoodMs ?? s.avgRtGoodMs,
        medianRtGoodMs: detail?.medianRtGoodMs ?? s.medianRtGoodMs,
        fastHitRatePct: detail?.fastHitRatePct ?? s.fastHitRatePct,

        gameVersion: detail?.gameVersion ?? s.gameVersion
      });

      enqueue(makeEvent('end', detail||{}));
      enqueue({ kind:'session_end', installId: meta.installId, atIso: nowIso(), sessionId: s.sessionId, summary: detail||{} });

      scheduleFlush(150);
    }

    // ---- flush loop ----
    let flushTimer = 0;
    function scheduleFlush(ms=flushIntervalMs){
      if (!enabled) return;
      if (flushTimer) return;
      flushTimer = setTimeout(()=>{
        flushTimer = 0;
        flush(false);
      }, ms);
    }

    async function flush(forceBeacon){
      if (!enabled || !endpoint) return false;
      if (flushing) return false;

      const t = Date.now();
      if (t < nextAllowAt) return false;

      flushing = true;
      try{
        const q = loadQueue();
        if (!q.length){
          flushing = false;
          return true;
        }

        const batch = q.slice(0, batchSize);
        const rest  = q.slice(batchSize);

        const payload = {
          v: 1,
          source: 'HeroHealthLogger',
          installId: meta.installId,
          sentAtIso: nowIso(),
          url: location.href,
          items: batch
        };

        // try beacon first if forced (pagehide)
        let ok = false;
        if (forceBeacon){
          ok = beacon(endpoint, payload);
          if (!ok) {
            await postJson(endpoint, payload, 6500);
            ok = true;
          }
        } else {
          await postJson(endpoint, payload, 8000);
          ok = true;
        }

        if (ok){
          saveQueue(rest);
          failCount = 0;
          nextAllowAt = 0;
          flushing = false;

          // if still has items, continue quickly
          if (rest.length) scheduleFlush(120);
          return true;
        }

        throw new Error('send failed');
      }catch(err){
        flushing = false;
        failCount = clamp(failCount + 1, 1, 12);
        const backoffMs = Math.min(60000, 900 * Math.pow(2, failCount-1));
        nextAllowAt = Date.now() + backoffMs;
        // schedule next attempt
        scheduleFlush(backoffMs);
        return false;
      }
    }

    // ---- event taps ----
    function bind(){
      if (createLogger.__bound) return;
      createLogger.__bound = true;

      ROOT.addEventListener('hha:start', (ev)=>{
        const d = ev?.detail || {};
        // session starts once
        if (!sessionStarted) startSession(d);
        else enqueue(makeEvent('start_dup', d));
      }, { passive:true });

      ROOT.addEventListener('hha:log', (ev)=>{
        const d = ev?.detail || {};
        enqueue(makeEvent(d.type || 'log', d));
        scheduleFlush();
      }, { passive:true });

      ROOT.addEventListener('hha:score', (ev)=>{
        const d = ev?.detail || {};
        enqueue(makeEvent('score', d));
        // optional: patch rolling values
        patchSession({
          comboMax: d.comboMax ?? session?.comboMax,
          misses: d.misses ?? session?.misses,
        });
        scheduleFlush();
      }, { passive:true });

      ROOT.addEventListener('hha:time', (ev)=>{
        const d = ev?.detail || {};
        enqueue(makeEvent('time', d));
      }, { passive:true });

      ROOT.addEventListener('hha:fever', (ev)=>{
        const d = ev?.detail || {};
        enqueue(makeEvent('fever', d));
      }, { passive:true });

      ROOT.addEventListener('quest:update', (ev)=>{
        const d = ev?.detail || {};
        enqueue(makeEvent('quest_update', d));
      }, { passive:true });

      ROOT.addEventListener('hha:end', (ev)=>{
        const d = ev?.detail || {};
        endSession(d);
        // force flush soon
        scheduleFlush(100);
      }, { passive:true });

      // flush-hardened
      ROOT.addEventListener('pagehide', ()=>{
        flush(true);
      }, { passive:true });

      DOC.addEventListener('visibilitychange', ()=>{
        if (DOC.visibilityState === 'hidden'){
          flush(true);
        }
      }, { passive:true });

      // online -> try flush quickly
      ROOT.addEventListener('online', ()=>{
        scheduleFlush(350);
      }, { passive:true });
    }

    bind();

    return {
      enable(){ enabled = true; },
      disable(){ enabled = false; },
      flushNow(){ return flush(false); },
      flushBeacon(){ return flush(true); },
      log(type, data){ enqueue(makeEvent(type, data||{})); scheduleFlush(); },
      patchSession,
      getSession(){ return session; },
      endpoint
    };
  }

  ROOT.HHA_LOGGER = { createLogger };

})(window);