// === /herohealth/vr-groups/telemetry.js ===
// GroupsVR Telemetry — PRODUCTION (PACK 13.95)
// ✅ Modes: off | lite | full
// ✅ Throttle + batch queue
// ✅ Flush-hardened (beforeunload/pagehide/visibilitychange)
// ✅ Auto downgrade by FPS (full->lite->off) + optional recover
// ✅ Emits: window event "groups:telemetry_auto" {kind:'switch', from,to,fps}
// ✅ Safe: never throws; if endpoint missing => local-only
//
// Usage:
//   GroupsVR.Telemetry.init({ runMode:'play'|'research'|'practice', endpoint:'', flushEveryMs:2000, ... })
//   GroupsVR.Telemetry.event('name', {k:v}, level) // level: 'lite'|'full' (default full)
//   GroupsVR.Telemetry.flush('reason')
//   GroupsVR.Telemetry.setMode('lite'|'full'|'off')
// Notes:
// - In runMode 'research' or 'practice' => forced OFF by default (privacy + stability)
// - Endpoint expects your flush-log.js to provide sender if needed; here we do fetch best-effort.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};
  if (WIN.GroupsVR.Telemetry && WIN.GroupsVR.Telemetry.__loaded) return;

  const now = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  // -----------------------------
  // Internal state
  // -----------------------------
  const S = {
    __loaded: true,
    inited: false,
    runMode: 'play',
    endpoint: '',
    mode: 'full',           // 'full'|'lite'|'off'
    desiredMode: 'full',    // what user wanted; may be downgraded
    queue: [],
    maxEventsPerBatch: 60,
    maxQueueBatches: 16,
    flushEveryMs: 2000,
    statusEveryMs: 850,
    lastFlushAt: 0,
    lastStatusAt: 0,

    // FPS monitor / downgrade
    fps: 60,
    fpsEMA: 60,
    fpsMinToKeepFull: 46,
    fpsMinToKeepLite: 32,
    downgradeCooldownMs: 5500,
    lastDowngradeAt: 0,
    recoverCooldownMs: 13000,
    lastRecoverAt: 0,

    // throttle
    lastEventAt: Object.create(null),
    minGapMsLite: 220,
    minGapMsFull: 90,

    // perf loop
    _raf: 0,
    _fpsFrames: 0,
    _fpsLastT: 0,

    // timer
    _flushT: 0,
    _statusT: 0
  };

  function safeJson(x){
    try{ return JSON.stringify(x); }catch(_){ return ''; }
  }

  function emitAutoSwitch(from,to,fps){
    try{
      WIN.dispatchEvent(new CustomEvent('groups:telemetry_auto', {
        detail:{ kind:'switch', from, to, fps: Math.round(fps||0) }
      }));
    }catch(_){}
  }

  function shouldForceOff(runMode){
    // Force off in research/practice by default
    return (runMode === 'research' || runMode === 'practice');
  }

  // -----------------------------
  // FPS monitor
  // -----------------------------
  function startFPS(){
    S._fpsFrames = 0;
    S._fpsLastT = now();

    const tick = ()=>{
      S._fpsFrames++;
      const t = now();
      const dt = t - S._fpsLastT;

      if (dt >= 500){
        const fps = (S._fpsFrames * 1000) / dt;
        S.fps = fps;
        // EMA for smoother decisions
        S.fpsEMA = (S.fpsEMA * 0.78) + (fps * 0.22);

        S._fpsFrames = 0;
        S._fpsLastT = t;

        maybeAutoSwitch();
      }

      S._raf = requestAnimationFrame(tick);
    };

    S._raf = requestAnimationFrame(tick);
  }

  function stopFPS(){
    try{ cancelAnimationFrame(S._raf); }catch(_){}
    S._raf = 0;
  }

  function maybeAutoSwitch(){
    if (!S.inited) return;
    if (S.mode === 'off') return; // already off; still can recover
    const t = now();

    // downgrade
    if (t - S.lastDowngradeAt > S.downgradeCooldownMs){
      if (S.mode === 'full' && S.fpsEMA < S.fpsMinToKeepFull){
        const from = S.mode;
        S.mode = 'lite';
        S.lastDowngradeAt = t;
        emitAutoSwitch(from, S.mode, S.fpsEMA);
      } else if (S.mode === 'lite' && S.fpsEMA < S.fpsMinToKeepLite){
        const from = S.mode;
        S.mode = 'off';
        S.lastDowngradeAt = t;
        emitAutoSwitch(from, S.mode, S.fpsEMA);
      }
    }

    // recover (best effort)
    if (t - S.lastRecoverAt > S.recoverCooldownMs){
      // only recover toward desiredMode, never beyond
      if (S.desiredMode === 'full'){
        if (S.mode === 'off' && S.fpsEMA > (S.fpsMinToKeepLite + 6)){
          const from = S.mode;
          S.mode = 'lite';
          S.lastRecoverAt = t;
          emitAutoSwitch(from, S.mode, S.fpsEMA);
        } else if (S.mode === 'lite' && S.fpsEMA > (S.fpsMinToKeepFull + 6)){
          const from = S.mode;
          S.mode = 'full';
          S.lastRecoverAt = t;
          emitAutoSwitch(from, S.mode, S.fpsEMA);
        }
      } else if (S.desiredMode === 'lite'){
        if (S.mode === 'off' && S.fpsEMA > (S.fpsMinToKeepLite + 6)){
          const from = S.mode;
          S.mode = 'lite';
          S.lastRecoverAt = t;
          emitAutoSwitch(from, S.mode, S.fpsEMA);
        }
      }
    }
  }

  // -----------------------------
  // Queue + flush
  // -----------------------------
  function canSend(){
    // endpoint empty => local-only
    return !!(S.endpoint && String(S.endpoint).trim());
  }

  async function postBatch(payload){
    // Best effort sender:
    // 1) If flush-log.js provides window.GroupsVR.FlushLog.send(payload)
    // 2) else use fetch to endpoint (text/plain to reduce preflight)
    try{
      const FL = WIN.GroupsVR && WIN.GroupsVR.FlushLog;
      if (FL && typeof FL.send === 'function'){
        return await FL.send(payload, { endpoint: S.endpoint });
      }
    }catch(_){}

    try{
      if (!canSend()) return true;

      const body = safeJson(payload) || '{}';
      // no-cors => can't read response, but avoids CORS failures
      await fetch(S.endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body
      });
      return true;
    }catch(_){
      return false;
    }
  }

  function trimQueue(){
    // keep last N batches
    if (S.queue.length > S.maxQueueBatches){
      S.queue = S.queue.slice(S.queue.length - S.maxQueueBatches);
    }
  }

  function enqueueBatch(batch){
    S.queue.push(batch);
    trimQueue();
  }

  function buildEnvelope(reason){
    const ctx = (WIN.GroupsVR && WIN.GroupsVR.getResearchCtx) ? WIN.GroupsVR.getResearchCtx() : {};
    return {
      v: 'telemetry-v1',
      gameTag: 'GroupsVR',
      projectTag: 'HeroHealth',
      runMode: S.runMode,
      mode: S.mode,
      fps: Math.round(S.fpsEMA),
      ts: new Date().toISOString(),
      reason: String(reason||''),
      ctx
    };
  }

  async function flush(reason){
    try{
      if (!S.inited) return;
      if (S.mode === 'off') return;
      if (!S.queue.length) return;

      const env = buildEnvelope(reason);
      const batches = S.queue.splice(0, S.queue.length);

      const payload = { env, batches };

      const ok = await postBatch(payload);
      if (!ok){
        // if send failed, requeue only last few batches
        const keep = batches.slice(-Math.min(6, batches.length));
        S.queue = keep.concat(S.queue);
        trimQueue();
      }
    }catch(_){}
  }

  function scheduleFlushLoop(){
    clearInterval(S._flushT);
    S._flushT = setInterval(()=>{
      try{
        if (!S.inited) return;
        if (S.mode === 'off') return;
        const t = now();
        if ((t - S.lastFlushAt) >= S.flushEveryMs){
          S.lastFlushAt = t;
          flush('timer');
        }
      }catch(_){}
    }, clamp(S.flushEveryMs, 800, 6000));
  }

  function scheduleStatusLoop(){
    clearInterval(S._statusT);
    S._statusT = setInterval(()=>{
      try{
        if (!S.inited) return;
        const t = now();
        if ((t - S.lastStatusAt) >= S.statusEveryMs){
          S.lastStatusAt = t;
          // lightweight status event (lite)
          API.event('status', { fps:Math.round(S.fpsEMA), mode:S.mode }, 'lite');
        }
      }catch(_){}
    }, clamp(S.statusEveryMs, 350, 1500));
  }

  function installFlushHardened(){
    // beforeunload/pagehide/visibilitychange => flush
    const doFlush = (why)=>{ try{ flush(why); }catch(_){ } };

    try{
      WIN.addEventListener('pagehide', ()=>doFlush('pagehide'), { passive:true });
      WIN.addEventListener('beforeunload', ()=>doFlush('beforeunload'), { passive:true });
      DOC.addEventListener('visibilitychange', ()=>{
        if (DOC.visibilityState === 'hidden') doFlush('hidden');
      }, { passive:true });
    }catch(_){}
  }

  // -----------------------------
  // Throttle rules
  // -----------------------------
  function allowEvent(name, level){
    const t = now();
    const key = String(name||'') + '|' + String(level||'full');
    const last = S.lastEventAt[key] || 0;

    const gap = (level === 'lite') ? S.minGapMsLite : S.minGapMsFull;
    if ((t - last) < gap) return false;
    S.lastEventAt[key] = t;
    return true;
  }

  function levelAllowed(level){
    if (S.mode === 'off') return false;
    if (S.mode === 'lite' && level === 'full') return false;
    return true;
  }

  function normalizeLevel(level){
    level = String(level||'full').toLowerCase();
    return (level === 'lite') ? 'lite' : 'full';
  }

  // -----------------------------
  // Public API
  // -----------------------------
  const API = {
    __loaded: true,

    init(cfg = {}){
      try{
        const runMode = String(cfg.runMode || 'play').toLowerCase();
        S.runMode = (runMode === 'research') ? 'research' : (runMode === 'practice' ? 'practice' : 'play');

        S.endpoint = String(cfg.endpoint || '').trim();

        S.flushEveryMs = clamp(cfg.flushEveryMs ?? 2000, 800, 6000);
        S.maxEventsPerBatch = clamp(cfg.maxEventsPerBatch ?? 60, 20, 120);
        S.maxQueueBatches = clamp(cfg.maxQueueBatches ?? 16, 6, 40);
        S.statusEveryMs = clamp(cfg.statusEveryMs ?? 850, 350, 1500);

        // user desired mode (default full)
        const want = String(cfg.mode || 'full').toLowerCase();
        S.desiredMode = (want === 'lite') ? 'lite' : (want === 'off' ? 'off' : 'full');

        // enforce off in research/practice
        if (shouldForceOff(S.runMode)){
          S.mode = 'off';
          S.desiredMode = 'off';
        } else {
          S.mode = S.desiredMode;
        }

        S.inited = true;

        installFlushHardened();
        scheduleFlushLoop();
        scheduleStatusLoop();
        startFPS();

        // initial ping
        API.event('init', { runMode:S.runMode, mode:S.mode, endpoint: !!S.endpoint }, 'lite');
      }catch(_){}
    },

    setMode(mode){
      try{
        mode = String(mode||'full').toLowerCase();
        const next = (mode === 'lite') ? 'lite' : (mode === 'off' ? 'off' : 'full');
        const from = S.mode;
        S.mode = next;
        S.desiredMode = next;
        emitAutoSwitch(from, S.mode, S.fpsEMA);
      }catch(_){}
    },

    getMode(){
      return S.mode;
    },

    event(name, data, level='full'){
      try{
        if (!S.inited) return;

        level = normalizeLevel(level);
        if (!levelAllowed(level)) return;
        if (!allowEvent(name, level)) return;

        const rec = {
          t: Math.round(now()),
          name: String(name||''),
          level,
          data: data || {}
        };

        // batch by time window; simplest: append to last batch until limit reached
        let batch = S.queue[S.queue.length - 1];
        if (!batch || !batch.items || batch.items.length >= S.maxEventsPerBatch){
          batch = { ts: new Date().toISOString(), items: [] };
          enqueueBatch(batch);
        }
        batch.items.push(rec);
      }catch(_){}
    },

    flush(reason='manual'){
      flush(reason);
    },

    stop(){
      try{
        stopFPS();
        clearInterval(S._flushT);
        clearInterval(S._statusT);
        S._flushT = 0;
        S._statusT = 0;
        S.inited = false;
        S.queue = [];
      }catch(_){}
    }
  };

  WIN.GroupsVR.Telemetry = API;

})();