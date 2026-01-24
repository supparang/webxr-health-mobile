// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — PRODUCTION (queue + keepalive + flush-hardened)
// ✅ Reads endpoint from ?log=
// ✅ window.HHA_LOGGER.logEvent(type, data)
// ✅ window.HHA_LOGGER.logSummary(summaryObj)
// ✅ window.HHA_LOGGER.flush({reason})  (best-effort, keepalive)
// ✅ Optional auto-hook: listens to common HHA events and logs
// ✅ Safe: never throws, no hard dependency
//
// Payload format (suggested):
// { kind:'event'|'summary', game, sessionId, runMode, ts, clientTime, url, data }
//
// Notes:
// - For Apps Script, usually POST JSON and respond quickly.
// - keepalive works best for small payloads. Logger chunks if needed.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_CLOUD_LOGGER_LOADED__) return;
  WIN.__HHA_CLOUD_LOGGER_LOADED__ = true;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const now = ()=>{ try{ return Date.now(); }catch(_){ return +new Date(); } };
  const safeJson = (o)=>{ try{ return JSON.stringify(o); }catch(_){ return ''; } };

  const ENDPOINT = String(qs('log','') || '').trim();
  const ENABLED = !!ENDPOINT;

  // Small unique id (per page load)
  const PAGE_ID = (()=>{
    const s = `${now()}_${Math.random().toString(16).slice(2)}`;
    return s;
  })();

  // ---------- Config ----------
  const CFG = {
    enabled: ENABLED,
    endpoint: ENDPOINT,
    maxQueue: 600,            // max items kept in memory
    maxBytes: 52_000,         // keepalive / typical proxy safe-ish size
    flushIntervalMs: 1500,    // background flush pacing
    retryBaseMs: 900,
    retryMaxMs: 6000,
    autoHook: true,           // listen hha:* events
    debug: false
  };

  // allow overrides via window.HHA_LOGGER_CONFIG
  try{
    if (WIN.HHA_LOGGER_CONFIG && typeof WIN.HHA_LOGGER_CONFIG === 'object'){
      Object.assign(CFG, WIN.HHA_LOGGER_CONFIG);
    }
  }catch(_){}

  // ---------- State ----------
  const S = {
    q: [],
    inflight: false,
    lastFlushAt: 0,
    retryMs: CFG.retryBaseMs,
    dropped: 0,
    lastErr: '',
    lastOkAt: 0,
    timers: { tick: null }
  };

  function dbg(...args){
    if (!CFG.debug) return;
    try{ console.log('[HHA_LOG]', ...args); }catch(_){}
  }

  // ---------- Helpers ----------
  function baseMeta(){
    return {
      pageId: PAGE_ID,
      url: String(location.href),
      ref: String(document.referrer || ''),
      ua: String(navigator.userAgent || ''),
      clientTime: now(),
      tzOffsetMin: (new Date().getTimezoneOffset ? new Date().getTimezoneOffset() : 0)
    };
  }

  function compact(obj){
    // keep payload lean
    try{
      // Drop huge stacks if any
      if (obj && obj.error && typeof obj.error === 'string' && obj.error.length > 2000){
        obj.error = obj.error.slice(0,2000) + '…';
      }
    }catch(_){}
    return obj;
  }

  function pushItem(item){
    if (!CFG.enabled) return false;

    if (S.q.length >= CFG.maxQueue){
      // drop oldest
      const dropN = Math.max(1, Math.floor(CFG.maxQueue*0.08));
      S.q.splice(0, dropN);
      S.dropped += dropN;
    }
    S.q.push(item);
    scheduleFlushSoon();
    return true;
  }

  function scheduleFlushSoon(){
    if (S.timers.tick) return;
    S.timers.tick = setTimeout(()=>{
      S.timers.tick = null;
      flush({ reason:'tick' });
    }, CFG.flushIntervalMs);
  }

  function chunkByBytes(items, maxBytes){
    // create chunks of JSON payloads under maxBytes
    const chunks = [];
    let cur = [];
    let curBytes = 2; // []
    for (const it of items){
      const js = safeJson(it);
      const b = (js ? js.length : 0) + 1;
      if (cur.length && (curBytes + b) > maxBytes){
        chunks.push(cur);
        cur = [];
        curBytes = 2;
      }
      cur.push(it);
      curBytes += b;
    }
    if (cur.length) chunks.push(cur);
    return chunks;
  }

  async function postJson(payload, keepalive){
    if (!CFG.endpoint) return false;

    const body = safeJson(payload);
    if (!body) return false;

    try{
      const res = await fetch(CFG.endpoint, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body,
        keepalive: !!keepalive,
        mode:'cors'
      });
      // even 204/200 ok; Apps Script often returns 200
      const ok = !!res && (res.status >= 200 && res.status < 300);
      if (!ok){
        S.lastErr = `HTTP ${res ? res.status : '??'}`;
        return false;
      }
      return true;
    }catch(err){
      S.lastErr = String(err && (err.message || err));
      return false;
    }
  }

  // ---------- Public APIs ----------
  function logEvent(type, data){
    try{
      const item = compact({
        kind: 'event',
        type: String(type||'event'),
        ...baseMeta(),
        data: data ?? {}
      });
      return pushItem(item);
    }catch(_){
      return false;
    }
  }

  function logSummary(summaryObj){
    try{
      const item = compact({
        kind: 'summary',
        ...baseMeta(),
        data: summaryObj ?? {}
      });
      return pushItem(item);
    }catch(_){
      return false;
    }
  }

  async function flush(opts){
    if (!CFG.enabled) return { ok:false, reason:'disabled' };
    if (S.inflight) return { ok:false, reason:'inflight' };
    if (!S.q.length) return { ok:true, reason:'empty' };

    S.inflight = true;
    const reason = (opts && opts.reason) ? String(opts.reason) : 'flush';

    // take snapshot
    const batch = S.q.splice(0, S.q.length);

    // wrap so server can handle batches
    const envelope = (items)=>compact({
      kind:'batch',
      reason,
      ...baseMeta(),
      dropped: S.dropped|0,
      items
    });

    // chunk for keepalive safety
    const chunks = chunkByBytes(batch, CFG.maxBytes);
    dbg('flush chunks', chunks.length, 'items', batch.length);

    let allOk = true;
    for (let i=0;i<chunks.length;i++){
      const payload = envelope(chunks[i]);

      // keepalive on unload-ish reasons (best effort)
      const keepalive = (reason === 'pagehide' || reason === 'beforeunload' || reason === 'visibility' || reason === 'end');

      const ok = await postJson(payload, keepalive);
      if (!ok){
        allOk = false;

        // restore remainder (include failed chunk + next)
        const remain = chunks.slice(i).flat();
        // put back to front
        S.q = remain.concat(S.q);

        // retry backoff
        S.retryMs = clamp(S.retryMs*1.35, CFG.retryBaseMs, CFG.retryMaxMs);
        dbg('flush fail', S.lastErr, 'retryMs', S.retryMs);

        setTimeout(()=>flush({ reason:'retry' }), S.retryMs);
        break;
      } else {
        S.retryMs = CFG.retryBaseMs;
        S.lastOkAt = now();
      }
    }

    S.inflight = false;
    return { ok: allOk, reason };
  }

  // ---------- Auto hooks (optional) ----------
  function hookEvents(){
    if (!CFG.autoHook) return;

    const safe = (fn)=>{ try{ fn(); }catch(_){ } };

    // score/time/judge/end are valuable
    WIN.addEventListener('hha:score', (ev)=>{
      safe(()=>logEvent('hha:score', ev.detail || {}));
    }, { passive:true });

    WIN.addEventListener('hha:time', (ev)=>{
      safe(()=>logEvent('hha:time', ev.detail || {}));
    }, { passive:true });

    WIN.addEventListener('hha:judge', (ev)=>{
      safe(()=>logEvent('hha:judge', ev.detail || {}));
    }, { passive:true });

    WIN.addEventListener('quest:update', (ev)=>{
      safe(()=>logEvent('quest:update', ev.detail || {}));
    }, { passive:true });

    WIN.addEventListener('hha:coach', (ev)=>{
      safe(()=>logEvent('hha:coach', ev.detail || {}));
    }, { passive:true });

    WIN.addEventListener('hha:end', (ev)=>{
      safe(()=>{
        const d = ev.detail || {};
        logSummary(d);
        // end flush best-effort
        flush({ reason:'end' });
      });
    }, { passive:true });

    // lifecycle flush hardening
    DOC.addEventListener('visibilitychange', ()=>{
      safe(()=>{
        if (DOC.visibilityState === 'hidden'){
          flush({ reason:'visibility' });
        }
      });
    });

    WIN.addEventListener('pagehide', ()=>{
      safe(()=>flush({ reason:'pagehide' }));
    });

    WIN.addEventListener('beforeunload', ()=>{
      safe(()=>flush({ reason:'beforeunload' }));
    });
  }

  hookEvents();

  // Expose API
  WIN.HHA_LOGGER = {
    get enabled(){ return !!CFG.enabled; },
    get endpoint(){ return CFG.endpoint; },
    get queueLength(){ return S.q.length|0; },
    get dropped(){ return S.dropped|0; },
    get lastError(){ return S.lastErr || ''; },
    logEvent,
    logSummary,
    flush
  };

  dbg('ready', { enabled: CFG.enabled, endpoint: CFG.endpoint });

})();