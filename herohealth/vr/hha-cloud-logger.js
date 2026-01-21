// === vr-fitness/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — VR-Fitness (PRODUCTION, flush-hardened)
// ✅ Endpoint via ?log= (Google Apps Script WebApp URL)
// ✅ Offline-safe queue (localStorage) + retry
// ✅ sendBeacon fallback + fetch(keepalive)
// ✅ Flush triggers: hha:flush, pagehide, visibilitychange, beforeunload
// ✅ Listens: hha:start / hha:time / hha:score / hha:window / hha:end
// ✅ Pass-through context: studyId/phase/conditionGroup/device/view/seed etc.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_CLOUD_LOGGER_VRFIT__) return;
  WIN.__HHA_CLOUD_LOGGER_VRFIT__ = true;

  const qs = (k, d=null) => { try { return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; } };
  const nowIso = () => { try { return new Date().toISOString(); } catch { return ''; } };

  // ---- Config ----
  const ENDPOINT = (qs('log','') || '').trim();   // ?log=https://script.google.com/macros/s/...
  const STUDY_ID = (qs('studyId','') || '').trim();
  const PHASE    = (qs('phase','') || '').trim();
  const COND_G   = (qs('conditionGroup','') || '').trim();
  const VIEW     = (qs('view','') || '').trim();
  const RUN      = (qs('run','') || '').trim();
  const DIFF     = (qs('diff','') || '').trim();
  const MODE     = (qs('mode','') || '').trim();
  const SEED     = (qs('seed','') || '').trim();
  const HUB      = (qs('hub','') || '').trim();
  const RESEARCH = (() => {
    const r = String(qs('research','') || '').toLowerCase();
    return r === '1' || r === 'true' || r === 'on' || !!STUDY_ID || !!ENDPOINT;
  })();

  // Queue key (per domain)
  const LS_KEY = 'HHA_LOG_QUEUE_V1';

  // Tune: how often background flush tries (ms)
  const FLUSH_INTERVAL_MS = 9000;

  // Safety: max queue length
  const MAX_Q = 800;

  // ---- Internal state ----
  let lastStartCtx = null;
  let flushTimer = null;
  let flushing = false;

  function loadQ(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') || []; }
    catch { return []; }
  }
  function saveQ(q){
    try { localStorage.setItem(LS_KEY, JSON.stringify(q)); } catch(_) {}
  }

  function getDevice(){
    const ua = navigator.userAgent || '';
    if (/Quest|Oculus|Vive|VR/i.test(ua)) return 'vrHeadset';
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
    return 'pc';
  }

  function baseCtx(extra){
    const ctx = {
      // common
      studyId: STUDY_ID,
      phase: PHASE,
      conditionGroup: COND_G,
      research: RESEARCH ? 1 : 0,

      // run context
      view: VIEW,
      run: RUN,
      diff: DIFF,
      mode: MODE,
      seed: SEED,
      hub: HUB,

      // device
      device: getDevice(),
      lang: (DOC.documentElement && DOC.documentElement.lang) ? DOC.documentElement.lang : '',

      // time
      clientTs: nowIso(),
    };

    // merge lastStartCtx if exists (gameId/gameVersion etc.)
    if (lastStartCtx && typeof lastStartCtx === 'object') {
      Object.assign(ctx, lastStartCtx);
    }

    if (extra && typeof extra === 'object') Object.assign(ctx, extra);
    return ctx;
  }

  function canSend(){
    return !!ENDPOINT && ENDPOINT.startsWith('http');
  }

  function makeEnvelope(type, data){
    return {
      type,
      ts: nowIso(),
      ctx: baseCtx(),
      data: (data && typeof data === 'object') ? data : {}
    };
  }

  function enqueue(envelope){
    const q = loadQ();
    q.push(envelope);
    // trim if too large
    if (q.length > MAX_Q) q.splice(0, q.length - MAX_Q);
    saveQ(q);
  }

  function trySendBeacon(payloadStr){
    try{
      if (!navigator.sendBeacon) return false;
      const blob = new Blob([payloadStr], { type: 'application/json' });
      return navigator.sendBeacon(ENDPOINT, blob);
    }catch(_){
      return false;
    }
  }

  async function trySendFetch(payloadStr){
    try{
      // keepalive allows sending on unload in modern browsers (still best-effort)
      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr,
        mode: 'no-cors',
        keepalive: true,
      });
      return true;
    }catch(_){
      return false;
    }
  }

  async function flushQueue(reason){
    if (!canSend()) return false;
    if (flushing) return false;

    const q = loadQ();
    if (!q.length) return true;

    flushing = true;
    try{
      // Send in small batches (safe for URLFetch on Apps Script)
      // We send a JSON object {batch:[...], reason:"..."} for one request.
      let idx = 0;
      const BATCH = 25;

      while (idx < q.length){
        const batch = q.slice(idx, idx + BATCH);
        const payload = JSON.stringify({
          batch,
          reason: reason || 'flush',
          sentAt: nowIso(),
        });

        // Prefer beacon on unload-like situations, but keep fetch as primary
        let ok = false;
        ok = await trySendFetch(payload);
        if (!ok) ok = trySendBeacon(payload);

        if (!ok){
          // stop and keep remaining
          const remain = q.slice(idx);
          saveQ(remain);
          return false;
        }

        idx += BATCH;
      }

      // all sent
      saveQ([]);
      return true;
    } finally {
      flushing = false;
    }
  }

  function ensureFlushLoop(){
    if (flushTimer) return;
    flushTimer = setInterval(()=>{ flushQueue('interval'); }, FLUSH_INTERVAL_MS);
  }

  function stopFlushLoop(){
    if (!flushTimer) return;
    clearInterval(flushTimer);
    flushTimer = null;
  }

  // ---- Event listeners ----
  function onStart(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    // keep last start context for all subsequent logs
    lastStartCtx = {
      gameId: d.gameId || d.game || d.id || '',
      gameVersion: d.gameVersion || d.version || '',
      sessionId: d.sessionId || '',      // optional if game emits; else set by end record
      timeSec: d.timeSec || d.time || 0,
      mode: d.mode || MODE,
      diff: d.diff || DIFF,
      seed: d.seed || SEED,
      view: d.view || VIEW,
      // keep any extras but avoid huge objects
    };

    enqueue(makeEnvelope('start', d));
    ensureFlushLoop();
    // attempt early flush (best-effort)
    flushQueue('start');
  }

  function onTime(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    enqueue(makeEnvelope('time', d));
  }

  function onScore(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    enqueue(makeEnvelope('score', d));
  }

  function onWindow(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    enqueue(makeEnvelope('window', d));
  }

  function onEnd(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    // Update start ctx if end provides stronger identifiers
    if (d && typeof d === 'object') {
      lastStartCtx = Object.assign({}, lastStartCtx || {}, {
        gameId: d.gameId || (lastStartCtx && lastStartCtx.gameId) || '',
        gameVersion: d.gameVersion || (lastStartCtx && lastStartCtx.gameVersion) || '',
        sessionId: d.sessionId || (lastStartCtx && lastStartCtx.sessionId) || String(Date.now()),
        timeSec: d.timeSec || (lastStartCtx && lastStartCtx.timeSec) || 0,
        mode: d.mode || (lastStartCtx && lastStartCtx.mode) || MODE,
        diff: d.diff || (lastStartCtx && lastStartCtx.diff) || DIFF,
        seed: d.seed || (lastStartCtx && lastStartCtx.seed) || SEED,
      });
    }

    enqueue(makeEnvelope('end', d));

    // Flush aggressively on end
    flushQueue('end');
  }

  function onFlush(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    flushQueue(d.reason || 'hha:flush');
  }

  WIN.addEventListener('hha:start',  onStart);
  WIN.addEventListener('hha:time',   onTime);
  WIN.addEventListener('hha:score',  onScore);
  WIN.addEventListener('hha:window', onWindow);
  WIN.addEventListener('hha:end',    onEnd);
  WIN.addEventListener('hha:flush',  onFlush);

  // ---- Lifecycle flush ----
  function onPageHide(){ flushQueue('pagehide'); }
  function onVis(){
    if (DOC.visibilityState === 'hidden') flushQueue('visibilityhidden');
  }
  function onBeforeUnload(){ flushQueue('beforeunload'); }

  WIN.addEventListener('pagehide', onPageHide);
  WIN.addEventListener('visibilitychange', onVis);
  WIN.addEventListener('beforeunload', onBeforeUnload);

  // ---- Boot: if queue exists, try flush ----
  if (loadQ().length) {
    ensureFlushLoop();
    flushQueue('boot');
  }

  // Expose minimal debug
  WIN.HHACloudLogger = {
    flush: (reason)=>flushQueue(reason||'manual'),
    queueSize: ()=>loadQ().length,
    endpoint: ENDPOINT,
    research: RESEARCH ? 1 : 0
  };

})();