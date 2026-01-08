// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (flush-hardened + queue + research-friendly)
//
// ✅ Usage:
//   - Add <script src="../vr/hha-cloud-logger.js" defer></script>
//   - Provide endpoint with ?log=YOUR_ENDPOINT
//   - Emit events OR call window.HHA_LOGGER.send(payload)
//
// ✅ Auto hooks (best-effort):
//   - listens: hha:end, hha:log, hha:flush
//   - flush on: pagehide, visibilitychange(hidden), beforeunload (best-effort)
//
// ✅ Research helpers:
//   - auto reads URL params: studyId, phase, conditionGroup, sessionOrder, blockLabel, siteCode, ...
//   - attaches device info + page url + referrer
//   - keeps queue in localStorage when network fails
//
// Payload format is flexible; logger will:
// - merge baseCtx + payload
// - ensure timestampIso, sessionId, gameMode, runMode etc if provided
// - POST JSON with keepalive
//
// Notes:
// - This is not "guaranteed" delivery (browser limitations) but hardened.
//
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (!WIN || !DOC) return;
  if (WIN.__HHA_CLOUD_LOGGER__) return;
  WIN.__HHA_CLOUD_LOGGER__ = true;

  // -------------------- helpers --------------------
  const qs = (k, d=null)=>{
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch(_){ return d; }
  };

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function nowIso(){
    try { return new Date().toISOString(); } catch(_){ return ''; }
  }

  function safeJsonParse(s){
    try{ return JSON.parse(s); }catch(_){ return null; }
  }

  function safeJsonStringify(o){
    try{ return JSON.stringify(o); }catch(_){ return ''; }
  }

  function getDevice(){
    const ua = navigator.userAgent || '';
    const plat = navigator.platform || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isVR = !!(navigator.xr);
    return {
      ua,
      platform: plat,
      isMobile,
      isIOS,
      isAndroid,
      hasWebXR: isVR,
      lang: navigator.language || '',
      tz: (Intl && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : ''
    };
  }

  function inferView(){
    const v = String(qs('view','')||'').toLowerCase();
    if (v) return v;
    // fallback heuristics from body class
    try{
      const b = DOC.body;
      if (b && b.classList.contains('cardboard')) return 'cardboard';
      if (b && b.classList.contains('view-cvr')) return 'cvr';
      if (b && b.classList.contains('view-mobile')) return 'mobile';
    }catch(_){}
    return 'pc';
  }

  // -------------------- base context from URL --------------------
  const BASE_CTX = {
    timestampIso: qs('timestampIso', nowIso()),
    projectTag: qs('projectTag', 'HeroHealth'),
    runMode: qs('runMode', qs('run', 'play')),
    studyId: qs('studyId',''),
    phase: qs('phase',''),
    conditionGroup: qs('conditionGroup',''),
    sessionOrder: qs('sessionOrder',''),
    blockLabel: qs('blockLabel',''),
    siteCode: qs('siteCode',''),
    schoolYear: qs('schoolYear',''),
    semester: qs('semester',''),
    sessionId: qs('sessionId', qs('studentKey','') || ''),
    studentKey: qs('studentKey',''),
    schoolCode: qs('schoolCode',''),
    schoolName: qs('schoolName',''),
    classRoom: qs('classRoom',''),
    studentNo: qs('studentNo',''),
    nickName: qs('nickName',''),
    gender: qs('gender',''),
    age: qs('age',''),
    gradeLevel: qs('gradeLevel', qs('grade','')),
    heightCm: qs('heightCm',''),
    weightKg: qs('weightKg',''),
    bmi: qs('bmi',''),
    bmiGroup: qs('bmiGroup',''),
    vrExperience: qs('vrExperience',''),
    gameFrequency: qs('gameFrequency',''),
    handedness: qs('handedness',''),
    visionIssue: qs('visionIssue',''),
    healthDetail: qs('healthDetail',''),
    consentParent: qs('consentParent',''),

    // game controls
    gameMode: qs('gameMode',''),
    diff: qs('diff',''),
    durationPlannedSec: qs('durationPlannedSec', qs('time','')),
    seed: qs('seed',''),
    hub: qs('hub',''),
    view: inferView(),

    // env
    pageUrl: String(location.href),
    referrer: String(document.referrer || ''),
  };

  const DEVICE = getDevice();

  // -------------------- endpoint + queue --------------------
  const ENDPOINT = String(qs('log','') || '').trim();
  const ENABLED = !!ENDPOINT;

  const LS_KEY = 'HHA_LOG_QUEUE_V1';
  const MAX_QUEUE = 80; // keep bounded
  const SEND_TIMEOUT_MS = 5200;

  function loadQueue(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      const arr = safeJsonParse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(_){ return []; }
  }

  function saveQueue(q){
    try{
      localStorage.setItem(LS_KEY, safeJsonStringify(q));
    }catch(_){}
  }

  let queue = loadQueue();

  function enqueue(item){
    queue.push(item);
    if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE);
    saveQueue(queue);
  }

  // -------------------- network send --------------------
  function withTimeout(promise, ms){
    let t;
    const timeout = new Promise((_,rej)=>{
      t = setTimeout(()=>rej(new Error('timeout')), ms);
    });
    return Promise.race([promise, timeout]).finally(()=>clearTimeout(t));
  }

  async function postJson(payload){
    if (!ENABLED) return { ok:false, disabled:true };
    const body = safeJsonStringify(payload);
    if (!body) return { ok:false, error:'stringify_failed' };

    // prefer fetch keepalive
    const ctrl = (WIN.AbortController) ? new AbortController() : null;
    const sig = ctrl ? ctrl.signal : undefined;

    const p = fetch(ENDPOINT, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body,
      keepalive:true,
      signal:sig
    });

    try{
      const res = await withTimeout(p, SEND_TIMEOUT_MS);
      return { ok: !!(res && res.ok), status: res && res.status };
    }catch(err){
      try{ ctrl && ctrl.abort(); }catch(_){}
      return { ok:false, error: String(err && (err.message||err)) };
    }
  }

  // -------------------- public API --------------------
  function buildPayload(data){
    const d = (data && typeof data === 'object') ? data : { value:data };

    // merge context shallow
    const out = Object.assign({}, BASE_CTX, d);

    // normalize some fields (optional)
    if (!out.timestampIso) out.timestampIso = nowIso();
    if (!out.runMode) out.runMode = qs('runMode', qs('run','play')) || 'play';
    if (!out.view) out.view = inferView();
    if (!out.device) out.device = DEVICE;
    if (!out.gameVersion) out.gameVersion = qs('ver', qs('v','')) || '';
    if (!out.sessionId && out.studentKey) out.sessionId = out.studentKey;

    return out;
  }

  async function send(data, { flush=false } = {}){
    const payload = buildPayload(data);

    // always store last summary for convenience (when looks like end summary)
    try{
      if (payload.gameMode && (payload.scoreFinal!=null || payload.reason)){
        localStorage.setItem('HHA_LAST_SUMMARY', safeJsonStringify(payload));
        localStorage.setItem('hha_last_summary', safeJsonStringify(payload));
      }
    }catch(_){}

    // if disabled, just queue (so you can later re-enable by adding ?log=)
    if (!ENABLED){
      enqueue({ t: Date.now(), payload });
      return { ok:false, disabled:true, queued:true };
    }

    const res = await postJson(payload);
    if (!res.ok){
      enqueue({ t: Date.now(), payload });
      return { ok:false, queued:true, res };
    }

    // on success, optionally try flush queue
    if (flush) await flushQueue();
    return { ok:true, res };
  }

  async function flushQueue(){
    if (!ENABLED) return { ok:false, disabled:true, count: queue.length };
    if (!queue.length) return { ok:true, count:0 };

    const startCount = queue.length;
    const keep = [];

    for (let i=0;i<queue.length;i++){
      const item = queue[i];
      const payload = item && item.payload ? item.payload : item;
      const res = await postJson(payload);
      if (!res.ok) keep.push(item);
    }

    queue = keep;
    saveQueue(queue);

    return { ok:true, countSent: startCount - keep.length, countRemain: keep.length };
  }

  // -------------------- hooks --------------------
  // Event: hha:end => send + flush
  WIN.addEventListener('hha:end', (ev)=>{
    const detail = ev && ev.detail ? ev.detail : null;
    send(detail || { type:'end' }, { flush:true });
  });

  // Event: hha:log => send (no force flush)
  WIN.addEventListener('hha:log', (ev)=>{
    const detail = ev && ev.detail ? ev.detail : null;
    send(detail || { type:'log' }, { flush:false });
  });

  // Event: hha:flush => flush queue
  WIN.addEventListener('hha:flush', ()=>{
    flushQueue();
  });

  // Flush on lifecycle changes
  function bestEffortFlush(){
    // try sendBeacon if tiny? We keep JSON via fetch keepalive (already best effort)
    flushQueue();
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if (DOC.visibilityState === 'hidden') bestEffortFlush();
  });

  WIN.addEventListener('pagehide', bestEffortFlush);
  WIN.addEventListener('beforeunload', bestEffortFlush);

  // initial flush shortly after load
  setTimeout(()=>{ flushQueue(); }, 1200);

  // expose
  WIN.HHA_LOGGER = {
    enabled: ENABLED,
    endpoint: ENDPOINT,
    baseCtx: BASE_CTX,
    device: DEVICE,
    send,
    flush: flushQueue,
    queueSize: ()=>queue.length
  };

})();