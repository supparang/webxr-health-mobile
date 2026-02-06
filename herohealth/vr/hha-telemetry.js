// === /herohealth/vr/hha-telemetry.js ===
// HHA Universal Telemetry — v1.0.0 (flush-hardened)
// - Queue events + batch POST JSON to endpoint (?log=...)
// - Flush on: pagehide, beforeunload, visibilitychange(hidden)
// - Supports sendBeacon fallback
// - Adds research ctx automatically from URL + optional ctx object
// API:
//   window.HHA_Telemetry.init({ endpoint, game, runMode, diff, view, seed, time, ctx, flushEveryMs, ... })
//   window.HHA_Telemetry.event(type, data)  // enqueue
//   window.HHA_Telemetry.flush(extraSummary?) // force send now
//   window.HHA_Telemetry.stop()
//   window.HHA_Telemetry.getStatus()

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (WIN.__HHA_TELEMETRY_LOADED__) return;
  WIN.__HHA_TELEMETRY_LOADED__ = true;

  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const safeJson = (x)=>{ try{ return JSON.stringify(x); }catch(_){ return '{}'; } };

  function qsAll(){
    try{ return new URL(location.href).searchParams; }
    catch(_){ return new URLSearchParams(); }
  }

  function pickQS(q, k, def=''){
    try{
      const v = q.get(k);
      return (v === null || v === undefined) ? def : String(v);
    }catch(_){
      return def;
    }
  }

  function inferCtxFromQS(){
    const q = qsAll();
    const ctx = {
      pid: pickQS(q,'pid',''),
      studyId: pickQS(q,'studyId',''),
      phase: pickQS(q,'phase',''),
      conditionGroup: pickQS(q,'conditionGroup',''),
      runMode: pickQS(q,'run', pickQS(q,'runMode','play')),
      diff: pickQS(q,'diff','normal'),
      view: pickQS(q,'view',''),
      style: pickQS(q,'style',''),
      seed: pickQS(q,'seed',''),
      time: pickQS(q,'time',''),
      hub: pickQS(q,'hub','')
    };
    return ctx;
  }

  function merge(a,b){
    const o = Object.assign({}, a||{});
    if(b && typeof b === 'object'){
      for(const k of Object.keys(b)) o[k] = b[k];
    }
    return o;
  }

  // --- senders ---
  async function postJson(endpoint, payload){
    // try sendBeacon first if small enough and supported
    const body = safeJson(payload);
    const blob = new Blob([body], { type:'application/json' });

    try{
      if (navigator.sendBeacon && body.length <= 64*1024){
        const ok = navigator.sendBeacon(endpoint, blob);
        if (ok) return { ok:true, via:'beacon' };
      }
    }catch(_){}

    // fetch keepalive fallback
    try{
      const r = await fetch(endpoint, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body,
        keepalive:true,
        mode:'cors'
      });
      return { ok: !!r.ok, via:'fetch', status: r.status };
    }catch(e){
      return { ok:false, via:'fetch', error: String(e?.message||e) };
    }
  }

  // --- engine ---
  const S = {
    inited:false,
    endpoint:'',
    game:'',
    baseCtx:{},

    queue:[],
    maxEventsPerBatch: 60,
    maxQueueBatches: 16, // hard cap to avoid memory blow
    flushEveryMs: 2000,
    statusEveryMs: 900,

    lastFlushAt:0,
    lastStatusAt:0,
    timer:0,

    // metrics
    sentBatches:0,
    sentEvents:0,
    droppedEvents:0,
    lastSendOk:true,
    lastSendVia:'',
    lastSendStatus:0,
    lastError:'',

    // lifecycle hooks
    _onPageHide:null,
    _onBeforeUnload:null,
    _onVisChange:null
  };

  function getStatus(){
    return {
      inited:S.inited,
      endpoint:S.endpoint,
      game:S.game,
      queued:S.queue.length,
      sentBatches:S.sentBatches,
      sentEvents:S.sentEvents,
      droppedEvents:S.droppedEvents,
      lastSendOk:S.lastSendOk,
      lastSendVia:S.lastSendVia,
      lastSendStatus:S.lastSendStatus,
      lastError:S.lastError
    };
  }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  function pushEvent(type, data){
    if(!S.inited) return false;
    if(!type) return false;

    // hard cap: if queue too big, drop oldest batch-ish
    const cap = S.maxEventsPerBatch * S.maxQueueBatches;
    if(S.queue.length >= cap){
      // drop oldest 20% to recover
      const dropN = Math.max(1, Math.floor(cap * 0.2));
      S.queue.splice(0, dropN);
      S.droppedEvents += dropN;
    }

    const t = nowMs();
    const ev = {
      t: Math.round(t),
      type: String(type),
      data: (data && typeof data === 'object') ? data : { v:data }
    };
    S.queue.push(ev);
    return true;
  }

  function buildPayload(extraSummary){
    const q = qsAll();
    const ctxQS = inferCtxFromQS();

    const payload = {
      schema: 'HHA_TELEMETRY_v1',
      ts: Date.now(),
      url: location.href,
      game: S.game || pickQS(q,'game',''),
      ctx: merge(ctxQS, S.baseCtx),
      summary: (extraSummary && typeof extraSummary === 'object') ? extraSummary : null,
      events: []
    };

    // take up to maxEventsPerBatch
    const n = Math.min(S.maxEventsPerBatch, S.queue.length);
    if(n>0){
      payload.events = S.queue.splice(0, n);
    }
    return payload;
  }

  async function flush(extraSummary){
    if(!S.inited) return { ok:false, skipped:true, reason:'not_inited' };
    if(!S.endpoint) return { ok:false, skipped:true, reason:'no_endpoint' };

    // nothing to send but still allow summary flush
    if(S.queue.length === 0 && !extraSummary){
      return { ok:true, skipped:true, reason:'empty' };
    }

    const payload = buildPayload(extraSummary);
    if((payload.events?.length||0) === 0 && !payload.summary){
      return { ok:true, skipped:true, reason:'empty2' };
    }

    const res = await postJson(S.endpoint, payload);

    S.lastFlushAt = nowMs();
    S.lastSendOk = !!res.ok;
    S.lastSendVia = res.via || '';
    S.lastSendStatus = res.status || 0;
    S.lastError = res.error || '';

    if(res.ok){
      S.sentBatches++;
      S.sentEvents += (payload.events?.length||0);
    }else{
      // if failed, re-queue events to front (best effort)
      try{
        if(payload.events && payload.events.length){
          S.queue = payload.events.concat(S.queue);
        }
      }catch(_){}
    }

    // optional status event for HUD
    const t = nowMs();
    if((t - S.lastStatusAt) >= S.statusEveryMs){
      S.lastStatusAt = t;
      emit('hha:telemetry', getStatus());
    }

    return res;
  }

  function tick(){
    if(!S.inited) return;
    const t = nowMs();

    if((t - S.lastFlushAt) >= S.flushEveryMs){
      // flush batch (no summary)
      flush(null);
    }

    // schedule next
    S.timer = setTimeout(tick, Math.max(120, Math.floor(S.flushEveryMs/2)));
  }

  function bindFlushHarden(getSummaryFn){
    // avoid double bind
    unbindFlushHarden();

    const safeCall = ()=>{
      try{
        const sum = (typeof getSummaryFn === 'function') ? (getSummaryFn()||null) : null;
        flush(sum);
      }catch(_){
        flush(null);
      }
    };

    S._onPageHide = ()=>safeCall();
    S._onBeforeUnload = ()=>safeCall();
    S._onVisChange = ()=>{
      try{
        if(DOC.visibilityState === 'hidden') safeCall();
      }catch(_){}
    };

    WIN.addEventListener('pagehide', S._onPageHide);
    WIN.addEventListener('beforeunload', S._onBeforeUnload);
    DOC.addEventListener('visibilitychange', S._onVisChange);
  }

  function unbindFlushHarden(){
    try{
      if(S._onPageHide) WIN.removeEventListener('pagehide', S._onPageHide);
      if(S._onBeforeUnload) WIN.removeEventListener('beforeunload', S._onBeforeUnload);
      if(S._onVisChange) DOC.removeEventListener('visibilitychange', S._onVisChange);
    }catch(_){}
    S._onPageHide = null;
    S._onBeforeUnload = null;
    S._onVisChange = null;
  }

  function init(opts){
    opts = opts || {};
    const q = qsAll();

    // endpoint priority: opts.endpoint > ?log=
    const endpoint = String(opts.endpoint || pickQS(q,'log','') || '').trim();

    S.endpoint = endpoint;
    S.game = String(opts.game || pickQS(q,'game','') || '').trim();

    const baseCtx = merge(inferCtxFromQS(), (opts.ctx||{}));
    // overwrite with explicit opts fields if provided
    if(opts.runMode) baseCtx.runMode = String(opts.runMode);
    if(opts.diff)    baseCtx.diff = String(opts.diff);
    if(opts.view)    baseCtx.view = String(opts.view);
    if(opts.seed!==undefined) baseCtx.seed = String(opts.seed);
    if(opts.time!==undefined) baseCtx.time = String(opts.time);

    S.baseCtx = baseCtx;

    S.flushEveryMs = clamp(opts.flushEveryMs ?? 2000, 250, 8000);
    S.statusEveryMs = clamp(opts.statusEveryMs ?? 900, 250, 5000);
    S.maxEventsPerBatch = clamp(opts.maxEventsPerBatch ?? 60, 10, 200);
    S.maxQueueBatches = clamp(opts.maxQueueBatches ?? 16, 4, 80);

    S.inited = true;
    S.lastFlushAt = 0;
    S.lastStatusAt = 0;
    if(S.timer) try{ clearTimeout(S.timer); }catch(_){}
    S.timer = 0;

    // auto start ticking only if endpoint exists
    if(S.endpoint){
      S.timer = setTimeout(tick, 120);
    }

    // always bind flush harden
    bindFlushHarden(opts.getSummary);

    // also mirror game start/end events automatically (optional)
    try{
      WIN.addEventListener('hha:start', (ev)=>{
        pushEvent('hha:start', ev?.detail || {});
      }, { passive:true });
      WIN.addEventListener('hha:score', (ev)=>{
        pushEvent('hha:score', ev?.detail || {});
      }, { passive:true });
      WIN.addEventListener('hha:judge', (ev)=>{
        pushEvent('hha:judge', ev?.detail || {});
      }, { passive:true });
      WIN.addEventListener('quest:update', (ev)=>{
        pushEvent('quest:update', ev?.detail || {});
      }, { passive:true });
      WIN.addEventListener('hha:end', (ev)=>{
        // flush with summary immediately
        flush(ev?.detail || null);
      }, { passive:true });
    }catch(_){}

    // announce status
    emit('hha:telemetry', getStatus());
    return true;
  }

  function stop(){
    if(S.timer) try{ clearTimeout(S.timer); }catch(_){}
    S.timer = 0;
    unbindFlushHarden();
    S.inited = false;
  }

  // expose
  WIN.HHA_Telemetry = {
    init,
    event: pushEvent,
    flush,
    stop,
    getStatus
  };
})();