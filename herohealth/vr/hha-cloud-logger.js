// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger V2.2 — ROW Schema + Dedup + Queue + Beacon + text/plain POST (PRODUCTION SAFE)
// ✅ Default endpoint updated to NEW Apps Script
// ✅ Prefers text/plain body for POST (matches your Apps Script "A")
// ✅ Still supports: sendBeacon / fetch keepalive / fetch no-cors
// ✅ URL override: ?log=ENCODED_ENDPOINT  | disable: ?nolog=1

(function(){
  'use strict';

  const ROOT = window;
  const DOC  = document;

  if (ROOT.__HHA_CLOUD_LOGGER_V22__) return;
  ROOT.__HHA_CLOUD_LOGGER_V22__ = true;

  // ✅ NEW endpoint (your Apps Script Web App)
  const DEFAULT_ENDPOINT =
    'https://script.google.com/macros/s/AKfycbzViUBbG-pNLDIXZx7BdFEJj_pf8oFDkRh0_7ryke0nCUdQClPZIZ_k5-qPod14K3DHFA/exec';

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  const ENDPOINT = (qs('log', null) || DEFAULT_ENDPOINT);
  const DISABLED = (qs('nolog','0') === '1');

  // Queue / persistence
  const LS_KEY = 'HHA_LOG_QUEUE_V22';
  const MAX_QUEUE = 240;   // mem queue cap
  const MAX_LS = 180;      // localStorage cap
  const FLUSH_BATCH = 24;  // send per batch

  // Dedup
  const DEDUP_TTL_MS = 1800; // 30 min
  const dedup = new Map();

  function safeNowIso(){ try { return new Date().toISOString(); } catch { return ''; } }
  function safeStr(x){ try { return (x==null)?'':String(x); } catch { return ''; } }
  function safeNum(x, def=0){
    const n = Number(x);
    return Number.isFinite(n) ? n : def;
  }
  function safeJson(obj){ try { return JSON.stringify(obj); } catch { return '{"_err":"json"}'; } }
  function safeParse(str){ try { return JSON.parse(str); } catch { return null; } }

  // --- localStorage helpers ---
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

  // --- context (hydrated from URL once, then refined by start/end) ---
  const ctx = {
    sessionId: null,
    startTimeIso: null,
    projectTag: null,
    runMode: null,
    view: null,
    diff: null,
    seed: null,
    gameVersion: null,

    studyId: null,
    phase: null,
    conditionGroup: null,
    sessionOrder: null,
    blockLabel: null,
    siteCode: null,

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

  // hydrate context from URL once
  (function hydrateFromUrlOnce(){
    try{
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
  })();

  // --- row schema (matches your Apps Script FIXED_COLUMNS + logger fields) ---
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

    r.nTargetGoodSpawned    = safeNum(d.nTargetGoodSpawned, null);
    r.nTargetJunkSpawned    = safeNum(d.nTargetJunkSpawned, null);
    r.nTargetStarSpawned    = safeNum(d.nTargetStarSpawned, null);
    r.nTargetDiamondSpawned = safeNum(d.nTargetDiamondSpawned, null);
    r.nTargetShieldSpawned  = safeNum(d.nTargetShieldSpawned, null);

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
    // keep all detail as extraJson so Apps Script can store in __extraJson or extraJson col
    r.extraJson = safeJson(d);
    return r;
  }

  // --- queue (memory) ---
  const memQ = [];
  function memPush(item){
    if(DISABLED) return;
    try{
      memQ.push(item);
      if(memQ.length > MAX_QUEUE) memQ.splice(0, memQ.length - MAX_QUEUE);
    }catch(_){}
  }

  // --- dedup ---
  function makeEventKey(row){
    const sec = safeStr(row.timestampIso).slice(0,19);
    return (
      safeStr(row.sessionId) + '|' +
      safeStr(row.eventType) + '|' +
      safeStr(row.reason) + '|' +
      safeStr(row.scoreFinal) + '|' +
      safeStr(row.misses) + '|' +
      sec
    );
  }
  function allowByDedup(row){
    try{
      const now = Date.now();
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

  // --- transport ---
  // ✅ IMPORTANT: Apps Script supports A) POST text/plain (recommended)
  function asPlainBody(payloadObj){
    // send JSON string, but content-type text/plain
    return safeJson(payloadObj);
  }

  function sendBeacon(url, bodyStr){
    try{
      if(!navigator.sendBeacon) return false;
      // can be text/plain; Apps Script parses JSON by body anyway
      const blob = new Blob([bodyStr], { type:'text/plain;charset=utf-8' });
      return navigator.sendBeacon(url, blob);
    }catch(_){ return false; }
  }

  async function sendFetchKeepalivePlain(url, bodyStr){
    try{
      await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'text/plain;charset=utf-8' },
        body: bodyStr,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit',
      });
      return true;
    }catch(_){ return false; }
  }

  async function sendFetchNoCorsPlain(url, bodyStr){
    try{
      await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'text/plain;charset=utf-8' },
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

    // ✅ payload aligned with cloud-logger row batching
    const payload = { kind: 'HHA_ROWS_V22', count: rows.length, rows };
    const bodyStr = asPlainBody(payload);

    // order: beacon -> keepalive -> no-cors
    if(sendBeacon(ENDPOINT, bodyStr)) return true;
    if(await sendFetchKeepalivePlain(ENDPOINT, bodyStr)) return true;
    if(await sendFetchNoCorsPlain(ENDPOINT, bodyStr)) return true;
    return false;
  }

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
      // pull from LS first (oldest first)
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

  // --- apply ctx ---
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

      if(d.sessionOrder != null) ctx.sessionOrder = d.sessionOrder;
      if(d.blockLabel   != null) ctx.blockLabel   = d.blockLabel;
      if(d.siteCode     != null) ctx.siteCode     = d.siteCode;

      ensureSessionId();
    }catch(_){}
  }

  function applyCtxFromEnd(d){
    try{
      ctx.projectTag = d.projectTag ?? ctx.projectTag ?? null;
      ctx.runMode    = d.runMode ?? ctx.runMode ?? null;
      ctx.view       = d.device ?? d.view ?? ctx.view ?? null;
      ctx.diff       = d.diff ?? ctx.diff ?? null;
      ctx.seed       = d.seed ?? ctx.seed ?? null;
      ctx.gameVersion= d.gameVersion ?? ctx.gameVersion ?? null;

      ctx.studyId = d.studyId ?? ctx.studyId ?? null;
      ctx.phase   = d.phase ?? ctx.phase ?? null;
      ctx.conditionGroup = d.conditionGroup ?? ctx.conditionGroup ?? null;

      if(d.sessionOrder != null) ctx.sessionOrder = d.sessionOrder;
      if(d.blockLabel   != null) ctx.blockLabel   = d.blockLabel;
      if(d.siteCode     != null) ctx.siteCode     = d.siteCode;

      if(!ctx.startTimeIso) ctx.startTimeIso = d.startTimeIso ?? safeNowIso();
      ensureSessionId();
    }catch(_){}
  }

  // --- event handlers ---
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
      if(allowByDedup(row)) memPush(row);
      if(memQ.length % 10 === 0) flushSoon();
    }catch(_){}
  }

  ROOT.addEventListener('hha:start', (ev)=> onStart(ev && ev.detail), { passive:true });
  ROOT.addEventListener('hha:end',   (ev)=> onEnd(ev && ev.detail),   { passive:true });
  ROOT.addEventListener('hha:log',   (ev)=> onLog(ev && ev.detail),   { passive:true });

  // flush on pagehide/hidden
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

  // initial kick
  flushSoon();

})();