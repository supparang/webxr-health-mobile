// === /herohealth/vr/hha-cloud-logger.js ===
// Hero Health Academy — Cloud Logger (IIFE) — FIX-ALL / PRODUCTION
// ✅ Listens: hha:log_session, hha:log_event  (from engines)
// ✅ Sends to Google Apps Script endpoint (POST JSON)
// ✅ Robust queue + retry + localStorage buffer (offline-safe)
// ✅ Multi-school fields: school, district, class, teacher, studentId, gradeLevel
// ✅ Research-safe: captures runMode/diff/seed, url params, device metadata
// ✅ Debug overlay: add ?log=1 in URL

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // prevent double bind
  if (root.__HHA_LOGGER_BOUND__) return;
  root.__HHA_LOGGER_BOUND__ = true;

  const sp = new URLSearchParams(root.location && root.location.search ? root.location.search : '');

  // ---- config ----
  // Priority: 1) window.HHA_LOG_ENDPOINT 2) <meta name="hha-log-endpoint" ...> 3) URL ?endpoint=
  const META_ENDPOINT =
    (function(){
      try{
        const m = doc.querySelector('meta[name="hha-log-endpoint"]');
        return m ? (m.getAttribute('content') || '') : '';
      }catch{ return ''; }
    })();

  const ENDPOINT =
    String(
      root.HHA_LOG_ENDPOINT ||
      sp.get('endpoint') ||
      META_ENDPOINT ||
      ''
    ).trim();

  const ENABLED = !!ENDPOINT;
  const DEBUG = (sp.get('log') === '1');

  // storage keys
  const LS_KEY = 'HHA_LOG_QUEUE_V1';
  const LS_KEY_LAST = 'HHA_LOG_LAST_V1';

  // retry
  const RETRY_BASE_MS = 900;
  const RETRY_MAX_MS  = 12000;
  const FLUSH_EVERY_MS = 900;   // tick flush
  const BATCH_MAX = 12;         // batch size per flush

  // ---- helpers ----
  function nowMs(){ try { return (performance && performance.now) ? performance.now() : Date.now(); } catch { return Date.now(); } }
  function isoNow(){ try { return new Date().toISOString(); } catch { return ''; } }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch{ return fallback; }
  }
  function safeJsonStringify(o){
    try{ return JSON.stringify(o); }catch{ return '{}'; }
  }
  function uid(){
    return 'hha_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  }

  function getUA(){
    try{ return navigator.userAgent || ''; }catch{ return ''; }
  }

  function getScreen(){
    try{ return { w: root.innerWidth||0, h: root.innerHeight||0, dpr: root.devicePixelRatio||1 }; }
    catch{ return { w:0,h:0,dpr:1 }; }
  }

  function getNet(){
    try{
      const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!c) return {};
      return { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: !!c.saveData };
    }catch{ return {}; }
  }

  // ---- identity & context from URL ----
  // Use these params when present:
  // school, district, area, class, room, teacher, student, studentId, grade, group, cohort
  function pickParam(...keys){
    for (let i=0;i<keys.length;i++){
      const v = sp.get(keys[i]);
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  const CONTEXT_BASE = {
    school:     pickParam('school','School','sch'),
    district:   pickParam('district','District','dist'),
    area:       pickParam('area','Area'),
    className:  pickParam('class','Class','cls'),
    room:       pickParam('room','Room'),
    teacher:    pickParam('teacher','Teacher'),
    studentId:  pickParam('studentId','sid','student'),
    gradeLevel: pickParam('grade','Grade','g'),
    group:      pickParam('group','Group'),
    cohort:     pickParam('cohort','Cohort'),
    deviceTag:  pickParam('device','Device'),
    run:        pickParam('run','mode') || pickParam('runMode') || '', // for convenience
    seed:       pickParam('seed') || ''
  };

  // ---- queue ----
  let queue = [];
  let flushing = false;
  let flushTimer = null;
  let lastFailAt = 0;
  let backoffMs = RETRY_BASE_MS;

  // ensure sessionId
  let sessionId = '';

  function loadQueue(){
    const raw = (function(){ try{ return localStorage.getItem(LS_KEY) || ''; }catch{ return ''; } })();
    const arr = safeJsonParse(raw, []);
    if (Array.isArray(arr)) queue = arr;
  }
  function saveQueue(){
    try{ localStorage.setItem(LS_KEY, safeJsonStringify(queue)); }catch{}
  }

  function setLastStatus(obj){
    try{ localStorage.setItem(LS_KEY_LAST, safeJsonStringify(obj||{})); }catch{}
  }

  function getLastStatus(){
    try{
      return safeJsonParse(localStorage.getItem(LS_KEY_LAST)||'{}', {});
    }catch{ return {}; }
  }

  function pushItem(item){
    queue.push(item);
    // cap queue to avoid infinite growth
    if (queue.length > 1500) queue = queue.slice(queue.length - 1500);
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
      'box-shadow:0 18px 50px rgba(0,0,0,.42);pointer-events:none;';
    dbgEl.textContent = 'Logger: ready';
    (doc.body||doc.documentElement).appendChild(dbgEl);
  }
  function dbg(msg){
    if (!DEBUG) return;
    ensureDebugUI();
    if (!dbgEl) return;
    const last = getLastStatus();
    const t = new Date();
    dbgEl.textContent =
      `Logger ${ENABLED ? 'ON' : 'OFF'} | q=${queue.length} | backoff=${backoffMs}ms\n` +
      `[${t.toLocaleTimeString()}] ${msg}\n` +
      (last && last.lastOk ? `lastOk=${last.lastOk}` : '') +
      (last && last.lastErr ? ` | lastErr=${last.lastErr}` : '');
  }

  // ---- transport ----
  async function postJSON(url, payload){
    const body = safeJsonStringify(payload);
    const res = await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // Apps Script often works best with no-cors in production
      headers: { 'Content-Type': 'application/json' },
      body
    });
    return res; // with no-cors, status may be opaque — treat as best-effort
  }

  function canFlush(){
    if (!ENABLED) return false;
    if (queue.length <= 0) return false;
    // if just failed, wait backoff
    const t = Date.now();
    if (lastFailAt && (t - lastFailAt) < backoffMs) return false;
    return true;
  }

  async function flush(){
    if (flushing) return;
    if (!canFlush()) return;

    flushing = true;
    const batch = queue.slice(0, BATCH_MAX);

    // payload shape:
    // { type:'batch', sessionId, items:[...], client:{...} }
    const payload = {
      type: 'batch',
      sessionId: sessionId || '',
      sentIso: isoNow(),
      items: batch,
      client: {
        ua: getUA(),
        screen: getScreen(),
        net: getNet(),
        page: (function(){ try{ return root.location.href || ''; }catch{ return ''; } })(),
        tz: (function(){ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }catch{ return ''; } })()
      }
    };

    try{
      await postJSON(ENDPOINT, payload);

      // success best-effort (opaque ok)
      queue = queue.slice(batch.length);
      saveQueue();

      backoffMs = RETRY_BASE_MS;
      lastFailAt = 0;
      setLastStatus({ lastOk: isoNow(), lastErr: '' });

      if (DEBUG) dbg(`flush ok: sent ${batch.length}, remain ${queue.length}`);

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

  // ---- normalize items ----
  function enrichBase(meta){
    const out = Object.assign({}, CONTEXT_BASE, meta || {});
    // normalize strings
    ['school','district','area','className','room','teacher','studentId','gradeLevel','group','cohort','deviceTag','seed'].forEach(k=>{
      if (out[k] == null) out[k] = '';
      out[k] = String(out[k]).trim();
    });
    if (!out.sessionId) out.sessionId = sessionId || '';
    return out;
  }

  // ---- public hooks (events) ----
  function onSession(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if (!sessionId) sessionId = String(d.sessionId || uid());

    // capture diff/runMode/duration, plus URL params
    const meta = enrichBase(Object.assign({
      sessionId,
      startedIso: d.startedIso || isoNow(),
      game: d.game || 'UnknownGame',
      diff: d.diff || sp.get('diff') || '',
      runMode: d.runMode || sp.get('run') || sp.get('mode') || '',
      durationSec: d.durationSec || (Number(sp.get('time'))||0),
      seed: d.seed || CONTEXT_BASE.seed || '',
      ts: sp.get('ts') || ''
    }, d));

    pushItem({ type:'session', meta });

    if (DEBUG) dbg(`session start: ${meta.game} diff=${meta.diff} mode=${meta.runMode} seed=${meta.seed}`);
    flush();
  }

  function onEvent(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if (!sessionId && d.sessionId) sessionId = String(d.sessionId);
    if (!sessionId) sessionId = uid();

    const meta = enrichBase(Object.assign({
      sessionId,
      kind: d.kind || 'event',
      tMs: d.tMs || Math.round(nowMs()),
      tsIso: d.tsIso || isoNow(),
      game: d.game || 'UnknownGame',
      diff: d.diff || sp.get('diff') || '',
      runMode: d.runMode || sp.get('run') || sp.get('mode') || '',
      seed: d.seed || CONTEXT_BASE.seed || '',
      ts: sp.get('ts') || ''
    }, d));

    pushItem({ type:'event', meta });

    // flush frequently but not every single event if queue is huge
    if (queue.length <= 30 || (queue.length % 6 === 0)) flush();
  }

  // ---- expose small API for manual push if needed ----
  const api = {
    enabled: ENABLED,
    endpoint: ENDPOINT,
    getQueueSize: () => queue.length,
    flush,
    setContext(patch){
      // allow setting context at runtime: window.HHA_Logger.setContext({ school:'...', className:'...' })
      if (!patch) return;
      Object.assign(CONTEXT_BASE, patch);
      if (DEBUG) dbg(`context patched: ${safeJsonStringify(patch)}`);
    }
  };

  root.HHA_Logger = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Logger = api;

  // ---- init ----
  loadQueue();
  startFlushLoop();
  ensureDebugUI();

  if (DEBUG){
    dbg(`init ${ENABLED ? 'OK' : 'NO ENDPOINT'} | endpoint=${ENABLED ? 'set' : 'missing'}`);
  }

  // Bind events
  root.addEventListener('hha:log_session', onSession);
  root.addEventListener('hha:log_event', onEvent);

  // Also capture end summary if present
  root.addEventListener('hha:end', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    onEvent({ detail: Object.assign({ kind:'end_summary' }, d) });
  });

  // Flush when back online / tab hidden
  root.addEventListener('online', ()=>{ if (DEBUG) dbg('online -> flush'); flush(); });
  doc.addEventListener('visibilitychange', ()=>{
    if (doc.visibilityState === 'hidden') {
      if (DEBUG) dbg('hidden -> flush');
      flush();
    }
  });

})(window);