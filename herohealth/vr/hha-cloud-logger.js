// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger V2.1 — ROW Schema + Dedup + Queue + Beacon (PRODUCTION SAFE)
// ✅ Flatten into sheet-like columns (rows[])
// ✅ Safe: never throws, gameplay never breaks
// ✅ Queue in mem + localStorage, flush on pagehide/hidden
// ✅ Transport: sendBeacon -> fetch keepalive -> fetch no-cors
// ✅ Endpoint: ?log= overrides DEFAULT_ENDPOINT
// ✅ Disable: ?nolog=1
// ✅ Dedup: basic eventKey (prevents rapid duplicates)

(function(){
  'use strict';

  const ROOT = window;
  const DOC  = document;

  if (ROOT.__HHA_CLOUD_LOGGER_V21__) return;
  ROOT.__HHA_CLOUD_LOGGER_V21__ = true;

  // -------------------------
  // Config
  // -------------------------
  const DEFAULT_ENDPOINT =
    'https://script.google.com/macros/s/AKfycbxdy-3BjJhn6Fo3kQX9oxHQIlXT7p2OXn-UYfv1MKV5oSW6jYG-RlnAgKlHqrNxxbhmaw/exec';

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  const ENDPOINT = (qs('log', null) || DEFAULT_ENDPOINT);
  const DISABLED = (qs('nolog','0') === '1');

  const LS_KEY = 'HHA_LOG_QUEUE_V21';
  const MAX_QUEUE = 240;
  const MAX_LS = 160;
  const FLUSH_BATCH = 24;

  // Dedup
  const DEDUP_TTL_MS = 1800;
  const dedup = new Map(); // key -> lastTs

  // -------------------------
  // Safe helpers
  // -------------------------
  function safeNowIso(){ try { return new Date().toISOString(); } catch { return ''; } }
  function safeStr(x){ try { return (x==null)?'':String(x); } catch { return ''; } }
  function safeNum(x, def=0){
    const n = Number(x);
    return Number.isFinite(n) ? n : def;
  }
  function safeJson(obj){ try { return JSON.stringify(obj); } catch { return '{"_err":"json"}'; } }
  function safeParse(str){ try { return JSON.parse(str); } catch { return null; } }

  function getLS(){
    try{
      const s = localStorage.getItem(LS_KEY);
      if(!s) return [];
      const j = safeParse(s);
      return Array.isArray(j) ? j : [];
    }catch(_){ return []; }
  }
  function setLS(arr){
    try{ localStorage.setItem(LS_KEY, safeJson(arr)); }catch(_){}
  }
  function pushLS(items){
    try{
      const cur = getLS();
      const next = cur.concat(items);
      const trimmed = next.length > MAX_LS ? next.slice(next.length - MAX_LS) : next;
      setLS(trimmed);
    }catch(_){}
  }
  function popLS(n){
    try{
      const cur = getLS();
      if(!cur.length) return [];
      const take = cur.slice(0, n);
      const rest = cur.slice(n);
      setLS(rest);
      return take;
    }catch(_){ return []; }
  }

  // -------------------------
  // Context (fill from start/end)
  // -------------------------
  const ctx = {
    sessionId: null,
    startTimeIso: null,
    projectTag: null,
    runMode: null,
    view: null,
    diff: null,
    seed: null,
    gameVersion: null,

    // study metadata
    studyId: null,
    phase: null,
    conditionGroup: null,
    sessionOrder: null,
    blockLabel: null,
    siteCode: null,

    // student/profile (optional, if passed by game or URL)
    studentKey: null,
    schoolCode: null,
    schoolName: null,
    classRoom: null,
    studentNo: null,
    nickName: null,
    gender: null,
    age: null,
    gradeLevel: null,
    heightCm: null,
    weightKg: null,
    bmi: null,
    bmiGroup: null,
    vrExperience: null,
    gameFrequency: null,
    handedness: null,
    visionIssue: null,
    healthDetail: null,
    consentParent: null,
  };

  function ensureSessionId(){
    if(ctx.sessionId) return ctx.sessionId;
    ctx.sessionId = 'HHA-' + Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
    return ctx.sessionId;
  }

  // Pull optional identity from URL (non-breaking)
  function hydrateFromUrlOnce(){
    try{
      // only fill missing values
      const map = [
        ['studyId',['study','studyId']],
        ['phase',['phase']],
        ['conditionGroup',['cond','conditionGroup']],
        ['sessionOrder',['sessionOrder']],
        ['blockLabel',['block','blockLabel']],
        ['siteCode',['site','siteCode']],
        ['studentKey',['studentKey','sid','student']],
        ['schoolCode',['schoolCode']],
        ['schoolName',['schoolName']],
        ['classRoom',['classRoom','room']],
        ['studentNo',['studentNo','no']],
        ['nickName',['nickName','nick']],
        ['gender',['gender']],
        ['age',['age']],
        ['gradeLevel',['gradeLevel','grade']],
        ['heightCm',['heightCm']],
        ['weightKg',['weightKg']],
        ['bmi',['bmi']],
        ['bmiGroup',['bmiGroup']],
        ['vrExperience',['vrExperience']],
        ['gameFrequency',['gameFrequency']],
        ['handedness',['handedness']],
        ['visionIssue',['visionIssue']],
        ['healthDetail',['healthDetail']],
        ['consentParent',['consentParent']],
      ];
      for(const [k, keys] of map){
        if(ctx[k] != null && ctx[k] !== '') continue;
        for(const q of keys){
          const v = qs(q, null);
          if(v != null && v !== ''){
            ctx[k] = v;
            break;
          }
        }
      }
    }catch(_){}
  }
  hydrateFromUrlOnce();

  // -------------------------
  // Sheet ROW schema (flat)
  // -------------------------
  function baseRow(){
    return {
      timestampIso: safeNowIso(),
      projectTag: ctx.projectTag || null,

      runMode: ctx.runMode || null,
      studyId: ctx.studyId || null,
      phase: ctx.phase || null,
      conditionGroup: ctx.conditionGroup || null,
      sessionOrder: ctx.sessionOrder || null,
      blockLabel: ctx.blockLabel || null,
      siteCode: ctx.siteCode || null,
      schoolYear: qs('schoolYear', null),
      semester: qs('semester', null),

      sessionId: ensureSessionId(),
      gameMode: ctx.view || null,
      diff: ctx.diff || null,
      durationPlannedSec: null,
      durationPlayedSec: null,

      scoreFinal: null,
      comboMax: null,
      misses: null,

      goalsCleared: null,
      goalsTotal: null,
      miniCleared: null,
      miniTotal: null,

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

      device: ctx.view || null,
      gameVersion: ctx.gameVersion || null,
      reason: null,
      startTimeIso: ctx.startTimeIso || null,
      endTimeIso: null,

      // student/profile
      studentKey: ctx.studentKey || null,
      schoolCode: ctx.schoolCode || null,
      schoolName: ctx.schoolName || null,
      classRoom: ctx.classRoom || null,
      studentNo: ctx.studentNo || null,
      nickName: ctx.nickName || null,
      gender: ctx.gender || null,
      age: ctx.age || null,
      gradeLevel: ctx.gradeLevel || null,
      heightCm: ctx.heightCm || null,
      weightKg: ctx.weightKg || null,
      bmi: ctx.bmi || null,
      bmiGroup: ctx.bmiGroup || null,
      vrExperience: ctx.vrExperience || null,
      gameFrequency: ctx.gameFrequency || null,
      handedness: ctx.handedness || null,
      visionIssue: ctx.visionIssue || null,
      healthDetail: ctx.healthDetail || null,
      consentParent: ctx.consentParent || null,

      // raw (optional)
      rtBreakdownJson: null,
      extraJson: null,
      eventType: null,
    };
  }

  function toRowFromStart(d){
    const r = baseRow();
    r.eventType = 'start';
    r.projectTag = d.projectTag ?? r.projectTag;
    r.runMode = d.runMode ?? r.runMode;
    r.studyId = d.studyId ?? r.studyId;
    r.phase = d.phase ?? r.phase;
    r.conditionGroup = d.conditionGroup ?? r.conditionGroup;

    r.gameMode = d.view ?? r.gameMode;
    r.device = d.view ?? r.device;
    r.diff = d.diff ?? r.diff;
    r.gameVersion = d.gameVersion ?? r.gameVersion;

    r.durationPlannedSec = safeNum(d.durationPlannedSec, null);
    r.startTimeIso = d.startTimeIso ?? r.startTimeIso;

    // keep ctx in sync
    return r;
  }

  function toRowFromEnd(d){
    const r = baseRow();
    r.eventType = 'end';

    r.projectTag = d.projectTag ?? r.projectTag;
    r.runMode = d.runMode ?? r.runMode;
    r.studyId = d.studyId ?? r.studyId;
    r.phase = d.phase ?? r.phase;
    r.conditionGroup = d.conditionGroup ?? r.conditionGroup;

    r.gameMode = d.device ?? d.view ?? r.gameMode;
    r.device = d.device ?? d.view ?? r.device;
    r.diff = d.diff ?? r.diff;
    r.gameVersion = d.gameVersion ?? r.gameVersion;

    r.reason = d.reason ?? null;
    r.startTimeIso = d.startTimeIso ?? r.startTimeIso;
    r.endTimeIso = d.endTimeIso ?? safeNowIso();

    r.durationPlannedSec = safeNum(d.durationPlannedSec, null);
    r.durationPlayedSec  = safeNum(d.durationPlayedSec, null);

    r.scoreFinal = safeNum(d.scoreFinal, null);
    r.comboMax   = safeNum(d.comboMax, null);
    r.misses     = safeNum(d.misses, null);

    r.goalsCleared = safeNum(d.goalsCleared, null);
    r.goalsTotal   = safeNum(d.goalsTotal, null);
    r.miniCleared  = safeNum(d.miniCleared, null);
    r.miniTotal    = safeNum(d.miniTotal, null);

    r.nTargetGoodSpawned   = safeNum(d.nTargetGoodSpawned, null);
    r.nTargetJunkSpawned   = safeNum(d.nTargetJunkSpawned, null);
    r.nTargetStarSpawned   = safeNum(d.nTargetStarSpawned, null);
    r.nTargetDiamondSpawned= safeNum(d.nTargetDiamondSpawned, null);
    r.nTargetShieldSpawned = safeNum(d.nTargetShieldSpawned, null);

    r.nHitGood      = safeNum(d.nHitGood, null);
    r.nHitJunk      = safeNum(d.nHitJunk, null);
    r.nHitJunkGuard = safeNum(d.nHitJunkGuard, null);
    r.nExpireGood   = safeNum(d.nExpireGood, null);

    r.accuracyGoodPct = (d.accuracyGoodPct!=null) ? Number(d.accuracyGoodPct) : null;
    r.junkErrorPct    = (d.junkErrorPct!=null) ? Number(d.junkErrorPct) : null;
    r.avgRtGoodMs     = (d.avgRtGoodMs!=null) ? Number(d.avgRtGoodMs) : null;
    r.medianRtGoodMs  = (d.medianRtGoodMs!=null) ? Number(d.medianRtGoodMs) : null;
    r.fastHitRatePct  = (d.fastHitRatePct!=null) ? Number(d.fastHitRatePct) : null;

    r.rtBreakdownJson = d.rtBreakdownJson ?? null;

    return r;
  }

  function toRowFromLog(d){
    const r = baseRow();
    r.eventType = safeStr(d.type || 'log');
    // keep it lightweight; store raw into extraJson
    // (Apps Script สามารถเลือก ignore ได้)
    r.extraJson = safeJson(d);
    return r;
  }

  // -------------------------
  // Queue (memory)
  // -------------------------
  const memQ = [];
  function memPush(item){
    if(DISABLED) return;
    try{
      memQ.push(item);
      if(memQ.length > MAX_QUEUE) memQ.splice(0, memQ.length - MAX_QUEUE);
    }catch(_){}
  }

  // -------------------------
  // Dedup
  // -------------------------
  function makeEventKey(row){
    // stable-ish key: sessionId + eventType + (reason/score/miss) + second
    const sec = safeStr(row.timestampIso).slice(0,19); // up to seconds
    const key =
      safeStr(row.sessionId) + '|' +
      safeStr(row.eventType) + '|' +
      safeStr(row.reason) + '|' +
      safeStr(row.scoreFinal) + '|' +
      safeStr(row.misses) + '|' +
      sec;
    return key;
  }
  function allowByDedup(row){
    try{
      const now = Date.now();
      // cleanup
      for(const [k,t] of dedup.entries()){
        if(now - t > DEDUP_TTL_MS) dedup.delete(k);
      }
      const k = makeEventKey(row);
      const last = dedup.get(k);
      if(last && (now - last) < DEDUP_TTL_MS) return false;
      dedup.set(k, now);
      return true;
    }catch(_){
      return true;
    }
  }

  // -------------------------
  // Transport
  // -------------------------
  function sendBeacon(url, bodyStr){
    try{
      if(!navigator.sendBeacon) return false;
      const blob = new Blob([bodyStr], { type:'application/json' });
      return navigator.sendBeacon(url, blob);
    }catch(_){ return false; }
  }

  async function sendFetchKeepalive(url, bodyStr){
    try{
      await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: bodyStr,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit',
      });
      return true;
    }catch(_){ return false; }
  }

  async function sendFetchNoCors(url, bodyStr){
    try{
      await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: bodyStr,
        keepalive: true,
        mode: 'no-cors',
      });
      return true;
    }catch(_){ return false; }
  }

  async function postRows(rows){
    if(DISABLED) return false;
    if(!rows || !rows.length) return true;

    const payload = {
      kind: 'HHA_ROWS_V21',
      count: rows.length,
      rows
    };
    const bodyStr = safeJson(payload);

    if(sendBeacon(ENDPOINT, bodyStr)) return true;
    if(await sendFetchKeepalive(ENDPOINT, bodyStr)) return true;
    if(await sendFetchNoCors(ENDPOINT, bodyStr)) return true;

    return false;
  }

  // -------------------------
  // Flush logic
  // -------------------------
  let flushing = false;

  function persistMemQ(){
    try{
      if(memQ.length){
        const copy = memQ.splice(0, memQ.length);
        pushLS(copy);
      }
    }catch(_){}
  }

  async function flushOnce(maxBatch=FLUSH_BATCH){
    if(DISABLED) return true;
    if(flushing) return true;
    flushing = true;

    try{
      // merge LS -> memQ (prepend)
      const fromLS = popLS(maxBatch);
      if(fromLS.length){
        for(const it of fromLS) memQ.unshift(it);
      }

      const batch = memQ.splice(0, maxBatch);
      if(!batch.length){
        flushing = false;
        return true;
      }

      const ok = await postRows(batch);
      if(!ok){
        pushLS(batch);
        flushing = false;
        return false;
      }

      flushing = false;
      return true;
    }catch(_){
      try{ persistMemQ(); }catch(__){}
      flushing = false;
      return false;
    }
  }

  async function flushAll(){
    if(DISABLED) return;
    for(let i=0;i<7;i++){
      const ok = await flushOnce(FLUSH_BATCH);
      if(!ok) break;
      if(memQ.length === 0 && getLS().length === 0) break;
    }
  }

  function flushSoon(){
    try{ setTimeout(()=>{ flushAll(); }, 0); }catch(_){}
  }

  // -------------------------
  // Event handlers
  // -------------------------
  function applyCtxFromStart(d){
    try{
      ctx.projectTag = d.projectTag ?? ctx.projectTag ?? null;
      ctx.runMode    = d.runMode ?? ctx.runMode ?? null;
      ctx.view       = d.view ?? ctx.view ?? null;
      ctx.diff       = d.diff ?? ctx.diff ?? null;
      ctx.seed       = d.seed ?? ctx.seed ?? null;
      ctx.gameVersion= d.gameVersion ?? ctx.gameVersion ?? null;
      ctx.startTimeIso = d.startTimeIso ?? ctx.startTimeIso ?? safeNowIso();

      ctx.studyId = d.studyId ?? ctx.studyId ?? null;
      ctx.phase   = d.phase ?? ctx.phase ?? null;
      ctx.conditionGroup = d.conditionGroup ?? ctx.conditionGroup ?? null;

      ensureSessionId();
    }catch(_){}
  }

  function applyCtxFromEnd(d){
    try{
      // keep some ctx for late logs
      ctx.projectTag = d.projectTag ?? ctx.projectTag ?? null;
      ctx.runMode    = d.runMode ?? ctx.runMode ?? null;
      ctx.view       = d.device ?? d.view ?? ctx.view ?? null;
      ctx.diff       = d.diff ?? ctx.diff ?? null;
      ctx.seed       = d.seed ?? ctx.seed ?? null;
      ctx.gameVersion= d.gameVersion ?? ctx.gameVersion ?? null;

      ctx.studyId = d.studyId ?? ctx.studyId ?? null;
      ctx.phase   = d.phase ?? ctx.phase ?? null;
      ctx.conditionGroup = d.conditionGroup ?? ctx.conditionGroup ?? null;

      if(!ctx.startTimeIso) ctx.startTimeIso = d.startTimeIso ?? safeNowIso();
      ensureSessionId();
    }catch(_){}
  }

  function onStart(detail){
    try{
      const d = (detail && typeof detail === 'object') ? detail : {};
      applyCtxFromStart(d);
      const row = toRowFromStart(d);
      if(allowByDedup(row)) memPush(row);
      flushSoon();
    }catch(_){}
  }

  function onEnd(detail){
    try{
      const d = (detail && typeof detail === 'object') ? detail : {};
      applyCtxFromEnd(d);
      const row = toRowFromEnd(d);
      if(allowByDedup(row)) memPush(row);
      flushSoon();
      persistMemQ();
    }catch(_){}
  }

  function onLog(detail){
    try{
      const d = (detail && typeof detail === 'object') ? detail : {};
      const row = toRowFromLog(d);
      // logs can be noisy — dedup still ok
      if(allowByDedup(row)) memPush(row);
      if(memQ.length % 10 === 0) flushSoon();
    }catch(_){}
  }

  ROOT.addEventListener('hha:start', (ev)=> onStart(ev && ev.detail), { passive:true });
  ROOT.addEventListener('hha:end',   (ev)=> onEnd(ev && ev.detail),   { passive:true });
  ROOT.addEventListener('hha:log',   (ev)=> onLog(ev && ev.detail),   { passive:true });

  ROOT.addEventListener('pagehide', ()=>{
    try{
      persistMemQ();
      flushAll();
    }catch(_){}
  }, { passive:true });

  DOC.addEventListener('visibilitychange', ()=>{
    try{
      if(DOC.visibilityState === 'hidden'){
        persistMemQ();
        flushAll();
      }
    }catch(_){}
  }, { passive:true });

  // boot flush
  flushSoon();

})();