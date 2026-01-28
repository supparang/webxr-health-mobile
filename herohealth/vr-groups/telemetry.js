// === /herohealth/vr-groups/telemetry.js ===
// GroupsVR Telemetry — PRODUCTION (Pack 13.95)
// ✅ mode: off | lite | full
// ✅ throttle per event type + batch queue
// ✅ autoDowngrade by FPS (full->lite->off)
// ✅ flush-hardened: sendBeacon fallback, retry window
// ✅ emits: window event "groups:telemetry_auto" {kind:'switch', from,to,fps}
// ✅ safe no-op if endpoint missing or mode=off
//
// Public API (window.GroupsVR.Telemetry):
// - init(cfg)
// - track(type, payload, opts?)
// - mark(name, payload?)
// - setMode(mode, reason?)
// - flush(reason?)
// - getState()

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};
  if (WIN.GroupsVR.Telemetry && WIN.GroupsVR.Telemetry.__loaded__) return;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch{ return Date.now(); } };

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  // ---------- defaults ----------
  const DEF = {
    mode: 'off',            // off|lite|full
    runMode: 'play',        // play|research|practice
    endpoint: '',

    seed: '',
    diff: 'normal',
    style: 'mix',
    view: 'pc',

    flushEveryMs: 2000,
    statusEveryMs: 850,

    maxEventsPerBatch: 60,
    maxQueueBatches: 16,

    autoDowngrade: true,
    fpsWindowMs: 1800,
    fpsLiteBelow: 34,
    fpsOffBelow: 24,

    // Throttle map (ms) — prevent spam
    throttleMs: {
      'shot': 90,
      'hit': 70,
      'miss': 120,
      'judge': 180,
      'coach': 800,
      'quest': 250,
      'progress': 260,
      'power': 220,
      'time': 500,
      'score': 280,
      'ui': 400
    }
  };

  // ---------- state ----------
  const S = {
    inited: false,
    mode: 'off',
    endpoint: '',
    runMode: 'play',
    ctx: {},
    queue: [],          // array of batches {t0, events:[]}
    lastFlushMs: 0,
    lastStatusMs: 0,
    lastTypeMs: Object.create(null),

    // fps sampler
    fps: {
      enabled: false,
      lastRAF: 0,
      frames: 0,
      t0: 0,
      lastFps: 60,
      rafId: 0
    },

    // retry
    flushing: false,
    failCount: 0
  };

  // ---------- helpers ----------
  function isModeValid(m){ return (m==='off'||m==='lite'||m==='full'); }

  function baseEvent(type, payload){
    return {
      ts: Date.now(),
      type: String(type||'event'),
      runMode: S.runMode,
      mode: S.mode,
      view: S.ctx.view || 'pc',
      seed: S.ctx.seed || '',
      diff: S.ctx.diff || 'normal',
      style: S.ctx.style || 'mix',
      payload: payload || {}
    };
  }

  function ensureBatch(){
    let b = S.queue[S.queue.length-1];
    if (!b || (b.events && b.events.length >= (S.ctx.maxEventsPerBatch||DEF.maxEventsPerBatch))){
      b = { t0: Date.now(), events: [] };
      S.queue.push(b);
      if (S.queue.length > (S.ctx.maxQueueBatches||DEF.maxQueueBatches)){
        // drop oldest batch to keep memory safe
        S.queue.shift();
        emit('groups:telemetry_auto', { kind:'drop', reason:'maxQueueBatches' });
      }
    }
    return b;
  }

  function throttleOk(type){
    const t = String(type||'event');
    const map = S.ctx.throttleMs || DEF.throttleMs;
    const ms = clamp(map[t] ?? 120, 0, 5000);
    if (!ms) return true;

    const last = Number(S.lastTypeMs[t]||0);
    const n = nowMs();
    if (n - last < ms) return false;
    S.lastTypeMs[t] = n;
    return true;
  }

  function canSend(){
    if (!S.inited) return false;
    if (!S.endpoint) return false;
    if (S.mode === 'off') return false;
    return true;
  }

  // ---------- fps auto downgrade ----------
  function fpsStart(){
    if (!S.ctx.autoDowngrade) return;
    if (S.fps.rafId) return;

    S.fps.enabled = true;
    S.fps.lastRAF = 0;
    S.fps.frames = 0;
    S.fps.t0 = nowMs();

    const tick = (t)=>{
      if (!S.fps.enabled) return;
      if (!S.fps.lastRAF) S.fps.lastRAF = t;
      S.fps.frames++;

      const elapsed = t - S.fps.t0;
      const winMs = clamp(S.ctx.fpsWindowMs ?? DEF.fpsWindowMs, 800, 5000);

      if (elapsed >= winMs){
        const fps = Math.round((S.fps.frames / (elapsed/1000)) * 10) / 10;
        S.fps.lastFps = fps;
        S.fps.frames = 0;
        S.fps.t0 = t;

        // downgrade logic (only in play)
        if (S.runMode === 'play'){
          const liteBelow = Number(S.ctx.fpsLiteBelow ?? DEF.fpsLiteBelow);
          const offBelow  = Number(S.ctx.fpsOffBelow  ?? DEF.fpsOffBelow);

          if (S.mode === 'full' && fps < liteBelow){
            setModeInternal('lite', `fps<${liteBelow}`, fps);
          }else if ((S.mode === 'full' || S.mode === 'lite') && fps < offBelow){
            setModeInternal('off', `fps<${offBelow}`, fps);
          }
        }
      }

      S.fps.rafId = WIN.requestAnimationFrame(tick);
    };

    S.fps.rafId = WIN.requestAnimationFrame(tick);
  }

  function fpsStop(){
    S.fps.enabled = false;
    if (S.fps.rafId){
      try{ WIN.cancelAnimationFrame(S.fps.rafId); }catch(_){}
      S.fps.rafId = 0;
    }
  }

  function setModeInternal(next, reason, fps){
    if (!isModeValid(next)) return;
    const prev = S.mode;
    if (prev === next) return;

    S.mode = next;

    emit('groups:telemetry_auto', {
      kind:'switch',
      from: prev,
      to: next,
      reason: String(reason||''),
      fps: (typeof fps === 'number') ? fps : S.fps.lastFps
    });

    // also store a marker (no throttle)
    try{
      const b = ensureBatch();
      b.events.push(baseEvent('telemetry_mode', { from: prev, to: next, reason, fps: S.fps.lastFps }));
    }catch(_){}
  }

  // ---------- network send ----------
  async function postJson(url, body){
    // fetch first
    try{
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify(body),
        keepalive: true
      });
      return !!(r && r.ok);
    }catch(_){
      // fallback to sendBeacon
      try{
        const blob = new Blob([JSON.stringify(body)], { type:'application/json' });
        return !!navigator.sendBeacon(url, blob);
      }catch(_2){
        return false;
      }
    }
  }

  async function flush(reason){
    if (!canSend()) return false;
    if (S.flushing) return false;
    if (!S.queue.length) return true;

    S.flushing = true;

    // take one batch at a time to keep payload small
    const batch = S.queue[0];
    const payload = {
      meta: Object.assign({
        ts: Date.now(),
        reason: String(reason||'tick'),
        runMode: S.runMode,
        mode: S.mode
      }, S.ctx || {}),
      events: (batch && batch.events) ? batch.events.slice(0) : []
    };

    let ok = false;
    try{
      ok = await postJson(S.endpoint, payload);
    }catch(_){
      ok = false;
    }

    if (ok){
      S.queue.shift();
      S.failCount = 0;
    }else{
      S.failCount++;
      // if repeatedly failing, stop sending but keep minimal queue
      if (S.failCount >= 6){
        setModeInternal('off', 'network_fail', S.fps.lastFps);
        // drop old queue to avoid memory
        while (S.queue.length > 2) S.queue.shift();
      }
    }

    S.lastFlushMs = nowMs();
    S.flushing = false;
    return ok;
  }

  // ---------- API ----------
  function init(cfg){
    cfg = cfg || {};
    S.ctx = Object.assign({}, DEF, cfg);

    S.endpoint = String(S.ctx.endpoint || '');
    S.runMode  = String(S.ctx.runMode || 'play');
    S.mode     = isModeValid(S.ctx.mode) ? S.ctx.mode : DEF.mode;

    // Hard safety: research/practice force off
    if (S.runMode !== 'play') S.mode = 'off';

    S.inited = true;

    // FPS sampling only when play & autoDowngrade
    if (S.runMode === 'play' && S.ctx.autoDowngrade && S.mode !== 'off') fpsStart();
    else fpsStop();

    // periodic flush tick
    const flushEveryMs = clamp(S.ctx.flushEveryMs ?? DEF.flushEveryMs, 300, 10000);
    const statusEveryMs= clamp(S.ctx.statusEveryMs?? DEF.statusEveryMs, 350, 3000);

    // one-time marker
    try{
      const b = ensureBatch();
      b.events.push(baseEvent('telemetry_init', {
        endpoint: !!S.endpoint,
        mode: S.mode,
        runMode: S.runMode,
        view: S.ctx.view,
        diff: S.ctx.diff,
        style: S.ctx.style
      }));
    }catch(_){}

    // tick loop (lightweight)
    let alive = true;
    function tick(){
      if (!alive) return;

      const n = nowMs();

      if (canSend() && (n - S.lastFlushMs >= flushEveryMs)){
        flush('tick');
      }

      // optional status event
      if (canSend() && (n - S.lastStatusMs >= statusEveryMs)){
        S.lastStatusMs = n;
        if (S.mode !== 'off'){
          // status is lite-safe
          const b = ensureBatch();
          b.events.push(baseEvent('status', {
            fps: S.fps.lastFps,
            q: S.queue.length,
            fail: S.failCount
          }));
        }
      }

      setTimeout(tick, 180);
    }
    setTimeout(tick, 180);

    // flush on leave
    WIN.addEventListener('pagehide', ()=>{ try{ flush('pagehide'); }catch(_){ } }, {capture:true});
    WIN.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden'){ try{ flush('hidden'); }catch(_){ } }
    }, {capture:true});

    // expose shutdown
    S._stop = ()=>{ alive=false; fpsStop(); };
  }

  function track(type, payload, opts){
    if (!S.inited) return;
    if (S.mode === 'off') return;

    const t = String(type||'event');

    // lite filter: allow only some
    if (S.mode === 'lite'){
      const allow = (
        t === 'status' || t === 'telemetry_mode' ||
        t === 'judge'  || t === 'quest' || t === 'progress' ||
        t === 'score'  || t === 'time'  || t === 'power' ||
        t === 'coach'
      );
      if (!allow) return;
    }

    const bypass = !!(opts && opts.bypassThrottle);
    if (!bypass && !throttleOk(t)) return;

    const b = ensureBatch();
    b.events.push(baseEvent(t, payload||{}));
  }

  function mark(name, payload){
    // no throttle marker
    if (!S.inited) return;
    if (S.mode === 'off') return;
    try{
      const b = ensureBatch();
      b.events.push(baseEvent('mark', Object.assign({ name: String(name||'') }, payload||{})));
    }catch(_){}
  }

  function setMode(m, reason){
    if (!S.inited) return;
    const next = String(m||'').toLowerCase();
    if (!isModeValid(next)) return;

    // research/practice force off always
    if (S.runMode !== 'play'){
      if (S.mode !== 'off') setModeInternal('off', 'forced_nonplay', S.fps.lastFps);
      return;
    }

    setModeInternal(next, reason||'manual', S.fps.lastFps);

    // start/stop fps sampling based on mode
    if (S.ctx.autoDowngrade && next !== 'off') fpsStart();
    if (next === 'off') fpsStop();
  }

  function getState(){
    return {
      inited: S.inited,
      mode: S.mode,
      runMode: S.runMode,
      endpoint: !!S.endpoint,
      queueBatches: S.queue.length,
      fps: S.fps.lastFps,
      failCount: S.failCount
    };
  }

  // expose
  WIN.GroupsVR.Telemetry = {
    __loaded__: true,
    init,
    track,
    mark,
    setMode,
    flush,
    getState
  };

})();