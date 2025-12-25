// === /herohealth/vr/hha-cloud-logger.js ===
// HeroHealth — Cloud Logger (Google Apps Script friendly)
// ✅ รับ event มาตรฐาน: hha:log_session / hha:log_event / hha:end (ถ้ามี)
// ✅ ส่งขึ้น Google Apps Script endpoint แบบ queue + batch + retry
// ✅ กันเน็ตหลุด: เก็บคิวใน localStorage แล้ว flush เมื่อกลับมาออนไลน์
// ✅ ใช้ sendBeacon ถ้าได้ (ตอนปิดหน้า) + fallback fetch
// ✅ ปลอดภัย: ไม่บังคับ schema ตายตัว (ส่งเฉพาะ field ที่มี)

// วิธีตั้ง endpoint (เลือกอย่างใดอย่างหนึ่ง)
// 1) ใส่ใน URL: ?log=YOUR_APPS_SCRIPT_EXEC_URL
// 2) หรือกำหนด global ก่อนโหลดไฟล์นี้: window.HHA_LOG_ENDPOINT = "https://script.google.com/macros/s/xxx/exec"
// 3) หรือใส่ใน <script ... data-endpoint="..."></script> (ถ้าคุณอยากเพิ่มภายหลัง)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // -------------------- Small helpers --------------------
  const now = () => Date.now();
  const safeJson = (x) => {
    try { return JSON.stringify(x); } catch (_) { return '{}'; }
  };
  const parseIntSafe = (v, d=0) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
  };

  function getParam(name){
    try{
      const u = new URL(root.location.href);
      return u.searchParams.get(name);
    }catch(_){ return null; }
  }

  // -------------------- Endpoint resolve --------------------
  function resolveEndpoint(){
    // 1) URL ?log=
    const q = getParam('log') || getParam('logger') || getParam('endpoint');
    if (q && /^https?:\/\//i.test(q)) return q;

    // 2) global
    if (root.HHA_LOG_ENDPOINT && /^https?:\/\//i.test(root.HHA_LOG_ENDPOINT)) return root.HHA_LOG_ENDPOINT;

    // 3) data-endpoint from this script tag
    try{
      const cur = doc.currentScript;
      const d = cur && (cur.dataset && (cur.dataset.endpoint || cur.dataset.url));
      if (d && /^https?:\/\//i.test(d)) return d;
    }catch(_){}

    // default: none
    return '';
  }

  // -------------------- Context snapshot --------------------
  function buildBaseContext(){
    // เก็บเฉพาะที่มีจริง (ไม่บังคับ schema)
    let href = '';
    try { href = String(root.location.href || ''); } catch(_){}

    const ctx = {
      ts: now(),
      href,
      ua: (root.navigator && root.navigator.userAgent) ? root.navigator.userAgent : '',
      tz: (()=>{ try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch(_){ return ''; } })(),
    };

    // ดึงบางพารามิเตอร์ที่ใช้บ่อย (ถ้ามี)
    const u = (()=>{ try { return new URL(href); } catch(_){ return null; } })();
    if (u){
      const sp = u.searchParams;
      const keys = [
        'projectTag','run','mode','diff','time','seed',
        'studyId','phase','conditionGroup','sessionOrder','blockLabel',
        'siteCode','schoolYear','semester',
        'sessionId','gameMode','durationPlannedSec'
      ];
      for(const k of keys){
        const v = sp.get(k);
        if (v !== null && v !== '') ctx[k] = v;
      }

      // นักเรียน/สถานศึกษา (ถ้ามีส่งมาจาก hub)
      const studentKeys = [
        'studentKey','schoolCode','schoolName','classRoom','studentNo','nickName',
        'gender','age','gradeLevel','heightCm','weightKg','bmi','bmiGroup',
        'vrExperience','gameFrequency','handedness','visionIssue','healthDetail','consentParent'
      ];
      for(const k of studentKeys){
        const v = sp.get(k);
        if (v !== null && v !== '') ctx[k] = v;
      }
    }

    // ถ้าเกมมี context กลางใน window (optional)
    if (root.HHA_CONTEXT && typeof root.HHA_CONTEXT === 'object'){
      ctx.HHA_CONTEXT = root.HHA_CONTEXT;
    }

    return ctx;
  }

  // -------------------- Queue + persistence --------------------
  const LS_KEY = 'HHA_LOG_QUEUE_V1';
  const STATE = {
    enabled: true,
    debug: false,
    endpoint: '',
    batchSize: 12,
    flushEveryMs: 1200,
    retryBaseMs: 1000,
    retryMaxMs: 15000,
    maxQueue: 600,
    queue: [],
    flushing: false,
    nextFlushAt: 0,
    lastSendAt: 0,
    failCount: 0,
    baseCtx: buildBaseContext()
  };

  function loadQueue(){
    try{
      const raw = root.localStorage && root.localStorage.getItem(LS_KEY);
      if(!raw) return;
      const arr = JSON.parse(raw);
      if(Array.isArray(arr)) STATE.queue = arr.slice(0, STATE.maxQueue);
    }catch(_){}
  }
  function saveQueue(){
    try{
      if(!root.localStorage) return;
      root.localStorage.setItem(LS_KEY, safeJson(STATE.queue.slice(0, STATE.maxQueue)));
    }catch(_){}
  }
  function enqueue(item){
    if(!STATE.enabled) return;
    if(!item || typeof item !== 'object') return;

    // เติม context + ts
    const payload = Object.assign({}, STATE.baseCtx, { ts: now() }, item);

    // cap queue
    if (STATE.queue.length >= STATE.maxQueue) {
      STATE.queue.splice(0, Math.max(1, Math.floor(STATE.maxQueue * 0.25)));
    }
    STATE.queue.push(payload);
    saveQueue();

    scheduleFlushSoon();
    if (STATE.debug) console.log('[HHACloudLogger] enqueue', payload);
  }

  // -------------------- Send logic --------------------
  function canSend(){
    return !!STATE.endpoint && /^https?:\/\//i.test(STATE.endpoint);
  }

  async function postJson(url, bodyObj){
    const body = safeJson(bodyObj);

    // ถ้าเป็นตอนปิดหน้า: sendBeacon จะเสถียรกว่า
    if (root.navigator && typeof root.navigator.sendBeacon === 'function') {
      try{
        const blob = new Blob([body], { type: 'application/json' });
        const ok = root.navigator.sendBeacon(url, blob);
        if (ok) return { ok: true, status: 204, beacon: true };
      }catch(_){}
    }

    // fetch fallback
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body,
      keepalive: true,
      mode: 'cors',
      credentials: 'omit'
    });
    return { ok: resp.ok, status: resp.status, beacon: false };
  }

  function scheduleFlushSoon(){
    const t = now();
    // อย่า spam: ให้ไหลรวมเป็น batch
    if (STATE.nextFlushAt && t < STATE.nextFlushAt) return;
    STATE.nextFlushAt = t + STATE.flushEveryMs;

    setTimeout(()=>{ flush().catch(()=>{}); }, STATE.flushEveryMs);
  }

  async function flush(){
    if(!STATE.enabled) return;
    if(STATE.flushing) return;
    if(!canSend()) return;
    if(!STATE.queue.length) return;
    if(root.navigator && root.navigator.onLine === false) return;

    STATE.flushing = true;
    try{
      const batch = STATE.queue.slice(0, STATE.batchSize);
      const body = { kind:'hha_batch', v:1, items: batch };

      const res = await postJson(STATE.endpoint, body);

      if(res && res.ok){
        // pop batch
        STATE.queue.splice(0, batch.length);
        saveQueue();
        STATE.failCount = 0;
        if (STATE.debug) console.log('[HHACloudLogger] flush ok', { sent: batch.length, status: res.status, beacon: res.beacon });
      }else{
        STATE.failCount++;
        if (STATE.debug) console.warn('[HHACloudLogger] flush fail', res);
        backoff();
      }
    }catch(err){
      STATE.failCount++;
      if (STATE.debug) console.warn('[HHACloudLogger] flush error', err);
      backoff();
    }finally{
      STATE.flushing = false;

      // ถ้ายังเหลือคิว ให้พยายามต่อแบบสุภาพ
      if (STATE.queue.length) {
        scheduleFlushSoon();
      }
    }
  }

  function backoff(){
    const fc = Math.max(1, STATE.failCount);
    const wait = Math.min(STATE.retryMaxMs, STATE.retryBaseMs * Math.pow(1.7, fc));
    STATE.nextFlushAt = now() + wait;
    setTimeout(()=>{ flush().catch(()=>{}); }, wait);
  }

  // -------------------- Event listeners --------------------
  function onLogSession(e){
    const d = (e && e.detail) ? e.detail : {};
    enqueue({ type:'session', data: d });
  }
  function onLogEvent(e){
    const d = (e && e.detail) ? e.detail : {};
    enqueue({ type:'event', data: d });
  }
  function onEnd(e){
    const d = (e && e.detail) ? e.detail : {};
    enqueue({ type:'end', data: d });
  }

  // -------------------- Public API --------------------
  const API = {
    init(opts = {}){
      STATE.debug = !!opts.debug;

      // resolve endpoint now
      const ep = resolveEndpoint();
      if (ep) STATE.endpoint = ep;

      if (typeof opts.endpoint === 'string' && /^https?:\/\//i.test(opts.endpoint)) {
        STATE.endpoint = opts.endpoint;
      }

      if (typeof opts.enabled === 'boolean') STATE.enabled = opts.enabled;
      if (opts.batchSize) STATE.batchSize = Math.max(1, parseIntSafe(opts.batchSize, STATE.batchSize));
      if (opts.flushEveryMs) STATE.flushEveryMs = Math.max(250, parseIntSafe(opts.flushEveryMs, STATE.flushEveryMs));

      // load persisted queue
      loadQueue();

      // attach events once
      root.removeEventListener('hha:log_session', onLogSession);
      root.removeEventListener('hha:log_event', onLogEvent);
      root.removeEventListener('hha:end', onEnd);

      root.addEventListener('hha:log_session', onLogSession);
      root.addEventListener('hha:log_event', onLogEvent);
      root.addEventListener('hha:end', onEnd);

      // auto flush on online
      root.addEventListener('online', ()=> scheduleFlushSoon());

      // flush on page hide
      doc.addEventListener('visibilitychange', ()=>{
        if (doc.visibilityState === 'hidden') flush().catch(()=>{});
      });
      root.addEventListener('pagehide', ()=>{ flush().catch(()=>{}); });

      // initial flush
      scheduleFlushSoon();

      if (STATE.debug) console.log('[HHACloudLogger] init', {
        enabled: STATE.enabled,
        endpoint: STATE.endpoint,
        queued: STATE.queue.length
      });

      return true;
    },
    setEndpoint(url){
      if (typeof url === 'string' && /^https?:\/\//i.test(url)){
        STATE.endpoint = url;
        scheduleFlushSoon();
        return true;
      }
      return false;
    },
    enqueue(item){ enqueue(item); },
    flush(){ return flush(); },
    getState(){
      return {
        enabled: STATE.enabled,
        debug: STATE.debug,
        endpoint: STATE.endpoint,
        queued: STATE.queue.length,
        failCount: STATE.failCount
      };
    }
  };

  // expose
  root.HHACloudLogger = API;

  // auto-init (ไม่บังคับ endpoint)
  // ถ้ามี endpoint -> จะเริ่มส่งเอง, ถ้าไม่มี -> จะเก็บคิวไว้จนกว่าจะตั้ง endpoint
  API.init({ debug: false });

})(typeof window !== 'undefined' ? window : globalThis);